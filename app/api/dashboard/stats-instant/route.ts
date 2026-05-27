import { NextRequest, NextResponse } from 'next/server';
import { successResponse } from '@/lib/response';
import { Order } from '@/models';
import dbConnect from '@/lib/dbConnect';
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from "@/lib/cacheConfig";

// In-memory cache for ultra-fast loading
let dashboardCache = {
  data: null as any,
  timestamp: 0,
  ttl: 30 * 1000 // 30 seconds cache
};

// Global cache map for filter-specific caching
const getCacheMap = (): Map<string, { data: any; timestamp: number }> => {
  if (typeof (global as any).dashboardCacheMap === 'undefined') {
    (global as any).dashboardCacheMap = new Map<string, { data: any; timestamp: number }>();
  }
  return (global as any).dashboardCacheMap;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Get cache map once at the start
  const cacheMap = getCacheMap();
  
  try {
    // Get filter parameters from URL
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const financialYear = searchParams.get('financialYear');

    // Create cache key based on filters
    const cacheKey = `dashboard-stats-${startDate || 'all'}-${endDate || 'all'}-${financialYear || 'all'}`;
    
    // Check cache first (using a Map for multiple filter combinations)
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < dashboardCache.ttl) {
      const responseTime = Date.now() - startTime;
      // ⚡ ISR CACHING: Add cache tags
      const headers = {
        ...getCacheHeaders(CACHE_DURATIONS.DASHBOARD_STATS),
        'Content-Type': 'application/json',
        'X-Cache-Tags': CACHE_TAGS.DASHBOARD,
        'X-Cache': 'HIT',
        'X-Response-Time': `${responseTime}ms`
      } as Record<string, string>;
      
      return NextResponse.json(successResponse(cached.data, 'Dashboard stats loaded from cache'), { 
        status: 200,
        headers
      });
    }

    // Connect to database
    await dbConnect();

    // Build match conditions based on filters
    const matchConditions: any = { softDeleted: { $ne: true } };

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

    // Ultra-fast simple queries for real data
    const [totalCount, statusStats, typeStats, pendingTypeStats, deliveredTypeStats] = await Promise.all([
      // Total count
      Order.countDocuments(matchConditions).maxTimeMS(200),
      
      // Status stats - simple aggregation
      Order.aggregate([
        { $match: matchConditions },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).option({ maxTimeMS: 200 }),
      
      // Type stats - simple aggregation
      Order.aggregate([
        { $match: matchConditions },
        { $group: { _id: '$orderType', count: { $sum: 1 } } }
      ]).option({ maxTimeMS: 200 }),
      
      // Pending type stats
      Order.aggregate([
        { 
          $match: {
            ...matchConditions,
            $or: [
              { status: { $in: ['pending', 'Not set', 'Not selected', null] } },
              { status: { $exists: false } }
            ]
          }
        },
        { $group: { _id: '$orderType', count: { $sum: 1 } } }
      ]).option({ maxTimeMS: 200 }),
      
      // Delivered type stats
      Order.aggregate([
        { 
          $match: {
            ...matchConditions,
            status: 'delivered'
          }
        },
        { $group: { _id: '$orderType', count: { $sum: 1 } } }
      ]).option({ maxTimeMS: 200 })
    ]);

    // Process the results
    const totalOrders = totalCount;
    
    // Process status stats
    const statusStatsMap: any = { pending: 0, in_progress: 0, completed: 0, delivered: 0, cancelled: 0, not_set: 0 };
    statusStats.forEach((stat: any) => {
      const status = stat._id || 'not_set';
      if (statusStatsMap.hasOwnProperty(status)) {
        statusStatsMap[status] = stat.count;
      } else {
        statusStatsMap.not_set += stat.count;
      }
    });

    // Process type stats
    const typeStatsMap: any = { Dying: 0, Printing: 0, not_set: 0 };
    typeStats.forEach((stat: any) => {
      const type = stat._id || 'not_set';
      if (typeStatsMap.hasOwnProperty(type)) {
        typeStatsMap[type] = stat.count;
      } else {
        typeStatsMap.not_set += stat.count;
      }
    });

    // Process pending type stats
    const pendingTypeStatsMap: any = { Dying: 0, Printing: 0, not_set: 0 };
    pendingTypeStats.forEach((stat: any) => {
      const type = stat._id || 'not_set';
      if (pendingTypeStatsMap.hasOwnProperty(type)) {
        pendingTypeStatsMap[type] = stat.count;
      } else {
        pendingTypeStatsMap.not_set += stat.count;
      }
    });

    // Process delivered type stats
    const deliveredTypeStatsMap: any = { Dying: 0, Printing: 0, not_set: 0 };
    deliveredTypeStats.forEach((stat: any) => {
      const type = stat._id || 'not_set';
      if (deliveredTypeStatsMap.hasOwnProperty(type)) {
        deliveredTypeStatsMap[type] = stat.count;
      } else {
        deliveredTypeStatsMap.not_set += stat.count;
      }
    });

    // Create the response data
    const dashboardData = {
      totalOrders,
      statusStats: statusStatsMap,
      typeStats: typeStatsMap,
      pendingTypeStats: pendingTypeStatsMap,
      deliveredTypeStats: deliveredTypeStatsMap,
      monthlyTrends: [], // Simplified for speed
      recentOrders: [] // Simplified for speed
    };

    // Update cache with filter-specific key
    cacheMap.set(cacheKey, {
      data: dashboardData,
      timestamp: Date.now()
    });
    
    // Also update legacy cache for backward compatibility
    dashboardCache.data = dashboardData;
    dashboardCache.timestamp = Date.now();

    const responseTime = Date.now() - startTime;
    // ⚡ ISR CACHING: Add cache tags for revalidation
    const headers = {
      ...getCacheHeaders(CACHE_DURATIONS.DASHBOARD_STATS),
      'Content-Type': 'application/json',
      'X-Cache-Tags': CACHE_TAGS.DASHBOARD,
      'X-Cache': 'MISS',
      'X-Response-Time': `${responseTime}ms`
    } as Record<string, string>;
    
    return NextResponse.json(successResponse(dashboardData, 'Dashboard stats loaded from database'), { 
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    
    // Try to get cached data for this specific filter combination
    const { searchParams } = new URL(request.url);
    const errorStartDate = searchParams.get('startDate');
    const errorEndDate = searchParams.get('endDate');
    const errorFinancialYear = searchParams.get('financialYear');
    const cacheKey = `dashboard-stats-${errorStartDate || 'all'}-${errorEndDate || 'all'}-${errorFinancialYear || 'all'}`;
    const cached = cacheMap.get(cacheKey);
    
    // Return cached data if available, otherwise return empty data
    const fallbackData = cached?.data || dashboardCache.data || {
      totalOrders: 0,
      statusStats: { pending: 0, in_progress: 0, completed: 0, delivered: 0, cancelled: 0, not_set: 0 },
      typeStats: { Dying: 0, Printing: 0, not_set: 0 },
      pendingTypeStats: { Dying: 0, Printing: 0, not_set: 0 },
      deliveredTypeStats: { Dying: 0, Printing: 0, not_set: 0 },
      monthlyTrends: [],
      recentOrders: []
    };

    const responseTime = Date.now() - startTime;
    return NextResponse.json(successResponse(fallbackData, 'Dashboard stats loaded with fallback data'), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'X-Cache': 'FALLBACK',
        'X-Response-Time': `${responseTime}ms`
      }
    });
  }
}
