import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { requireAuth } from '@/lib/session';
import { logCreate, logError } from '@/lib/logger';
import { errorResponse } from '@/lib/response';
import mongoose from 'mongoose';

// GET /api/mill-outputs - Get all mill outputs
export async function GET(request: NextRequest) {
  try {
    // Rate limiting check
    const { checkRateLimitOrError, apiRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    await requireAuth(request);

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Ultra fast - 50ms target
    const skip = (page - 1) * limit;

    let query: any = {};
    if (orderId) {
      query.orderId = orderId;
    }

    const { MillOutput, Order, Quality } = await import('@/models');
    
    // ⚡ OPTIMIZED: Query without populate (fetch related data separately - MUCH faster)
    const [millOutputs, total] = await Promise.all([
      MillOutput.find(query)
        .select('orderId order recdDate millBillNo finishedMtr millRate quality createdAt updatedAt')
        .sort({ recdDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(200),
      MillOutput.countDocuments(query).maxTimeMS(100)
    ]);
    
    // ⚡ Fetch related data separately (batch queries - no N+1)
    const orderIds = [...new Set(millOutputs.map((mo: any) => mo.order).filter(Boolean))];
    const qualityIds = [...new Set(millOutputs.map((mo: any) => mo.quality).filter(Boolean))];
    
    const [orders, qualities] = await Promise.all([
      orderIds.length > 0 ? Order.find({ _id: { $in: orderIds } })
        .select('_id orderId orderType party')
        .lean()
        .maxTimeMS(100) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(100) : Promise.resolve([])
    ]);
    
    const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));
    
    // Attach related data to mill outputs
    const millOutputsWithQuality = millOutputs.map((output: any) => ({
      ...output,
      order: output.order ? orderMap.get(output.order.toString()) || null : null,
      quality: output.quality ? qualityMap.get(output.quality.toString()) || null : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        millOutputs: millOutputsWithQuality,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    logError('view', error, {
      resource: 'order',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/mill-outputs - Create new mill output
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check for write operations
    const { checkRateLimitOrError, writeRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    await requireAuth(request);
    await dbConnect();
    const body = await request.json();
    const { orderId, recdDate, millBillNo, finishedMtr, millRate, quality } = body;

    // Validate required fields
    if (!orderId || !recdDate || !millBillNo || !finishedMtr) {
      return NextResponse.json(
        { error: 'Order ID, received date, mill bill number, and finished meters are required' },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (isNaN(Number(finishedMtr)) || Number(finishedMtr) < 0) {
      return NextResponse.json(
        { error: 'Finished meters must be a valid positive number' },
        { status: 400 }
      );
    }

    // Validate millRate if provided
    if (millRate !== undefined && millRate !== null && millRate !== '') {
      if (isNaN(Number(millRate)) || Number(millRate) < 0) {
        return NextResponse.json(
          { error: 'Mill rate must be a valid positive number' },
          { status: 400 }
        );
      }
    }

    // Find the order by orderId to get the ObjectId
    const { Order, Quality } = await import('@/models');
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    // Import and create MillOutput
    const { MillOutput } = await import('@/models');
    // Create new mill output
    const millOutputData = {
      orderId,
      order: order._id, // Use the actual ObjectId reference
      recdDate: new Date(recdDate),
      millBillNo: millBillNo.trim(),
      finishedMtr: Number(finishedMtr),
      millRate: millRate !== undefined && millRate !== null && millRate !== '' ? Number(millRate) : undefined,
      quality: quality && quality.trim() !== '' ? new mongoose.Types.ObjectId(quality) : null
    };
    
    const millOutput = await MillOutput.create(millOutputData);
    
    // ⚡ OPTIMIZED: Fetch related data separately for logging
    const fetchedMillOutput = await MillOutput.findById(millOutput._id)
      .select('orderId order recdDate millBillNo finishedMtr millRate quality createdAt updatedAt')
      .lean() as any;
    
    if (!fetchedMillOutput) {
      return NextResponse.json(errorResponse('Failed to retrieve created mill output'), { status: 500 });
    }
    
    const orderIdRef = (fetchedMillOutput as any).order;
    const qualityId = (fetchedMillOutput as any).quality;
    
    const [orders, qualities] = await Promise.all([
      orderIdRef ? Order.find({ _id: orderIdRef }).select('_id orderId').lean().maxTimeMS(100) : Promise.resolve([]),
      qualityId ? Quality.find({ _id: qualityId }).select('_id name').lean().maxTimeMS(100) : Promise.resolve([])
    ]);
    
    const populatedMillOutput = {
      ...fetchedMillOutput,
      order: orderIdRef ? orders[0] || null : null,
      quality: qualityId ? qualities[0] || null : null
    } as any;
    
    // Log the creation
    try {
      await logCreate('mill_output', (populatedMillOutput as any)?._id?.toString() || 'unknown', {
        orderId,
        orderObjectId: order._id?.toString(),
        recdDate: populatedMillOutput?.recdDate,
        millBillNo: populatedMillOutput?.millBillNo,
        finishedMtr: populatedMillOutput?.finishedMtr,
        millRate: populatedMillOutput?.millRate,
        quality: populatedMillOutput?.quality
      }, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }
    
    // Return the created mill output
    return NextResponse.json({
      success: true,
      data: millOutput.toObject(),
      message: 'Mill output created successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('order_update', error, {
      resource: 'order',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error: ' + errorMessage 
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// DELETE /api/mill-outputs - Bulk delete mill outputs by orderId
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting check for write operations
    const { checkRateLimitOrError, writeRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session - allow master, superadmin, admin, and user to delete
    const session = await requireAuth(request);
    const allowedRoles = ['master', 'superadmin', 'admin', 'user'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied - Unauthorized role for deletion' },
        { status: 403 }
      );
    }
    
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required for bulk deletion' },
        { status: 400 }
      );
    }

    // Delete all mill outputs for the specified order
    const { MillOutput } = await import('@/models');
    const result = await MillOutput.deleteMany({ orderId });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗑️ Deleted ${result.deletedCount} mill outputs for order: ${orderId}`);
    }

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.deletedCount },
      message: 'Mill outputs deleted successfully'
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error deleting mill outputs:', error);
    }
    logError('mill_output_delete', error, {
      resource: 'mill_output',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete mill outputs' },
      { status: 500 }
    );
  }
}

