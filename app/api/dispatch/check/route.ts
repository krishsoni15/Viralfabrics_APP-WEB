import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Dispatch } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from '@/lib/cacheConfig';

/**
 * Lightweight API to check if dispatch exists for an order
 * Returns just a boolean - super fast!
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(errorResponse('orderId is required'), { status: 400 });
    }

    await dbConnect();

    // ⚡ ULTRA-FAST: Just count documents (no data fetching)
    const count = await Dispatch.countDocuments({ order: orderId })
      .maxTimeMS(1000)
      .lean() as any;

    return NextResponse.json(
      successResponse({ exists: count > 0, count }, 'Dispatch check completed'),
      {
        status: 200,
        headers: {
          ...getCacheHeaders(CACHE_DURATIONS.ORDERS_LIST),
          'Content-Type': 'application/json',
          'X-Cache-Tags': CACHE_TAGS.ORDERS,
        },
      }
    );
  } catch (error: any) {
    console.error('Error checking dispatch:', error);
    return NextResponse.json(errorResponse('Failed to check dispatch'), { status: 500 });
  }
}

