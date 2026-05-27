import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { requireAuth } from '@/lib/session';
import { logCreate, logError } from '@/lib/logger';
import { checkRateLimitOrError, apiRateLimiter } from '@/lib/rateLimit';
import mongoose from 'mongoose';

// GET /api/dispatch - Get all dispatch records
export async function GET(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    await requireAuth(request);

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    let query: any = {};
    if (orderId) {
      query.orderId = orderId;
    }

    const { Dispatch, Order, Quality } = await import('@/models');
    
    // ⚡ ULTRA-FAST: Query without populate (fetch related data separately)
    const [dispatches, total] = await Promise.all([
      Dispatch.find(query)
        .select('order orderId dispatchDate billNo transportNo lrNo finishMtr saleRate quality totalValue createdAt')
        .sort({ dispatchDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(2000),
      Dispatch.countDocuments(query).maxTimeMS(1000)
    ]);

    // ⚡ Fetch orders and qualities separately (MUCH faster than populate)
    const orderIds = [...new Set(dispatches.map((d: any) => d.order).filter(Boolean))];
    const qualityIds = [...new Set(dispatches.map((d: any) => d.quality).filter(Boolean))];

    const [orders, qualities] = await Promise.all([
      orderIds.length > 0 ? Order.find({ _id: { $in: orderIds } })
        .select('_id orderId')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

    const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Attach orders and qualities to dispatches
    const populatedDispatches = dispatches.map((dispatch: any) => ({
      ...dispatch,
      order: dispatch.order ? orderMap.get(dispatch.order.toString()) || null : null,
      quality: dispatch.quality ? qualityMap.get(dispatch.quality.toString()) || null : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        dispatches: populatedDispatches,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to view dispatch', error, { context: 'view', request });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/dispatch - Create new dispatch record
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check for write operations
    const { writeRateLimiter, checkRateLimitOrError } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    await requireAuth(request);
    await dbConnect();
    const body = await request.json();
    const { orderId, dispatchDate, billNo, transportNo, lrNo, finishMtr, saleRate, quality } = body;

    // Validate required fields
    if (!orderId || !dispatchDate || !billNo || !finishMtr) {
      return NextResponse.json(
        { error: 'Order ID, dispatch date, bill number, and finish meters are required' },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (isNaN(Number(finishMtr)) || Number(finishMtr) < 0) {
      return NextResponse.json(
        { error: 'Finish meters must be a valid positive number' },
        { status: 400 }
      );
    }

    // Validate saleRate if provided
    if (saleRate !== undefined && saleRate !== null && saleRate !== '') {
      if (isNaN(Number(saleRate)) || Number(saleRate) < 0) {
        return NextResponse.json(
          { error: 'Sale rate must be a valid positive number' },
          { status: 400 }
        );
      }
    }

    // Find the order by orderId to get the ObjectId
    const { Order, Dispatch, Quality } = await import('@/models');
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    // Create new dispatch record
    const finishMtrNum = Number(finishMtr);
    const saleRateNum = saleRate !== undefined && saleRate !== null && saleRate !== '' ? Number(saleRate) : 0;
    const totalValue = finishMtrNum * saleRateNum;
    
    // Handle quality ObjectId conversion
    let qualityObjectId = null;
    if (quality && quality.trim() !== '') {
      try {
        qualityObjectId = new mongoose.Types.ObjectId(quality);
        } catch (objectIdError) {
        qualityObjectId = null;
      }
    } else {
      }

    const dispatchData: any = {
      orderId,
      order: order._id, // Use the actual ObjectId reference
      dispatchDate: new Date(dispatchDate),
      billNo: billNo.trim(),
      finishMtr: finishMtrNum,
      saleRate: saleRateNum,
      quality: qualityObjectId,
      totalValue: totalValue
    };
    // Optional transport/lr fields
    if (typeof transportNo === 'string') {
      dispatchData.transportNo = transportNo.trim();
    }
    if (typeof lrNo === 'string') {
      dispatchData.lrNo = lrNo.trim();
    }
    
    const dispatch = await Dispatch.create(dispatchData);
    
    // ⚡ Fetch related data separately for logging (faster than populate)
    const [fetchedOrder, fetchedQuality] = await Promise.all([
      Order.findById(order._id).select('_id orderId').lean().maxTimeMS(1000),
      qualityObjectId ? Quality.findById(qualityObjectId).select('_id name').lean().maxTimeMS(1000) : Promise.resolve(null)
    ]);
    
    const populatedDispatch = {
      ...dispatch.toObject(),
      order: fetchedOrder,
      quality: fetchedQuality
    };
    
    // Log the creation
    try {
      await logCreate('dispatch', (populatedDispatch as any)?._id?.toString() || 'unknown', {
        orderId,
        orderObjectId: order._id?.toString(),
        dispatchDate: populatedDispatch?.dispatchDate,
        billNo: populatedDispatch?.billNo,
        transportNo: populatedDispatch?.transportNo,
        lrNo: populatedDispatch?.lrNo,
        finishMtr: populatedDispatch?.finishMtr,
        saleRate: populatedDispatch?.saleRate,
        totalValue: populatedDispatch?.totalValue,
        quality: populatedDispatch?.quality,
        items: populatedDispatch?.items
      }, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }
    
    // Return the created dispatch
    return NextResponse.json({
      success: true,
      data: populatedDispatch || dispatch.toObject(),
      message: 'Dispatch record created successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to create dispatch', error, { context: 'dispatch_create', request });
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/dispatch - Bulk delete dispatches by orderId
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting check for write operations
    const { writeRateLimiter, checkRateLimitOrError } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    await dbConnect();
    
    // Validate session
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required for bulk deletion' },
        { status: 400 }
      );
    }

    // Delete all dispatches for the specified order
    const { Dispatch } = await import('@/models');
    const result = await Dispatch.deleteMany({ orderId });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗑️ Deleted ${result.deletedCount} dispatches for order: ${orderId}`);
    }

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.deletedCount },
      message: 'Dispatches deleted successfully'
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to delete dispatches', error, { context: 'dispatch_delete', request });
    return NextResponse.json(
      { success: false, error: 'Failed to delete dispatches' },
      { status: 500 }
    );
  }
}