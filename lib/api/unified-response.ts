/**
 * Unified API Response Models
 * 
 * Standardized response format across all endpoints
 */

import { ERROR_CODES } from './response';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: Record<string, any>;
    stack?: string; // Only in development
  };
  errorCode: string;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  message?: string;
  timestamp: string;
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  message: string,
  errorCode: string = ERROR_CODES.INTERNAL_ERROR,
  details?: Record<string, any>
): ApiErrorResponse {
  return {
    success: false,
    message,
    error: {
      code: errorCode,
      details,
      ...(process.env.NODE_ENV === 'development' && {
        stack: new Error().stack,
      }),
    },
    errorCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    message,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for success response
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard for error response
 */
export function isErrorResponse(
  response: ApiResponse
): response is ApiErrorResponse {
  return response.success === false;
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Extract data from response (throws if error)
 */
export function extractData<T>(response: ApiResponse<T>): T {
  if (isErrorResponse(response)) {
    throw new Error(response.message);
  }
  return response.data;
}

/**
 * Extract error from response
 */
export function extractError(response: ApiResponse): string | null {
  if (isErrorResponse(response)) {
    return response.message;
  }
  return null;
}

