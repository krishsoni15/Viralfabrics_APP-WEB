/**
 * Database Query Optimizations
 * 
 * Centralized utilities for optimized database queries
 * Reduces server load and improves response times
 */

import { Model, FilterQuery, QueryOptions } from 'mongoose';

// ============================================================================
// QUERY OPTIMIZATION HELPERS
// ============================================================================

/**
 * Optimized find query with lean, selective fields, and timeout
 */
export async function optimizedFind<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  options: {
    select?: string;
    sort?: any;
    skip?: number;
    limit?: number;
    maxTimeMS?: number;
    lean?: boolean;
  } = {}
): Promise<T[]> {
  const {
    select,
    sort,
    skip,
    limit,
    maxTimeMS = 3000,
    lean = true,
  } = options;

  let queryBuilder: any = model.find(query);

  if (select) {
    queryBuilder = queryBuilder.select(select);
  }

  if (sort) {
    queryBuilder = queryBuilder.sort(sort);
  }

  if (skip !== undefined) {
    queryBuilder = queryBuilder.skip(skip);
  }

  if (limit !== undefined) {
    queryBuilder = queryBuilder.limit(limit);
  }

  if (lean) {
    queryBuilder = queryBuilder.lean() as any;
  }

  queryBuilder = queryBuilder.maxTimeMS(maxTimeMS);

  const result = await queryBuilder.exec();
  return result as unknown as T[];
}

/**
 * Optimized count query with timeout
 */
export async function optimizedCount<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  maxTimeMS: number = 2000
): Promise<number> {
  return model.countDocuments(query).maxTimeMS(maxTimeMS).exec();
}

/**
 * Optimized findOne query
 */
export async function optimizedFindOne<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  options: {
    select?: string;
    maxTimeMS?: number;
    lean?: boolean;
  } = {}
): Promise<T | null> {
  const { select, maxTimeMS = 2000, lean = true } = options;

  let queryBuilder: any = model.findOne(query);

  if (select) {
    queryBuilder = queryBuilder.select(select);
  }

  if (lean) {
    queryBuilder = queryBuilder.lean() as any;
  }

  queryBuilder = queryBuilder.maxTimeMS(maxTimeMS);

  const result = await queryBuilder.exec();
  return result as unknown as T | null;
}

/**
 * Batch fetch related documents (faster than populate)
 */
export async function batchFetchRelated<T>(
  model: Model<T>,
  ids: string[],
  options: {
    select?: string;
    maxTimeMS?: number;
  } = {}
): Promise<Map<string, T>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { select, maxTimeMS = 2000 } = options;

  let queryBuilder = model.find({ _id: { $in: ids } } as FilterQuery<T>);

  if (select) {
    queryBuilder = queryBuilder.select(select);
  }

  const documents = await queryBuilder
    .lean()
    .maxTimeMS(maxTimeMS)
    .exec();

  return new Map(
    documents.map((doc: any) => [(doc._id as any).toString(), doc as T])
  );
}

/**
 * Parallel query execution with error handling
 */
export async function parallelQueries<T extends readonly unknown[]>(
  queries: [...{ [K in keyof T]: () => Promise<T[K]> }]
): Promise<{ [K in keyof T]: T[K] | null }> {
  const results = await Promise.allSettled(
    queries.map((query) => query())
  );

  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  ) as { [K in keyof T]: T[K] | null };
}

/**
 * Optimized aggregation with timeout
 */
export async function optimizedAggregate<T>(
  model: Model<T>,
  pipeline: any[],
  maxTimeMS: number = 5000
): Promise<any[]> {
  return model.aggregate(pipeline).option({ maxTimeMS }).exec();
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Create cache key from query params
 */
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
}

/**
 * Check if cache is valid
 */
export function isCacheValid(
  timestamp: number,
  ttl: number = 300000 // 5 minutes default
): boolean {
  return Date.now() - timestamp < ttl;
}

// ============================================================================
// QUERY BUILDING HELPERS
// ============================================================================

/**
 * Build date range query
 */
