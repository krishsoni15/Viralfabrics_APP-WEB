import dbConnect from "@/lib/dbConnect";
import Broker from "@/models/Broker";
import Supplier from "@/models/Supplier";
import PurchaseOrder from "@/models/PurchaseOrder";
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
    const query = (searchParams.get('q') || '').trim();

    // 1. Fetch brokers from Broker master collection & PurchaseOrders
    const brokerMap = new Map<string, { _id: string; name: string; phone: string; updatedAt: string }>();

    // From Broker master collection
    const masterBrokers = await Broker.find(
      query ? {
        $or: [
          { name: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { phone: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        ]
      } : {}
    ).sort({ updatedAt: -1 }).limit(100).lean();

    for (const b of masterBrokers) {
      const bItem = b as any;
      if (bItem.name) {
        const bName = bItem.name.trim();
        const bPhone = bItem.phone ? bItem.phone.trim() : '';
        const key = `${bName.toLowerCase()}_${bPhone.toLowerCase()}`;
        brokerMap.set(key, {
          _id: String(bItem._id),
          name: bName,
          phone: bPhone,
          updatedAt: (bItem.updatedAt || new Date()).toISOString()
        });
      }
    }

    // From PurchaseOrders (latest 200 orders)
    const poBrokers = await PurchaseOrder.find(
      { softDeleted: false, brokerName: { $exists: true, $ne: '' } },
      'brokerName brokerPhone updatedAt'
    ).sort({ updatedAt: -1 }).limit(200).lean();

    for (const po of poBrokers) {
      const poItem = po as any;
      if (poItem.brokerName && poItem.brokerName.trim()) {
        const bName = poItem.brokerName.trim();
        const bPhone = poItem.brokerPhone ? poItem.brokerPhone.trim() : '';
        const key = `${bName.toLowerCase()}_${bPhone.toLowerCase()}`;
        const existing = brokerMap.get(key);
        if (!existing) {
          brokerMap.set(key, {
            _id: String(poItem._id),
            name: bName,
            phone: bPhone,
            updatedAt: (poItem.updatedAt || new Date()).toISOString()
          });
        }
      }
    }

    // 2. Fetch suppliers from Supplier master collection & PurchaseOrders
    const supplierMap = new Map<string, { _id: string; name: string; address: string; gstin: string; updatedAt: string }>();

    const masterSuppliers = await Supplier.find(
      query ? {
        $or: [
          { name: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { address: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { gstin: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        ]
      } : {}
    ).sort({ updatedAt: -1 }).limit(100).lean();

    for (const s of masterSuppliers) {
      const sItem = s as any;
      if (sItem.name) {
        const sName = sItem.name.trim();
        const sAddr = sItem.address ? sItem.address.trim() : '';
        const sGstin = sItem.gstin ? sItem.gstin.trim() : '';
        const key = `${sName.toLowerCase()}_${sAddr.toLowerCase()}_${sGstin.toLowerCase()}`;
        supplierMap.set(key, {
          _id: String(sItem._id),
          name: sName,
          address: sAddr,
          gstin: sGstin,
          updatedAt: (sItem.updatedAt || new Date()).toISOString()
        });
      }
    }

    // From PurchaseOrders (latest 200 orders)
    const poSuppliers = await PurchaseOrder.find(
      { softDeleted: false, supplierName: { $exists: true, $ne: '' } },
      'supplierName supplierAddress supplierGstin updatedAt'
    ).sort({ updatedAt: -1 }).limit(200).lean();

    for (const po of poSuppliers) {
      const poItem = po as any;
      if (poItem.supplierName && poItem.supplierName.trim()) {
        const sName = poItem.supplierName.trim();
        const sAddr = poItem.supplierAddress ? poItem.supplierAddress.trim() : '';
        const sGstin = poItem.supplierGstin ? poItem.supplierGstin.trim().toUpperCase() : '';
        const key = `${sName.toLowerCase()}_${sAddr.toLowerCase()}_${sGstin.toLowerCase()}`;
        const existing = supplierMap.get(key);
        if (!existing) {
          supplierMap.set(key, {
            _id: String(poItem._id),
            name: sName,
            address: sAddr,
            gstin: sGstin,
            updatedAt: (poItem.updatedAt || new Date()).toISOString()
          });
        }
      }
    }

    // Filter by query if query exists
    let brokers = Array.from(brokerMap.values());
    let suppliers = Array.from(supplierMap.values());

    if (query) {
      const q = query.toLowerCase();
      brokers = brokers.filter(b => b.name.toLowerCase().includes(q) || b.phone.toLowerCase().includes(q));
      suppliers = suppliers.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.gstin.toLowerCase().includes(q));
    }

    return Response.json({
      success: true,
      data: {
        brokers: brokers.slice(0, 50),
        suppliers: suppliers.slice(0, 50)
      }
    });

  } catch (error: any) {
    console.error('GET /api/purchase-orders/suggestions error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
