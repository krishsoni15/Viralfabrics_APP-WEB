import dbConnect from "@/lib/dbConnect";
import Fabric from "@/models/Fabric";
import QualityName from "@/models/QualityName";
import { type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { apiRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
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
    
    // First try to get from QualityName collection
    const qualityNames = await QualityName.find().sort({ name: 1 });
    
    // NO CACHING - Always return fresh data
    const noCacheHeaders = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    if (qualityNames.length > 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        data: qualityNames.map(qn => qn.name).sort() 
      }), { status: 200, headers: noCacheHeaders });
    }
    
    // Fallback to Fabric collection
    const fabricQualityNames = await Fabric.distinct('qualityName');
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: fabricQualityNames.sort() 
    }), { status: 200, headers: noCacheHeaders });
    
  } catch (error) {
    console.error('Error fetching quality names:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to fetch quality names" 
    }), { status: 500 });
  }
}
