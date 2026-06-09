/**
 * Simple in-memory rate limiter for API routes
 * For production, consider using Redis-based rate limiting
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request should be allowed
   * @param identifier - Unique identifier (e.g., IP address, user ID)
   * @returns Object with allowed status and remaining requests
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const record = this.store[identifier];

    // Clean up expired records periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      this.cleanup(now);
    }

    if (!record || now > record.resetTime) {
      // Create new record
      this.store[identifier] = {
        count: 1,
        resetTime: now + this.windowMs
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs
      };
    }

    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      };
    }

    record.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * Clean up expired records
   */
  private cleanup(now: number): void {
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    delete this.store[identifier];
  }
}

// Create rate limiters for different endpoints
export const samplingRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute
export const weaverRateLimiter = samplingRateLimiter;
export const uploadRateLimiter = new RateLimiter(60000, 20); // 20 uploads per minute

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: Request): string {
  // Try to get IP from headers (works with most proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  return ip;
}

/**
 * Rate limit middleware for API routes
 */
export function rateLimit(
  limiter: RateLimiter,
  identifier: string
): { allowed: boolean; remaining: number; resetTime: number } {
  return limiter.check(identifier);
}

