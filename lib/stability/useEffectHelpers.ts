/**
 * useEffect Helper Utilities
 * 
 * Provides safe wrappers for common useEffect patterns to prevent memory leaks
 */

import { useEffect, useRef, EffectCallback, DependencyList } from 'react';

/**
 * Safe useEffect with automatic cleanup tracking
 */
export function useSafeEffect(
  effect: EffectCallback,
  deps?: DependencyList
) {
  const mountedRef = useRef(true);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;

    // Run effect
    const cleanup = effect();
    cleanupRef.current = cleanup || undefined;

    return () => {
      mountedRef.current = false;
      // Run cleanup if provided
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, deps);
}

/**
 * Safe interval that automatically cleans up
 */
export function useSafeInterval(
  callback: () => void,
  delay: number | null
) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Safe timeout that automatically cleans up
 */
export function useSafeTimeout(
  callback: () => void,
  delay: number | null
) {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay === null) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = setTimeout(() => {
      savedCallback.current();
      timeoutRef.current = null;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delay]);
}

/**
 * Debounced effect - delays execution until dependencies stop changing
 */
export function useDebouncedEffect(
  effect: EffectCallback,
  deps: DependencyList,
  delay: number = 300
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear previous cleanup
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      const cleanup = effect();
      cleanupRef.current = cleanup || undefined;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, deps);
}

/**
 * Safe async effect - prevents state updates after unmount
 */
export function useSafeAsyncEffect(
  effect: () => Promise<void | (() => void)>,
  deps?: DependencyList
) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cleanup: (() => void) | void;

    const runEffect = async () => {
      try {
        cleanup = await effect();
      } catch (error) {
        if (mountedRef.current) {
          console.error('Error in async effect:', error);
        }
      }
    };

    runEffect();

    return () => {
      mountedRef.current = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, deps);
}

