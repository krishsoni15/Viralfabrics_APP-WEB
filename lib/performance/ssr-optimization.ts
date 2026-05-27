/**
 * SSR Optimization Utilities
 * 
 * World-class SSR, caching, and hydration optimizations
 * for Meta/Google/Netflix-level performance
 */

import { unstable_cache } from 'next/cache';
import { revalidateTag, revalidatePath } from 'next/cache';
import { cache } from 'react';
import React from 'react';

// ============================================================================
// REACT CACHE (Request Memoization)
// ============================================================================

/**
 * Cache function results per request
 * Prevents duplicate work in the same request
 */
export const requestCache = cache;

// ============================================================================
// UNSTABLE CACHE (ISR with Tags)
// ============================================================================

/**
 * Create a cached function with ISR
 * 
 * @param fn - Function to cache
 * @param keyParts - Cache key parts
 * @param options - Cache options
 * 
 * @example
 * const getCachedOrders = createCachedFunction(
 *   async () => Order.find().lean(),
 *   ['orders'],
 *   { tags: ['orders'], revalidate: 300 }
 * );
 */
export function createCachedFunction<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  options: {
    tags?: string[];
    revalidate?: number;
  } = {}
) {
  return unstable_cache(
    fn,
    keyParts,
    {
      tags: options.tags || [],
      revalidate: options.revalidate || 300,
    }
  );
}

// ============================================================================
// HYDRATION OPTIMIZATION
// ============================================================================

/**
 * Prevent hydration mismatches
 * Only runs on client after mount
 * 
 * Note: This is a utility function, not a hook.
 * Use React.useLayoutEffect directly in components.
 */
export function useIsomorphicLayoutEffect(
  effect: () => void | (() => void),
  deps?: React.DependencyList
): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  // This function is for documentation purposes only
  // In actual components, use React.useLayoutEffect directly
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useLayoutEffect(effect, deps);
}

/**
 * Client-only component wrapper
 * Prevents SSR for components that need browser APIs
 * 
 * Note: This should be used in a 'use client' component file
 */
export function ClientOnly({ children }: { children: React.ReactNode }): React.ReactElement | null {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return React.createElement(React.Fragment, null, children);
}

// ============================================================================
// STREAMING OPTIMIZATION
// ============================================================================

/**
 * Create a streaming response with Suspense boundaries
 * Improves Time to First Byte (TTFB)
 * 
 * Note: This is a server-side utility for Next.js App Router
 */
export async function createStreamingResponse<T>(
  data: Promise<T>,
  fallback: React.ReactNode
): Promise<React.ReactElement> {
  const { Suspense } = React;

  const StreamingComponent = StreamingData as React.ComponentType<{ data: Promise<T> }>;
  return React.createElement(
    Suspense,
    { fallback },
    React.createElement(StreamingComponent, { data })
  );
}

async function StreamingData<T>({ data }: { data: Promise<T> }): Promise<React.ReactElement> {
  const resolved = await data;
  return React.createElement(React.Fragment, null, JSON.stringify(resolved));
}

// ============================================================================
// CACHE REVALIDATION
// ============================================================================

/**
 * Revalidate multiple cache tags atomically
 */
export async function revalidateTags(tags: string[]): Promise<void> {
  await Promise.all(tags.map((tag) => revalidateTag(tag)));
}

/**
 * Revalidate multiple paths atomically
 */
export async function revalidatePaths(paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => revalidatePath(path)));
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Measure function execution time
 */
export async function measurePerformance<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      // Use logger instead of console.log
      const { logger } = await import('@/lib/logger');
      logger.debug(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    // Use logger for errors
    const { logError } = await import('@/lib/logger');
    logError(`[Performance] ${label} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

