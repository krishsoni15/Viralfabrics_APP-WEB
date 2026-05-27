'use server';

/**
 * Server Actions for Party Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import Party from '@/models/Party';
import { cookies } from 'next/headers';
import { CACHE_TAGS } from '@/lib/cacheConfig';

export type PartyActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

export async function createParty(partyData: any): Promise<PartyActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const party = await Party.create(partyData);

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.PARTIES);
    revalidateTag(CACHE_TAGS.ORDERS); // Parties affect orders
    revalidatePath('/parties');

    return {
      success: true,
      data: party,
      message: 'Party created successfully',
    };
  } catch (error: any) {
    console.error('Create party error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create party',
    };
  }
}

export async function updateParty(
  partyId: string,
  updateData: any
): Promise<PartyActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const party = await Party.findByIdAndUpdate(
      partyId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!party) {
      return { success: false, message: 'Party not found' };
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.PARTIES);
    revalidateTag(CACHE_TAGS.PARTY(partyId));
    revalidateTag(CACHE_TAGS.ORDERS); // Party changes affect orders
    revalidatePath('/parties');
    revalidatePath(`/parties/${partyId}`);

    return {
      success: true,
      data: party,
      message: 'Party updated successfully',
    };
  } catch (error: any) {
    console.error('Update party error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update party',
    };
  }
}

export async function deleteParty(partyId: string): Promise<PartyActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const party = await Party.findByIdAndDelete(partyId);

    if (!party) {
      return { success: false, message: 'Party not found' };
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.PARTIES);
    revalidateTag(CACHE_TAGS.PARTY(partyId));
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidatePath('/parties');

    return {
      success: true,
      message: 'Party deleted successfully',
    };
  } catch (error: any) {
    console.error('Delete party error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete party',
    };
  }
}

