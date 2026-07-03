import dbConnect from "@/lib/dbConnect";
import PurchaseOrder from "@/models/PurchaseOrder";
import Broker from "@/models/Broker";
import Supplier from "@/models/Supplier";
import Counter, { getCurrentFinancialYear } from "@/models/Counter";
import { getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/response";
import { apiRateLimiter, writeRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const purchaseOrder = await PurchaseOrder.findById(id)
      .populate('createdBy', 'name username')
      .lean();

    if (!purchaseOrder) {
      return Response.json(
        { success: false, message: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: purchaseOrder });
  } catch (error: any) {
    console.error('GET /api/purchase-orders/[id] error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const body = await request.json();

    const existingPO = await PurchaseOrder.findById(id);
    if (!existingPO) {
      return Response.json(
        { success: false, message: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Don't allow changing poNumber, companyHeader, or financialYear unless date/company changes
    const { poNumber, companyHeader, financialYear, _id, ...updateData } = body;

    // Handle poDate conversion
    if (updateData.poDate) {
      updateData.poDate = new Date(updateData.poDate);
    }

    // Check if companyHeader or poDate is changing in a way that shifts financial year/company
    const newCompanyHeader = body.companyHeader || existingPO.companyHeader;
    const newPoDate = updateData.poDate || existingPO.poDate;
    
    const newFyCode = getCurrentFinancialYear(newPoDate);
    const existingFyCode = existingPO.financialYear;

    if (newFyCode !== existingFyCode || newCompanyHeader !== existingPO.companyHeader) {
      // Build counter key based on company
      const counterKey = newCompanyHeader === 'Viral Fabrics'
        ? 'po_viral_fabrics'
        : 'po_viral_enterprise';

      // Get next FY-scoped sequence number (auto-resets per FY)
      const { sequence } = await (Counter as any).getNextFYSequence(counterKey, newPoDate);
      updateData.poNumber = `FY${newFyCode}-${String(sequence).padStart(3, '0')}`;
      updateData.financialYear = newFyCode;
      updateData.companyHeader = newCompanyHeader;
    }

    // Uppercase GSTIN
    if (updateData.supplierGstin) {
      updateData.supplierGstin = updateData.supplierGstin.trim().toUpperCase();
    }

    const collation = { locale: 'en', strength: 2 };

    // Update/Upsert broker in master DB with latest phone & timestamp
    if (updateData.brokerName && updateData.brokerName.trim()) {
      try {
        const trimmedName = updateData.brokerName.trim();
        const trimmedPhone = updateData.brokerPhone ? updateData.brokerPhone.trim() : '';

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
        console.error('Broker update error:', e.message);
      }
    }

    // Update/Upsert supplier in master DB with latest address, GSTIN & timestamp
    if (updateData.supplierName && updateData.supplierName.trim()) {
      try {
        const trimmedName = updateData.supplierName.trim();
        const trimmedAddress = updateData.supplierAddress ? updateData.supplierAddress.trim() : '';
        const trimmedGstin = updateData.supplierGstin ? updateData.supplierGstin.trim().toUpperCase() : '';

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
        console.error('Supplier update error:', e.message);
      }
    }

    const purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name username').lean();

    if (!purchaseOrder) {
      return Response.json(
        { success: false, message: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order updated successfully'
    });
  } catch (error: any) {
    console.error('PUT /api/purchase-orders/[id] error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    const session = await getSession(request);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    // Only master can delete
    if (session.role !== 'master') {
      return Response.json(forbiddenResponse('Only master can delete purchase orders'), { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    // Soft delete
    const purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      id,
      { $set: { softDeleted: true } },
      { new: true }
    );

    if (!purchaseOrder) {
      return Response.json(
        { success: false, message: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: `Purchase order ${purchaseOrder.poNumber} deleted successfully`
    });
  } catch (error: any) {
    console.error('DELETE /api/purchase-orders/[id] error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
