import dbConnect from "@/lib/dbConnect";
import Party from "@/models/Party";
import { requireAuth, getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { logCreate } from "@/lib/logger";
import { partiesCache, CACHE_TTL, clearPartiesCache } from "@/lib/partiesCache";
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from "@/lib/cacheConfig";
import { revalidateTag } from 'next/cache';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session and obtain it - handle auth errors gracefully
    let session = null;
    try {
      await requireAuth(req);
      session = await getSession(req);
    } catch (authError) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Unauthorized. Please log in again.',
        error: 'AUTH_REQUIRED'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If user is tied to a party (has partyId), only return their own party (skip global cache)
    if (session && session.partyId && session.role !== 'master' && session.role !== 'superadmin') {
      try {
        await dbConnect();
        const party = await Party.findById(session.partyId)
          .select('_id name contactName contactPhone address createdAt updatedAt')
          .lean();

        if (!party) {
          return new Response(JSON.stringify({ success: false, message: 'Party not found' }), { status: 404 });
        }

        return new Response(JSON.stringify({ success: true, data: [party], pagination: { currentPage: 1, totalPages: 1, totalCount: 1, hasNextPage: false, hasPrevPage: false, limit: 1 }, message: 'Party loaded' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCacheHeaders(CACHE_DURATIONS.PARTIES)
          }
        });
      } catch (err) {
        // Fall through to normal behavior on error
        if (process.env.NODE_ENV === 'development') console.error('Error loading party for party-role user:', err);
      }
    }

    // ⚡ OPTIMIZED: Check cache first with pagination support
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100); // Default 100 for dropdowns
    const skip = (page - 1) * limit;
    const cacheKey = `parties-${search || 'all'}-${limit}-${page}`;
    
    const cached = partiesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      // Return consistent structure: { success: true, data: [...], pagination: {...} }
      const cachedResponse = cached.data;
      return new Response(JSON.stringify({
        success: true,
        data: Array.isArray(cachedResponse) ? cachedResponse : (cachedResponse?.data || []),
        pagination: cachedResponse?.pagination || {},
        message: 'Parties loaded from cache'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    await dbConnect();

    let query = {};
    
    // If search parameter is provided, search by name with case-insensitive partial match
    if (search && search.trim()) {
      query = {
        name: { $regex: search.trim(), $options: 'i' }
      };
    }

    // ⚡ OPTIMIZED: Get parties with pagination, search filter, sorted by name
    const [parties, totalCount] = await Promise.all([
      Party.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .select('_id name contactName contactPhone address createdAt updatedAt')
        .lean() // ⚡ Already using .lean() - good!
        .maxTimeMS(2000),
      Party.countDocuments(query).maxTimeMS(2000)
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const responseData = {
      data: parties,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    };

    // Update cache - store parties array directly for consistency
    partiesCache.set(cacheKey, {
      data: {
        data: parties,
        pagination: responseData.pagination
      },
      timestamp: Date.now()
    });

    // ⚡ ISR CACHING: Add cache tags for revalidation
    const headers = {
      ...getCacheHeaders(CACHE_DURATIONS.PARTIES),
      'Content-Type': 'application/json',
      'X-Cache-Tags': CACHE_TAGS.PARTIES,
      'X-Cache': 'MISS',
      'X-Response-Time': `${Date.now() - startTime}ms`
    } as Record<string, string>;

    return new Response(JSON.stringify({ 
      success: true, 
      ...responseData,
      message: 'Parties fetched successfully'
    }), { 
      status: 200, 
      headers
    });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Parties API GET error:', error);
    }
    
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Unauthorized" 
        }), { status: 401 });
      }
      if (error.message.includes("timeout")) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Request timeout" 
        }), { status: 408 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ 
      success: false, 
      message: "Parties API error: " + message 
    }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session - handle auth errors gracefully
    try {
      await requireAuth(req);
    } catch (authError) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Unauthorized. Please log in again.',
        error: 'AUTH_REQUIRED'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { name, contactName, contactPhone, address } = await req.json();

    // Validation
    const errors: string[] = [];
    
    if (!name || !name.trim()) {
      errors.push("Party name is required");
    } else if (name.trim().length < 2) {
      errors.push("Party name must be at least 2 characters long");
    } else if (name.trim().length > 100) {
      errors.push("Party name cannot exceed 100 characters");
    }
    
    if (contactName && contactName.trim().length > 50) {
      errors.push("Contact name cannot exceed 50 characters");
    }
    
    if (contactPhone && contactPhone.trim().length > 20) {
      errors.push("Contact phone cannot exceed 20 characters");
    }
    
    if (address && address.trim().length > 200) {
      errors.push("Address cannot exceed 200 characters");
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: errors.join(", ") 
        }), 
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if party with same name already exists (case-insensitive)
    const existingParty = await Party.findOne({ 
      name: { $regex: `^${name.trim()}$`, $options: 'i' } 
    });
    
    if (existingParty) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "A party with this name already exists" 
        }), 
        { status: 400 }
      );
    }

    // Create party data object
    const partyData = {
      name: name.trim(),
      contactName: contactName ? contactName.trim() : undefined,
      contactPhone: contactPhone ? contactPhone.trim() : undefined,
      address: address ? address.trim() : undefined,
    };
    
    const createdParty = await Party.create(partyData);

    // Log the party creation (async, non-blocking)
    logCreate('party', (createdParty as any)._id.toString(), { 
      name: createdParty.name,
      contactName: createdParty.contactName,
      contactPhone: createdParty.contactPhone
    }, req).catch(() => {});

    // ⚡ CACHE REVALIDATION - Invalidate both in-memory and Next.js ISR cache
    clearPartiesCache();
    revalidateTag(CACHE_TAGS.PARTIES);
    revalidateTag(CACHE_TAGS.ORDERS); // Parties affect orders

    // Return the created party without sensitive fields
    const partySafe = {
      _id: createdParty._id,
      name: createdParty.name,
      contactName: createdParty.contactName,
      contactPhone: createdParty.contactPhone,
      address: createdParty.address,
      createdAt: createdParty.createdAt,
      updatedAt: createdParty.updatedAt,
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Party created successfully", 
        data: partySafe 
      }), 
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Unauthorized" 
        }), { status: 401 });
      }
      
      // Handle MongoDB duplicate key errors
      if (error.message.includes('E11000')) {
        if (error.message.includes('name')) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "A party with this name already exists" 
            }), 
            { status: 400 }
          );
        }
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: validationErrors.join(", ") 
          }), 
          { status: 400 }
        );
      }
    }
    
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ 
      success: false, 
      message 
    }), { status: 500 });
  }
}
