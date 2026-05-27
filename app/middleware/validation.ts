import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '@/lib/errors';
import { asyncHandler } from './errorHandler';

/**
 * Validates request body against Zod schema
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new ValidationError(messages.join(', '));
    }
    throw error;
  }
}

/**
 * Validates query parameters against Zod schema
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
    
    return schema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new ValidationError(messages.join(', '));
    }
    throw error;
  }
}

/**
 * Validates route parameters (from [id] routes)
 */
export function validateParams<T>(
  params: Promise<Record<string, string>>,
  schema: ZodSchema<T>
): Promise<T> {
  return params.then((p) => {
    try {
      return schema.parse(p);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        );
        throw new ValidationError(messages.join(', '));
      }
      throw error;
    }
  });
}

/**
 * Middleware factory for request validation
 */
export function validateRequest<TBody, TQuery = unknown>(
  bodySchema?: ZodSchema<TBody>,
  querySchema?: ZodSchema<TQuery>
) {
  return asyncHandler(async (req: NextRequest) => {
    const body = bodySchema ? await validateBody(req, bodySchema) : undefined;
    const query = querySchema ? validateQuery(req, querySchema) : undefined;
    
    // Attach validated data to request
    (req as any).validatedBody = body;
    (req as any).validatedQuery = query;
    
    return NextResponse.next();
  });
}

