'use server';

/**
 * Server Actions for User Operations with Automatic Cache Revalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { cookies } from 'next/headers';

export type UserActionResult = {
  success: boolean;
  data?: any;
  message?: string;
  errors?: string[];
};

// ============================================================================
// CREATE USER
// ============================================================================

export async function createUser(userData: any): Promise<UserActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const user = await User.create(userData);

    // Remove password from response
    const { password, ...userWithoutPassword } = user.toObject();

    // ⚡ CACHE REVALIDATION
    revalidateTag('users');
    revalidatePath('/users');

    return {
      success: true,
      data: userWithoutPassword,
      message: 'User created successfully',
    };
  } catch (error: any) {
    console.error('Create user error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create user',
    };
  }
}

// ============================================================================
// UPDATE USER
// ============================================================================

export async function updateUser(
  userId: string,
  updateData: any
): Promise<UserActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password')
      .lean();

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag('users');
    revalidateTag(`user-${userId}`);
    revalidatePath('/users');
    revalidatePath(`/users/${userId}`);

    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  } catch (error: any) {
    console.error('Update user error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update user',
    };
  }
}

// ============================================================================
// DELETE USER
// ============================================================================

export async function deleteUser(userId: string): Promise<UserActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (!sessionToken) {
      return { success: false, message: 'Unauthorized - Please login' };
    }

    await dbConnect();

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag('users');
    revalidateTag(`user-${userId}`);
    revalidatePath('/users');

    return {
      success: true,
      message: 'User deleted successfully',
    };
  } catch (error: any) {
    console.error('Delete user error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete user',
    };
  }
}

