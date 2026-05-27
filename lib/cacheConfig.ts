/**
 * Cache Configuration and Utilities
 * 
 * Centralized cache configuration for the application
 * with helpers for cache management and ISR setup.
 */

// ============================================================================
// CACHE DURATIONS (in seconds)
// ============================================================================

export const CACHE_DURATIONS = {
  // Static Data (rarely changes) - 1 hour
  PARTIES: 3600,
  QUALITIES: 3600,
  PROCESSES: 3600,
  MILLS: 3600,
  
  // Semi-Dynamic Data - 5 minutes
  ORDERS_LIST: 300,
  FABRICS_LIST: 300,
  USERS_LIST: 300,
  
  // Dynamic Data - 30 seconds
  DASHBOARD_STATS: 30,
  ORDER_DETAILS: 30,
  
  // Real-time Data - no cache
  LOGS: 0,
  LIVE_ACTIVITY: 0,
} as const;

// ============================================================================
// CACHE TAGS
// ============================================================================

export const CACHE_TAGS = {
  // Main entities
  ORDERS: 'orders',
  FABRICS: 'fabrics',
  PARTIES: 'parties',
  QUALITIES: 'qualities',
  USERS: 'users',
  MILLS: 'mills',
  PROCESSES: 'processes',
  
  // Related data
  DASHBOARD: 'dashboard',
  STATS: 'stats',
  LOGS: 'logs',
  
  // Specific items (use with ID)
  ORDER: (id: string) => `order-${id}`,
  FABRIC: (id: string) => `fabric-${id}`,
  PARTY: (id: string) => `party-${id}`,
  QUALITY: (id: string) => `quality-${id}`,
  USER: (id: string) => `user-${id}`,
} as const;

// ============================================================================
// FETCH OPTIONS HELPERS
// ============================================================================

/**
 * Get fetch options with cache configuration for lists
 * Usage: fetch('/api/orders', getFetchOptions('orders'))
 */
export function getFetchOptions(
  tags: string[],
  revalidate?: number
): RequestInit {
  return {
    next: {
      tags,
      revalidate: revalidate ?? CACHE_DURATIONS.ORDERS_LIST,
    },
  };
}

/**
 * Get fetch options with no cache (always fresh)
 * Usage: fetch('/api/logs', getNoStoreOptions())
 */
export function getNoStoreOptions(): RequestInit {
  return {
    cache: 'no-store',
  };
}

/**
 * Get fetch options for static data (rarely changes)
 * Usage: fetch('/api/parties', getStaticOptions(['parties']))
 */
export function getStaticOptions(tags: string[]): RequestInit {
  return {
    next: {
      tags,
      revalidate: CACHE_DURATIONS.PARTIES,
    },
  };
}

/**
 * Get fetch options for dynamic data (changes frequently)
 * Usage: fetch('/api/dashboard', getDynamicOptions(['dashboard']))
 */
export function getDynamicOptions(tags: string[]): RequestInit {
  return {
    next: {
      tags,
      revalidate: CACHE_DURATIONS.DASHBOARD_STATS,
    },
  };
}

// ============================================================================
// API RESPONSE CACHE HEADERS
// ============================================================================

/**
 * Get cache headers for API responses
 * Usage: return Response.json(data, { headers: getCacheHeaders(60) })
 */
export function getCacheHeaders(maxAge: number = 60): HeadersInit {
  return {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
  };
}

/**
 * Get no-cache headers for API responses
 * Usage: return Response.json(data, { headers: getNoCacheHeaders() })
 */
export function getNoCacheHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
// ====== IN API ROUTES ======

// Example 1: Orders API with cache tags
export async function GET(request: NextRequest) {
  const orders = await Order.find().lean();
  
  return Response.json(
    { success: true, data: orders },
    { headers: getCacheHeaders(CACHE_DURATIONS.ORDERS_LIST) }
  );
}

// Example 2: Dashboard with short cache
export async function GET() {
  const stats = await getStats();
  
  return Response.json(
    { success: true, data: stats },
    { headers: getCacheHeaders(CACHE_DURATIONS.DASHBOARD_STATS) }
  );
}

// ====== IN CLIENT COMPONENTS ======

// Example 1: Fetch with cache tags
const res = await fetch('/api/orders', getFetchOptions([CACHE_TAGS.ORDERS]));

// Example 2: Fetch with no cache (always fresh)
const res = await fetch('/api/logs', getNoStoreOptions());

// Example 3: Fetch with long cache
const res = await fetch('/api/parties', getStaticOptions([CACHE_TAGS.PARTIES]));

// ====== IN SERVER ACTIONS ======

import { revalidateTag } from 'next/cache';

export async function createOrder(data) {
  'use server';
  
  await Order.create(data);
  
  // Revalidate related caches
  revalidateTag(CACHE_TAGS.ORDERS);
  revalidateTag(CACHE_TAGS.DASHBOARD);
}
*/

