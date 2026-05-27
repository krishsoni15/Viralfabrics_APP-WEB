import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Process from '@/models/Process';
// Removed unused validation imports
import { 
  ValidationError, 
  NotFoundError 
} from '@/lib/errors';
import { logCreate } from '@/lib/logger';

// Professional in-memory cache for processes data
const processesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance

// GET /api/processes - List processes with pagination and search
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check cache first
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);
    const search = url.searchParams.get('search') || '';
    const sortBy = url.searchParams.get('sortBy') || 'priority';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const cacheKey = `processes-${search || 'all'}-${limit}-${sortBy}-${sortOrder}`;
    
    const cached = processesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        message: 'Processes loaded from cache'
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    // Connect to database
    await dbConnect();
    
    // Build query
    const query: any = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    if (sortBy === 'priority') {
      sort.priority = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'name') {
      sort.name = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.priority = -1; // Default to priority desc
    }
    sort.name = 1; // Secondary sort by name

    // Optimized query with limits and timeout
    const processes = await Process.find(query)
      .sort(sort)
      .limit(limit)
      .lean()
      .maxTimeMS(200); // 200ms timeout for 50ms target

    // Update cache
    processesCache.set(cacheKey, {
      data: processes,
      timestamp: Date.now()
    });

    return new Response(JSON.stringify({
      success: true,
      data: processes,
      message: 'Processes fetched successfully'
    }), { 
      status: 200, 
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to retrieve processes'
    }), { status: 500 });
  }
}

// POST /api/processes - Create new process
export async function POST(request: NextRequest) {
  try {
    // Connect to database
    await dbConnect();
    
    // Parse and validate request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.priority) {
      return NextResponse.json({
        success: false,
        message: 'Process name and priority are required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check if process with same name already exists
    const existingProcess = await Process.findOne({ name: { $regex: body.name, $options: 'i' } });
    if (existingProcess) {
      return NextResponse.json({
        success: false,
        message: 'Process with this name already exists',
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }

    // Create new process
    const process = new Process({
      name: body.name.trim(),
      priority: parseInt(body.priority),
      description: body.description?.trim() || '',
      isActive: body.isActive !== undefined ? body.isActive : true
    });
    
    const savedProcess = await process.save();

    // Log the process creation
    await logCreate('process', (savedProcess as any)._id.toString(), { 
      name: savedProcess.name,
      priority: savedProcess.priority,
      description: savedProcess.description
    }, request);

    // Clear cache
    processesCache.clear();

    // Return success response
    const response = {
      success: true,
      data: savedProcess,
      message: 'Process created successfully',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return NextResponse.json({
          success: false,
          message: 'Process with this name already exists',
          timestamp: new Date().toISOString()
        }, { status: 409 });
      }
    }
    
    return NextResponse.json({
      success: false,
      message: 'Failed to create process - invalid data received',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
