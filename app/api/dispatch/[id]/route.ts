import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Dispatch } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, notFoundResponse, updatedResponse, deletedResponse } from '@/lib/response';
import { logUpdate, logDelete, logError } from '@/lib/logger';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { id } = await params;

    const dispatch = await Dispatch.findById(id)
      .populate('order', 'orderId orderType party')
      .lean() as any;
    
    if (!dispatch) {
      return NextResponse.json(notFoundResponse('Dispatch'), { status: 404 });
    }

    return NextResponse.json(successResponse(dispatch, 'Dispatch fetched successfully'));

  } catch (error: any) {
    return NextResponse.json(errorResponse('Failed to fetch dispatch'), { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const body = await request.json();
    const { dispatchDate, billNo, transportNo, lrNo, finishMtr, saleRate } = body;

    // Check if dispatch exists and store old values
    const existingDispatch = await Dispatch.findById(id)
      .populate('order', 'orderId')
      .populate('quality', 'name')
      .lean() as any;
    if (!existingDispatch) {
      return NextResponse.json(notFoundResponse('Dispatch'), { status: 404 });
    }
    
    // Store old values for logging
    const oldValues = {
      dispatchDate: existingDispatch.dispatchDate,
      billNo: existingDispatch.billNo,
      transportNo: existingDispatch.transportNo,
      lrNo: existingDispatch.lrNo,
      finishMtr: existingDispatch.finishMtr,
      saleRate: existingDispatch.saleRate,
      totalValue: existingDispatch.totalValue,
      orderId: (existingDispatch.order as any)?.orderId || existingDispatch.order,
      quality: existingDispatch.quality,
      items: existingDispatch.items
    };

    // Validate required fields
    if (!dispatchDate) {
      return NextResponse.json(validationErrorResponse('Dispatch date is required'), { status: 400 });
    }
    if (!billNo) {
      return NextResponse.json(validationErrorResponse('Bill number is required'), { status: 400 });
    }
    if (!finishMtr || finishMtr <= 0) {
      return NextResponse.json(validationErrorResponse('Valid finish meters is required'), { status: 400 });
    }
    // Validate saleRate if provided
    if (saleRate !== undefined && saleRate !== null && saleRate !== '' && (isNaN(Number(saleRate)) || Number(saleRate) < 0)) {
      return NextResponse.json(validationErrorResponse('Sale rate must be a valid positive number'), { status: 400 });
    }

    // Calculate total value
    const saleRateNum = saleRate !== undefined && saleRate !== null && saleRate !== '' ? parseFloat(saleRate) : 0;
    const totalValue = parseFloat(finishMtr) * saleRateNum;

    // Update dispatch
    const updateData: any = {
      dispatchDate: new Date(dispatchDate),
      billNo: billNo.trim(),
      finishMtr: parseFloat(finishMtr),
      totalValue: totalValue
    };
    
    // Only include saleRate if it's provided
    if (saleRate !== undefined && saleRate !== null && saleRate !== '') {
      updateData.saleRate = parseFloat(saleRate);
    }
    if (typeof transportNo === 'string') {
      updateData.transportNo = transportNo.trim();
    }
    if (typeof lrNo === 'string') {
      updateData.lrNo = lrNo.trim();
    }
    
    const updatedDispatch = await Dispatch.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDispatch) {
      return NextResponse.json(notFoundResponse('Dispatch'), { status: 404 });
    }

    // Populate references for response
    const populatedDispatch = await Dispatch.findById(updatedDispatch._id)
      .populate('order', 'orderId orderType party')
      .populate('quality', 'name')
      .lean() as any;

    // Store new values for logging
    const newValues = {
      dispatchDate: populatedDispatch?.dispatchDate,
      billNo: populatedDispatch?.billNo,
      transportNo: populatedDispatch?.transportNo,
      lrNo: populatedDispatch?.lrNo,
      finishMtr: populatedDispatch?.finishMtr,
      saleRate: populatedDispatch?.saleRate,
      totalValue: populatedDispatch?.totalValue,
      orderId: (populatedDispatch?.order as any)?.orderId || populatedDispatch?.order,
      quality: populatedDispatch?.quality,
      items: populatedDispatch?.items
    };

    // Log the update with complete oldValues and newValues
    try {
      await logUpdate('dispatch', id, oldValues, newValues, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(updatedResponse(populatedDispatch, 'Dispatch updated successfully'));

  } catch (error: any) {
    await logError('Failed to update dispatch', error, { context: 'dispatch_update', request });
    return NextResponse.json(errorResponse('Failed to update dispatch'), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master') {
      return NextResponse.json({ success: false, error: 'Access denied - Only master can delete' }, { status: 403 });
    }

    await dbConnect();

    const { id } = await params;

    // Get dispatch before deletion for logging
    const dispatch = await Dispatch.findById(id)
      .populate('order', 'orderId')
      .populate('quality', 'name')
      .lean() as any;
    if (!dispatch) {
      return NextResponse.json(notFoundResponse('Dispatch'), { status: 404 });
    }

    // Delete dispatch
    await Dispatch.findByIdAndDelete(id);

    // Log the deletion
    try {
      logDelete('dispatch', id, {}, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(deletedResponse('Dispatch deleted successfully'));

  } catch (error: any) {
    await logError('Failed to delete dispatch', error, { context: 'dispatch_delete', request });
    return NextResponse.json(errorResponse('Failed to delete dispatch'), { status: 500 });
  }
}
