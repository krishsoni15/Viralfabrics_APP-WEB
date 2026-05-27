/**
 * Race Condition Prevention
 * 
 * Utilities to prevent duplicate requests, concurrent operations, and race conditions
 */

/**
 * Prevents duplicate function calls
 */
export function createDeduplicator<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const pending = new Map<string, Promise<any>>();

  return (async (...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    // If already pending, return existing promise
    if (pending.has(key)) {
      return pending.get(key);
    }

    // Create new promise
    const promise = fn(...args).finally(() => {
      pending.delete(key);
    });

    pending.set(key, promise);
    return promise;
  }) as T;
}

/**
 * Prevents concurrent executions of the same function
 */
export function createMutexedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  let isExecuting = false;
  let pendingResolve: Array<() => void> = [];

  return (async (...args: Parameters<T>) => {
    if (isExecuting) {
      // Wait for current execution to finish
      return new Promise<any>((resolve) => {
        pendingResolve.push(() => resolve(fn(...args)));
      });
    }

    isExecuting = true;
    try {
      const result = await fn(...args);
      return result;
    } finally {
      isExecuting = false;
      // Execute pending calls
      const resolvers = pendingResolve;
      pendingResolve = [];
      resolvers.forEach((resolve) => resolve());
    }
  }) as T;
}

/**
 * Request deduplication for API calls
 */
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  clear() {
    this.pending.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();

/**
 * Prevents multiple simultaneous form submissions
 */
export function createSubmissionGuard() {
  let isSubmitting = false;

  return {
    guard: async <T>(fn: () => Promise<T>): Promise<T> => {
      if (isSubmitting) {
        throw new Error('Submission already in progress');
      }

      isSubmitting = true;
      try {
        return await fn();
      } finally {
        isSubmitting = false;
      }
    },
    isSubmitting: () => isSubmitting,
  };
}

/**
 * Prevents duplicate fetches with same parameters
 */
export function createFetchDeduplicator() {
  const cache = new Map<string, { promise: Promise<any>; timestamp: number }>();
  const TTL = 1000; // 1 second cache

  return async <T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const now = Date.now();
    const cached = cache.get(key);

    // Return cached promise if still valid
    if (cached && now - cached.timestamp < TTL) {
      return cached.promise;
    }

    // Create new promise
    const promise = fn().finally(() => {
      // Clean up old entries
      const expired = Array.from(cache.entries()).filter(
        ([, value]) => now - value.timestamp >= TTL
      );
      expired.forEach(([key]) => cache.delete(key));
    });

    cache.set(key, { promise, timestamp: now });
    return promise;
  };
}

export const fetchDeduplicator = createFetchDeduplicator();

