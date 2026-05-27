/**
 * Enhanced Validation Middleware
 * 
 * Uses centralized schemas and standardized error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import {
  validateData,
  sanitizeObject,
  containsXSS,
} from '@/lib/validation';
import {
  validationErrorResponse,
  errorResponse,
  ERROR_CODES,
} from '@/lib/api/response';
import { ValidationError } from '@/lib/errors';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Validate request body against Zod schema
 * Includes XSS protection and sanitization
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
  options: {
    sanitize?: boolean;
    checkXSS?: boolean;
  } = { sanitize: true, checkXSS: true }
): Promise<T> {
  try {
    const body = await req.json();

    // Check for XSS
    if (options.checkXSS) {
      const bodyString = JSON.stringify(body);
      if (containsXSS(bodyString)) {
        throw new ValidationError('Potentially malicious content detected');
      }
    }

    // Sanitize if enabled
    const sanitizedBody = options.sanitize ? sanitizeObject(body) : body;

    // Validate against schema
    const result = validateData(schema, sanitizedBody);
    
    if (!result.success) {
      throw new ValidationError(
        Object.values(result.errors).join(', ')
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      const zodError = error;
      const errors: Record<string, string> = {};
      zodError.issues.forEach((err) => {
        const path = err.path.join('.') || 'root';
        errors[path] = err.message;
      });
      throw new ValidationError(
        Object.values(errors).join(', ')
      );
    }
    throw error;
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): T {
  try {
    const { searchParams } = new URL(req.url);
    const query: Record<string, string> = {};

    // Convert URLSearchParams to object
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const result = validateData(schema, query);
    
    if (!result.success) {
      throw new ValidationError(
        Object.values(result.errors).join(', ')
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      const zodError = error;
      const errors: Record<string, string> = {};
      zodError.issues.forEach((err) => {
        const path = err.path.join('.') || 'root';
        errors[path] = err.message;
      });
      throw new ValidationError(
        Object.values(errors).join(', ')
      );
    }
    throw error;
  }
}

/**
 * Validate route parameters (from [id] routes)
 */
export async function validateParams<T>(
  params: Promise<Record<string, string>> | Record<string, string>,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    
    const result = validateData(schema, resolvedParams);
    
    if (!result.success) {
      throw new ValidationError(
        Object.values(result.errors).join(', ')
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      const zodError = error;
      const errors: Record<string, string> = {};
      zodError.issues.forEach((err) => {
        const path = err.path.join('.') || 'root';
        errors[path] = err.message;
      });
      throw new ValidationError(
        Object.values(errors).join(', ')
      );
    }
    throw error;
  }
}

// ============================================================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================================================

export interface ValidationOptions {
  sanitize?: boolean;
  checkXSS?: boolean;
  requireAuth?: boolean;
}

/**
 * Create validation middleware for route handlers
 */
export function createValidationMiddleware<TBody = unknown, TQuery = unknown, TParams = unknown>(
  options: {
    bodySchema?: ZodSchema<TBody>;
    querySchema?: ZodSchema<TQuery>;
    paramsSchema?: ZodSchema<TParams>;
  } & ValidationOptions = {}
) {
  return async (
    req: NextRequest,
    params?: Promise<Record<string, string>> | Record<string, string>
  ) => {
    const validated: {
      body?: TBody;
      query?: TQuery;
      params?: TParams;
    } = {};

    // Validate body
    if (options.bodySchema) {
      validated.body = await validateBody(req, options.bodySchema, {
        sanitize: options.sanitize ?? true,
        checkXSS: options.checkXSS ?? true,
      });
    }

    // Validate query
    if (options.querySchema) {
      validated.query = validateQuery(req, options.querySchema);
    }

    // Validate params
    if (options.paramsSchema && params) {
      validated.params = await validateParams(params, options.paramsSchema);
    }

    // Attach validated data to request
    (req as any).validated = validated;

    return validated;
  };
}

