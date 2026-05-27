import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { type NextRequest } from "next/server";

// Cache for connection to prevent repeated connections
let connectionCache: any = null;

// Simple, fast status update endpoint
export async function PATCH(req: NextRequest) {
  try {
    // Use cached connection if available
    await dbConnect();
    
    const { orderId, status } = await req.json();

    // Validate status
    if (!['pending', 'delivered'].includes(status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Invalid status" 
        }), 
        { status: 400 }
      );
    }

    // Fast update - no validation, no logging, minimal response
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      { status },
      { 
        new: true, 
        runValidators: false,
        select: '_id orderId status'
      }
    );

    if (!updatedOrder) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Order not found" 
        }), 
        { status: 404 }
      );
    }

    // Return minimal response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Status updated successfully",
        data: {
          _id: updatedOrder._id,
          orderId: updatedOrder.orderId,
          status: updatedOrder.status
        }
      }), 
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        message 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
