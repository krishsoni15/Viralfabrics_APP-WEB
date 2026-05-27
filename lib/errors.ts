// Professional Error Handling System

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, code);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 409, code);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

// Error response formatter (uses standardized format)
export const formatErrorResponse = (error: any) => {
  if (error instanceof AppError) {
    return {
      success: false,
      message: error.message,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        statusCode: error.statusCode
      },
      errorCode: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  // Handle mongoose validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return {
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: messages,
        statusCode: 400
      },
      errorCode: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  // Handle mongoose duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return {
      success: false,
      message: `${field} already exists`,
      error: {
        code: 'DUPLICATE_KEY',
        statusCode: 409
      },
      errorCode: 'DUPLICATE_KEY',
      timestamp: new Date().toISOString()
    };
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return {
      success: false,
      message: 'Invalid token',
      error: {
        code: 'INVALID_TOKEN',
        statusCode: 401
      },
      errorCode: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    };
  }

  if (error.name === 'TokenExpiredError') {
    return {
      success: false,
      message: 'Token expired',
      error: {
        code: 'TOKEN_EXPIRED',
        statusCode: 401
      },
      errorCode: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString()
    };
  }

  // Default error response
  return {
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message || 'An unexpected error occurred',
    error: {
      code: 'INTERNAL_ERROR',
      statusCode: 500
    },
    errorCode: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler middleware
export const globalErrorHandler = (error: any, req: any, res: any, next: any) => {
  const errorResponse = formatErrorResponse(error);
  
  // Log error for debugging
  res.status(errorResponse.error.statusCode).json(errorResponse);
};
