// Shared cache utility for parties data
export const partiesCache = new Map<string, { data: any; timestamp: number }>();
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance

export function clearPartiesCache() {
  partiesCache.clear();
}
