'use server';

/**
 * Server Actions for Sampling Module
 * These run on the server and can be called from Server Components
 * 
 * Note: These use the service layer for business logic
 */

import { cookies, headers } from 'next/headers';
import { getWeavers, getWeaverById } from '@/app/(pages)/(dashboard)/sampling/lib/services/weaverService';
import { getSamples } from '@/app/(pages)/(dashboard)/sampling/lib/services/sampleService';

// Helper to check authentication from cookies/headers
async function checkAuth() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const token = headersList.get('authorization')?.split(' ')[1] || cookieStore.get('token')?.value;
  return !!token;
}

/**
 * Server Action: Fetch weavers with pagination
 * This runs on the server and can be called from Server Components
 * @param params - Query parameters (page, limit, search, sort)
 * @returns Response object with success status, data array, and pagination info
 */
export async function fetchWeaversAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'newest' | 'oldest';
}) {
  try {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      return {
        success: false,
        message: 'Unauthorized',
        data: [],
        pagination: null
      };
    }

    // Use service layer for business logic
    const result = await getWeavers({
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort
    });
    
    return {
      success: true,
      data: result.weavers,
      pagination: result.pagination
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch weavers',
      data: [],
      pagination: null
    };
  }
}

/**
 * Server Action: Fetch samples with pagination
 * @param params - Query parameters (weaverId, page, limit, search)
 * @returns Response object with success status, data array, and pagination info
 */
export async function fetchSamplesAction(params: {
  weaverId?: string;
  page?: number;
  limit?: number;
  search?: string;
}) {
  try {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      return {
        success: false,
        message: 'Unauthorized',
        data: [],
        pagination: null
      };
    }

    // Use service layer for business logic
    const result = await getSamples({
      weaverId: params.weaverId,
      page: params.page,
      limit: params.limit,
      search: params.search
    });
    
    return {
      success: true,
      data: result.samples,
      pagination: result.pagination
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch samples',
      data: [],
      pagination: null
    };
  }
}

/**
 * Server Action: Fetch single weaver by ID
 * @param weaverId - MongoDB ObjectId string
 * @returns Response object with success status and weaver data
 */
export async function fetchWeaverAction(weaverId: string) {
  try {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      return {
        success: false,
        message: 'Unauthorized',
        data: null
      };
    }

    // Use service layer for business logic
    const weaver = await getWeaverById(weaverId);
    
    return {
      success: true,
      data: weaver
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch weaver',
      data: null
    };
  }
}

