/**
 * MongoDB Query Optimization Utilities
 * 
 * This file contains helper functions and best practices for optimizing MongoDB queries.
 * Use these utilities to ensure consistent performance across your application.
 */

import mongoose from 'mongoose';

// ============================================================================
// QUERY TIMEOUT
// ============================================================================

/**
 * Default query timeout in milliseconds
 * Prevents hanging queries that can degrade performance
 */
export const DEFAULT_QUERY_TIMEOUT = 5000; // 5 seconds

/**
 * Apply timeout to a query
 * Usage: applyTimeout(Order.find())
 */
export function applyTimeout<T>(query: any, timeout = DEFAULT_QUERY_TIMEOUT): any {
  return query.maxTimeMS(timeout);
}

// ============================================================================
// LEAN QUERIES
// ============================================================================

/**
 * Apply lean to a query for better performance
 * .lean() returns plain JavaScript objects instead of Mongoose documents
 * This is 2-5x faster for read-only operations
 * 
 * Usage: applyLean(Order.find())
 */
export function applyLean<T>(query: any): any {
  return query.lean() as any;
}

/**
 * Apply both lean and timeout to a query
 * This is the recommended way for all read-only queries
 * 
 * Usage: optimizeQuery(Order.find())
 */
export function optimizeQuery<T>(query: any, timeout = DEFAULT_QUERY_TIMEOUT): any {
  return query.lean().maxTimeMS(timeout);
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: any;
}

/**
 * Default pagination settings
 */
export const DEFAULT_PAGINATION: Required<PaginationOptions> = {
  page: 1,
  limit: 25,
  sort: { createdAt: -1 }
};

/**
 * Apply pagination to a query
 * Usage: applyPagination(Order.find(), { page: 2, limit: 50 })
 */
export function applyPagination<T>(
  query: any,
  options: PaginationOptions = {}
): any {
  const { page, limit, sort } = { ...DEFAULT_PAGINATION, ...options };
  const skip = (page - 1) * limit;

  return query
    .sort(sort)
    .limit(limit)
    .skip(skip);
}

/**
 * Get pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Calculate pagination metadata
 * Usage: const meta = getPaginationMeta(100, 2, 25)
 */
export function getPaginationMeta(
  total: number,
  page: number = 1,
  limit: number = 25
): PaginationMeta {
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  };
}

// ============================================================================
// FIELD SELECTION
// ============================================================================

/**
 * Common field selections for different use cases
 */
export const FIELD_SELECTIONS = {
  // Order list view - minimal fields
  ORDER_LIST: '_id orderId orderType party status deliveryDate createdAt',
  
  // Order detail view - all fields
  ORDER_DETAIL: '_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status createdAt updatedAt',
  
  // Party list
  PARTY_LIST: '_id name contactName contactPhone',
  
  // Quality list
  QUALITY_LIST: '_id name description',
} as const;

/**
 * Apply field selection to a query
 * Usage: applySelect(Order.find(), FIELD_SELECTIONS.ORDER_LIST)
 */
export function applySelect(query: any, fields: string): any {
  return query.select(fields);
}

// ============================================================================
// POPULATE OPTIMIZATION
// ============================================================================

/**
 * Optimized populate configurations
 */
export const POPULATE_CONFIGS = {
  // Order with party and quality (optimized)
  ORDER_WITH_RELATIONS: [
    { path: 'party', select: '_id name contactName contactPhone' },
    { path: 'items.quality', select: '_id name' }
  ],
  
  // Minimal populate for lists
  ORDER_LIST_RELATIONS: [
    { path: 'party', select: '_id name' }
  ]
} as const;

/**
 * Apply multiple populates efficiently
 * Usage: applyPopulates(Order.find(), POPULATE_CONFIGS.ORDER_WITH_RELATIONS)
 */
export function applyPopulates(query: any, populates: any[]): any {
  let modifiedQuery = query;
  for (const populate of populates) {
    modifiedQuery = modifiedQuery.populate(populate);
  }
  return modifiedQuery;
}

// ============================================================================
// COMBINED OPTIMIZATION
// ============================================================================

/**
 * Apply all optimizations to a query at once
 * This is the RECOMMENDED way to query for lists
 * 
 * Usage:
 * const orders = await optimizeListQuery(
 *   Order.find({ status: 'pending' }),
 *   {
 *     page: 1,
 *     limit: 25,
 *     fields: FIELD_SELECTIONS.ORDER_LIST,
 *     populates: POPULATE_CONFIGS.ORDER_LIST_RELATIONS
 *   }
 * );
 */
