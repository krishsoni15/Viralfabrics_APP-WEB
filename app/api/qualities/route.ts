import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Quality from '@/models/Quality';
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from "@/lib/cacheConfig";
import { revalidateTag } from 'next/cache';
import { 
  validateRequest, 
  createQualitySchema, 
  searchSchema,
  CreateQualityRequest,
  SearchRequest 
} from '@/lib/validation';
import { 
  ValidationError, 
  NotFoundError 
} from '@/lib/errors';
import { 
  sendSuccess, 
  sendCreated, 
  sendValidationError, 
  sendServerError,
  paginatedResponse,
  calculatePagination,
  buildQuery,
  buildSort
} from '@/lib/response';
import { logCreate } from '@/lib/logger';
import { qualitiesCache, CACHE_TTL } from './cache';
import { requireAuth } from '@/lib/session';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';

// GET /api/qualities - List qualities with pagination and search
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session - handle auth errors gracefully
    try {
      await requireAuth(request);
    } catch (authError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized. Please log in again.',
          error: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    // ⚡ OPTIMIZED: Check cache first with pagination support
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 100); // Default 100 for dropdowns
    const skip = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const cacheKey = `qualities-${search || 'all'}-${limit}-${page}`;
    
    const cached = qualitiesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      // Return consistent structure: { success: true, data: [...], pagination: {...} }
      const cachedResponse = cached.data;
      return NextResponse.json({
        success: true,
        data: Array.isArray(cachedResponse) ? cachedResponse : (cachedResponse?.data || []),
        pagination: cachedResponse?.pagination || {},
        message: 'Qualities loaded from cache'
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    // Connect to database
    await dbConnect();
    
    // Build query
    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
      query.isActive = true; // Only search active qualities
    }

    // ⚡ OPTIMIZED: Query with pagination, limits and timeout
    const [qualities, totalCount] = await Promise.all([
      Quality.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean() // ⚡ Already using .lean() - good!
        .maxTimeMS(2000),
      Quality.countDocuments(query).maxTimeMS(2000)
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const responseData = {
      data: qualities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    };

    // Update cache - store qualities array directly for consistency
    qualitiesCache.set(cacheKey, {
      data: {
        data: qualities,
        pagination: responseData.pagination
      },
      timestamp: Date.now()
    });

    // ⚡ ISR CACHING: Add cache tags for revalidation
    const headers = {
      ...getCacheHeaders(CACHE_DURATIONS.QUALITIES),
      'Content-Type': 'application/json',
      'X-Cache-Tags': CACHE_TAGS.QUALITIES,
      'X-Cache': 'MISS',
      'X-Response-Time': `${Date.now() - startTime}ms`
    } as Record<string, string>;

    return new Response(JSON.stringify({
      success: true,
      ...responseData,
      message: 'Qualities fetched successfully'
    }), { 
      status: 200, 
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to retrieve qualities'
    }), { status: 500 });
  }
}

// POST /api/qualities - Create new quality
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session - handle auth errors gracefully
    try {
      await requireAuth(request);
    } catch (authError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized. Please log in again.',
          error: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    // Connect to database
    await dbConnect();
    
    // Parse and validate request body
    const body = await request.json();
    // Received quality data
    
    const validatedData = validateRequest(createQualitySchema, body);
    // Validated quality data

    // Check if quality with same name already exists
    const existingQuality = await Quality.findOne({ name: { $regex: validatedData.name, $options: 'i' } });
    if (existingQuality) {
      return NextResponse.json({
        success: false,
        message: 'Quality with this name already exists',
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }

    // Create new quality
    const quality = new Quality(validatedData);
    const savedQuality = await quality.save();
    // Quality created successfully

    // Log the quality creation (async, non-blocking)
    logCreate('quality', (savedQuality as any)._id.toString(), { 
      name: savedQuality.name,
      description: savedQuality.description
    }, request).catch(() => {});

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.QUALITIES);
    revalidateTag(CACHE_TAGS.ORDERS); // Qualities affect orders
    
    // ⚡ FIX: Clear in-memory cache when creating new quality
    // This ensures the next GET request fetches fresh data including the new quality
    qualitiesCache.clear();
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Cleared qualities cache after creating new quality');
    }

    // Return success response
    const response = {
      success: true,
      data: savedQuality,
      message: 'Quality created successfully',
      timestamp: new Date().toISOString()
    };

    // Sending success response
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({
        success: false,
        message: `Validation error: ${error.message}`,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Failed to create quality - invalid data received',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
