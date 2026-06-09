import dbConnect from "@/lib/dbConnect";
import Quality from "@/models/Quality";
import Order from "@/models/Order";
import { requireAuth } from "@/lib/session";
import { type NextRequest } from "next/server";
import { logUpdate, logDelete } from "@/lib/logger";
import { MillInput } from "@/models/Mill";
import MillOutput from "@/models/MillOutput";
import Dispatch from "@/models/Dispatch";

// GET /api/qualities/[id] - Get quality by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication temporarily disabled
    // await requireAuth(request);

    await dbConnect();
    
    const { id } = await params;
    
    const quality = await Quality.findById(id).select('_id name description createdAt updatedAt');
    
    if (!quality) {
      return new Response(
        JSON.stringify({ message: "Quality not found" }), 
        { status: 404 }
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: quality 
    }), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}

// PUT /api/qualities/[id] - Update quality
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication temporarily disabled
    // await requireAuth(request);

    const body = await request.json();
    const { id } = await params;
    
    const { name, description } = body;

    // Validation
    const errors: string[] = [];
    
    if (!name || !name.trim()) {
      errors.push("Quality name is required");
    } else if (name.trim().length < 2) {
      errors.push("Quality name must be at least 2 characters long");
    } else if (name.trim().length > 100) {
      errors.push("Quality name cannot exceed 100 characters");
    }
    
    if (description && description.trim().length > 500) {
      errors.push("Description cannot exceed 500 characters");
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ message: errors.join(", ") }), 
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the quality first
    const existingQuality = await Quality.findById(id);
    
    if (!existingQuality) {
      return new Response(
        JSON.stringify({ message: "Quality not found" }), 
        { status: 404 }
      );
    }

    // Check if another quality with same name already exists (case-insensitive)
    const duplicateQuality = await Quality.findOne({ 
      _id: { $ne: id },
      name: { $regex: `^${name.trim()}$`, $options: 'i' } 
    });
    
    if (duplicateQuality) {
      return new Response(
        JSON.stringify({ message: "A quality with this name already exists" }), 
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      description: description ? description.trim() : undefined,
    };

    // Update the quality
    const updatedQuality = await Quality.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('_id name description createdAt updatedAt');

    // Log the quality update
    await logUpdate('quality', id, updateData, updatedQuality.toObject(), request);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Quality updated successfully", 
        data: updatedQuality 
      }), 
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      
      // Handle MongoDB duplicate key errors
      if (error.message.includes('E11000')) {
        if (error.message.includes('name')) {
          return new Response(
            JSON.stringify({ message: "A quality with this name already exists" }), 
            { status: 400 }
          );
        }
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
        return new Response(
          JSON.stringify({ message: validationErrors.join(", ") }), 
          { status: 400 }
        );
      }
    }
    
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate session - only master can delete qualities
    const session = await requireAuth(req);
    if (session.role !== 'master') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Access denied - Only master can delete qualities" 
        }), 
        { status: 403 }
      );
    }

    await dbConnect();
    
    const { id } = await params;
    
    // Check if quality exists
    const existingQuality = await Quality.findById(id);
    if (!existingQuality) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Quality not found" 
        }), 
        { status: 404 }
      );
    }

    // ⚡ FIX: Check if quality is being used in any order items
    const ordersUsingQuality = await Order.find({
      'items.quality': id
    });
    
    // ⚡ FIX: Check if quality is being used in MillInput (main quality or additionalMeters)
    const millInputsUsingQuality = await MillInput.find({
      $or: [
        { quality: id },
        { 'additionalMeters.quality': id }
      ]
    });
    
    // ⚡ FIX: Check if quality is being used in MillOutput
    const millOutputsUsingQuality = await MillOutput.find({
      quality: id
    });
    
    // ⚡ FIX: Check if quality is being used in Dispatch
    const dispatchesUsingQuality = await Dispatch.find({
      quality: id
    });
    
    // Build usage details
    const usageDetails: string[] = [];
    if (ordersUsingQuality.length > 0) {
      usageDetails.push(`${ordersUsingQuality.length} order(s)`);
    }
    if (millInputsUsingQuality.length > 0) {
      usageDetails.push(`${millInputsUsingQuality.length} mill input(s)`);
    }
    if (millOutputsUsingQuality.length > 0) {
      usageDetails.push(`${millOutputsUsingQuality.length} mill output(s)`);
    }
    if (dispatchesUsingQuality.length > 0) {
      usageDetails.push(`${dispatchesUsingQuality.length} dispatch(es)`);
    }
    
    if (usageDetails.length > 0) {
      const usageMessage = usageDetails.join(', ');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Cannot delete quality "${existingQuality.name}" - it's being used in ${usageMessage}. Please remove all references to this quality first.` 
        }), 
        { status: 400 }
      );
    }

    // Delete the quality
    await Quality.findByIdAndDelete(id);

    // Log the quality deletion
    logDelete('quality', id, {}, req);

    // ⚡ FIX: Clear in-memory cache and revalidate Next.js cache
    try {
      const { qualitiesCache } = await import('../cache');
      if (qualitiesCache) {
        qualitiesCache.clear();
        console.log('🗑️ Cleared qualities cache after deleting quality');
      }
    } catch (e) {
      console.error('Failed to clear qualities cache:', e);
    }
    
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const { CACHE_TAGS } = await import('@/lib/cacheConfig');
    revalidateTag(CACHE_TAGS.QUALITIES);
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidatePath('/orders');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Quality deleted successfully" 
      }), 
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        message 
      }), 
      { status: 500 }
    );
  }
}
