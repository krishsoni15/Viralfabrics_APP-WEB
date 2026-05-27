import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/Order';
import Counter from '@/models/Counter';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Check if there are any orders in the system
    const orderCount = await Order.countDocuments();
    
    if (orderCount > 0) {
      return NextResponse.json({
        success: false,
        message: 'Cannot reset counter when orders exist. Delete all orders first.'
      }, { status: 400 });
    }

    // Reset the counter to 0
    await Counter.findByIdAndUpdate('orderId', { sequence: 0 }, { upsert: true });

    return NextResponse.json({
      success: true,
      message: 'Order counter reset successfully. Next order will start with 001'
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to reset order counter'
    }, { status: 500 });
  }
}
