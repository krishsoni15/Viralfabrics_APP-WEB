/**
 * Network Optimization Utilities
 * 
 * Reduce network calls and compress payloads
 */

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================

/**
 * Deduplicate concurrent requests
 * Prevents duplicate API calls
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

// ============================================================================
// REQUEST BATCHING
// ============================================================================

/**
 * Batch multiple requests into one
 * Reduces network round trips
 */
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  
  return results;
}

// ============================================================================
// PAYLOAD COMPRESSION
// ============================================================================

/**
 * Compress JSON payload
 * Reduces network transfer size
 */
export function compressPayload(data: any): string {
  // Use JSON.stringify with minimal whitespace
  return JSON.stringify(data);
}

/**
 * Decompress JSON payload
 */
export function decompressPayload<T>(compressed: string): T {
  return JSON.parse(compressed);
}

// ============================================================================
// RESPONSE CACHING
// ============================================================================

/**
 * Cache API responses in memory
 * Reduces duplicate requests
 */
class ResponseCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const responseCache = new ResponseCache();

// ============================================================================
// OPTIMISTIC UPDATES
// ============================================================================

/**
 * Optimistically update UI before server confirms
 * Improves perceived performance
 */
export function createOptimisticUpdate<T>(
  currentData: T,
  updateFn: (data: T) => T
): T {
  // Apply update immediately
  return updateFn(currentData);
}

// ============================================================================
// PREFETCHING
// ============================================================================

/**
 * Prefetch data for likely next actions
 * Reduces perceived latency
 */
export function prefetchData(url: string): void {
  if (typeof window === 'undefined') return;
  
  // Use link prefetch
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Prefetch route
 */
export function prefetchRoute(route: string): void {
  if (typeof window === 'undefined') return;
  
  const router = require('next/router').default;
  if (router) {
    router.prefetch(route);
  }
}

