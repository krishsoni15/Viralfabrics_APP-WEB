import dbConnect from "@/lib/dbConnect";
import Fabric from "@/models/Fabric";
import Weaver from "@/models/Weaver";
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
    
    const { searchParams } = new URL(req.url);
    const qualityName = searchParams.get('qualityName');
    const limit = parseInt(searchParams.get('limit') || '100'); // Default limit for performance
    
    // If no qualityName provided, return all weavers or empty array
    if (!qualityName) {
      // Return all weavers from Weaver collection
      const allWeavers = await Weaver.find()
        .sort({ name: 1 })
        .limit(limit)
        .lean()
        .maxTimeMS(3000); // 3 second timeout
      
      const weaverNames = allWeavers.map(w => w.name).sort();
      
      // NO CACHING - Always return fresh data
      const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: weaverNames 
      }), { status: 200, headers });
    }
    
    // First try to get from Weaver collection
    const qualityNameDoc = await QualityName.findOne({ name: qualityName });
    if (qualityNameDoc) {
      const weavers = await Weaver.find({ qualityNameId: qualityNameDoc._id })
        .sort({ name: 1 })
        .limit(limit)
        .lean()
        .maxTimeMS(3000); // 3 second timeout
      
      if (weavers.length > 0) {
        const weaverNames = weavers.map(w => w.name).sort();
        
        // NO CACHING - Always return fresh data
        const headers = {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        };
        
        return new Response(JSON.stringify({ 
          success: true, 
          data: weaverNames 
        }), { status: 200, headers });
      }
    }
    
    // Fallback to Fabric collection
    const fabricWeavers = await Fabric.distinct('weaver', { qualityName })
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
      data: fabricWeavers.sort() 
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Error fetching weavers:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to fetch weavers" 
    }), { status: 500 });
  }
}
