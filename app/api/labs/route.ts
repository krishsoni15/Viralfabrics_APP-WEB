import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { Lab, Order, Quality } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, createdResponse, conflictResponse, notFoundResponse } from '@/lib/response';
import { logCreate, logView, logError } from '@/lib/logger';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';

// POST /api/labs - Create a new lab
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    const allowedRoles = ['master', 'superadmin', 'admin', 'user'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Access denied - Unauthorized role for creation' }, { status: 403 });
    }

    await dbConnect();
    
    const body = await request.json();
    
    // Basic validation
    const { orderId, orderItemId, labSendDate, labSendNumber, labSendData, status, remarks } = body;
    
    if (!orderId) {
      return NextResponse.json(validationErrorResponse('Order ID is required'), { status: 400 });
    }
    
    if (!orderItemId) {
      return NextResponse.json(validationErrorResponse('Order item ID is required'), { status: 400 });
    }
    
    if (!labSendDate) {
      return NextResponse.json(validationErrorResponse('Lab send date is required'), { status: 400 });
    }

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(notFoundResponse('Order'), { status: 404 });
    }

    // Check party access
    if (session.partyId && session.role !== 'master' && session.role !== 'superadmin') {
      if (!order.party || order.party.toString() !== session.partyId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }
    
    // Check if lab already exists for this order item
    const existingLab = await Lab.findOne({ 
      order: orderId, 
      orderItemId: orderItemId,
      softDeleted: false 
    });
    
    if (existingLab) {
      return NextResponse.json(conflictResponse('A lab already exists for this order item'), { status: 409 });
    }
    
    // Create the lab with proper structure and defaults
    const lab = new Lab({
      order: orderId,
      orderItemId: orderItemId,
      labSendDate: new Date(labSendDate),
      labSendNumber: labSendNumber?.trim() || '',
      labSendData: {
        color: labSendData?.color || '',
        shade: labSendData?.shade || '',
        notes: labSendData?.notes || '',
        sampleNumber: labSendData?.sampleNumber || '',
        imageUrl: labSendData?.imageUrl || '',
        approvalDate: labSendData?.approvalDate ? new Date(labSendData.approvalDate) : null,
        specifications: labSendData?.specifications || {}
      },
      status: status || 'sent',
      remarks: remarks?.trim() || ''
    });
    
    await lab.save();
    
    // Log the lab creation
    try {
      await logCreate('lab', lab._id?.toString() || 'unknown', { 
        orderId: order.orderId,
        orderObjectId: order._id?.toString(),
        orderItemId,
        labSendDate: lab.labSendDate,
        labSendNumber: lab.labSendNumber,
        labSendData: lab.labSendData,
        status: lab.status,
        remarks: lab.remarks
      }, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }
    
    return NextResponse.json(createdResponse(lab, 'Lab created successfully'));
    
  } catch (error: any) {
    // Check for duplicate key error specifically
    if (error.code === 11000) {
      return NextResponse.json(conflictResponse('A lab already exists for this order item'), { status: 409 });
    }
    
    await logError('lab_create', error, {
      resource: 'lab',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to create lab'), { status: 500 });
  }
}

// GET /api/labs - List labs with pagination and filtering
export async function GET(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100); // Ultra fast - 50ms target
    const status = searchParams.get('status');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    
    // Build filter object
    const filter: any = {};
    
    if (!includeDeleted) {
      filter.softDeleted = false;
    }
    
    if (orderId) {
      filter.order = orderId;
    }

    // Restrict labs to user's party if session has a partyId (applies to party users)
    if (session.partyId && session.role !== 'master' && session.role !== 'superadmin') {
      if (orderId) {
        const orderQuery: any = { _id: orderId, party: session.partyId };
        if (session.contactNames && session.contactNames.length > 0) {
          orderQuery.contactName = { $in: session.contactNames };
        } else if (session.contactName) {
          orderQuery.contactName = session.contactName;
        }
        const order = await Order.findOne(orderQuery).select('party').lean().maxTimeMS(1000);
        if (!order) {
          return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }
      } else {
        const orderQuery: any = { party: session.partyId };
        if (session.contactNames && session.contactNames.length > 0) {
          orderQuery.contactName = { $in: session.contactNames };
        } else if (session.contactName) {
          orderQuery.contactName = session.contactName;
        }
        const partyOrders = await Order.find(orderQuery).select('_id').lean().maxTimeMS(1000);
        const partyOrderIds = partyOrders.map((o: any) => o._id);
        if (filter.order) {
          const currentIds = Array.isArray(filter.order.$in) ? filter.order.$in : [filter.order];
          const allowedIds = currentIds.filter((id: any) => partyOrderIds.some(poId => poId.toString() === id.toString()));
          filter.order = { $in: allowedIds.length > 0 ? allowedIds : [new mongoose.Types.ObjectId()] };
        } else {
          filter.order = { $in: partyOrderIds.length > 0 ? partyOrderIds : [new mongoose.Types.ObjectId()] };
        }
      }
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (q) {
      filter.$text = { $search: q };
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Optimized: Use simple find instead of aggregation for better performance
    const [labs, total] = await Promise.all([
      Lab.find(filter)
        .select('_id order orderItemId status labSendDate labSendNumber remarks createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(200), // 200ms timeout for 50ms target
      
      Lab.countDocuments(filter)
        .maxTimeMS(200) // 200ms timeout for 50ms target
    ]);
    
    return NextResponse.json(successResponse({
      items: labs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Labs fetched successfully'));
    
  } catch (error: unknown) {
    await logError('lab_view', error, {
      resource: 'lab',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to fetch labs'), { status: 500 });
  }
}
