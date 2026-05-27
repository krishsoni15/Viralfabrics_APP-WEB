import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { GreyInfo, Order } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, notFoundResponse } from '@/lib/response';
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
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    let greyInfoEntries;
    
    // ⚡ OPTIMIZED: Query without populate (fetch related data separately - MUCH faster)
    const query: any = orderId ? { orderId } : {};
    const queryBuilder = GreyInfo.find(query)
      .select('orderId order quality quantity chalanNo numberOfPieces date weaverName createdAt updatedAt')
      .sort({ createdAt: -1 });
    
    // Only apply limit when fetching all (not when filtering by orderId)
    if (!orderId) {
      queryBuilder.limit(1000);
    }
    
    greyInfoEntries = await queryBuilder
      .lean()
      .maxTimeMS(2000);
    
    // ⚡ Fetch related data separately (batch queries - no N+1)
    const orderIds = [...new Set(greyInfoEntries.map((gi: any) => gi.order).filter(Boolean))];
    const qualityIds = [...new Set(greyInfoEntries.map((gi: any) => gi.quality).filter(Boolean))];
    
    const [orders, qualities] = await Promise.all([
      orderIds.length > 0 ? Order.find({ _id: { $in: orderIds } })
        .select('_id orderId')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? (await import('@/models/Quality')).default.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);
    
    const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));
    
    // Attach related data
    greyInfoEntries = greyInfoEntries.map((gi: any) => ({
      ...gi,
      order: gi.order ? orderMap.get(gi.order.toString()) || null : null,
      quality: gi.quality ? qualityMap.get(gi.quality.toString()) || null : null
    }));

    return NextResponse.json(successResponse({ greyInfo: greyInfoEntries }, 'Grey information fetched successfully'));
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching grey info:', error);
    }
    return NextResponse.json(errorResponse('Failed to fetch grey information'), { status: 500 });
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
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    const { orderId, quality, quantity, chalanNo, numberOfPieces, date } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json(validationErrorResponse('Order ID is required'), { status: 400 });
    }

    // Check if order exists
    const order = await Order.findOne({ orderId });
    if (!order) {
      return NextResponse.json(notFoundResponse('Order'), { status: 404 });
    }

    // Create new grey info entry
    const greyInfoData: any = {
      orderId,
      order: order._id
    };

    // Add optional fields only if provided
    if (quality) {
      greyInfoData.quality = quality;
    }
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const qtyValue = parseFloat(String(quantity));
      if (!isNaN(qtyValue)) {
        greyInfoData.quantity = qtyValue;
      }
    }
    if (chalanNo !== undefined && chalanNo !== null && chalanNo !== '') {
      greyInfoData.chalanNo = String(chalanNo).trim();
    }
    if (numberOfPieces !== undefined && numberOfPieces !== null && numberOfPieces !== '') {
      const piecesValue = parseInt(String(numberOfPieces));
      if (!isNaN(piecesValue)) {
        greyInfoData.numberOfPieces = piecesValue;
      }
    }
    if (date && date !== '') {
      try {
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          greyInfoData.date = dateObj;
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Invalid date format:', date);
        }
      }
    }
    
    const greyInfo = new GreyInfo(greyInfoData);
    await greyInfo.save({ validateBeforeSave: false });

    // ⚡ OPTIMIZED: Fetch related data separately (faster than populate)
    const fetchedGreyInfo = await GreyInfo.findById(greyInfo._id)
      .select('orderId order quality quantity chalanNo numberOfPieces date weaverName createdAt updatedAt')
      .lean();
    
    if (!fetchedGreyInfo) {
      return NextResponse.json(errorResponse('Failed to retrieve created grey info'), { status: 500 });
    }
    
    const orderIdRef = (fetchedGreyInfo as any).order;
    const qualityId = (fetchedGreyInfo as any).quality;
    
    const [orders, qualities] = await Promise.all([
      orderIdRef ? Order.find({ _id: orderIdRef }).select('_id orderId').lean().maxTimeMS(1000) : Promise.resolve([]),
      qualityId ? (await import('@/models/Quality')).default.find({ _id: qualityId }).select('_id name').lean().maxTimeMS(1000) : Promise.resolve([])
    ]);
    
    const savedGreyInfo = {
      ...fetchedGreyInfo,
      order: orderIdRef ? orders[0] || null : null,
      quality: qualityId ? qualities[0] || null : null
    };

    // Log the creation
    try {
      await logCreate('grey_info', (savedGreyInfo as any)?._id?.toString() || 'unknown', { 
        orderId,
        orderObjectId: order._id?.toString(),
        quality: savedGreyInfo?.quality,
        quantity: savedGreyInfo?.quantity,
        chalanNo: savedGreyInfo?.chalanNo,
        numberOfPieces: savedGreyInfo?.numberOfPieces,
        date: savedGreyInfo?.date
      }, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const { CACHE_TAGS } = await import('@/lib/cacheConfig');
    revalidateTag('grey-info');
    revalidateTag(CACHE_TAGS.ORDERS);
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders`);
    }
    revalidatePath('/grey-info');

    return NextResponse.json(successResponse({ greyInfo: savedGreyInfo }, 'Grey information created successfully'), { status: 201 });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error creating grey info:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        body: error.body
      });
    }
    const errorMessage = error.message || error.toString() || 'Failed to create grey information';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
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
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(validationErrorResponse('Order ID is required for bulk deletion'), { status: 400 });
    }

    // Delete all grey info entries for the specified order
    const result = await GreyInfo.deleteMany({ orderId });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗑️ Deleted ${result.deletedCount} grey info entries for order: ${orderId}`);
    }

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const { CACHE_TAGS } = await import('@/lib/cacheConfig');
    revalidateTag('grey-info');
    revalidateTag(CACHE_TAGS.ORDERS);
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders`);
    }
    revalidatePath('/grey-info');

    return NextResponse.json(successResponse({ deletedCount: result.deletedCount }, 'Grey information deleted successfully'));
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error deleting grey info:', error);
    }
    return NextResponse.json(errorResponse('Failed to delete grey information'), { status: 500 });
  }
}

