/**
 * Example API Route with Complete Validation
 * 
 * This demonstrates the proper way to use validation in API routes.
 * Copy this pattern to other routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler, handleApiError } from '@/app/middleware/errorHandler';
import { validateBody, validateQuery } from '@/app/middleware/validation.enhanced';
import { createOrderSchema, orderQuerySchema } from '@/lib/validation';
import { successResponse, validationErrorResponse, notFoundResponse } from '@/lib/api/response';
import { ValidationError } from '@/lib/errors';
import { OrderService } from '@/app/services/OrderService';
import { getSession } from '@/lib/session';
import { checkRateLimitOrError, writeRateLimiter } from '@/lib/rateLimit';
import mongoose from 'mongoose';
import { CreateOrderData } from '@/app/repositories/OrderRepository';

/**
 * GET /api/orders
 * 
 * Fetch orders with validation
 */
export const GET = asyncHandler(async (req: NextRequest) => {
  // Validate query parameters
  const query = validateQuery(req, orderQuerySchema);

  // Check rate limit
  const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
  if (rateLimitError) {
    const errorData = await rateLimitError.json() as Record<string, unknown>;
    return NextResponse.json(errorData, { status: rateLimitError.status });
  }

  // Validate session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    // Fetch orders using service
    const orders = await OrderService.getMany(query);

    return NextResponse.json(
      successResponse(orders, 'Orders fetched successfully')
    );
  } catch (error) {
    return handleApiError(error, req);
  }
});

/**
 * POST /api/orders
 * 
 * Create order with complete validation
 */
export const POST = asyncHandler(async (req: NextRequest) => {
  // Check rate limit for write operations
  const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
  if (rateLimitError) {
    const errorData = await rateLimitError.json() as Record<string, unknown>;
    return NextResponse.json(errorData, { status: rateLimitError.status });
  }

  // Validate session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    // Validate request body (includes XSS protection and sanitization)
    const validatedData = await validateBody(req, createOrderSchema, {
      sanitize: true,
      checkXSS: true,
    });

    // Convert string IDs to ObjectIds for party and quality fields
    const data = {
      ...validatedData,
      party: validatedData.party 
        ? (typeof validatedData.party === 'string' 
            ? new mongoose.Types.ObjectId(validatedData.party) 
            : validatedData.party)
        : undefined,
      items: (validatedData.items ?? []).map((item) => ({
        ...item,
        quality: item.quality 
          ? (typeof item.quality === 'string'
              ? new mongoose.Types.ObjectId(item.quality)
              : item.quality)
          : undefined
      })),
      metadata: {
        createdBy: session.id,
      },
    } as CreateOrderData;

    // Create order using service
    const order = await OrderService.create(data);

    return NextResponse.json(
      successResponse(order, 'Order created successfully'),
      { status: 201 }
    );
  } catch (error) {
    // Handle validation errors specifically
    if (error instanceof ValidationError) {
      return NextResponse.json(
        validationErrorResponse([error.message]),
        { status: 400 }
      );
    }

    // Handle other errors
    return handleApiError(error, req);
  }
});

/**
 * PUT /api/orders/[id]
 * 
 * Update order with validation
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return asyncHandler(async (req: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) {
      const errorData = await rateLimitError.json() as Record<string, unknown>;
      return NextResponse.json(errorData, { status: rateLimitError.status });
    }

    // Validate session
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    try {
      // Validate route params
      const { id } = await params;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          notFoundResponse('Order'),
          { status: 404 }
        );
      }

      // Validate request body
      const validatedData = await validateBody(req, createOrderSchema.partial(), {
        sanitize: true,
        checkXSS: true,
      });

      // Convert string IDs to ObjectIds for party and quality fields
      const data = {
        ...validatedData,
        party: validatedData.party 
          ? (typeof validatedData.party === 'string' 
              ? new mongoose.Types.ObjectId(validatedData.party) 
              : validatedData.party)
          : undefined,
        items: (validatedData.items ?? []).map((item) => ({
          ...item,
          quality: item.quality 
            ? (typeof item.quality === 'string'
                ? new mongoose.Types.ObjectId(item.quality)
                : item.quality)
            : undefined
        }))
      };

      // Update order
      const order = await OrderService.update(id, data);

      if (!order) {
        return NextResponse.json(
          notFoundResponse('Order'),
          { status: 404 }
        );
      }

      return NextResponse.json(
        successResponse(order, 'Order updated successfully')
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          validationErrorResponse([error.message]),
          { status: 400 }
        );
      }

      return handleApiError(error, req);
    }
  })(req);
}

/**
 * DELETE /api/orders/[id]
 * 
 * Delete order with validation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return asyncHandler(async (req: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) {
      const errorData = await rateLimitError.json() as Record<string, unknown>;
      return NextResponse.json(errorData, { status: rateLimitError.status });
    }

    // Validate session
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    try {
      // Validate route params
      const { id } = await params;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          notFoundResponse('Order'),
          { status: 404 }
        );
      }

      // Delete order (throws NotFoundError if order doesn't exist)
      await OrderService.delete(id);

      return NextResponse.json(
        successResponse(null, 'Order deleted successfully')
      );
    } catch (error) {
      return handleApiError(error, req);
    }
  })(req);
}

