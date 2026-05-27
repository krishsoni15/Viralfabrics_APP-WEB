/**
 * Console Cleanup Utility
 * 
 * Replaces console statements with logger in production
 * Use this at app initialization
 */

import { logger } from '@/lib/logger';

/**
 * Replace console methods with logger in production
 */
export function setupConsoleCleanup() {
  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv === 'production') {
    // Replace console methods with no-ops or logger
    const originalConsole = { ...console };

    console.log = (...args: any[]) => {
      logger.info(args.join(' '));
    };

    console.error = (...args: any[]) => {
      logger.error(args.join(' '), new Error(args.join(' ')));
    };

    console.warn = (...args: any[]) => {
      logger.warn(args.join(' '));
    };

    console.debug = (...args: any[]) => {
      logger.debug(args.join(' '));
    };

    console.info = (...args: any[]) => {
      logger.info(args.join(' '));
    };
  } else if (nodeEnv === 'development') {
    // Keep original console in development
    // (no changes needed, console is already available)
  }
}

/**
 * Remove console statements from code (for build-time)
 * This is a placeholder - use a build tool like babel-plugin-transform-remove-console
 */
export function removeConsoleStatements() {
  // This should be done at build time, not runtime
  // Use: babel-plugin-transform-remove-console or similar
  if (process.env.NODE_ENV === 'production') {
    // Runtime fallback (not ideal, but better than nothing)
    setupConsoleCleanup();
  }
}

