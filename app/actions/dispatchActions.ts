'use server';

/**
 * Server Actions for Dispatch Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import Dispatch from '@/models/Dispatch';
import { cookies } from 'next/headers';

export type DispatchActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

// ============================================================================
// CREATE DISPATCH
// ============================================================================

export async function createDispatch(dispatchData: any): Promise<DispatchActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const dispatch = await Dispatch.create(dispatchData);

    // ⚡ CACHE REVALIDATION
    revalidateTag('dispatches');
    revalidateTag('orders');
    revalidateTag('dashboard');
    revalidateTag(`order-${dispatchData.order}`);
    revalidatePath('/dispatch');
    revalidatePath(`/orders/${dispatchData.order}`);
    revalidatePath('/dashboard');

    return {
      success: true,
      data: dispatch,
      message: 'Dispatch created successfully',
    };
  } catch (error: any) {
    console.error('Create dispatch error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create dispatch',
    };
  }
}

// ============================================================================
// UPDATE DISPATCH
// ============================================================================

export async function updateDispatch(
  dispatchId: string,
  updateData: any
): Promise<DispatchActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const dispatch = await Dispatch.findByIdAndUpdate(
      dispatchId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!dispatch) {
      return { success: false, message: 'Dispatch not found' };
    }

    // Get order ID from dispatch (handle both ObjectId and string)
    const dispatchAny = dispatch as any;
    const orderId = typeof dispatchAny.order === 'string' 
      ? dispatchAny.order 
      : dispatchAny.order?._id?.toString() || dispatchAny.order?.toString() || '';

    // ⚡ CACHE REVALIDATION
    revalidateTag('dispatches');
    revalidateTag(`dispatch-${dispatchId}`);
    revalidateTag('orders');
    revalidateTag('dashboard');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/dispatch');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: dispatch,
      message: 'Dispatch updated successfully',
    };
  } catch (error: any) {
    console.error('Update dispatch error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update dispatch',
    };
  }
}

// ============================================================================
// DELETE DISPATCH
// ============================================================================

export async function deleteDispatch(dispatchId: string): Promise<DispatchActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const dispatch = await Dispatch.findById(dispatchId).lean();
    if (!dispatch) {
      return { success: false, message: 'Dispatch not found' };
    }

    // Get order ID from dispatch (handle both ObjectId and string)
    const dispatchAny = dispatch as any;
    const orderId = typeof dispatchAny.order === 'string' 
      ? dispatchAny.order 
      : dispatchAny.order?._id?.toString() || dispatchAny.order?.toString() || '';

    await Dispatch.findByIdAndDelete(dispatchId);

    // ⚡ CACHE REVALIDATION
    revalidateTag('dispatches');
    revalidateTag(`dispatch-${dispatchId}`);
    revalidateTag('orders');
    revalidateTag('dashboard');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/dispatch');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Dispatch deleted successfully',
    };
  } catch (error: any) {
    console.error('Delete dispatch error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete dispatch',
    };
  }
}

