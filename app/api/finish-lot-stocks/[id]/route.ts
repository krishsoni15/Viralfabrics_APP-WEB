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
    
    // Check if lotType is being changed
    if (body.lotType) {
      const existingItem = await FinishLotStock.findById(id);
      if (existingItem && existingItem.lotType !== body.lotType) {
        // Generate new sequence
        const type = body.lotType === 'RFD' ? 'RFD' : 'OTHER';
        const prefix = type === 'RFD' ? 'RFD' : 'OTH';
        const latestEntry = await FinishLotStock.findOne({ lotType: type })
          .sort({ createdAt: -1 })
          .exec();

        let nextNumber = 1;
        if (latestEntry && latestEntry.sequence) {
          const parts = latestEntry.sequence.split('-');
          if (parts.length === 2) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num)) {
              nextNumber = num + 1;
            }
          }
        }
        body.sequence = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
      }
    }

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
    if (!session || session.role !== 'master') {
      return Response.json({ success: false, message: 'Access denied' }, { status: 403 });
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
