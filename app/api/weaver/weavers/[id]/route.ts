import dbConnect from "@/lib/dbConnect";
import SamplingWeaver from "@/models/SamplingWeaver";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import { sanitizeString } from "@/lib/sanitize";
import { weaverRateLimiter, getClientIdentifier, rateLimit } from "@/lib/rateLimiter";
import { logger } from "@/lib/logger";
import { weaverCache } from "@/lib/cache/weaverCache";
// Service layer (optional - can use for consistency)
import { getWeaverById, updateWeaver as updateWeaverService, deleteWeaver as deleteWeaverService } from "@/app/(pages)/(dashboard)/weaver/lib/services/weaverService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    const { id } = await params;
    
    // Use service layer for business logic
    try {
      const weaver = await getWeaverById(id);
      
      return Response.json({
        success: true,
        data: weaver
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid weaver ID format') {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 400 });
        }
        if (error.message === 'Weaver not found') {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 404 });
        }
      }
      throw error;
    }
  } catch (error: unknown) {
    logger.error('Error fetching weaver', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'GET /api/weaver/weavers/[id]'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch weaver";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    
    // Validate ID format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return Response.json({
        success: false,
        message: "Invalid weaver ID format"
      }, { status: 400 });
    }
    
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return Response.json({
        success: false,
        message: "Invalid request data"
      }, { status: 400 });
    }
    
    const { name, phone, address } = requestData || {};
    
    if (!name?.trim()) {
      return Response.json({
        success: false,
        message: "Name is required"
      }, { status: 400 });
    }
    
    // Additional validation
    if (name.trim().length > 100) {
      return Response.json({
        success: false,
        message: "Name must be 100 characters or less"
      }, { status: 400 });
    }
    
    // Validate phone number - only numbers allowed
    if (phone && phone.trim()) {
      const phoneNumber = phone.trim();
      if (!/^\d+$/.test(phoneNumber)) {
        return Response.json({
          success: false,
          message: "Phone number must contain only numbers"
        }, { status: 400 });
      }
      if (phoneNumber.length > 20) {
        return Response.json({
          success: false,
          message: "Phone must be 20 digits or less"
        }, { status: 400 });
      }
    }
    
    if (address && address.trim().length > 500) {
      return Response.json({
        success: false,
        message: "Address must be 500 characters or less"
      }, { status: 400 });
    }
    
    // Use service layer for business logic
    try {
      const weaver = await updateWeaverService(id, {
        name: name.trim(),
        phone: phone?.trim(),
        address: address?.trim()
      });
      
      // Invalidate cache
      weaverCache.invalidate('weavers:');
      weaverCache.invalidate('samples:');
      
      return Response.json({
        success: true,
        message: "Weaver updated successfully",
        data: weaver
      });
    } catch (error: unknown) {
      // Handle duplicate key errors or validation errors
      if (error instanceof Error && error.message.includes('E11000')) {
        return Response.json({
          success: false,
          message: "A weaver with this name already exists"
        }, { status: 409 });
      }
      if (error instanceof Error && error.message === 'Weaver not found') {
        return Response.json({
          success: false,
          message: error.message
        }, { status: 404 });
      }
      throw error; // Re-throw to be caught by outer catch
    }
  } catch (error: unknown) {
    logger.error('Error updating weaver', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'PUT /api/weaver/weavers/[id]'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to update weaver";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master') {
      return Response.json({ success: false, message: 'Access denied - Only master can delete' }, { status: 403 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateLimitResult = rateLimit(weaverRateLimiter, clientId);
    if (!rateLimitResult.allowed) {
      return Response.json({
        success: false,
        message: 'Too many requests. Please try again later.'
      }, {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      });
    }

    const { id } = await params;
    
    // Use service layer for business logic (includes transaction)
    try {
      const result = await deleteWeaverService(id);
      
      // Invalidate cache
      weaverCache.invalidate('weavers:');
      weaverCache.invalidate('samples:');
      weaverCache.invalidate(`samples:${id}:`);
      
      const message = result.sampleCount > 0 
        ? `Weaver and ${result.sampleCount} associated sample(s) deleted successfully`
        : "Weaver deleted successfully";
      
      logger.info(`Deleted weaver ${id} with ${result.sampleCount} sample(s)`, {
        weaverId: id,
        sampleCount: result.sampleCount
      });
      
      return Response.json({
        success: true,
        message: message
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid weaver ID format') {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 400 });
        }
        if (error.message === 'Weaver not found') {
          return Response.json({
            success: false,
            message: error.message
          }, { status: 404 });
        }
      }
      throw error;
    }
    
  } catch (error: unknown) {
    logger.error('Error deleting weaver', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'DELETE /api/weaver/weavers/[id]'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to delete weaver";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

