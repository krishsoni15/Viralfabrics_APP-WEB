import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Lab } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from '@/lib/response';

// GET /api/labs/by-order/[orderId] - Get all labs for a specific order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const startTime = Date.now();
  try {
    await dbConnect();
    
    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    
    const { orderId } = await params;
    
    // Validate ObjectId
    if (!orderId || orderId.length !== 24) {
      return NextResponse.json(validationErrorResponse('Invalid order ID'), { status: 400 });
    }
    
    // Get labs with all necessary data including labSendData
    const labs = await Lab.find({
      order: orderId,
      softDeleted: false
    })
    .select('_id orderItemId status labSendDate labSendNumber labSendData remarks createdAt')
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(200); // Ultra-fast timeout

    return NextResponse.json(successResponse(labs, 'Labs fetched successfully'));
    
  } catch (error: any) {
    return NextResponse.json(errorResponse('Failed to fetch labs'), { status: 500 });
  }
}
