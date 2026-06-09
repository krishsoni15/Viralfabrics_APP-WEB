import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { MillOutput } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/response';
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from '@/lib/cacheConfig';

/**
 * Lightweight API to check if mill output exists for an order
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
    const count = await MillOutput.countDocuments({ order: orderId })
      .maxTimeMS(1000)
      .lean() as any;

    return NextResponse.json(
      successResponse({ exists: count > 0, count }, 'Mill output check completed'),
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
    console.error('Error checking mill output:', error);
    return NextResponse.json(errorResponse('Failed to check mill output'), { status: 500 });
  }
}

