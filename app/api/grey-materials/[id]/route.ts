import { NextResponse } from 'next/server';
import dbConnect from "@/lib/dbConnect";
import GreyMaterial from "@/models/GreyMaterial";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    await dbConnect();
    const { id } = await params;
    const gm = await GreyMaterial.findById(id).lean();
    if (!gm) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    
    // Get ALL grey materials with the same quality code
    const qualityCodeToMatch = String(gm.qualityCode || '').trim();
    const allItems = await GreyMaterial.find({ 
      qualityCode: qualityCodeToMatch 
    })
      .lean()
      .sort({ createdAt: 1 });

    return new Response(JSON.stringify({ 
      success: true, 
      data: allItems,
      totalItems: allItems.length,
      qualityCode: gm.qualityCode
    }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    await dbConnect();
    const body = await req.json();
    const { id } = await params;
    const gm = await GreyMaterial.findByIdAndUpdate(id, body, { new: true });
    return new Response(JSON.stringify({ success: true, data: gm }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session || session.role !== 'master') return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    await dbConnect();
    const { id } = await params;
    await GreyMaterial.findByIdAndDelete(id);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
