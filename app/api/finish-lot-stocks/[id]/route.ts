import { NextResponse } from 'next/server';
import dbConnect from "@/lib/dbConnect";
import FinishLotStock from "@/models/FinishLotStock";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session) return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    await dbConnect();
    const { id } = await params;
    const item = await FinishLotStock.findById(id).lean();
    if (!item) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: item }), { status: 200 });
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
    
    // Normalize data if qualityName is provided
    if (body.qualityName) {
      body.qualityName = body.qualityName.trim();
    }
    
    const { id } = await params;
    const item = await FinishLotStock.findByIdAndUpdate(id, body, { new: true });
    if (!item) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: item }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session || (session.role !== 'master' && session.role !== 'superadmin')) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    await dbConnect();
    const { id } = await params;
    const item = await FinishLotStock.findByIdAndDelete(id);
    if (!item) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
