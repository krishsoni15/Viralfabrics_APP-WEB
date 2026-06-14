import { type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { apiRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
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
    
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    // Grey materials no longer use weaverQualityName, so return an empty array
    return new Response(JSON.stringify({ 
      success: true, 
      data: [] 
    }), { status: 200, headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: "Failed to fetch weaver quality names" 
    }), { status: 500 });
  }
}
