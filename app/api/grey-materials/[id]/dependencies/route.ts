import dbConnect from "@/lib/dbConnect";
import GreyMaterial from "@/models/GreyMaterial";
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
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) return rateLimitError;
    
    const session = await getSession(req);
    if (!session) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Unauthorized" 
      }), { status: 401 });
    }
    
    await dbConnect();
    
    const gm = await GreyMaterial.findById(id)
      .lean()
      .maxTimeMS(1000);
    
    if (!gm) {
      return new Response(JSON.stringify({
        success: false,
        message: "Grey Material not found"
      }), { status: 404 });
    }

    const dependencies: string[] = [];

    // Check if grey material is used in orders
    const ordersUsingGm = await Order.find({ 
      'greyInformation.quality': id 
    })
    .select('_id')
    .limit(1)
    .lean()
    .maxTimeMS(1000);
    
    if (ordersUsingGm.length > 0) {
      dependencies.push("Orders");
    }

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
    console.error('Error checking grey material dependencies:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Failed to check dependencies"
    }), { status: 500 });
  }
}
