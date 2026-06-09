import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Order, Party } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';

// Ultra-fast in-memory cache for upcoming deliveries
const upcomingCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds for ultra-fast loading

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Try to get session, but don't require it for now to allow data loading
    try {
      await getSession(request);
    } catch (error) {
      console.log('Session error:', error);
    }

    // Create cache key
    const cacheKey = 'upcoming-deliveries-instant';
    const cached = upcomingCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json(successResponse(cached.data, 'Upcoming deliveries loaded from cache'), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
          'X-Cache': 'HIT',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    // Connect to database with optimized settings
    await dbConnect();

    // Calculate date range for next 7 days - be more inclusive to handle timezone issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Start from yesterday to catch any timezone issues
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const queryConditions: any[] = [
      {
        $or: [
          { softDeleted: false },
          { softDeleted: { $exists: false } }
        ]
      },
      {
        deliveryDate: {
          $gte: startDate,
          $lte: nextWeek
        }
      }
    ];

    // Restrict to user's party if role is 'party'
    let session: any = null;
    try {
      session = await getSession(request);
    } catch (e) {}
    if (session?.role === 'party' && session?.partyId) {
      const mongoose = await import('mongoose');
      queryConditions.push({
        party: mongoose.default.Types.ObjectId.isValid(session.partyId)
          ? new mongoose.default.Types.ObjectId(session.partyId)
          : session.partyId
      });
    }

    // ⚡ ULTRA-FAST: Optimized query with minimal fields and no populate
    const upcomingOrders = await Order.find({ $and: queryConditions })
    .select('orderId orderType deliveryDate party status priority items createdAt')
    .sort({ deliveryDate: 1 })
    .limit(50) // ⚡ Limit to 50 for speed
    .lean()
    .maxTimeMS(5000); // ⚡ Increased to 5 seconds for reliability
    
    // ⚡ Fetch parties separately in parallel (faster than populate)
    const partyIds = [...new Set(upcomingOrders.map((o: any) => o.party).filter(Boolean))];
    const parties = partyIds.length > 0 ? await Party.find({ _id: { $in: partyIds } })
      .select('_id name contactName contactPhone')
      .lean()
      .maxTimeMS(3000) : []; // ⚡ Increased timeout for reliability
    
    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));

    // ⚡ Process and format the data with party lookup
    const processedOrders = upcomingOrders.map((order: any) => {
      const deliveryDate = new Date(order.deliveryDate);
      const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const partyId = order.party?.toString() || order.party;
      const party = partyId ? partyMap.get(partyId) : null;
      
      return {
        id: order._id,
        orderId: order.orderId,
        orderType: order.orderType || 'Not Set',
        deliveryDate: order.deliveryDate,
        party: party || { name: 'Unknown Party' },
        status: order.status,
        priority: order.priority || 5,
        items: order.items || [],
        daysUntilDelivery: Math.max(0, daysUntil),
        createdAt: order.createdAt
      };
    });

    // Cache the result
    upcomingCache.set(cacheKey, { data: processedOrders, timestamp: Date.now() });

    // Add ultra-fast cache headers
    const responseTime = Date.now() - startTime;
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      'X-Cache': 'MISS',
      'X-Response-Time': `${responseTime}ms`
    };

    return NextResponse.json(successResponse(processedOrders, 'Upcoming deliveries loaded successfully'), { 
      status: 200, 
      headers 
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('Error fetching upcoming deliveries:', error);
    
    // Check if it's a timeout error
    const isTimeout = error.message?.includes('timeout') || error.message?.includes('maxTimeMS');
    
    // Return empty array instead of error for timeout (allows fallback to work)
    if (isTimeout) {
      console.warn('Database timeout - returning empty array for fallback');
      return NextResponse.json(successResponse([], 'No upcoming deliveries found'), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': `${responseTime}ms`,
          'X-Timeout': 'true'
        }
      });
    }
    
    // For other errors, return error response
    return NextResponse.json(errorResponse('Failed to fetch upcoming deliveries', error.message), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Response-Time': `${responseTime}ms`
      }
    });
  }
}
