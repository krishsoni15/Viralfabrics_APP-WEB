'use server';

/**
 * Server Actions for Mill Input/Output Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import { cookies } from 'next/headers';

export type MillActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

// ============================================================================
// MILL INPUT ACTIONS
// ============================================================================

export async function createMillInput(millInputData: any): Promise<MillActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();
    const { MillInput } = await import('@/models/Mill');

    const millInput = await MillInput.create(millInputData);

    // ⚡ CACHE REVALIDATION
    revalidateTag('mill-inputs');
    revalidateTag('orders');
    revalidateTag(`order-${millInputData.order}`);
    revalidatePath('/mill-inputs');
    revalidatePath(`/orders/${millInputData.order}`);

    return {
      success: true,
      data: millInput,
      message: 'Mill input created successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create mill input error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to create mill input',
    };
  }
}

export async function updateMillInput(
  millInputId: string,
  updateData: any
): Promise<MillActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();
    const { MillInput } = await import('@/models/Mill');

    const millInput = await MillInput.findByIdAndUpdate(
      millInputId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!millInput) {
      return { success: false, message: 'Mill input not found' };
    }

    // Get order ID from millInput (handle both ObjectId and string)
    const millInputAny = millInput as any;
    const orderId = typeof millInputAny.order === 'string' 
      ? millInputAny.order 
      : millInputAny.order?._id?.toString() || millInputAny.order?.toString() || '';

    // ⚡ CACHE REVALIDATION
    revalidateTag('mill-inputs');
    revalidateTag(`mill-input-${millInputId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/mill-inputs');

    return {
      success: true,
      data: millInput,
      message: 'Mill input updated successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update mill input error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to update mill input',
    };
  }
}

export async function deleteMillInput(millInputId: string): Promise<MillActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();
    const { MillInput } = await import('@/models/Mill');

    const millInput = await MillInput.findById(millInputId).lean();
    if (!millInput) {
      return { success: false, message: 'Mill input not found' };
    }

    // Get order ID from millInput (handle both ObjectId and string)
    const millInputAny = millInput as any;
    const orderId = typeof millInputAny.order === 'string' 
      ? millInputAny.order 
      : millInputAny.order?._id?.toString() || millInputAny.order?.toString() || '';

    await MillInput.findByIdAndDelete(millInputId);

    // ⚡ CACHE REVALIDATION
    revalidateTag('mill-inputs');
    revalidateTag(`mill-input-${millInputId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/mill-inputs');

    return {
      success: true,
      message: 'Mill input deleted successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete mill input error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to delete mill input',
    };
  }
}

// ============================================================================
// MILL OUTPUT ACTIONS
// ============================================================================

export async function createMillOutput(millOutputData: any): Promise<MillActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();
    const MillOutput = (await import('@/models/MillOutput')).default;

    const millOutput = await MillOutput.create(millOutputData);

    // ⚡ CACHE REVALIDATION
    revalidateTag('mill-outputs');
    revalidateTag('orders');
    revalidateTag(`order-${millOutputData.order}`);
    revalidatePath('/mill-outputs');
    revalidatePath(`/orders/${millOutputData.order}`);

    return {
      success: true,
      data: millOutput,
      message: 'Mill output created successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create mill output error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to create mill output',
    };
  }
}

export async function updateMillOutput(
  millOutputId: string,
  updateData: any
): Promise<MillActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();
    const MillOutput = (await import('@/models/MillOutput')).default;

    const millOutput = await MillOutput.findByIdAndUpdate(
      millOutputId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!millOutput) {
      return { success: false, message: 'Mill output not found' };
    }

    // Get order ID from millOutput (handle both ObjectId and string)
    const millOutputAny = millOutput as any;
    const orderId = typeof millOutputAny.order === 'string' 
      ? millOutputAny.order 
      : millOutputAny.order?._id?.toString() || millOutputAny.order?.toString() || '';

    // ⚡ CACHE REVALIDATION
    revalidateTag('mill-outputs');
    revalidateTag(`mill-output-${millOutputId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/mill-outputs');

    return {
      success: true,
      data: millOutput,
      message: 'Mill output updated successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update mill output error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to update mill output',
    };
  }
}

export async function deleteMillOutput(millOutputId: string): Promise<MillActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();
    const MillOutput = (await import('@/models/MillOutput')).default;

    const millOutput = await MillOutput.findById(millOutputId).lean();
    if (!millOutput) {
      return { success: false, message: 'Mill output not found' };
    }

    // Get order ID from millOutput (handle both ObjectId and string)
    const millOutputAny = millOutput as any;
    const orderId = typeof millOutputAny.order === 'string' 
      ? millOutputAny.order 
      : millOutputAny.order?._id?.toString() || millOutputAny.order?.toString() || '';

    await MillOutput.findByIdAndDelete(millOutputId);

    // ⚡ CACHE REVALIDATION
    revalidateTag('mill-outputs');
    revalidateTag(`mill-output-${millOutputId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/mill-outputs');

    return {
      success: true,
      message: 'Mill output deleted successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete mill output error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to delete mill output',
    };
  }
}

