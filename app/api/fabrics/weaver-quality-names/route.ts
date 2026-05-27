import dbConnect from "@/lib/dbConnect";
import Fabric from "@/models/Fabric";
import Weaver from "@/models/Weaver";
import WeaverQualityName from "@/models/WeaverQualityName";
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
    
    const { searchParams } = new URL(req.url);
    const weaver = searchParams.get('weaver');
    const limit = parseInt(searchParams.get('limit') || '100'); // Default limit for performance
    
    // If no weaver provided, return all weaver quality names or empty array
    if (!weaver) {
      // Return all weaver quality names from WeaverQualityName collection
      const allWeaverQualityNames = await WeaverQualityName.find()
        .sort({ name: 1 })
        .limit(limit)
        .lean()
        .maxTimeMS(3000); // 3 second timeout
      
      const weaverQualityNameNames = allWeaverQualityNames.map(wqn => wqn.name).sort();
      
      // NO CACHING - Always return fresh data
      const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: weaverQualityNameNames 
      }), { status: 200, headers });
    }
    
    // First try to get from WeaverQualityName collection
    const weaverDoc = await Weaver.findOne({ name: weaver });
    if (weaverDoc) {
      const weaverQualityNames = await WeaverQualityName.find({ weaverId: weaverDoc._id })
        .sort({ name: 1 })
        .limit(limit)
        .lean()
        .maxTimeMS(3000); // 3 second timeout
      
      if (weaverQualityNames.length > 0) {
        const weaverQualityNameNames = weaverQualityNames.map(wqn => wqn.name).sort();
        
        // NO CACHING - Always return fresh data
        const headers = {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        };
        
        return new Response(JSON.stringify({ 
          success: true, 
          data: weaverQualityNameNames 
        }), { status: 200, headers });
      }
    }
    
    // Fallback to Fabric collection
    const fabricWeaverQualityNames = await Fabric.distinct('weaverQualityName', { weaver })
      .maxTimeMS(3000); // 3 second timeout
    
    // NO CACHING - Always return fresh data
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: fabricWeaverQualityNames.sort() 
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Error fetching weaver quality names:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to fetch weaver quality names" 
    }), { status: 500 });
  }
}
