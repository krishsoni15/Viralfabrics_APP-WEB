// Shared in-memory cache for qualities data
export const qualitiesCache = new Map<string, { data: any; timestamp: number }>();
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

