'use server';

/**
 * Server Actions for Fabric Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import Fabric from '@/models/Fabric';
import { cookies } from 'next/headers';
import { CACHE_TAGS } from '@/lib/cacheConfig';

export type FabricActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

export async function createFabric(fabricData: any): Promise<FabricActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const fabric = await Fabric.create(fabricData);

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.FABRICS);
    revalidateTag(CACHE_TAGS.ORDERS); // Fabrics affect orders
    revalidatePath('/fabrics');

    return {
      success: true,
      data: fabric,
      message: 'Fabric created successfully',
    };
  } catch (error: any) {
    console.error('Create fabric error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create fabric',
    };
  }
}

export async function updateFabric(
  fabricId: string,
  updateData: any
): Promise<FabricActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const fabric = await Fabric.findByIdAndUpdate(
      fabricId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!fabric) {
      return { success: false, message: 'Fabric not found' };
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.FABRICS);
    revalidateTag(CACHE_TAGS.FABRIC(fabricId));
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidatePath('/fabrics');
    revalidatePath(`/fabrics/${fabricId}`);

    return {
      success: true,
      data: fabric,
      message: 'Fabric updated successfully',
    };
  } catch (error: any) {
    console.error('Update fabric error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update fabric',
    };
  }
}

export async function deleteFabric(fabricId: string): Promise<FabricActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const fabric = await Fabric.findByIdAndDelete(fabricId);

    if (!fabric) {
      return { success: false, message: 'Fabric not found' };
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.FABRICS);
    revalidateTag(CACHE_TAGS.FABRIC(fabricId));
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidatePath('/fabrics');

    return {
      success: true,
      message: 'Fabric deleted successfully',
    };
  } catch (error: any) {
    console.error('Delete fabric error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete fabric',
    };
  }
}

