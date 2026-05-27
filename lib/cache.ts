/**
 * Distributed Caching with Redis (Upstash) with in-memory fallback
 */

// Try to use Redis, fallback to in-memory if not configured
let Redis: any;
let redis: any;
let useRedis = false;

try {
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    const upstashRedis = require('@upstash/redis');
    Redis = upstashRedis.Redis;
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });
    useRedis = true;
  }
} catch (error) {
  console.warn('Redis not available, using in-memory caching');
}

// In-memory fallback cache
const memoryCache = new Map<string, { data: any; expires: number }>();

// Cleanup expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupMemoryCache(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, value] of memoryCache.entries()) {
    if (now > value.expires) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Get cached value or fetch and cache
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  if (useRedis && redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        try {
          return typeof cached === 'string' ? JSON.parse(cached) : cached;
        } catch {
          return cached as T;
        }
      }
      
      const data = await fetcher();
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
      return data;
    } catch (error) {
      console.warn('Redis cache error, falling back to fetcher:', error);
      return fetcher();
    }
  } else {
    // In-memory fallback
    cleanupMemoryCache();
    const cached = memoryCache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    
    const data = await fetcher();
    memoryCache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
    return data;
  }
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (useRedis && redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.warn('Redis invalidation error:', error);
    }
  } else {
    // In-memory fallback
    cleanupMemoryCache();
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern) || pattern === '*') {
        memoryCache.delete(key);
      }
    }
  }
}

/**
 * Set cache value directly
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 60
): Promise<void> {
  if (useRedis && redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.warn('Redis set error:', error);
    }
  } else {
    // In-memory fallback
    cleanupMemoryCache();
    memoryCache.set(key, {
      data: value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }
}

/**
 * Get cache value directly
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (useRedis && redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        try {
          return typeof cached === 'string' ? JSON.parse(cached) : cached;
        } catch {
          return cached as T;
        }
      }
      return null;
    } catch (error) {
      console.warn('Redis get error:', error);
      return null;
    }
  } else {
    // In-memory fallback
    cleanupMemoryCache();
    const cached = memoryCache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    return null;
  }
}

