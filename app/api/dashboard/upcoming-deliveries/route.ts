import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Order, Party } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';
import { checkRateLimitOrError, apiRateLimiter } from '@/lib/rateLimit';

// Ultra-fast in-memory cache for upcoming deliveries
const upcomingCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds for ultra-fast loading

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session first (fast check)
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    // Create cache key
    const cacheKey = 'upcoming-deliveries';
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

    // ⚡ OPTIMIZED: Query without populate (fetch related data separately - MUCH faster)
    const upcomingOrders = await Order.find({
      $and: [
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
      ]
    })
    .select('orderId orderType deliveryDate party status priority items')
    .sort({ deliveryDate: 1 })
    .lean()
    .maxTimeMS(200);
    
    // ⚡ Fetch parties separately (batch query - no N+1)
    const partyIds = [...new Set(upcomingOrders.map((o: any) => o.party).filter(Boolean))];
    const parties = partyIds.length > 0 
      ? await Party.find({ _id: { $in: partyIds } })
          .select('_id name contactName contactPhone')
          .lean()
          .maxTimeMS(100)
      : [];
    
    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    
    // Attach parties to orders
    const ordersWithParties = upcomingOrders.map((order: any) => ({
      ...order,
      party: order.party ? partyMap.get(order.party.toString()) || { name: 'Unknown Party' } : { name: 'Unknown Party' }
    }));

    // Process and format the data
    const processedOrders = ordersWithParties.map((order: any) => {
      const deliveryDate = new Date(order.deliveryDate);
      const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: order._id,
        orderId: order.orderId,
        orderType: order.orderType || 'Not Set',
        deliveryDate: order.deliveryDate,
        party: order.party || { name: 'Unknown Party' },
        status: order.status,
        priority: order.priority || 5,
        items: order.items || [],
        daysUntilDelivery: Math.max(0, daysUntil), // Ensure non-negative
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
    if (process.env.NODE_ENV === 'development') {
      console.error('Upcoming deliveries error:', error);
    }
    
    return NextResponse.json(errorResponse('Failed to load upcoming deliveries. Please try again.'), { 
      status: 500,
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Error-Type': 'unknown'
      }
    });
  }
}
