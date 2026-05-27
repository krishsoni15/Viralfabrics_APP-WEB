/**
 * Server-Side Fetch Utilities with ISR Caching
 * 
 * Use these helpers in Server Components to fetch data with Next.js ISR caching.
 * This ensures proper cache invalidation and optimal performance.
 */

import { CACHE_TAGS, CACHE_DURATIONS } from './cacheConfig';

// Base URL for API routes
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return ''; // Client-side: use relative URLs
  }
  // Server-side: use absolute URL
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Default to localhost for development
  return 'http://localhost:3000';
};

/**
 * Fetch with ISR caching for orders
 */
export async function fetchOrders(params?: {
  limit?: number;
  page?: number;
  search?: string;
  orderType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  millId?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.orderType) searchParams.set('orderType', params.orderType);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.millId) searchParams.set('millId', params.millId);

  const url = `${getBaseUrl()}/api/orders?${searchParams.toString()}`;
  
  const res = await fetch(url, {
    next: {
      tags: [CACHE_TAGS.ORDERS],
      revalidate: CACHE_DURATIONS.ORDERS_LIST,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch orders: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch single order with ISR caching
 */
export async function fetchOrder(orderId: string) {
  const url = `${getBaseUrl()}/api/orders/${orderId}`;
  
  const res = await fetch(url, {
    next: {
      tags: [CACHE_TAGS.ORDERS, CACHE_TAGS.ORDER(orderId)],
      revalidate: CACHE_DURATIONS.ORDER_DETAILS,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch order: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch parties with ISR caching
 */
export async function fetchParties(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const url = `${getBaseUrl()}/api/parties?${searchParams.toString()}`;
  
  const res = await fetch(url, {
    next: {
      tags: [CACHE_TAGS.PARTIES],
      revalidate: CACHE_DURATIONS.PARTIES,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch parties: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch qualities with ISR caching
 */
export async function fetchQualities(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const url = `${getBaseUrl()}/api/qualities?${searchParams.toString()}`;
  
  const res = await fetch(url, {
    next: {
      tags: [CACHE_TAGS.QUALITIES],
      revalidate: CACHE_DURATIONS.QUALITIES,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch qualities: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch mills with ISR caching
 */
export async function fetchMills(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const url = `${getBaseUrl()}/api/mills?${searchParams.toString()}`;
  
  const res = await fetch(url, {
    next: {
      tags: [CACHE_TAGS.MILLS],
      revalidate: CACHE_DURATIONS.MILLS,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch mills: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch dashboard stats with ISR caching
 */
export async function fetchDashboardStats(params?: {
  startDate?: string;
  endDate?: string;
  financialYear?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.financialYear) searchParams.set('financialYear', params.financialYear);

  const url = `${getBaseUrl()}/api/dashboard/stats-instant?${searchParams.toString()}`;
  
  const res = await fetch(url, {
    next: {
      tags: [CACHE_TAGS.DASHBOARD, CACHE_TAGS.STATS],
      revalidate: CACHE_DURATIONS.DASHBOARD_STATS,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch with no cache (always fresh data)
 * Use for real-time data like logs
 */
export async function fetchNoCache(url: string) {
  const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`;
  
  const res = await fetch(fullUrl, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Generic fetch with custom cache configuration
 */
export async function fetchWithCache(
  url: string,
  options: {
    tags: string[];
    revalidate?: number;
  }
) {
  const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`;
  
  const res = await fetch(fullUrl, {
    next: {
      tags: options.tags,
      revalidate: options.revalidate || 60,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.statusText}`);
  }

  return res.json();
}

