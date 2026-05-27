/**
 * Server-Side Error Handling
 * 
 * Ensures all server operations have proper error handling and logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { errorResponse, ERROR_CODES } from '@/lib/api/response';

/**
 * Wraps async route handler with comprehensive error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Log error (non-blocking)
      try {
        logError(
          'Unhandled error in route handler',
          error instanceof Error ? error : new Error(String(error)),
          {
            url: (args[0] as NextRequest)?.url,
            method: (args[0] as NextRequest)?.method,
          }
        );
      } catch {
        // Don't block on logging errors
      }

      // Return standardized error response
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred';

      return NextResponse.json(
        errorResponse(errorMessage, ERROR_CODES.INTERNAL_ERROR),
        { status: 500 }
      );
    }
  };
}

/**
 * Wraps database operations with timeout and error handling
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  timeout: number = 5000,
  errorMessage: string = 'Database operation failed'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${errorMessage}: Operation timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error) {
    try {
      logError(
        errorMessage,
        error instanceof Error ? error : new Error(String(error))
      );
    } catch {
      // Don't block on logging errors
    }

    throw error;
  }
}

/**
 * Ensures all promises are handled
 */
export function handleUnhandledRejections() {
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason, promise) => {
      try {
        logError(
          'Unhandled promise rejection',
          reason instanceof Error ? reason : new Error(String(reason)),
          { promise: String(promise) }
        );
      } catch {
        // Don't block on logging errors
      }
    });

    process.on('uncaughtException', (error) => {
      try {
        logError('Uncaught exception', error);
      } catch {
        // Don't block on logging errors
      }
      // Don't exit in production - let the error handler deal with it
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });
  }
}

/**
 * Initialize error handling on server startup
 */
export function initializeErrorHandling() {
  handleUnhandledRejections();
}

