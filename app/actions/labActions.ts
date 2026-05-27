'use server';

/**
 * Server Actions for Lab Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import Lab from '@/models/Lab';
import { cookies } from 'next/headers';

export type LabActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

// ============================================================================
// CREATE LAB
// ============================================================================

export async function createLab(labData: any): Promise<LabActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const lab = await Lab.create(labData);

    // ⚡ CACHE REVALIDATION
    revalidateTag('labs');
    revalidateTag('orders'); // Labs affect order details
    revalidateTag(`order-${labData.order}`);
    revalidatePath('/labs');
    revalidatePath(`/orders/${labData.order}`);

    return {
      success: true,
      data: lab,
      message: 'Lab data created successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create lab error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to create lab data',
    };
  }
}

// ============================================================================
// UPDATE LAB
// ============================================================================

export async function updateLab(
  labId: string,
  updateData: any
): Promise<LabActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const lab = await Lab.findByIdAndUpdate(
      labId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!lab) {
      return { success: false, message: 'Lab data not found' };
    }

    // Get order ID from lab (handle both ObjectId and string)
    const labAny = lab as any;
    const orderId = typeof labAny.order === 'string' 
      ? labAny.order 
      : labAny.order?._id?.toString() || labAny.order?.toString() || '';

    // ⚡ CACHE REVALIDATION
    revalidateTag('labs');
    revalidateTag(`lab-${labId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/labs');

    return {
      success: true,
      data: lab,
      message: 'Lab data updated successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update lab error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to update lab data',
    };
  }
}

// ============================================================================
// DELETE LAB
// ============================================================================

export async function deleteLab(labId: string): Promise<LabActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const lab = await Lab.findById(labId).lean();
    if (!lab) {
      return { success: false, message: 'Lab data not found' };
    }

    // Get order ID from lab (handle both ObjectId and string)
    const labAny = lab as any;
    const orderId = typeof labAny.order === 'string' 
      ? labAny.order 
      : labAny.order?._id?.toString() || labAny.order?.toString() || '';

    await Lab.findByIdAndDelete(labId);

    // ⚡ CACHE REVALIDATION
    revalidateTag('labs');
    revalidateTag(`lab-${labId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/labs');

    return {
      success: true,
      message: 'Lab data deleted successfully',
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete lab error:', error);
    }
    return {
      success: false,
      message: error.message || 'Failed to delete lab data',
    };
  }
}

