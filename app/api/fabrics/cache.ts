// NO CACHING - All caching has been removed from fabrics page
// This file is kept for compatibility but exports are no longer used
export const fabricCache = new Map<string, { data: any; timestamp: number }>();
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - NOT USED

