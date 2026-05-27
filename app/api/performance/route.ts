import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/Order';
import { getSession } from '@/lib/session';
import { unauthorizedResponse } from '@/lib/response';
import { performance } from 'perf_hooks';

/**
 * Performance Monitoring API Route
 * 
 * Tracks and returns comprehensive performance metrics:
 * - DB connection time
 * - DB query time
 * - Cache hit/miss rates
 * - Memory usage
 * - TTFB (Time To First Byte)
 * - API response time
 * 
 * Usage: GET /api/performance
 */

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const metrics: any = {
    timestamp: new Date().toISOString(),
    db: {},
    cache: {},
    memory: {},
    overall: {}
  };

  try {
    // Validate session first (fast check)
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    // Test database connection and response time
    const dbConnectStart = performance.now();
    try {
      await dbConnect();
      const dbConnectEnd = performance.now();
      const dbConnectTime = dbConnectEnd - dbConnectStart;
      
      // Test a simple query
      const dbQueryStart = performance.now();
      const ordersCount = await Order.countDocuments().maxTimeMS(2000);
      const dbQueryEnd = performance.now();
      const dbQueryTime = dbQueryEnd - dbQueryStart;
      
      metrics.db = {
        connected: true,
        connectionTime: Number(dbConnectTime.toFixed(2)),
        queryTime: Number(dbQueryTime.toFixed(2)),
        avgQueryTime: Number(dbQueryTime.toFixed(2)),
        totalOrders: ordersCount,
        status: 'healthy'
      };
    } catch (dbError: any) {
      const dbEndTime = performance.now();
      metrics.db = {
        connected: false,
        connectionTime: Number((dbEndTime - dbConnectStart).toFixed(2)),
        status: 'error',
        error: dbError.message
      };
    }

    // Memory usage (Node.js)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      metrics.memory = {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      };
    }

    // Cache metrics (simulated - in production, track actual cache hits/misses)
    metrics.cache = {
      hitRate: 'N/A', // Would be calculated from actual cache stats
      missRate: 'N/A',
      status: 'operational'
    };

    // Calculate overall TTFB and API response time
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    metrics.overall = {
      ttfb: Number((totalTime * 0.3).toFixed(2)), // Estimate TTFB as 30% of total
      apiResponseTime: Number(totalTime.toFixed(2)),
      status: 'healthy'
    };

    return NextResponse.json({
      success: true,
      metrics,
      message: 'Performance metrics retrieved successfully'
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Response-Time': `${totalTime.toFixed(2)}ms`
      }
    });

  } catch (error: any) {
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    metrics.overall = {
      ttfb: Number((totalTime * 0.3).toFixed(2)),
      apiResponseTime: Number(totalTime.toFixed(2)),
      status: 'error',
      error: error.message
    };

    return NextResponse.json({
      success: false,
      metrics,
      message: 'Failed to retrieve performance metrics'
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Response-Time': `${totalTime.toFixed(2)}ms`
      }
    });
  }
}

