import dbConnect from "@/lib/dbConnect";
import PurchaseOrder from "@/models/PurchaseOrder";
import { getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/response";
import { generatePurchaseOrderPDF, getPurchaseOrderPDFFileName } from "@/lib/poPdfGenerator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master' && session.role !== 'superadmin') {
      return Response.json(forbiddenResponse('Access denied'), { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    const purchaseOrder = await PurchaseOrder.findById(id).lean();

    if (!purchaseOrder) {
      return Response.json(
        { success: false, message: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const doc = await generatePurchaseOrderPDF(purchaseOrder);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = getPurchaseOrderPDFFileName(purchaseOrder);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store"
      }
    });
  } catch (error: any) {
    console.error('GET /api/purchase-orders/[id]/pdf error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
