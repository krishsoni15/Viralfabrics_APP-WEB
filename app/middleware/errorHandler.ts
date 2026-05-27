import { NextRequest, NextResponse } from 'next/server';
import { AppError, formatErrorResponse } from '@/lib/errors';
import { logError } from '@/lib/logger';

/**
 * Global error handler for Next.js API routes
 * Catches all errors and returns consistent error responses
 */
export function handleApiError(error: unknown, req?: NextRequest): NextResponse {
  const errorResponse = formatErrorResponse(error);
  
  // Log error for monitoring (non-blocking)
  if (error instanceof Error) {
    logError(error.message, {
      stack: error.stack,
      url: req?.url,
      method: req?.method,
      statusCode: errorResponse.error.statusCode,
    }); // Logging is fire-and-forget; do not await or chain
  }
  
  return NextResponse.json(
    errorResponse,
    { status: errorResponse.error.statusCode }
  );
}

/**
 * Async handler wrapper for Next.js route handlers
 * Automatically catches errors and passes to error handler
 */
export function asyncHandler<T extends any[]>(
  fn: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      const req = args[0] as NextRequest;
      return handleApiError(error, req);
    }
  };
}

/**
 * Error handler for route handlers
 * Use this at the end of try/catch blocks
 */
export function catchError(error: unknown, req?: NextRequest): NextResponse {
  return handleApiError(error, req);
}

