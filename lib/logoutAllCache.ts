/**
 * In-memory cache for logout-all timestamp
 * This dramatically speeds up logout-all checks by avoiding database queries
 */

interface CacheEntry {
  timestamp: Date | null;
  cachedAt: number;
  triggeredBy?: string;
}

// Cache with 5 second TTL (short enough to be fresh, long enough to reduce DB load)
const CACHE_TTL_MS = 5000; // 5 seconds
let cache: CacheEntry | null = null;

/**
 * Get cached logout-all timestamp
 * Returns null if cache is empty or expired
 */
export function getCachedLogoutAllTimestamp(): Date | null | undefined {
  if (!cache) {
    return undefined; // Cache miss - need to fetch from DB
  }

  const now = Date.now();
  const age = now - cache.cachedAt;

  if (age > CACHE_TTL_MS) {
    // Cache expired
    cache = null;
    return undefined; // Cache miss - need to fetch from DB
  }

  return cache.timestamp;
}

/**
 * Set cached logout-all timestamp
 */
export function setCachedLogoutAllTimestamp(timestamp: Date | null, triggeredBy?: string): void {
  cache = {
    timestamp,
    cachedAt: Date.now(),
    triggeredBy,
  };
}

/**
 * Invalidate cache (call this when logout-all is triggered)
 */
export function invalidateLogoutAllCache(): void {
  cache = null;
}

/**
 * Get cached triggeredBy value
 */
export function getCachedTriggeredBy(): string | undefined {
  if (!cache) {
    return undefined;
  }

  const now = Date.now();
  const age = now - cache.cachedAt;

  if (age > CACHE_TTL_MS) {
    cache = null;
    return undefined;
  }

  return cache.triggeredBy;
}