export async function optimizeListQuery<T>(
  query: any,
  options: {
    page?: number;
    limit?: number;
    sort?: any;
    fields?: string;
    populates?: any[];
    timeout?: number;
  } = {}
): Promise<T[]> {
  let optimizedQuery = query;

  // Apply field selection
  if (options.fields) {
    optimizedQuery = applySelect(optimizedQuery, options.fields);
  }

  // Apply populates
  if (options.populates) {
    optimizedQuery = applyPopulates(optimizedQuery, options.populates);
  }

  // Apply pagination
  optimizedQuery = applyPagination(optimizedQuery, {
    page: options.page,
    limit: options.limit,
    sort: options.sort
  });

  // Apply lean and timeout
  optimizedQuery = optimizeQuery(optimizedQuery, options.timeout);

  return await optimizedQuery;
}

/**
 * Optimized query for single document
 * 
 * Usage:
 * const order = await optimizeDetailQuery(
 *   Order.findById(id),
 *   {
 *     fields: FIELD_SELECTIONS.ORDER_DETAIL,
 *     populates: POPULATE_CONFIGS.ORDER_WITH_RELATIONS
 *   }
 * );
 */
export async function optimizeDetailQuery<T>(
  query: any,
  options: {
    fields?: string;
    populates?: any[];
    timeout?: number;
  } = {}
): Promise<T | null> {
  let optimizedQuery = query;

  // Apply field selection
  if (options.fields) {
    optimizedQuery = applySelect(optimizedQuery, options.fields);
  }

  // Apply populates
  if (options.populates) {
    optimizedQuery = applyPopulates(optimizedQuery, options.populates);
  }

  // Apply lean and timeout
  optimizedQuery = optimizeQuery(optimizedQuery, options.timeout);

  return await optimizedQuery;
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

/**
 * Create an optimized aggregation pipeline
 * Usage: await optimizeAggregation(Order, pipeline)
 */
export async function optimizeAggregation<T>(
  model: mongoose.Model<any>,
  pipeline: any[],
  options: {
    timeout?: number;
    allowDiskUse?: boolean;
  } = {}
): Promise<T[]> {
  const { timeout = DEFAULT_QUERY_TIMEOUT, allowDiskUse = false } = options;

  return await model.aggregate(pipeline)
    .option({ maxTimeMS: timeout, allowDiskUse })
    .exec();
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
// ====== Example 1: Optimized Order List Query ======
const orders = await optimizeListQuery(
  Order.find({ status: 'pending' }),
  {
    page: 1,
    limit: 25,
    fields: FIELD_SELECTIONS.ORDER_LIST,
    populates: POPULATE_CONFIGS.ORDER_LIST_RELATIONS,
    sort: { createdAt: -1 }
  }
);

// ====== Example 2: Optimized Order Detail Query ======
const order = await optimizeDetailQuery(
  Order.findById(orderId),
  {
    fields: FIELD_SELECTIONS.ORDER_DETAIL,
    populates: POPULATE_CONFIGS.ORDER_WITH_RELATIONS
  }
);

// ====== Example 3: Manual Optimization ======
const orders = await Order.find({ status: 'pending' })
  .select(FIELD_SELECTIONS.ORDER_LIST)
  .populate('party', '_id name')
  .sort({ createdAt: -1 })
  .limit(25)
  .skip(0)
  .lean()
  .maxTimeMS(5000);

// ====== Example 4: Optimized Aggregation ======
const stats = await optimizeAggregation(Order, [
  { $match: { status: 'pending' } },
  { $group: { _id: '$orderType', count: { $sum: 1 } } }
]);
*/

// ============================================================================
// PERFORMANCE TIPS
// ============================================================================

/*
🚀 PERFORMANCE TIPS:

1. **Always use .lean() for read-only queries**
   - 2-5x faster than regular queries
   - Returns plain JavaScript objects

2. **Always add .maxTimeMS()**
   - Prevents hanging queries
   - Default: 5000ms (5 seconds)

3. **Use field selection (.select())**
   - Only fetch fields you need
   - Reduces network overhead

4. **Optimize populates**
   - Only populate fields you need
   - Use select in populate: .populate('party', '_id name')

5. **Use pagination**
   - Always limit results
   - Default: 25 items per page

6. **Use indexes**
   - Add compound indexes for common queries
   - See models/Order.ts for examples

7. **Use aggregation for complex queries**
   - Faster than multiple queries
   - Use $lookup instead of populate

8. **Avoid n+1 queries**
   - Use populate or $lookup
   - Fetch related data in one query
*/

