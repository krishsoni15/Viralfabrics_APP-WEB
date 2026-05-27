'use server';

/**
 * Server Actions for Grey Info Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import GreyInfo from '@/models/GreyInfo';
import { cookies } from 'next/headers';

export type GreyInfoActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

// ============================================================================
// CREATE GREY INFO
// ============================================================================

export async function createGreyInfo(greyInfoData: any): Promise<GreyInfoActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const greyInfo = await GreyInfo.create(greyInfoData);

    // ⚡ CACHE REVALIDATION
    revalidateTag('grey-info');
    revalidateTag('orders');
    revalidateTag(`order-${greyInfoData.order}`);
    revalidatePath('/grey-info');
    revalidatePath(`/orders/${greyInfoData.order}`);

    return {
      success: true,
      data: greyInfo,
      message: 'Grey info created successfully',
    };
  } catch (error: any) {
    console.error('Create grey info error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create grey info',
    };
  }
}

// ============================================================================
// UPDATE GREY INFO
// ============================================================================

export async function updateGreyInfo(
  greyInfoId: string,
  updateData: any
): Promise<GreyInfoActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const greyInfo = await GreyInfo.findByIdAndUpdate(
      greyInfoId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!greyInfo) {
      return { success: false, message: 'Grey info not found' };
    }

    // Get order ID from greyInfo (handle both ObjectId and string)
    const greyInfoAny = greyInfo as any;
    const orderId = typeof greyInfoAny.order === 'string' 
      ? greyInfoAny.order 
      : greyInfoAny.order?._id?.toString() || greyInfoAny.order?.toString() || '';

    // ⚡ CACHE REVALIDATION
    revalidateTag('grey-info');
    revalidateTag(`grey-info-${greyInfoId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/grey-info');

    return {
      success: true,
      data: greyInfo,
      message: 'Grey info updated successfully',
    };
  } catch (error: any) {
    console.error('Update grey info error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update grey info',
    };
  }
}

// ============================================================================
// DELETE GREY INFO
// ============================================================================

export async function deleteGreyInfo(greyInfoId: string): Promise<GreyInfoActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const greyInfo = await GreyInfo.findById(greyInfoId).lean();
    if (!greyInfo) {
      return { success: false, message: 'Grey info not found' };
    }

    // Get order ID from greyInfo (handle both ObjectId and string)
    const greyInfoAny = greyInfo as any;
    const orderId = typeof greyInfoAny.order === 'string' 
      ? greyInfoAny.order 
      : greyInfoAny.order?._id?.toString() || greyInfoAny.order?.toString() || '';

    await GreyInfo.findByIdAndDelete(greyInfoId);

    // ⚡ CACHE REVALIDATION
    revalidateTag('grey-info');
    revalidateTag(`grey-info-${greyInfoId}`);
    revalidateTag('orders');
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders/${orderId}`);
    }
    revalidatePath('/grey-info');

    return {
      success: true,
      message: 'Grey info deleted successfully',
    };
  } catch (error: any) {
    console.error('Delete grey info error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete grey info',
    };
  }
}

