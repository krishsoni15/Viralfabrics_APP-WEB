import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { GreyInfo, Quality, Order } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, notFoundResponse } from '@/lib/response';
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
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    
    // ⚡ OPTIMIZED: Query without populate (fetch related data separately)
    const fetchedGreyInfo = await GreyInfo.findById(id)
      .select('orderId order quality quantity chalanNo numberOfPieces date weaverName createdAt updatedAt')
      .lean();

    if (!fetchedGreyInfo) {
      return NextResponse.json(notFoundResponse('Grey information'), { status: 404 });
    }
    
    // ⚡ Fetch related data separately
    const orderId = (fetchedGreyInfo as any).order;
    const qualityId = (fetchedGreyInfo as any).quality;
    
    const [orders, qualities] = await Promise.all([
      orderId ? Order.find({ _id: orderId }).select('_id orderId').lean().maxTimeMS(1000) : Promise.resolve([]),
      qualityId ? Quality.find({ _id: qualityId }).select('_id name').lean().maxTimeMS(1000) : Promise.resolve([])
    ]);
    
    const greyInfo = {
      ...fetchedGreyInfo,
      order: orderId ? orders[0] || null : null,
      quality: qualityId ? qualities[0] || null : null
    };

    return NextResponse.json(successResponse({ greyInfo }, 'Grey information fetched successfully'));
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching grey info:', error);
    }
    return NextResponse.json(errorResponse('Failed to fetch grey information'), { status: 500 });
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
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const body = await request.json();
    const { quality, quantity, chalanNo, numberOfPieces, date } = body;

    // Check if grey info exists and store old values
    const existingGreyInfo = await GreyInfo.findById(id)
      .populate('quality', 'name')
      .populate('order', 'orderId')
      .lean();
    if (!existingGreyInfo) {
      return NextResponse.json(notFoundResponse('Grey information'), { status: 404 });
    }
    
    // Store old values for logging
    const oldValues = {
      quality: existingGreyInfo.quality,
      quantity: existingGreyInfo.quantity,
      chalanNo: existingGreyInfo.chalanNo,
      numberOfPieces: existingGreyInfo.numberOfPieces,
      date: existingGreyInfo.date,
      orderId: (existingGreyInfo.order as any)?.orderId || existingGreyInfo.order
    };

    // Check if quality exists only if provided
    if (quality) {
      const qualityExists = await Quality.findById(quality);
      if (!qualityExists) {
        return NextResponse.json(notFoundResponse('Quality'), { status: 404 });
      }
    }

    // Update grey info - only include fields that are provided
    const updateData: any = {};
    
    // Only update fields if they are provided
    if (quality !== undefined && quality !== null && quality !== '') {
      updateData.quality = quality;
    }
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const qtyValue = parseFloat(String(quantity));
      if (!isNaN(qtyValue)) {
        updateData.quantity = qtyValue;
      }
    }
    if (chalanNo !== undefined && chalanNo !== null && chalanNo !== '') {
      updateData.chalanNo = String(chalanNo).trim();
    }
    if (numberOfPieces !== undefined && numberOfPieces !== null && numberOfPieces !== '') {
      const piecesValue = parseInt(String(numberOfPieces));
      if (!isNaN(piecesValue)) {
        updateData.numberOfPieces = piecesValue;
      }
    }
    if (date !== undefined && date !== null && date !== '') {
      updateData.date = new Date(date);
    }

    const updatedGreyInfo = await GreyInfo.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: false }
    )
      .select('orderId order quality quantity chalanNo numberOfPieces date weaverName')
      .lean();

    if (!updatedGreyInfo) {
      return NextResponse.json(notFoundResponse('Grey information'), { status: 404 });
    }
    
    // ⚡ Fetch related data separately for response
    const updatedOrderId = (updatedGreyInfo as any).order;
    const updatedQualityId = (updatedGreyInfo as any).quality;
    
    const [updatedOrder, updatedQuality] = await Promise.all([
      updatedOrderId ? Order.findById(updatedOrderId).select('_id orderId').lean().maxTimeMS(1000) : Promise.resolve(null),
      updatedQualityId ? Quality.findById(updatedQualityId).select('_id name').lean().maxTimeMS(1000) : Promise.resolve(null)
    ]);

    // Store new values for logging
    const newValues = {
      quality: updatedQuality || updatedGreyInfo.quality,
      quantity: updatedGreyInfo.quantity,
      chalanNo: updatedGreyInfo.chalanNo,
      numberOfPieces: updatedGreyInfo.numberOfPieces,
      date: updatedGreyInfo.date,
      orderId: updatedOrder ? (updatedOrder as any).orderId : (updatedGreyInfo.order?.toString() || updatedGreyInfo.order)
    };

    // Log the update (non-blocking)
    logUpdate('grey_info', id, oldValues, newValues, request);

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const { CACHE_TAGS } = await import('@/lib/cacheConfig');
    const orderId = newValues.orderId;
    revalidateTag('grey-info');
    revalidateTag(`grey-info-${id}`);
    revalidateTag(CACHE_TAGS.ORDERS);
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders`);
    }
    revalidatePath('/grey-info');

    // Attach related data to response
    const greyInfoWithPopulated = {
      ...updatedGreyInfo,
      order: updatedOrder || updatedGreyInfo.order,
      quality: updatedQuality || updatedGreyInfo.quality
    };

    return NextResponse.json(successResponse({ greyInfo: greyInfoWithPopulated }, 'Grey information updated successfully'));
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error updating grey info:', error);
    }
    return NextResponse.json(errorResponse('Failed to update grey information'), { status: 500 });
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
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master') {
      return NextResponse.json(errorResponse('Access denied - Only master can delete'), { status: 403 });
    }

    await dbConnect();

    const { id } = await params;
    
    // ⚡ OPTIMIZED: Get grey info without populate
    const deletedGreyInfo = await GreyInfo.findById(id)
      .select('orderId order quality quantity chalanNo numberOfPieces date weaverName')
      .lean();

    if (!deletedGreyInfo) {
      return NextResponse.json(notFoundResponse('Grey information'), { status: 404 });
    }
    
    // ⚡ Fetch related data separately for logging
    const orderIdRef = (deletedGreyInfo as any).order;
    const qualityIdRef = (deletedGreyInfo as any).quality;
    
    const [deletedOrder, deletedQuality] = await Promise.all([
      orderIdRef ? Order.findById(orderIdRef).select('_id orderId').lean().maxTimeMS(1000) : Promise.resolve(null),
      qualityIdRef ? Quality.findById(qualityIdRef).select('_id name').lean().maxTimeMS(1000) : Promise.resolve(null)
    ]);

    // Delete the grey info
    await GreyInfo.findByIdAndDelete(id);

    // Log the deletion (async, non-blocking)
    logDelete('grey_info', id, {}, request);

    // ⚡ FIX: Properly invalidate Next.js cache
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const { CACHE_TAGS } = await import('@/lib/cacheConfig');
    const orderId = deletedOrder ? (deletedOrder as any).orderId : (deletedGreyInfo.order?.toString() || deletedGreyInfo.order);
    revalidateTag('grey-info');
    revalidateTag(`grey-info-${id}`);
    revalidateTag(CACHE_TAGS.ORDERS);
    if (orderId) {
      revalidateTag(`order-${orderId}`);
      revalidatePath(`/orders`);
    }
    revalidatePath('/grey-info');

    return NextResponse.json(successResponse({ deletedCount: 1 }, 'Grey information deleted successfully'));
  } catch (error: any) {
    console.error('Error deleting grey info:', error);
    return NextResponse.json(errorResponse('Failed to delete grey information'), { status: 500 });
  }
}

