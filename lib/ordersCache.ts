// Simple in-memory cache for frequently accessed orders data
export const queryCache = new Map<string, { data: any; timestamp: number }>();
export const CACHE_TTL = 30 * 1000; // 30 seconds cache

export function clearOrdersCache() {
  queryCache.clear();
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️ Orders cache cleared');
  }
}