export function buildDateRangeQuery(
  field: string,
  startDate?: string,
  endDate?: string
): any {
  if (!startDate && !endDate) {
    return {};
  }

  const query: any = {};
  if (startDate || endDate) {
    query[field] = {};
    if (startDate) {
      query[field].$gte = new Date(startDate);
    }
    if (endDate) {
      query[field].$lte = new Date(endDate);
    }
  }

  return query;
}

/**
 * Build search query
 */
export function buildSearchQuery(
  fields: string[],
  searchTerm: string
): any {
  if (!searchTerm?.trim()) {
    return {};
  }

  const trimmedTerm = searchTerm.trim();
  if (fields.length === 1) {
    return {
      [fields[0]]: { $regex: trimmedTerm, $options: 'i' },
    };
  }

  return {
    $or: fields.map((field) => ({
      [field]: { $regex: trimmedTerm, $options: 'i' },
    })),
  };
}

/**
 * Build pagination params
 */
export function buildPagination(
  page?: string | number,
  limit?: string | number,
  maxLimit: number = 100
): { skip: number; limit: number; page: number } {
  const pageNum = Math.max(parseInt(String(page || 1)), 1);
  const limitNum = Math.min(
    Math.max(parseInt(String(limit || 25)), 1),
    maxLimit
  );
  const skip = (pageNum - 1) * limitNum;

  return {
    skip,
    limit: limitNum,
    page: pageNum,
  };
}

// ============================================================================
// INDEX RECOMMENDATIONS
// ============================================================================

/**
 * Recommended indexes for optimal query performance
 * Run these in MongoDB shell or migration script
 */
export const RECOMMENDED_INDEXES = {
  orders: [
    { orderId: 1 }, // Unique index (already exists)
    { status: 1, createdAt: -1 }, // Compound for status filtering
    { orderType: 1, status: 1 }, // Compound for type and status
    { party: 1, status: 1 }, // Compound for party filtering
    { arrivalDate: 1 }, // For date range queries
    { deliveryDate: 1 }, // For delivery date queries
    { softDeleted: 1, createdAt: -1 }, // For active orders
    { orderId: 'text', poNumber: 'text', styleNo: 'text' }, // Text search
  ],
  parties: [
    { name: 1 }, // Unique index (already exists)
    { isActive: 1, name: 1 }, // Compound for active parties
    { category: 1, isActive: 1 }, // Compound for category filtering
    { name: 'text' }, // Text search
  ],
  qualities: [
    { name: 1 }, // For name lookups
    { code: 1 }, // Sparse unique (if exists)
    { name: 'text' }, // Text search
  ],
  mills: [
    { name: 1 }, // For name lookups
    { isActive: 1, name: 1 }, // Compound for active mills
    { name: 'text' }, // Text search
  ],
  millInputs: [
    { order: 1 }, // For order lookups
    { mill: 1 }, // For mill lookups
    { order: 1, mill: 1 }, // Compound
    { millDate: 1 }, // For date queries
  ],
  millOutputs: [
    { order: 1 }, // For order lookups
    { recdDate: 1 }, // For date queries
    { order: 1, recdDate: -1 }, // Compound
  ],
  dispatches: [
    { order: 1 }, // For order lookups
    { dispatchDate: 1 }, // For date queries
    { order: 1, dispatchDate: -1 }, // Compound
  ],
  greyInfo: [
    { order: 1 }, // For order lookups
    { order: 1, itemIndex: 1 }, // Compound
  ],
  labs: [
    { order: 1 }, // For order lookups
    { order: 1, itemIndex: 1 }, // Compound
    { labSendDate: 1 }, // For date queries
    { approvalDate: 1 }, // For date queries
  ],
};

/**
 * Generate index creation commands
 */
export function generateIndexCommands(): string[] {
  const commands: string[] = [];

  Object.entries(RECOMMENDED_INDEXES).forEach(([collection, indexes]) => {
    indexes.forEach((index) => {
      const indexStr = JSON.stringify(index);
      commands.push(`db.${collection}.createIndex(${indexStr});`);
    });
  });

  return commands;
}

