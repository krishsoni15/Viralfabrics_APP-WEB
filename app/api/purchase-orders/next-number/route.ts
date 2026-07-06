import dbConnect from "@/lib/dbConnect";
import Counter, { getCurrentFinancialYear } from "@/models/Counter";
import { getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/response";
import { apiRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    const session = await getSession(request);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master' && session.role !== 'superadmin') {
      return Response.json(forbiddenResponse('Access denied'), { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const companyHeader = searchParams.get('companyHeader');
    const poDateStr = searchParams.get('poDate');

    if (!companyHeader || !['Viral Fabrics', 'Viral Enterprise'].includes(companyHeader)) {
      return Response.json(
        { success: false, message: 'Valid companyHeader is required' },
        { status: 400 }
      );
    }

    const poDate = poDateStr ? new Date(poDateStr) : new Date();
    const fyCode = getCurrentFinancialYear(poDate);

    const counterKey = `${companyHeader === 'Viral Fabrics' ? 'po_viral_fabrics' : 'po_viral_enterprise'}_FY${fyCode}`;
    const counter = await Counter.findById(counterKey).lean() as any;

    const nextSequence = counter ? (counter.sequence + 1) : 1;
    const poNumber = `FY${fyCode}-${String(nextSequence).padStart(3, '0')}`;

    return Response.json({
      success: true,
      data: {
        poNumber,
        sequence: nextSequence,
        financialYear: fyCode
      }
    });
  } catch (error: any) {
    console.error('GET /api/purchase-orders/next-number error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to fetch next PO number' },
      { status: 500 }
    );
  }
}
