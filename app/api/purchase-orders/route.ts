import dbConnect from "@/lib/dbConnect";
import PurchaseOrder from "@/models/PurchaseOrder";
import Broker from "@/models/Broker";
import Supplier from "@/models/Supplier";
import Counter from "@/models/Counter";
import { getCurrentFinancialYear } from "@/models/Counter";
import { getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/response";
import { apiRateLimiter, writeRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";
import { sanitizeSearchQuery } from "@/lib/sanitize";

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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const search = sanitizeSearchQuery(searchParams.get('search') || '');
    const companyHeader = searchParams.get('companyHeader') || '';
    const fy = searchParams.get('fy') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const sort = searchParams.get('sort') || 'latest_first';

    // Build query
    const query: any = {
      $and: [
        {
          $or: [
            { softDeleted: false },
            { softDeleted: { $exists: false } }
          ]
        }
      ]
    };

    // Company header filter
    if (companyHeader) {
      query.$and.push({ companyHeader });
    }

    // Financial year filter
    if (fy) {
      query.$and.push({ financialYear: fy });
    }

    // Date range filter
    if (startDate && endDate) {
      query.$and.push({
        poDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        }
      });
    } else if (startDate) {
      query.$and.push({ poDate: { $gte: new Date(startDate) } });
    } else if (endDate) {
      query.$and.push({ poDate: { $lte: new Date(endDate + 'T23:59:59.999Z') } });
    }

    // Search across multiple fields
    if (search) {
      const searchPattern = search.trim();
      query.$and.push({
        $or: [
          { poNumber: { $regex: searchPattern, $options: 'i' } },
          { brokerName: { $regex: searchPattern, $options: 'i' } },
          { brokerPhone: { $regex: searchPattern, $options: 'i' } },
          { supplierName: { $regex: searchPattern, $options: 'i' } },
          { supplierGstin: { $regex: searchPattern, $options: 'i' } },
          { quality: { $regex: searchPattern, $options: 'i' } },
          { delivery: { $regex: searchPattern, $options: 'i' } },
          { notes: { $regex: searchPattern, $options: 'i' } },
          { rate: { $regex: searchPattern, $options: 'i' } },
          { paymentTerms: { $regex: searchPattern, $options: 'i' } }
        ]
      });
    }

    // Sort
    let sortOrder: any = { createdAt: -1 };
    if (sort === 'oldest_first') {
      sortOrder = { createdAt: 1 };
    } else if (sort === 'po_number_asc') {
      sortOrder = { poNumber: 1 };
    } else if (sort === 'po_number_desc') {
      sortOrder = { poNumber: -1 };
    }

    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .sort(sortOrder)
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('createdBy', 'name username')
        .lean()
        .maxTimeMS(5000),
      PurchaseOrder.countDocuments(query).maxTimeMS(3000)
    ]);

    const totalPages = Math.ceil(total / limit);

    return Response.json({
      success: true,
      data: purchaseOrders,
      message: 'Purchase orders loaded',
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error: any) {
    console.error('GET /api/purchase-orders error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    const session = await getSession(request);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master' && session.role !== 'superadmin') {
      return Response.json(forbiddenResponse('Access denied'), { status: 403 });
    }

    await dbConnect();
    const body = await request.json();

    const {
      companyHeader,
      poDate,
      brokerName,
      brokerPhone,
      supplierName,
      supplierAddress,
      supplierGstin,
      quality,
      pcsMtr,
      delivery,
      rate,
      paymentTerms,
      specs,
      notes
    } = body;

    if (!companyHeader || !['Viral Fabrics', 'Viral Enterprise'].includes(companyHeader)) {
      return Response.json(
        { success: false, message: 'Valid company header is required' },
        { status: 400 }
      );
    }

    // Get financial year based on poDate
    const parsedPoDate = poDate ? new Date(poDate) : new Date();
    const fyCode = getCurrentFinancialYear(parsedPoDate);

    // Build counter key based on company
    const counterKey = companyHeader === 'Viral Fabrics'
      ? 'po_viral_fabrics'
      : 'po_viral_enterprise';

    // Get next FY-scoped sequence number (auto-resets per FY)
    const { sequence } = await (Counter as any).getNextFYSequence(counterKey, parsedPoDate);
    const poNumber = `FY${fyCode}-${String(sequence).padStart(3, '0')}`;

    const collation = { locale: 'en', strength: 2 };

    // Save/Update broker to master DB (upsert with latest phone and timestamp)
    if (brokerName && brokerName.trim()) {
      try {
        const trimmedName = brokerName.trim();
        const trimmedPhone = brokerPhone ? brokerPhone.trim() : '';

        let brokerDoc = await Broker.findOne({ name: trimmedName, phone: trimmedPhone }).collation(collation);
        if (brokerDoc) {
          brokerDoc.updatedAt = new Date();
          await brokerDoc.save();
        } else {
          await Broker.create({
            name: trimmedName,
            phone: trimmedPhone
          });
        }
      } catch (e: any) {
        console.error('Broker save error:', e.message);
      }
    }

    // Save/Update supplier to master DB (upsert with latest address, GSTIN and timestamp)
    if (supplierName && supplierName.trim()) {
      try {
        const trimmedName = supplierName.trim();
        const trimmedAddress = supplierAddress ? supplierAddress.trim() : '';
        const trimmedGstin = supplierGstin ? supplierGstin.trim().toUpperCase() : '';

        let supplierDoc = await Supplier.findOne({
          name: trimmedName,
          address: trimmedAddress,
          gstin: trimmedGstin
        }).collation(collation);
        if (supplierDoc) {
          supplierDoc.updatedAt = new Date();
          await supplierDoc.save();
        } else {
          await Supplier.create({
            name: trimmedName,
            address: trimmedAddress,
            gstin: trimmedGstin
          });
        }
      } catch (e: any) {
        console.error('Supplier save error:', e.message);
      }
    }

    // Create purchase order
    const purchaseOrder = await PurchaseOrder.create({
      companyHeader,
      poNumber,
      poDate: poDate ? new Date(poDate) : new Date(),
      brokerName: brokerName?.trim() || '',
      brokerPhone: brokerPhone?.trim() || '',
      supplierName: supplierName?.trim() || '',
      supplierAddress: supplierAddress?.trim() || '',
      supplierGstin: supplierGstin?.trim().toUpperCase() || '',
      quality: quality?.trim() || '',
      pcsMtr: pcsMtr?.trim() || '',
      delivery: delivery?.trim() || '',
      rate: rate?.trim() || '',
      paymentTerms: paymentTerms?.trim() || '',
      specs: {
        finishGsm: specs?.finishGsm?.trim() || '',
        greyWidth: specs?.greyWidth?.trim() || '',
        finishWidth: specs?.finishWidth?.trim() || '',
        weight: specs?.weight?.trim() || ''
      },
      notes: notes?.trim() || '',
      financialYear: fyCode,
      createdBy: session.id,
      softDeleted: false
    });

    return Response.json(
      { success: true, data: purchaseOrder, message: `Purchase order ${poNumber} created successfully` },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('POST /api/purchase-orders error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
