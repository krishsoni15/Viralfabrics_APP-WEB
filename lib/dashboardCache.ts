/**
 * Dashboard Cache Invalidation Utility
 * Clears in-memory dashboard cache when orders are created/updated/deleted
 */

// Clear dashboard in-memory cache
export function clearDashboardCache(): void {
  try {
    // Clear global cache map
    if (typeof (global as any).dashboardCacheMap !== 'undefined') {
      (global as any).dashboardCacheMap.clear();
      if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ Dashboard cache cleared (global map)');
      }
    }
    
    // Clear legacy cache
    if (typeof (global as any).dashboardCache !== 'undefined') {
      (global as any).dashboardCache = {
        data: null,
        timestamp: 0,
        ttl: 30 * 1000
      };
      if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ Dashboard cache cleared (legacy cache)');
      }
    }
  } catch (error) {
    // Silent fail - cache clearing shouldn't break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to clear dashboard cache:', error);
    }
  }
}

// Invalidate dashboard cache and trigger refresh
export async function invalidateDashboardCache(): Promise<void> {
  clearDashboardCache();
  
  // Also revalidate Next.js cache tags
  try {
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const { CACHE_TAGS } = await import('@/lib/cacheConfig');
    
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidatePath('/dashboard');
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Dashboard cache invalidated (Next.js cache)');
    }
  } catch (error) {
    // Silent fail - revalidation shouldn't break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to revalidate dashboard cache:', error);
    }
  }
}

