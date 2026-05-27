import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { MillInput, Order, Mill, Quality } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, notFoundResponse, createdResponse } from '@/lib/response';
import { logCreate, logError } from '@/lib/logger';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';

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
    const millId = searchParams.get('millId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Ultra fast - 50ms target
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    let query = {};
    
    // Filter by order ID
    if (orderId) {
      query = { ...query, orderId };
    }
    
    // Filter by mill ID
    if (millId) {
      query = { ...query, mill: millId };
    }
    
    // Filter by date range
    if (startDate && endDate) {
      query = {
        ...query,
        millDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Get total count for pagination
    const totalCount = await MillInput.countDocuments(query).maxTimeMS(200);
    
    // ⚡ OPTIMIZED: Query without populate (fetch related data separately - MUCH faster)
    const millInputs = await MillInput.find(query)
      .select('orderId order mill millDate chalanNo greighMtr pcs quality processName additionalMeters notes createdAt updatedAt')
      .sort({ millDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(200);
    
    // ⚡ Fetch related data separately (batch queries - no N+1)
    const millIds = [...new Set(millInputs.map((mi: any) => mi.mill).filter(Boolean))];
    const orderIds = [...new Set(millInputs.map((mi: any) => mi.order).filter(Boolean))];
    const qualityIds = [...new Set([
      ...millInputs.map((mi: any) => mi.quality).filter(Boolean),
      ...millInputs.flatMap((mi: any) => 
        (mi.additionalMeters || []).map((am: any) => am.quality).filter(Boolean)
      )
    ])];
    
    const [mills, orders, qualities] = await Promise.all([
      millIds.length > 0 ? Mill.find({ _id: { $in: millIds } })
        .select('_id name contactPerson contactPhone')
        .lean()
        .maxTimeMS(100) : Promise.resolve([]),
      orderIds.length > 0 ? Order.find({ _id: { $in: orderIds } })
        .select('_id orderId orderType party')
        .lean()
        .maxTimeMS(100) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(100) : Promise.resolve([])
    ]);
    
    const millMap = new Map(mills.map((m: any) => [m._id.toString(), m]));
    const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));
    
    // Attach related data to mill inputs
    const millInputsWithPopulated = millInputs.map((mi: any) => ({
      ...mi,
      mill: mi.mill ? millMap.get(mi.mill.toString()) || null : null,
      order: mi.order ? orderMap.get(mi.order.toString()) || null : null,
      quality: mi.quality ? qualityMap.get(mi.quality.toString()) || null : null,
      additionalMeters: (mi.additionalMeters || []).map((am: any) => ({
        ...am,
        quality: am.quality ? qualityMap.get(am.quality.toString()) || null : null
      }))
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json(successResponse({
      millInputs: millInputsWithPopulated,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }, 'Mill inputs fetched successfully'));

  } catch (error: any) {
    return NextResponse.json(errorResponse('Failed to fetch mill inputs'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(validationErrorResponse('Order ID is required for bulk deletion'), { status: 400 });
    }

    // Delete all mill inputs for the specified order
    const result = await MillInput.deleteMany({ orderId });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗑️ Deleted ${result.deletedCount} mill inputs for order: ${orderId}`);
    }

    return NextResponse.json(successResponse({ deletedCount: result.deletedCount }, 'Mill inputs deleted successfully'));

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error deleting mill inputs:', error);
    }
    return NextResponse.json(errorResponse('Failed to delete mill inputs'), { status: 500 });
  }
}

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

    await dbConnect();

    const body = await request.json();
    const { orderId, mill, millDate, chalanNo, greighMtr, pcs, quality, processName, additionalMeters, notes } = body;

    // Debug logging
    // Validate required fields
    if (!orderId) {
      return NextResponse.json(validationErrorResponse('Order ID is required'), { status: 400 });
    }
    if (!mill) {
      return NextResponse.json(validationErrorResponse('Mill is required'), { status: 400 });
    }
    // All other fields are optional (millDate, chalanNo, greighMtr, pcs)
    // Quality is optional for now to maintain backward compatibility
    // if (!quality) {
    //   return NextResponse.json(validationErrorResponse('Quality is required'), { status: 400 });
    // }
    // Process name is optional
    // if (!processName || processName.trim() === '') {
    //   return NextResponse.json(validationErrorResponse('Process name is required'), { status: 400 });
    // }

    // Validate additional meters if provided (all fields are optional)
    if (additionalMeters && Array.isArray(additionalMeters)) {
      for (let i = 0; i < additionalMeters.length; i++) {
        const additional = additionalMeters[i];
        // All fields in additional meters are optional
        // Quality is optional for additional meters too
        // if (!additional.quality) {
        //   return NextResponse.json(validationErrorResponse(`Quality is required for additional entry ${i + 1}`), { status: 400 });
        // }
        // Process name is optional for additional meters
        // if (!additional.processName || additional.processName.trim() === '') {
        //   return NextResponse.json(validationErrorResponse(`Process name is required for additional entry ${i + 1}`), { status: 400 });
        // }
        
        // Check if additional quality exists only if provided
        if (additional.quality) {
          const additionalQualityExists = await Quality.findById(additional.quality);
          if (!additionalQualityExists) {
            return NextResponse.json(notFoundResponse(`Quality for additional entry ${i + 1}`), { status: 404 });
          }
        }
      }
    }

    // Check if order exists
    const order = await Order.findOne({ orderId });
    if (!order) {
      return NextResponse.json(notFoundResponse('Order'), { status: 404 });
    }

    // Check if mill exists
    const millExists = await Mill.findById(mill);
    if (!millExists) {
      return NextResponse.json(notFoundResponse('Mill'), { status: 404 });
    }

    // Check if quality exists only if provided
    if (quality) {
      const qualityExists = await Quality.findById(quality);
      if (!qualityExists) {
        return NextResponse.json(notFoundResponse('Quality'), { status: 404 });
      }
    }

    // Create new mill input (always create new record for each entry)
    // All fields except orderId and mill are optional
    const millInputData: any = {
      orderId,
      order: order._id,
      mill
    };
    
    // Add optional fields only if provided
    if (millDate) {
      millInputData.millDate = new Date(millDate);
    }
    if (chalanNo !== undefined && chalanNo !== null) {
      millInputData.chalanNo = chalanNo.trim() || '';
    }
    if (greighMtr !== undefined && greighMtr !== null) {
      millInputData.greighMtr = parseFloat(greighMtr);
    }
    if (pcs !== undefined && pcs !== null) {
      millInputData.pcs = parseInt(pcs);
    }
    if (quality !== undefined) {
      millInputData.quality = quality || undefined;
    }
    if (processName !== undefined) {
      millInputData.processName = processName ? processName.trim() : '';
    }
    if (additionalMeters !== undefined && Array.isArray(additionalMeters)) {
      millInputData.additionalMeters = additionalMeters.map(additional => ({
        greighMtr: additional.greighMtr ? parseFloat(additional.greighMtr) : undefined,
        pcs: additional.pcs ? parseInt(additional.pcs) : undefined,
        quality: additional.quality || undefined,
        processName: additional.processName ? additional.processName.trim() : '',
        notes: additional.notes?.trim()
      }));
    }
    if (notes !== undefined) {
      millInputData.notes = notes?.trim();
    }
    
    const millInput = new MillInput(millInputData);

    await millInput.save({ validateBeforeSave: false });
    // ⚡ OPTIMIZED: Fetch related data separately (faster than populate)
    const fetchedMillInput = await MillInput.findById(millInput._id)
      .select('orderId order mill millDate chalanNo greighMtr pcs quality processName additionalMeters notes createdAt updatedAt')
      .lean();
    
    if (!fetchedMillInput) {
      return NextResponse.json(errorResponse('Failed to retrieve created mill input'), { status: 500 });
    }
    
    // Fetch related data in parallel
    const millId = (fetchedMillInput as any).mill;
    const orderIdRef = (fetchedMillInput as any).order;
    const qualityId = (fetchedMillInput as any).quality;
    const additionalQualityIds = [...new Set(
      ((fetchedMillInput as any).additionalMeters || []).map((am: any) => am.quality).filter(Boolean)
    )];
    
    const [mills, orders, qualities] = await Promise.all([
      millId ? Mill.find({ _id: millId }).select('_id name contactPerson contactPhone').lean().maxTimeMS(100) : Promise.resolve([]),
      orderIdRef ? Order.find({ _id: orderIdRef }).select('_id orderId orderType party').lean().maxTimeMS(100) : Promise.resolve([]),
      [...(qualityId ? [qualityId] : []), ...additionalQualityIds].length > 0 
        ? Quality.find({ _id: { $in: [...(qualityId ? [qualityId] : []), ...additionalQualityIds] } })
          .select('_id name').lean().maxTimeMS(100) 
        : Promise.resolve([])
    ]);
    
    const millMap = new Map(mills.map((m: any) => [m._id.toString(), m]));
    const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));
    
    const finalMillInput = {
      ...fetchedMillInput,
      mill: millId ? millMap.get(millId.toString()) || null : null,
      order: orderIdRef ? orderMap.get(orderIdRef.toString()) || null : null,
      quality: qualityId ? qualityMap.get(qualityId.toString()) || null : null,
      additionalMeters: ((fetchedMillInput as any).additionalMeters || []).map((am: any) => ({
        ...am,
        quality: am.quality ? qualityMap.get(am.quality.toString()) || null : null
      }))
    };
    
    try {
      const millInputData = finalMillInput as any;
      await logCreate('mill_input', millInputData?._id?.toString() || 'unknown', { 
        orderId,
        orderObjectId: order._id?.toString(),
        mill: millInputData?.mill,
        millDate: millInputData?.millDate,
        chalanNo: millInputData?.chalanNo,
        greighMtr: millInputData?.greighMtr,
        pcs: millInputData?.pcs,
        quality: millInputData?.quality,
        processName: millInputData?.processName,
        additionalMeters: millInputData?.additionalMeters,
        notes: millInputData?.notes
      }, request);
    } catch (logError) {
      }

    return NextResponse.json(createdResponse(finalMillInput, 'Mill input created successfully'));

  } catch (error: any) {
    try {
      await logError('mill_input_create', error, {
        resource: 'mill_input',
        endpoint: request.url,
        method: request.method,
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    } catch (logError) {
      }
    return NextResponse.json(errorResponse('Failed to create mill input'), { status: 500 });
  }
}
