/**
 * Bundle Optimization Utilities
 * 
 * Minimize client bundle size to absolute minimum
 */

import React from 'react';
import dynamic, { DynamicOptionsLoadingProps } from 'next/dynamic';

// ============================================================================
// DYNAMIC IMPORTS
// ============================================================================

/**
 * Dynamically import heavy components
 * Reduces initial bundle size
 * 
 * @example
 * const HeavyComponent = createDynamicImport(() => import('./HeavyComponent'));
 */
export function createDynamicImport<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loading?: (loadingProps: DynamicOptionsLoadingProps) => React.ReactNode;
    ssr?: boolean;
  } = {}
): React.ComponentType<any> {
  return dynamic(importFn, {
    loading: options.loading || (() => React.createElement('div', null, 'Loading...')),
    ssr: options.ssr !== false,
  });
}

// ============================================================================
// TREE SHAKING HELPERS
// ============================================================================

/**
 * Import only what you need from lodash
 * Prevents importing entire library
 * 
 * @example
 * import debounce from 'lodash/debounce';
 * import throttle from 'lodash/throttle';
 */
export const lodashImports = {
  // Use named imports instead of default
  // import { debounce } from 'lodash' ❌
  // import debounce from 'lodash/debounce' ✅
};

// ============================================================================
// CODE SPLITTING
// ============================================================================

/**
 * Lazy load routes
 * Splits code by route
 */
export function createLazyRoute(importFn: () => Promise<any>): React.ComponentType<any> {
  const { lazy, Suspense } = React;
  
  const LazyComponent = lazy(importFn);
  
  return function LazyRoute(props: any): React.ReactElement {
    return React.createElement(
      Suspense,
      { fallback: React.createElement('div', null, 'Loading...') },
      React.createElement(LazyComponent, props)
    );
  };
}

// ============================================================================
// BUNDLE ANALYSIS
// ============================================================================

/**
 * Log bundle size in development
 * Helps identify large dependencies
 */
export function analyzeBundleSize(): void {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    if ((window as any).__NEXT_DATA__) {
      const chunks = (window as any).__NEXT_DATA__.buildId;
      // Use logger instead of console.log
      import('@/lib/logger').then(({ logger }) => {
        logger.debug('[Bundle] Build ID:', { buildId: chunks });
      }).catch(() => {
        // Logger not available, skip
      });
    }
  }
}

// ============================================================================
// POLYFILL OPTIMIZATION
// ============================================================================

/**
 * Only load polyfills for browsers that need them
 * Reduces bundle size for modern browsers
 */
export function loadPolyfills() {
  if (typeof window === 'undefined') return;
  
  // Check if polyfills are needed
  const needsPolyfills = !window.Promise || !window.fetch || !Array.from;
  
  if (needsPolyfills) {
    // Dynamically load polyfills
    import('core-js/stable' as any).catch(() => {
      // Polyfills not available, continue anyway
    });
  }
}

