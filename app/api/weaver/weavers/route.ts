import dbConnect from "@/lib/dbConnect";
import SamplingWeaver, { ISamplingWeaver } from "@/models/SamplingWeaver";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import { sanitizeString } from "@/lib/sanitize";
import type { FilterQuery } from "mongoose";
import { weaverRateLimiter, getClientIdentifier, rateLimit } from "@/lib/rateLimiter";
import { logger } from "@/lib/logger";
import { weaverCache, CACHE_TTL } from "@/lib/cache/weaverCache";
// Service layer (optional - can use for consistency)
import { getWeavers as getWeaversService, createWeaver as createWeaverService } from "@/app/(pages)/(dashboard)/weaver/lib/services/weaverService";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateLimitResult = rateLimit(weaverRateLimiter, clientId);
    if (!rateLimitResult.allowed) {
      return Response.json({
        success: false,
        message: 'Too many requests. Please try again later.'
      }, {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      });
    }

    const { searchParams } = new URL(req.url);
    const search = sanitizeString(searchParams.get('search') || '', { maxLength: 100 });
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const sort = searchParams.get('sort') || 'newest';
    const force = searchParams.get('force') === 'true';
    
    // Create cache key
    const cacheKey = `weavers:${search}:${page}:${limit}:${sort}`;
    
    // Check cache (skip if force refresh)
    if (!force) {
      const cached = weaverCache.get(cacheKey);
      if (cached) {
        return Response.json(cached, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            'X-Cache': 'HIT',
            'X-Response-Time': `${Date.now() - startTime}ms`
          }
        });
      }
    }

    // Use service layer for business logic (keeps code DRY)
    const result = await getWeaversService({
      page,
      limit,
      search,
      sort: sort as 'newest' | 'oldest'
    });
    
    const response = {
      success: true,
      data: result.weavers,
      pagination: result.pagination
    };
    
    // Cache response
    weaverCache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    
    return Response.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
  } catch (error: unknown) {
    logger.error('Error fetching weavers', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'GET /api/weaver/weavers'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch weavers";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateLimitResult = rateLimit(weaverRateLimiter, clientId);
    if (!rateLimitResult.allowed) {
      return Response.json({
        success: false,
        message: 'Too many requests. Please try again later.'
      }, {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      });
    }

    await dbConnect();
    
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return Response.json({
        success: false,
        message: "Invalid request data"
      }, { status: 400 });
    }
    
    const { name, phone, address } = requestData || {};
    
    if (!name?.trim()) {
      return Response.json({
        success: false,
        message: "Name is required"
      }, { status: 400 });
    }
    
    // Additional validation
    if (name.trim().length > 100) {
      return Response.json({
        success: false,
        message: "Name must be 100 characters or less"
      }, { status: 400 });
    }
    
    // Validate phone number - only numbers allowed
    if (phone && phone.trim()) {
      const phoneNumber = phone.trim();
      if (!/^\d+$/.test(phoneNumber)) {
        return Response.json({
          success: false,
          message: "Phone number must contain only numbers"
        }, { status: 400 });
      }
      if (phoneNumber.length > 20) {
        return Response.json({
          success: false,
          message: "Phone must be 20 digits or less"
        }, { status: 400 });
      }
    }
    
    if (address && address.trim().length > 500) {
      return Response.json({
        success: false,
        message: "Address must be 500 characters or less"
      }, { status: 400 });
    }
    
    // Use service layer for business logic
    try {
      const weaver = await createWeaverService({
        name: name.trim(),
        phone: phone?.trim(),
        address: address?.trim()
      });
      
      // Invalidate cache
      weaverCache.invalidate('weavers:');
      
      return Response.json({
        success: true,
        message: "Weaver created successfully",
        data: weaver
      }, { status: 201 });
    } catch (error: unknown) {
      // Handle duplicate key errors or validation errors
      if (error instanceof Error && error.message.includes('E11000')) {
        return Response.json({
          success: false,
          message: "A weaver with this name already exists"
        }, { status: 409 });
      }
      throw error; // Re-throw to be caught by outer catch
    }
  } catch (error: unknown) {
    logger.error('Error creating weaver', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'POST /api/weaver/weavers'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to create weaver";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

