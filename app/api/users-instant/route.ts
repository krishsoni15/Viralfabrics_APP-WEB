import { NextRequest, NextResponse } from 'next/server';
import { successResponse } from '@/lib/response';
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Party from "@/models/Party";
import { getSession } from "@/lib/session";
import { checkRateLimitOrError, apiRateLimiter } from '@/lib/rateLimit';
import { serializeMongoDocs } from '@/lib/serialize';

// Professional in-memory cache for users data
export const usersCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ 
        success: false,
        message: "Unauthorized" 
      }, { status: 401 });
    }
    
    // Check for superadmin or master role
    if (session.role !== 'superadmin' && session.role !== 'master') {
      return NextResponse.json({ 
        success: false,
        message: "Access denied - Superadmin access required" 
      }, { status: 403 });
    }

    // Check cache first
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25');
    const page = parseInt(searchParams.get('page') || '1');
    const cacheKey = `users-instant-${limit}-${page}-${session.role}`;
    
    const cached = usersCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      const responseTime = Date.now() - startTime;
      return NextResponse.json(successResponse(cached.data, 'Users loaded from cache'), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
          'X-Response-Time': `${responseTime}ms`
        }
      });
    }

    await dbConnect();
    
    const skip = (page - 1) * limit;
    
    const query = session.role === 'master' ? {} : { role: { $ne: 'master' } };

    // Super simple and fast query - no complex operations
    const users = await User.find(query, {
      _id: 1,
      name: 1,
      username: 1,
      phoneNumber: 1,
      address: 1,
      role: 1,
      isActive: 1,
      partyId: 1,
      createdAt: 1
    })
    .populate('partyId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
    .maxTimeMS(3000); // 3 second timeout to prevent timeouts
    
    // Simple count - no parallel needed
    const totalCount = await User.countDocuments(query).maxTimeMS(3000);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    
    // Serialize users to plain objects (handle ObjectIds)
    const serializedUsers = serializeMongoDocs(users);
    
    const responseData = {
      users: serializedUsers,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };

    // Update cache
    usersCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(successResponse(responseData, 'Users loaded instantly'), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
        'X-Response-Time': `${responseTime}ms`
      }
    });
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return NextResponse.json({ 
          success: false,
          message: "Unauthorized" 
        }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ 
          success: false,
          message: "Access denied - Superadmin access required" 
        }, { status: 403 });
      }
    }
    
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ 
      success: false,
      message,
      'X-Response-Time': `${responseTime}ms`
    }, { status: 500 });
  }
}
