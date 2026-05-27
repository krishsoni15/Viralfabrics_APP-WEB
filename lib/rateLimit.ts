/**
 * Rate Limiting Middleware
 * 
 * Provides protection against brute force attacks and API abuse.
 * Uses Redis (Upstash) for distributed rate limiting with in-memory fallback.
 */

import { NextRequest } from 'next/server';

// Try to use Redis, fallback to in-memory if not configured
let Ratelimit: any;
let Redis: any;
let redis: any;
let useRedis = false;

try {
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    const upstash = require('@upstash/ratelimit');
    const upstashRedis = require('@upstash/redis');
    Ratelimit = upstash.Ratelimit;
    Redis = upstashRedis.Redis;
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });
    useRedis = true;
  }
} catch (error) {
  console.warn('Redis not available, using in-memory rate limiting');
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  blockDurationMs?: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// In-memory store for fallback
const rateLimitStore = new Map<string, RateLimitRecord>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime && (!record.blockedUntil || now > record.blockedUntil)) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'anonymous';
}

// Redis-backed rate limiters
let loginRateLimiterRedis: any;
let apiRateLimiterRedis: any;
let strictRateLimiterRedis: any;
let writeRateLimiterRedis: any;

if (useRedis && Ratelimit) {
  loginRateLimiterRedis = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: '@upstash/ratelimit:login',
  });

  apiRateLimiterRedis = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit:api',
  });

  strictRateLimiterRedis = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit:strict',
  });

  writeRateLimiterRedis = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit:write',
  });
}

// In-memory rate limiter (fallback)
function createInMemoryRateLimiter(config: RateLimitConfig) {
  const { 
    windowMs, 
    max, 
    blockDurationMs = 0,
    keyGenerator = getClientIP 
  } = config;

  return async function checkRateLimit(req: NextRequest): Promise<RateLimitResult> {
    cleanupExpiredEntries();
    
    const key = keyGenerator(req);
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (record?.blockedUntil && now < record.blockedUntil) {
      return {
        success: false,
        remaining: 0,
        resetTime: record.blockedUntil,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      };
    }
    
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
      
      return {
        success: true,
        remaining: max - 1,
        resetTime: record.resetTime,
      };
    }
    
    if (record.count >= max) {
      if (blockDurationMs > 0) {
        record.blockedUntil = now + blockDurationMs;
        rateLimitStore.set(key, record);
      }
      
      return {
        success: false,
        remaining: 0,
        resetTime: record.blockedUntil || record.resetTime,
        retryAfter: Math.ceil(((record.blockedUntil || record.resetTime) - now) / 1000),
      };
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    
    return {
      success: true,
      remaining: max - record.count,
      resetTime: record.resetTime,
    };
  };
}

// Pre-configured rate limiters
export const loginRateLimiter = useRedis && loginRateLimiterRedis
  ? async (req: NextRequest) => {
      const ip = getClientIP(req);
      const result = await loginRateLimiterRedis.limit(ip);
      return {
        success: result.success,
        remaining: result.remaining,
        resetTime: result.reset ? result.reset.getTime() : Date.now() + 15 * 60 * 1000,
        retryAfter: result.reset ? Math.ceil((result.reset.getTime() - Date.now()) / 1000) : undefined,
      };
    }
  : createInMemoryRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 5,
      blockDurationMs: 30 * 60 * 1000,
    });

export const apiRateLimiter = useRedis && apiRateLimiterRedis
  ? async (req: NextRequest) => {
      const ip = getClientIP(req);
      const result = await apiRateLimiterRedis.limit(ip);
      return {
        success: result.success,
        remaining: result.remaining,
        resetTime: result.reset ? result.reset.getTime() : Date.now() + 60 * 1000,
        retryAfter: result.reset ? Math.ceil((result.reset.getTime() - Date.now()) / 1000) : undefined,
      };
    }
  : createInMemoryRateLimiter({
      windowMs: 60 * 1000,
      max: 100,
    });

export const strictRateLimiter = useRedis && strictRateLimiterRedis
  ? async (req: NextRequest) => {
      const ip = getClientIP(req);
      const result = await strictRateLimiterRedis.limit(ip);
      return {
        success: result.success,
        remaining: result.remaining,
        resetTime: result.reset ? result.reset.getTime() : Date.now() + 60 * 1000,
        retryAfter: result.reset ? Math.ceil((result.reset.getTime() - Date.now()) / 1000) : undefined,
      };
    }
  : createInMemoryRateLimiter({
      windowMs: 60 * 1000,
      max: 10,
    });

export const writeRateLimiter = useRedis && writeRateLimiterRedis
  ? async (req: NextRequest) => {
      const ip = getClientIP(req);
      const result = await writeRateLimiterRedis.limit(ip);
      return {
        success: result.success,
        remaining: result.remaining,
        resetTime: result.reset ? result.reset.getTime() : Date.now() + 60 * 1000,
        retryAfter: result.reset ? Math.ceil((result.reset.getTime() - Date.now()) / 1000) : undefined,
      };
    }
  : createInMemoryRateLimiter({
      windowMs: 60 * 1000,
      max: 30,
    });

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };
  
  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  
  return headers;
}

export async function checkRateLimitOrError(
  req: NextRequest,
  limiter: (req: NextRequest) => Promise<RateLimitResult> = apiRateLimiter
): Promise<Response | null> {
  const result = await limiter(req);
  
  if (!result.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getRateLimitHeaders(result),
        },
      }
    );
  }
  
  return null;
}
