import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Lab, Order } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, notFoundResponse, updatedResponse, deletedResponse } from '@/lib/response';
import { logView, logUpdate, logDelete, logError } from '@/lib/logger';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';
import mongoose from 'mongoose';

// GET /api/labs/[id] - Get a specific lab
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
    
    // Validate ObjectId
    if (!id || id.length !== 24) {
      return NextResponse.json(validationErrorResponse('Invalid lab ID'), { status: 400 });
    }
    
    // Find lab without populate to avoid the error
    const lab = await Lab.findOne({ 
      _id: id, 
      softDeleted: false 
    });
    
    if (!lab) {
      return NextResponse.json(notFoundResponse('Lab'), { status: 404 });
    }
    
    // Log the lab view
    logView('lab', id, request);
    
    return NextResponse.json(successResponse(lab, 'Lab fetched successfully'));
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logError('lab_view', error, {
      resource: 'lab',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to fetch lab'), { status: 500 });
  }
}

// PUT /api/labs/[id] - Update a lab
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
    
    // Validate ObjectId
    if (!id || id.length !== 24) {
      return NextResponse.json(validationErrorResponse('Invalid lab ID'), { status: 400 });
    }
    
    const body = await request.json();
    
    // Basic validation
    const { labSendDate, labSendNumber, labSendData, status, remarks } = body;
    
    if (!labSendDate) {
      return NextResponse.json(validationErrorResponse('Lab send date is required'), { status: 400 });
    }
    
    // ⚡ OPTIMIZED: Find lab without populate
    const lab = await Lab.findOne({ 
      _id: id, 
      softDeleted: false 
    })
      .select('order orderItemId labSendDate labSendNumber labSendData status remarks')
      .lean() as {
        order?: mongoose.Types.ObjectId | string;
        orderItemId?: string;
        labSendDate?: Date;
        labSendNumber?: string;
        labSendData?: unknown;
        status?: string;
        remarks?: string;
      } | null;
    
    if (!lab) {
      return NextResponse.json(notFoundResponse('Lab'), { status: 404 });
    }
    
    // ⚡ Fetch order separately for logging
    const orderId = lab.order;
    const order = orderId ? await Order.findById(orderId).select('_id orderId').lean().maxTimeMS(1000) : null;
    
    // Store old values for logging
    const oldValues = {
      orderId: order ? (order as { orderId?: string }).orderId : (lab.order?.toString() ?? lab.order),
      orderItemId: lab.orderItemId,
      labSendDate: lab.labSendDate,
      labSendNumber: lab.labSendNumber,
      labSendData: lab.labSendData,
      status: lab.status,
      remarks: lab.remarks
    };
    
    // Update the lab
    const updateData: {
      labSendDate: Date;
      labSendNumber?: string;
      labSendData?: unknown;
      status?: string;
      remarks?: string;
    } = {
      labSendDate: new Date(labSendDate),
      labSendNumber: labSendNumber?.trim(),
      labSendData: labSendData ?? lab.labSendData ?? {},
      status: status ?? lab.status,
      remarks: remarks?.trim()
    };
    
    const updatedLab = await Lab.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .select('order orderItemId labSendDate labSendNumber labSendData status remarks')
      .lean() as {
        order?: mongoose.Types.ObjectId | string;
        orderItemId?: string;
        labSendDate?: Date;
        labSendNumber?: string;
        labSendData?: unknown;
        status?: string;
        remarks?: string;
      } | null;
    
    if (!updatedLab) {
      return NextResponse.json(notFoundResponse('Lab'), { status: 404 });
    }
    
    // ⚡ Fetch order separately for response
    const updatedOrderId = updatedLab.order;
    const updatedOrder = updatedOrderId ? await Order.findById(updatedOrderId).select('_id orderId').lean().maxTimeMS(1000) : null;
    
    // Store new values for logging
    const newValues = {
      orderId: updatedOrder ? (updatedOrder as { orderId?: string }).orderId : (updatedLab.order?.toString() ?? updatedLab.order),
      orderItemId: updatedLab.orderItemId,
      labSendDate: updatedLab.labSendDate,
      labSendNumber: updatedLab.labSendNumber,
      labSendData: updatedLab.labSendData,
      status: updatedLab.status,
      remarks: updatedLab.remarks
    };
    
    // Log the lab update (async, non-blocking)
    logUpdate('lab', id, oldValues, newValues, request);
    
    // Attach order to response
    const labWithOrder = {
      ...updatedLab,
      order: updatedOrder ?? updatedLab.order
    };
    
    return NextResponse.json(updatedResponse(labWithOrder, 'Lab updated successfully'));
    
  } catch (error: unknown) {
    await logError('lab_update', error, {
      resource: 'lab',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to update lab'), { status: 500 });
  }
}

// DELETE /api/labs/[id] - Soft delete a lab
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master') {
      return NextResponse.json({ success: false, message: 'Access denied - Only master can delete' }, { status: 403 });
    }
    
    const { id } = await params;
    
    // Validate ObjectId
    if (!id || id.length !== 24) {
      return NextResponse.json(validationErrorResponse('Invalid lab ID'), { status: 400 });
    }
    
    // ⚡ OPTIMIZED: Find lab without populate
    const lab = await Lab.findOne({ 
      _id: id, 
      softDeleted: false 
    })
      .select('order orderItemId labSendDate labSendNumber labSendData status remarks')
      .lean() as {
        order?: mongoose.Types.ObjectId | string;
        orderItemId?: string;
        labSendDate?: Date;
        labSendNumber?: string;
        labSendData?: unknown;
        status?: string;
        remarks?: string;
      } | null;
    
    if (!lab) {
      return NextResponse.json(notFoundResponse('Lab'), { status: 404 });
    }
    
    // ⚡ Fetch order separately for logging
    const orderId = lab.order;
    const order = orderId ? await Order.findById(orderId).select('_id orderId').lean().maxTimeMS(1000) : null;
    
    // Soft delete the lab
    await Lab.findByIdAndUpdate(id, {
      softDeleted: true,
      deletedAt: new Date()
    });
    
    // Log the lab deletion (async, non-blocking)
    logDelete('lab', id, {}, request);
    
    return NextResponse.json(deletedResponse('Lab deleted successfully'));
    
  } catch (error: unknown) {
    await logError('lab_delete', error, {
      resource: 'lab',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to delete lab'), { status: 500 });
  }
}
