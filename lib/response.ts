// Professional API Response Helper

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
}

// Success response helpers
export const successResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

export const paginatedResponse = <T>(
  data: T[], 
  pagination: PaginationInfo,
  message?: string
): ApiResponse<T[]> => {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  return {
    success: true,
    data,
    message,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  };
};

export const createdResponse = <T>(data: T, message: string = 'Resource created successfully'): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

export const updatedResponse = <T>(data: T, message: string = 'Resource updated successfully'): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

export const deletedResponse = (message: string = 'Resource deleted successfully'): ApiResponse => ({
  success: true,
  message,
  timestamp: new Date().toISOString()
});

// Error response helpers
export const errorResponse = (message: string, statusCode: number = 500): ApiResponse => ({
  success: false,
  message,
  timestamp: new Date().toISOString()
});

export const notFoundResponse = (resource: string = 'Resource'): ApiResponse => ({
  success: false,
  message: `${resource} not found`,
  timestamp: new Date().toISOString()
});

export const validationErrorResponse = (message: string): ApiResponse => ({
  success: false,
  message,
  timestamp: new Date().toISOString()
});

export const unauthorizedResponse = (message: string = 'Unauthorized access'): ApiResponse => ({
  success: false,
  message,
  timestamp: new Date().toISOString()
});

export const forbiddenResponse = (message: string = 'Access forbidden'): ApiResponse => ({
  success: false,
  message,
  timestamp: new Date().toISOString()
});

export const conflictResponse = (message: string): ApiResponse => ({
  success: false,
  message,
  timestamp: new Date().toISOString()
});

// Pagination helper
export const calculatePagination = (page: number, limit: number, total: number) => {
  const skip = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

// Query builder helper
export const buildQuery = (filters: Record<string, any>) => {
  const query: Record<string, any> = {};
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'search') {
        query.$text = { $search: value };
      } else if (key === 'startDate' || key === 'endDate') {
        // Handle date ranges
        if (!query.createdAt) query.createdAt = {};
        if (key === 'startDate') query.createdAt.$gte = new Date(value);
        if (key === 'endDate') query.createdAt.$lte = new Date(value);
      } else if (Array.isArray(value)) {
        query[key] = { $in: value };
      } else {
        query[key] = value;
      }
    }
  });
  
  return query;
};

// Sort builder helper
export const buildSort = (sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') => {
  if (!sortBy) return { createdAt: -1 } as any;
  
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  return { [sortBy]: sortDirection } as any;
};

// Response wrapper for Express
export const sendResponse = <T>(res: any, statusCode: number, response: ApiResponse<T>) => {
  return res.status(statusCode).json(response);
};

// Common response patterns
export const sendSuccess = <T>(res: any, data: T, message?: string, statusCode: number = 200) => {
  return sendResponse(res, statusCode, successResponse(data, message));
};

export const sendCreated = <T>(res: any, data: T, message?: string) => {
  return sendResponse(res, 201, createdResponse(data, message));
};

export const sendUpdated = <T>(res: any, data: T, message?: string) => {
  return sendResponse(res, 200, updatedResponse(data, message));
};

export const sendDeleted = (res: any, message?: string) => {
  return sendResponse(res, 200, deletedResponse(message));
};

export const sendNotFound = (res: any, resource?: string) => {
  return sendResponse(res, 404, notFoundResponse(resource));
};

export const sendUnauthorized = (res: any, message?: string) => {
  return sendResponse(res, 401, unauthorizedResponse(message));
};

export const sendForbidden = (res: any, message?: string) => {
  return sendResponse(res, 403, forbiddenResponse(message));
};

export const sendConflict = (res: any, message: string) => {
  return sendResponse(res, 409, conflictResponse(message));
};

export const sendValidationError = (res: any, message: string) => {
  return sendResponse(res, 400, validationErrorResponse(message));
};

export const sendServerError = (res: any, message: string = 'Internal server error') => {
  return sendResponse(res, 500, errorResponse(message));
};
