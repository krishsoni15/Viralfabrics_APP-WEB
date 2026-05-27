import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/Order';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from '@/lib/cacheConfig';

// Ultra-fast in-memory cache for dashboard stats
const statsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for ultra-fast loading

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Validate session first (fast check)
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    // Get filter parameters from URL
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const financialYear = searchParams.get('financialYear');

    // Create cache key based on filters
    const cacheKey = `dashboard-stats-${startDate || 'all'}-${endDate || 'all'}-${financialYear || 'all'}`;
    const cached = statsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json(successResponse(cached.data, 'Dashboard stats loaded from cache'), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCacheHeaders(CACHE_DURATIONS.DASHBOARD_STATS),
          'X-Cache': 'HIT',
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Cache-Tags': `${CACHE_TAGS.DASHBOARD},${CACHE_TAGS.STATS}`
        }
      });
    }

    // Connect to database with optimized settings
    await dbConnect();

    // Build match conditions based on filters
    const matchConditions: any = {
      $or: [
        { softDeleted: false },
        { softDeleted: { $exists: false } }
      ]
    };

    // Add date filters
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) {
        matchConditions.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchConditions.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    // Add financial year filter
    if (financialYear && financialYear !== 'all') {
      const [startYear, endYear] = financialYear.split('-');
      const fyStartDate = new Date(`${startYear}-04-01`);
      const fyEndDate = new Date(`${endYear}-03-31T23:59:59.999Z`);
      
      if (!matchConditions.createdAt) {
        matchConditions.createdAt = {};
      }
      matchConditions.createdAt.$gte = fyStartDate;
      matchConditions.createdAt.$lte = fyEndDate;
    }

    // ⚡ Use $facet for a single aggregation instead of multiple queries
    const [aggregateResult] = await Order.aggregate([
      { $match: matchConditions },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: '$orderType', count: { $sum: 1 } } }
          ],
          pendingByType: [
            { 
              $match: { 
                $or: [
                  { status: { $in: ['pending', 'Not set', 'Not selected', null] } },
                  { status: { $exists: false } }
                ]
              }
            },
            { $group: { _id: '$orderType', count: { $sum: 1 } } }
          ],
          deliveredByType: [
            { $match: { status: 'delivered' } },
            { $group: { _id: '$orderType', count: { $sum: 1 } } }
          ],
          // Real monthly trends - last 12 months
          monthlyTrends: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ]
        }
      }
    ]).option({ maxTimeMS: 5000, allowDiskUse: true });

    // Extract results from facet
    const totalCount = aggregateResult?.total?.[0]?.count || 0;
    const statusStats = aggregateResult?.byStatus || [];
    const typeStats = aggregateResult?.byType || [];
    const pendingTypeStats = aggregateResult?.pendingByType || [];
    const deliveredTypeStats = aggregateResult?.deliveredByType || [];

    // Extract data from the parallel queries
    const totalOrders = totalCount;

    // Process status stats
    const processedStatusStats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      delivered: 0,
      cancelled: 0,
      not_set: 0
    };

    statusStats.forEach((stat: any) => {
      const status = stat._id;
      
      if (!status || status === 'Not set' || status === 'Not selected') {
        processedStatusStats.not_set += stat.count;
      } else if (status === 'pending') {
        processedStatusStats.pending += stat.count;
      } else if (status === 'in_progress') {
        processedStatusStats.in_progress += stat.count;
      } else if (status === 'completed') {
        processedStatusStats.completed += stat.count;
      } else if (status === 'delivered') {
        processedStatusStats.delivered += stat.count;
      } else if (status === 'cancelled') {
        processedStatusStats.cancelled += stat.count;
      } else {
        // Fallback: treat unknown status as not_set
        processedStatusStats.not_set += stat.count;
      }
    });

    // Process type stats
    const processedTypeStats = {
      Dying: 0,
      Printing: 0,
      not_set: 0
    };

    typeStats.forEach((stat: any) => {
      const type = stat._id;
      
      if (!type) {
        processedTypeStats.not_set += stat.count;
      } else if (type === 'Dying') {
        processedTypeStats.Dying += stat.count;
      } else if (type === 'Printing') {
        processedTypeStats.Printing += stat.count;
      } else {
        // Fallback: treat unknown type as not_set
        processedTypeStats.not_set += stat.count;
      }
    });

    // Process pending type stats
    const processedPendingTypeStats = {
      Dying: 0,
      Printing: 0,
      not_set: 0
    };

    pendingTypeStats.forEach((stat: any) => {
      const type = stat._id;
      if (!type) {
        processedPendingTypeStats.not_set += stat.count;
      } else if (type === 'Dying') {
        processedPendingTypeStats.Dying += stat.count;
      } else if (type === 'Printing') {
        processedPendingTypeStats.Printing += stat.count;
      }
    });

    // Process delivered type stats
    const processedDeliveredTypeStats = {
      Dying: 0,
      Printing: 0,
      not_set: 0
    };

    deliveredTypeStats.forEach((stat: any) => {
      const type = stat._id;
      if (!type) {
        processedDeliveredTypeStats.not_set += stat.count;
      } else if (type === 'Dying') {
        processedDeliveredTypeStats.Dying += stat.count;
      } else if (type === 'Printing') {
        processedDeliveredTypeStats.Printing += stat.count;
      }
    });

    // Real monthly trends from aggregation (already sorted newest first, reverse for chart)
    const rawMonthlyTrends = aggregateResult?.monthlyTrends || [];
    const monthlyTrends = rawMonthlyTrends
      .map((item: { _id: { year: number; month: number }; count: number }) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        count: item.count
      }))
      .reverse(); // Oldest first for charts

    const dashboardStats = {
      totalOrders,
      statusStats: processedStatusStats,
      typeStats: processedTypeStats,
      pendingTypeStats: processedPendingTypeStats,
      deliveredTypeStats: processedDeliveredTypeStats,
      monthlyTrends,
      recentOrders: [] // Empty for now to keep it fast
    };

    // Cache the result
    statsCache.set(cacheKey, { data: dashboardStats, timestamp: Date.now() });

    // ⚡ Add ISR cache headers with dashboard tag
    const responseTime = Date.now() - startTime;
    const headers = {
      'Content-Type': 'application/json',
      ...getCacheHeaders(CACHE_DURATIONS.DASHBOARD_STATS),
      'X-Cache': 'MISS',
      'X-Response-Time': `${responseTime}ms`,
      'X-Cache-Tags': `${CACHE_TAGS.DASHBOARD},${CACHE_TAGS.STATS}`
    };

    return NextResponse.json(successResponse(dashboardStats, 'Dashboard stats loaded successfully'), { 
      status: 200, 
      headers 
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('Dashboard stats error:', error);
    
    // Handle specific error types with better error messages
    if (error.name === 'MongoServerError') {
      return NextResponse.json(errorResponse('Database connection error. Please try again.'), { 
        status: 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Error-Type': 'database-connection'
        }
      });
    } else if (error.name === 'MongoTimeoutError' || error.message?.includes('timeout')) {
      return NextResponse.json(errorResponse('Request timeout. Please try again.'), { 
        status: 408,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Error-Type': 'timeout'
        }
      });
    } else if (error.message?.includes('connect')) {
      return NextResponse.json(errorResponse('Unable to connect to database. Please try again.'), { 
        status: 503,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Error-Type': 'database-unavailable'
        }
      });
    }
    
    return NextResponse.json(errorResponse('Failed to load dashboard stats. Please try again.'), { 
      status: 500,
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Error-Type': 'unknown'
      }
    });
  }
}