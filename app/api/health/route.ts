import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency: number | null;
      message?: string;
    };
    memory: {
      status: 'healthy' | 'warning' | 'critical';
      usage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
      };
      percentUsed: number;
    };
  };
}

export async function GET() {
  const startTime = Date.now();
  
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: {
        status: 'unhealthy',
        latency: null,
      },
      memory: {
        status: 'healthy',
        usage: {
          heapUsed: 0,
          heapTotal: 0,
          rss: 0,
          external: 0,
        },
        percentUsed: 0,
      },
    },
  };

  // Check database connection
  const dbStartTime = Date.now();
  try {
    await dbConnect();
    
    // Ping database
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      health.checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStartTime,
      };
    } else {
      health.checks.database = {
        status: 'unhealthy',
        latency: Date.now() - dbStartTime,
        message: 'Database connection not established',
      };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      latency: Date.now() - dbStartTime,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    health.status = 'unhealthy';
  }

  // Check memory usage
  try {
    const memUsage = process.memoryUsage();
    const percentUsed = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    let memoryStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (percentUsed > 90) {
      memoryStatus = 'critical';
      if (health.status === 'healthy') health.status = 'degraded';
    } else if (percentUsed > 75) {
      memoryStatus = 'warning';
    }
    
    health.checks.memory = {
      status: memoryStatus,
      usage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      percentUsed: Math.round(percentUsed),
    };
  } catch (error) {
    health.checks.memory.status = 'warning';
  }

  // Determine overall status
  if (health.checks.database.status === 'unhealthy') {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  });
}
