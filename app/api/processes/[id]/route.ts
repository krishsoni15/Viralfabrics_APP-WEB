import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Process from '@/models/Process';
import { 
  ValidationError, 
  NotFoundError 
} from '@/lib/errors';
// Removed unused response imports
import { logUpdate, logDelete } from '@/lib/logger';

// Professional in-memory cache for processes data
const processesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance

// GET /api/processes/[id] - Get single process
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check cache first
    const cacheKey = `process-${id}`;
    const cached = processesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        message: 'Process loaded from cache'
      }, { status: 200 });
    }

    await dbConnect();
    
    const process = await Process.findById(id);
    if (!process) {
      return NextResponse.json({
        success: false,
        message: 'Process not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Update cache
    processesCache.set(cacheKey, {
      data: process,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      data: process,
      message: 'Process fetched successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve process',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// PUT /api/processes/[id] - Update process
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    await dbConnect();
    
    const process = await Process.findById(id);
    if (!process) {
      return NextResponse.json({
        success: false,
        message: 'Process not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Validate required fields if provided
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({
        success: false,
        message: 'Process name cannot be empty',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (body.priority !== undefined && (isNaN(body.priority) || body.priority < 1 || body.priority > 100)) {
      return NextResponse.json({
        success: false,
        message: 'Priority must be a number between 1 and 100',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check for duplicate name if name is being updated
    if (body.name && body.name !== process.name) {
      const existingProcess = await Process.findOne({ 
        name: { $regex: body.name, $options: 'i' },
        _id: { $ne: id }
      });
      if (existingProcess) {
        return NextResponse.json({
          success: false,
          message: 'Process with this name already exists',
          timestamp: new Date().toISOString()
        }, { status: 409 });
      }
    }

    // Update process
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.priority !== undefined) updateData.priority = parseInt(body.priority);
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updatedProcess = await Process.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Log the process update
    await logUpdate('process', id, updateData, updatedProcess?.toObject() ?? updateData, request);

    // Clear cache
    processesCache.clear();

    return NextResponse.json({
      success: true,
      data: updatedProcess,
      message: 'Process updated successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

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
      message: 'Failed to update process',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE /api/processes/[id] - Delete process (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await dbConnect();
    
    const process = await Process.findById(id);
    if (!process) {
      return NextResponse.json({
        success: false,
        message: 'Process not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Soft delete by setting isActive to false
    const deletedProcess = await Process.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    // Log the process deletion
    logDelete('process', id, {}, req);

    // Clear cache
    processesCache.clear();

    return NextResponse.json({
      success: true,
      data: deletedProcess,
      message: 'Process deleted successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to delete process',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
