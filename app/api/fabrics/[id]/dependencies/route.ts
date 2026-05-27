import dbConnect from "@/lib/dbConnect";
import Fabric from "@/models/Fabric";
import Order from "@/models/Order";
import { type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { apiRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) return rateLimitError;
    
    // Validate session first (security check)
    const session = await getSession(req);
    if (!session) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Unauthorized" 
      }), { status: 401 });
    }
    
    await dbConnect();
    
    const fabricId = id;
    
    // Check if fabric exists with timeout
    const fabric = await Fabric.findById(fabricId)
      .lean()
      .maxTimeMS(1000); // 1 second timeout
    
    if (!fabric) {
      return new Response(JSON.stringify({
        success: false,
        message: "Fabric not found"
      }), { status: 404 });
    }

    const dependencies: string[] = [];

    // Check if fabric is used in orders with optimized query
    const ordersUsingFabric = await Order.find({ 
      'items.fabricId': fabricId 
    })
    .select('_id') // Only select ID for faster query
    .limit(1)
    .lean()
    .maxTimeMS(1000); // 1 second timeout
    
    if (ordersUsingFabric.length > 0) {
      dependencies.push("Orders");
    }

    // Check if fabric is used in any other collections
    // Add more checks here as needed for other tables
    
    // Add cache headers for better performance
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        dependencies,
        canDelete: dependencies.length === 0
      }
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Error checking fabric dependencies:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Failed to check fabric dependencies"
    }), { status: 500 });
  }
}
