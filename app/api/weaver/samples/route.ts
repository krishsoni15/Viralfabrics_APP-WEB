import dbConnect from "@/lib/dbConnect";
import Sample, { ISample } from "@/models/Sample";
import SamplingWeaver from "@/models/SamplingWeaver";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import { sanitizeString } from "@/lib/sanitize";
import type { FilterQuery } from "mongoose";
import { weaverRateLimiter, getClientIdentifier, rateLimit } from "@/lib/rateLimiter";
import { logger } from "@/lib/logger";
import { weaverCache, CACHE_TTL } from "@/lib/cache/weaverCache";
// Service layer (optional - can use for consistency)
import { getSamples as getSamplesService, createSample as createSampleService } from "@/app/(pages)/(dashboard)/weaver/lib/services/sampleService";
import { FABRIC_TYPES } from "@/app/(pages)/(dashboard)/weaver/constants";

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
    const weaverId = searchParams.get('weaverId') || undefined; // Convert null to undefined
    const search = sanitizeString(searchParams.get('search') || '', { maxLength: 100 });
    const force = searchParams.get('force') === 'true';
    // When fetching by weaverId, use reasonable limit (reduced from 1000 to 100 for performance)
    // Otherwise use default pagination
    const defaultLimit = weaverId ? 100 : 50;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || defaultLimit.toString()), 1), 1000);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    
    // Create cache key
    const cacheKey = `samples:${weaverId || 'all'}:${search}:${page}:${limit}`;
    
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

    // Use service layer for business logic
    const result = await getSamplesService({
      weaverId,
      page,
      limit,
      search
    });
    
    const response = {
      success: true,
      data: result.samples,
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
    logger.error('Error fetching samples', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'GET /api/weaver/samples'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch samples";
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
    
    const requestData = await req.json();
    const {
      weaverId,
      qualityName,
      type,
      rack,
      greighWidth,
      finishWidth,
      weight,
      gsm,
      content,
      danier,
      count,
      reed,
      pick,
      greighRate,
      label,
      images,
      note
    } = requestData;
    
    // Use service layer for business logic
    try {
      const sample = await createSampleService({
        weaverId,
        qualityName: qualityName?.trim(),
        type: type?.trim(),
        rack: rack?.trim(),
        greighWidth: greighWidth ? parseFloat(String(greighWidth)) : undefined,
        finishWidth: finishWidth ? parseFloat(String(finishWidth)) : undefined,
        weight: weight ? parseFloat(String(weight)) : undefined,
        gsm: gsm ? parseFloat(String(gsm)) : undefined,
        content: content?.trim(),
        danier: danier?.trim(),
        count: count ? parseFloat(String(count)) : undefined,
        reed: reed ? parseFloat(String(reed)) : undefined,
        pick: pick ? parseFloat(String(pick)) : undefined,
        greighRate: greighRate ? parseFloat(String(greighRate)) : undefined,
        label: label?.trim(),
        note: note?.trim(),
        images: images || []
      });
      
      // Invalidate cache
      weaverCache.invalidate('samples:');
      if (weaverId) {
        weaverCache.invalidate(`samples:${weaverId}:`);
      }
      
      return Response.json({
        success: true,
        message: "Sample created successfully",
        data: sample
      }, { status: 201 });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('required') || error.message.includes('Invalid')) {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 400 });
        }
        if (error.message === 'Weaver not found') {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 404 });
        }
        if (error.message.includes('Type must be one of')) {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error: unknown) {
    logger.error('Error creating sample', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'POST /api/weaver/samples'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to create sample";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

