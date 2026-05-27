/**
 * Centralized Performance Utilities
 * 
 * Provides reusable functions for caching, querying, and cache invalidation
 * to ensure consistent performance optimization across the application.
 */

import { unstable_cache } from 'next/cache';
import { revalidateTag, revalidatePath } from 'next/cache';
import dbConnect from './dbConnect';

// ============================================================================
// CACHED FETCH
// ============================================================================

/**
 * Fetch with ISR caching
 * @param url - API route URL
 * @param tag - Cache tag for revalidation
 * @param revalidate - Revalidation time in seconds (default: 30)
 */
export async function cachedFetch(
  url: string,
  tag: string,
  revalidate: number = 30
): Promise<Response> {
  const baseUrl = typeof window !== 'undefined' 
    ? '' 
    : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  return fetch(`${baseUrl}${url}`, {
    next: {
      tags: [tag],
      revalidate
    }
  });
}

// ============================================================================
// LEAN QUERY HELPERS
// ============================================================================

/**
 * Execute a lean query with connection pooling
 * @param model - Mongoose model
 * @param query - MongoDB query
 * @param projection - Field projection (optional)
 * @param options - Additional query options
 */
export async function dbLeanQuery<T>(
  model: any,
  query: any = {},
  projection: any = {},
  options: { timeout?: number; sort?: any; limit?: number; skip?: number } = {}
): Promise<T[]> {
  await dbConnect();
  
  let queryBuilder = model.find(query, projection).lean();
  
  if (options.sort) {
    queryBuilder = queryBuilder.sort(options.sort);
  }
  
  if (options.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }
  
  if (options.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }
  
  if (options.timeout) {
    queryBuilder = queryBuilder.maxTimeMS(options.timeout);
  } else {
    queryBuilder = queryBuilder.maxTimeMS(5000); // Default 5s timeout
  }
  
  return queryBuilder;
}

/**
 * Execute a lean findOne query
 */
export async function dbLeanFindOne<T>(
  model: any,
  query: any = {},
  projection: any = {},
  timeout: number = 5000
): Promise<T | null> {
  await dbConnect();
  return model.findOne(query, projection).lean().maxTimeMS(timeout);
}

// ============================================================================
// CACHE REVALIDATION WRAPPER
// ============================================================================

/**
 * Execute a function and revalidate caches after completion
 * @param fn - Function to execute
 * @param tags - Cache tags to revalidate
 * @param paths - Paths to revalidate (optional)
 */
export async function withRevalidate<T>(
  fn: () => Promise<T>,
  tags: string[],
  paths?: string[]
): Promise<T> {
  const result = await fn();
  
  // Revalidate all tags in parallel
  await Promise.all(tags.map(tag => revalidateTag(tag)));
  
  // Revalidate paths if provided
  if (paths) {
    await Promise.all(paths.map(path => revalidatePath(path)));
  }
  
  return result;
}

// ============================================================================
// UNSTABLE_CACHE HELPERS
// ============================================================================

/**
 * Get cached immutable data using unstable_cache
 * Use for static or rarely-changing data (qualities, mills, processes)
 */
export function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  revalidate: number = 3600 // 1 hour default
): Promise<T> {
  return unstable_cache(
    async () => {
      await dbConnect();
      return await fetchFn();
    },
    [key],
    { revalidate }
  )();
}

// ============================================================================
// PERFORMANCE LOGGING & MEASUREMENT
// ============================================================================

/**
 * Log performance metrics for a route
 */
export function logPerformance(
  routeName: string,
  startTime: number,
  metadata?: Record<string, any>
): void {
  const duration = Date.now() - startTime;
  
  // Only log in development or if explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_PERF_LOGS === 'true') {
    console.log(`[PERF] ${routeName}: ${duration}ms`, metadata || '');
  }
}

/**
 * Measure the execution time of an async function
 * @param fn - Async function to measure
 * @param name - Name for logging
 * @returns Object with result and duration
 */
export async function measure<T>(
  fn: () => Promise<T>,
  name: string = 'operation'
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;
  
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_PERF_LOGS === 'true') {
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  return { result, duration };
}

/**
 * Measure database query performance
 */
export async function measureDB<T>(
  fn: () => Promise<T>,
  queryName: string = 'query'
): Promise<{ result: T; dbTime: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const dbTime = end - start;
  
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_PERF_LOGS === 'true') {
    console.log(`[DB] ${queryName}: ${dbTime.toFixed(2)}ms`);
  }
  
  return { result, dbTime };
}

/**
 * Create a performance timer
 */
export function createTimer(name: string = 'operation') {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_PERF_LOGS === 'true') {
        console.log(`[TIMER] ${name}: ${duration.toFixed(2)}ms`);
      }
      return duration;
    },
    getElapsed: () => performance.now() - start
  };
}

// ============================================================================
// BATCH QUERY OPTIMIZATION
// ============================================================================

/**
 * Fetch related documents in batch (replacement for populate)
 * @param model - Mongoose model
 * @param ids - Array of document IDs
 * @param projection - Field projection
 */
export async function batchFetch<T>(
  model: any,
  ids: any[],
  projection: any = {}
): Promise<Map<string, T>> {
  if (!ids || ids.length === 0) {
    return new Map();
  }
  
  await dbConnect();
  
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  
  const documents = await model
    .find({ _id: { $in: uniqueIds } }, projection)
    .lean()
    .maxTimeMS(2000);
  
  return new Map(documents.map((doc: any) => [doc._id.toString(), doc]));
}

// ============================================================================
// AGGREGATION WITH LOOKUP (REPLACEMENT FOR POPULATE)
// ============================================================================

/**
 * Create a $lookup aggregation pipeline for joining collections
 * @param from - Collection name to join
 * @param localField - Field in current collection
 * @param foreignField - Field in joined collection (default: '_id')
 * @param as - Output field name
 * @param projection - Fields to include from joined collection
 */
export function createLookupStage(
  from: string,
  localField: string,
  foreignField: string = '_id',
  as: string,
  projection?: Record<string, number>
): any[] {
  const pipeline: any[] = [
    {
      $lookup: {
        from,
        localField,
        foreignField,
        as
      }
    },
    {
      $unwind: {
        path: `$${as}`,
        preserveNullAndEmptyArrays: true
      }
    }
  ];
  
  // Add projection if specified
  if (projection) {
    pipeline.push({
      $project: {
        ...Object.fromEntries(
          Object.entries(projection).map(([key, value]) => [`${as}.${key}`, value])
        )
      }
    });
  }
  
  return pipeline;
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
// Example 1: Cached fetch
const response = await cachedFetch('/api/orders', 'orders', 300);
const data = await response.json();

// Example 2: Lean query
const orders = await dbLeanQuery(Order, { status: 'pending' }, {}, {
  sort: { createdAt: -1 },
  limit: 50,
  timeout: 2000
});

// Example 3: With revalidation
const order = await withRevalidate(
  async () => await Order.create(orderData),
  ['orders', 'dashboard'],
  ['/orders', '/dashboard']
);

// Example 4: Cached immutable data
const qualities = await getCachedData(
  'qualities-list',
  async () => await Quality.find().lean(),
  3600 // 1 hour
);

// Example 5: Batch fetch (replacement for populate)
const partyIds = orders.map(o => o.party);
const parties = await batchFetch(Party, partyIds, { name: 1, contactName: 1 });
orders.forEach(order => {
  order.party = parties.get(order.party?.toString());
});

// Example 6: Performance logging
const start = Date.now();
const result = await someOperation();
logPerformance('/api/orders', start, { count: result.length });
*/

