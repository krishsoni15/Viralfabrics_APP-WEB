import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { MillOutput } from '@/models';
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

    const millOutput = await MillOutput.findById(id)
      .populate('order', 'orderId orderType party')
      .populate('quality', 'name')
      .lean() as any;
    
    if (!millOutput) {
      return NextResponse.json(notFoundResponse('Mill output'), { status: 404 });
    }

    return NextResponse.json(successResponse(millOutput, 'Mill output fetched successfully'));

  } catch (error: any) {
    return NextResponse.json(errorResponse('Failed to fetch mill output'), { status: 500 });
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
    const { recdDate, millBillNo, finishedMtr, millRate, quality } = body;

    // Check if mill output exists and store old values
    const existingMillOutput = await MillOutput.findById(id)
      .populate('quality', 'name')
      .populate('order', 'orderId')
      .lean() as any;
    if (!existingMillOutput) {
      return NextResponse.json(notFoundResponse('Mill output'), { status: 404 });
    }
    
    // Store old values for logging
    const oldValues = {
      recdDate: existingMillOutput.recdDate,
      millBillNo: existingMillOutput.millBillNo,
      finishedMtr: existingMillOutput.finishedMtr,
      millRate: existingMillOutput.millRate,
      quality: existingMillOutput.quality,
      orderId: (existingMillOutput.order as any)?.orderId || existingMillOutput.order
    };

    // Validate required fields
    if (!recdDate) {
      return NextResponse.json(validationErrorResponse('Received date is required'), { status: 400 });
    }
    if (!millBillNo) {
      return NextResponse.json(validationErrorResponse('Mill bill number is required'), { status: 400 });
    }
    if (!finishedMtr || finishedMtr <= 0) {
      return NextResponse.json(validationErrorResponse('Valid finished meters is required'), { status: 400 });
    }
    // Validate millRate if provided
    if (millRate !== undefined && millRate !== null && millRate !== '' && (isNaN(Number(millRate)) || Number(millRate) < 0)) {
      return NextResponse.json(validationErrorResponse('Mill rate must be a valid positive number'), { status: 400 });
    }

    // Update mill output
    const updateData: any = {
      recdDate: new Date(recdDate),
      millBillNo: millBillNo.trim(),
      finishedMtr: parseFloat(finishedMtr),
      quality: quality || null
    };
    
    // Only include millRate if it's provided
    if (millRate !== undefined && millRate !== null && millRate !== '') {
      updateData.millRate = parseFloat(millRate);
    }
    
    const updatedMillOutput = await MillOutput.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedMillOutput) {
      return NextResponse.json(notFoundResponse('Mill output'), { status: 404 });
    }

    // Populate references for response
    const populatedMillOutput = await MillOutput.findById(updatedMillOutput._id)
      .populate('order', 'orderId orderType party')
      .populate('quality', 'name')
      .lean() as any;

    // Store new values for logging
    const newValues = {
      recdDate: populatedMillOutput?.recdDate,
      millBillNo: populatedMillOutput?.millBillNo,
      finishedMtr: populatedMillOutput?.finishedMtr,
      millRate: populatedMillOutput?.millRate,
      quality: populatedMillOutput?.quality,
      orderId: (populatedMillOutput?.order as any)?.orderId || populatedMillOutput?.order
    };

    // Log the update with complete oldValues and newValues
    try {
      await logUpdate('mill_output', id, oldValues, newValues, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(updatedResponse(populatedMillOutput, 'Mill output updated successfully'));

  } catch (error: unknown) {
    await logError('mill_output_update', error, {
      resource: 'mill_output',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to update mill output'), { status: 500 });
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

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    const allowedRoles = ['master', 'superadmin', 'admin', 'user'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Access denied - Unauthorized role for deletion' }, { status: 403 });
    }

    await dbConnect();

    const { id } = await params;

    // Get mill output before deletion for logging
    const millOutput = await MillOutput.findById(id)
      .populate('quality', 'name')
      .populate('order', 'orderId')
      .lean() as any;
    if (!millOutput) {
      return NextResponse.json(notFoundResponse('Mill output'), { status: 404 });
    }

    // Delete mill output
    await MillOutput.findByIdAndDelete(id);

    // Log the deletion
    try {
      logDelete('mill_output', id, {}, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(deletedResponse('Mill output deleted successfully'));

  } catch (error: unknown) {
    await logError('mill_output_delete', error, {
      resource: 'mill_output',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to delete mill output'), { status: 500 });
  }
}
