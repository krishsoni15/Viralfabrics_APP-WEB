/**
 * Standardized API Response Format
 * 
 * All API responses follow this format:
 * { success: boolean, message?: string, data?: T, error?: ErrorInfo, errorCode?: string }
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: {
    code: string;
    details?: Record<string, any>;
    stack?: string; // Only in development
  };
  errorCode?: string;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Not found errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // Conflict errors
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Security errors
  XSS_DETECTED: 'XSS_DETECTED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Create success response
 */
export function successResponse<T>(
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
export function errorResponse(
  message: string,
  errorCode: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
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
 * Create validation error response
 */
export function validationErrorResponse(
  errors: Record<string, string> | string[]
): ApiErrorResponse {
  const errorMessages = Array.isArray(errors)
    ? errors
    : Object.values(errors);

  return errorResponse(
    errorMessages.join(', '),
    ERROR_CODES.VALIDATION_ERROR,
    {
      errors: Array.isArray(errors) ? errors : errors,
    }
  );
}

/**
 * Create not found response
 */
export function notFoundResponse(resource: string = 'Resource'): ApiErrorResponse {
  return errorResponse(
    `${resource} not found`,
    ERROR_CODES.NOT_FOUND
  );
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): ApiErrorResponse {
  return errorResponse(message, ERROR_CODES.UNAUTHORIZED);
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): ApiErrorResponse {
  return errorResponse(message, ERROR_CODES.FORBIDDEN);
}

/**
 * Create conflict response
 */
export function conflictResponse(message: string = 'Resource already exists'): ApiErrorResponse {
  return errorResponse(message, ERROR_CODES.CONFLICT);
}

/**
 * Create rate limit response
 */
export function rateLimitResponse(message?: string): ApiErrorResponse {
  return errorResponse(
    message || 'Too many requests. Please try again later.',
    ERROR_CODES.RATE_LIMIT_EXCEEDED
  );
}

