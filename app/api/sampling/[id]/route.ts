import dbConnect from "@/lib/dbConnect";
import Sampling from "@/models/Sampling";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const data = await req.json();
    
    const {
      qualityName,
      whereToPut,
      images,
      notes,
      meter,
      piece
    } = data;
    
    if (!qualityName?.trim()) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Quality name is required" 
      }), { status: 400 });
    }

    const updateData = {
      qualityName: qualityName.trim(),
      whereToPut: whereToPut?.trim() || '',
      images: images || [],
      notes: notes || '',
      piece: piece ? Number(piece) : 0,
      meter: meter ? Number(meter) : 0
    };

    const updated = await Sampling.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Sampling not found" 
      }), { status: 404 });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Sampling updated successfully",
      data: updated
    }), { status: 200 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to update sampling" 
    }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session || (session.role !== 'master' && session.role !== 'superadmin')) {
      return Response.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    const deleted = await Sampling.findByIdAndDelete(id);

    if (!deleted) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Sampling not found" 
      }), { status: 404 });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Sampling deleted successfully" 
    }), { status: 200 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to delete sampling" 
    }), { status: 500 });
  }
}
