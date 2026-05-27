import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { OrderService } from '@/app/services/OrderService';
import { OrderQuery } from '@/app/repositories/OrderRepository';
import { requireAuth } from '@/app/middleware/auth';
import { handleApiError } from '@/app/middleware/errorHandler';
import { createOrderSchema } from '@/app/validators/orderValidator';
import { apiRateLimiter, writeRateLimiter, checkRateLimitOrError } from '@/lib/rateLimit';
import { getCacheHeaders, CACHE_DURATIONS } from '@/lib/cacheConfig';
import { paginatedResponse, createdResponse } from '@/lib/response';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { logView } from '@/lib/logger';
import mongoose from 'mongoose';

/**
 * GET /api/orders
 * Get orders with filters, pagination, and search
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) {
      const errorData = await rateLimitError.json() as Record<string, unknown>;
      return NextResponse.json(errorData, { status: rateLimitError.status });
    }

    // Authentication
    await requireAuth(req);

    // Database connection
    await dbConnect();

    // Validate and parse query parameters
    const { searchParams } = new URL(req.url);
    const queryParams: OrderQuery = {};
    
    // Parse pagination
    queryParams.page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1);
    queryParams.limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '25'), 1), 100);
    
    // Parse filters
    const search = sanitizeSearchQuery(searchParams.get('search') ?? '');
    if (search) queryParams.search = search;
    
    const orderType = searchParams.get('orderType');
    if (orderType === 'Dying' || orderType === 'Printing') {
      queryParams.orderType = orderType;
    }
    
    const status = searchParams.get('status');
    if (status) queryParams.status = status;
    
    const party = searchParams.get('party');
    if (party) queryParams.party = party;
    
    const startDate = searchParams.get('startDate');
    if (startDate) queryParams.startDate = new Date(startDate);
    
    const endDate = searchParams.get('endDate');
    if (endDate) queryParams.endDate = new Date(endDate);
    
    const millId = searchParams.get('millId');
    if (millId) queryParams.millId = millId;
    
    // Parse sort
    const sort = searchParams.get('sort') ?? 'latest_first';
    if (sort === 'latest_first') {
      queryParams.sortBy = 'createdAt';
      queryParams.sortOrder = 'desc';
    } else if (sort === 'oldest_first') {
      queryParams.sortBy = 'createdAt';
      queryParams.sortOrder = 'asc';
    } else {
      queryParams.sortBy = 'createdAt';
      queryParams.sortOrder = 'desc';
    }

    // Get orders from service
    const result = await OrderService.getMany(queryParams);

    // Log view (non-blocking)
    logView('orders', 'list', req);

    // Return response
    return NextResponse.json(
      paginatedResponse(result.orders, {
        page: result.page,
        limit: result.limit,
        total: result.total
      }),
      {
        status: 200,
        headers: getCacheHeaders(CACHE_DURATIONS.ORDERS_LIST)
      }
    );
  } catch (error) {
    return handleApiError(error, req);
  }
}

/**
 * POST /api/orders
 * Create new order
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) {
      const errorData = await rateLimitError.json() as Record<string, unknown>;
      return NextResponse.json(errorData, { status: rateLimitError.status });
    }

    // Authentication
    await requireAuth(req);

    // Database connection
    await dbConnect();

    // Validate request body
    const body = await req.json();
    const validatedData = createOrderSchema.parse(body);

    // Convert string IDs to ObjectIds for party and quality fields
    const orderData = {
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

    // Create order via service
    const order = await OrderService.create(orderData);

    // Return response
    return NextResponse.json(
      createdResponse(order, 'Order created successfully'),
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, req);
  }
}
