import dbConnect from "@/lib/dbConnect";
import Sample, { ISample } from "@/models/Sample";
import SamplingWeaver from "@/models/SamplingWeaver";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import { sanitizeString } from "@/lib/sanitize";
import { weaverRateLimiter, getClientIdentifier, rateLimit } from "@/lib/rateLimiter";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
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

    await dbConnect();
    const { id } = await params;
    
    // Validate ID format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return Response.json({
        success: false,
        message: "Invalid sample ID format"
      }, { status: 400 });
    }
    
    const sample = await Sample.findById(id)
      .populate('weaverId', 'name phone address')
      .lean();
    
    if (!sample) {
      return Response.json({
        success: false,
        message: "Sample not found"
      }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      data: sample
    });
  } catch (error: unknown) {
    logger.error('Error fetching sample', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'GET /api/weaver/samples/[id]'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch sample";
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

    await dbConnect();
    const { id } = await params;
    
    // Validate ID format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return Response.json({
        success: false,
        message: "Invalid sample ID format"
      }, { status: 400 });
    }
    
    const requestData = await req.json();
    const {
      weaverId,
      qualityName,
      type,
      rack,
      greighWidth,
      finishWidth,
      weight,
      gsm,
      content,
      danier,
      count,
      reed,
      pick,
      greighRate,
      label,
      images,
      note
    } = requestData;
    
    if (!qualityName?.trim()) {
      return Response.json({
        success: false,
        message: "Quality name is required"
      }, { status: 400 });
    }
    
    if (weaverId) {
      // Validate weaverId format
      if (!/^[0-9a-fA-F]{24}$/.test(weaverId)) {
        return Response.json({
          success: false,
          message: "Invalid weaver ID format"
        }, { status: 400 });
      }
      const weaver = await SamplingWeaver.findById(weaverId).lean();
      if (!weaver) {
        return Response.json({
          success: false,
          message: "Weaver not found"
        }, { status: 404 });
      }
    }
    
    // Normalize and validate type (case-insensitive)
    const validTypes = ['Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'];
    let normalizedType = '';
    if (type?.trim()) {
      const trimmedType = type.trim();
      // Find matching type (case-insensitive)
      const matchedType = validTypes.find(
        validType => validType.toLowerCase() === trimmedType.toLowerCase()
      );
      if (matchedType) {
        normalizedType = matchedType; // Use the correctly cased version
      } else {
        return Response.json({
          success: false,
          message: `Type must be one of: ${validTypes.join(', ')}, or empty`
        }, { status: 400 });
      }
    }
    
    const updateData: Partial<ISample> = {
      qualityName: sanitizeString(qualityName.trim(), { maxLength: 100 }),
      type: normalizedType,
      rack: rack ? sanitizeString(rack.trim(), { maxLength: 100 }) : '',
      greighWidth: greighWidth ? parseFloat(greighWidth) : 0,
      finishWidth: finishWidth ? parseFloat(finishWidth) : 0,
      weight: weight ? parseFloat(weight) : 0,
      gsm: gsm ? parseFloat(gsm) : 0,
      content: content ? sanitizeString(content.trim(), { maxLength: 100 }) : '',
      danier: danier ? sanitizeString(danier.trim(), { maxLength: 50 }) : '',
      count: count ? parseFloat(count) : 0,
      reed: reed ? parseFloat(reed) : 0,
      pick: pick ? parseFloat(pick) : 0,
      greighRate: greighRate ? parseFloat(greighRate) : 0,
      label: label ? sanitizeString(label.trim(), { maxLength: 500 }) : '',
      note: note ? sanitizeString(note.trim(), { maxLength: 1000 }) : '',
      images: images ?? []
    };
    
    if (weaverId) {
      updateData.weaverId = weaverId;
    }
    
    const sample = await Sample.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('weaverId', 'name phone address')
      .lean();
    
    if (!sample) {
      return Response.json({
        success: false,
        message: "Sample not found"
      }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      message: "Sample updated successfully",
      data: sample
    });
  } catch (error: unknown) {
    logger.error('Error updating sample', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'PUT /api/weaver/samples/[id]'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to update sample";
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

    await dbConnect();
    const { id } = await params;
    
    const sample = await Sample.findByIdAndDelete(id).lean();
    
    if (!sample) {
      return Response.json({
        success: false,
        message: "Sample not found"
      }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      message: "Sample deleted successfully"
    });
  } catch (error: unknown) {
    logger.error('Error deleting sample', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'DELETE /api/weaver/samples/[id]'
    });
    const errorMessage = error instanceof Error ? error.message : "Failed to delete sample";
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

