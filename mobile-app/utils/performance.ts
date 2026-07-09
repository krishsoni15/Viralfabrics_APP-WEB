import { useRef, useEffect } from 'react';

/**
 * Performance measurement utilities for development.
 * All logging is gated behind __DEV__ so there is zero overhead in production.
 */

/**
 * Hook that counts how many times a component renders.
 * Usage: useRenderCount('OrdersScreen');
 * Output: [Perf] OrdersScreen rendered 3 times
 */
export function useRenderCount(componentName: string) {
  const count = useRef(0);
  count.current++;

  if (__DEV__) {
    console.log(`[Perf] ${componentName} rendered ${count.current} times`);
  }
}

/**
 * Hook that logs how long a useEffect callback takes to execute.
 * Usage: useTimedEffect('SessionRestore', () => { ... }, []);
 */
export function useTimedEffect(
  label: string,
  effect: () => void | (() => void),
  deps: React.DependencyList
) {
  useEffect(() => {
    if (__DEV__) {
      const start = performance.now();
      const cleanup = effect();
      const duration = performance.now() - start;
      console.log(`[Perf] ${label} took ${duration.toFixed(1)}ms`);
      return cleanup ?? undefined;
    }
    return effect() ?? undefined;
  }, deps);
}

/**
 * Measures and logs a synchronous block of code.
 * Usage: measureSync('filterOrders', () => { ...heavy computation... });
 */
export function measureSync<T>(label: string, fn: () => T): T {
  if (__DEV__) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    console.log(`[Perf] ${label}: ${duration.toFixed(1)}ms`);
    return result;
  }
  return fn();
}

/**
 * Measures and logs an async operation.
 * Usage: await measureAsync('fetchOrders', () => api.get('/orders'));
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (__DEV__) {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`[Perf] ${label}: ${duration.toFixed(1)}ms`);
    return result;
  }
  return fn();
}
