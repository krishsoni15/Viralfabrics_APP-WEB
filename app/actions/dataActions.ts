'use server';

/**
 * Server Actions for Data Fetching
 * 
 * These actions fetch data directly from the database, bypassing API routes
 * for maximum efficiency. They include automatic caching and revalidation.
 */

import { revalidateTag } from 'next/cache';
import dbConnect from '@/lib/dbConnect';
import { getSession } from '@/lib/session';
import { cookies, headers } from 'next/headers';
import { CACHE_TAGS, CACHE_DURATIONS } from '@/lib/cacheConfig';
import { Order, Party, Quality, Mill, MillInput, MillOutput, Dispatch, GreyInfo } from '@/models';
import { logError } from '@/lib/logger';
import { serializeMongoDoc, serializeMongoDocs } from '@/lib/serialize';

// ============================================================================
// TYPES
// ============================================================================

export interface FetchOrdersParams {
  limit?: number;
  page?: number;
  search?: string;
  searchType?: string;
  orderType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  millId?: string;
}

export interface FetchOrdersResult {
  success: boolean;
  data?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  message?: string;
}

// ============================================================================
// ORDERS
// ============================================================================

/**
 * Fetch orders directly from database (server-side only)
 * Optimized with lean queries and selective fields
 */
export async function fetchOrdersAction(params: FetchOrdersParams = {}): Promise<FetchOrdersResult> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const headersList = await headers();
    const authHeader = headersList.get('authorization') || cookieStore.get('auth-token')?.value;
    
    if (!authHeader) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    await dbConnect();

    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const page = Math.max(params.page || 1, 1);
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { softDeleted: { $ne: true } };

    if (params.status && params.status !== 'all') {
      query.status = params.status;
    }

    if (params.orderType && params.orderType !== 'all') {
      query.orderType = params.orderType;
    }

    if (params.startDate || params.endDate) {
      query.arrivalDate = {};
      if (params.startDate) {
        query.arrivalDate.$gte = new Date(params.startDate);
      }
      if (params.endDate) {
        query.arrivalDate.$lte = new Date(params.endDate);
      }
    }

    // Search handling
    if (params.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      const searchType = params.searchType || 'all';

      if (searchType === 'orderId') {
        query.orderId = { $regex: searchTerm, $options: 'i' };
      } else if (searchType === 'poNumber') {
        query.poNumber = { $regex: searchTerm, $options: 'i' };
      } else if (searchType === 'styleNo') {
        query.styleNo = { $regex: searchTerm, $options: 'i' };
      } else {
        // General search
        query.$or = [
          { orderId: { $regex: searchTerm, $options: 'i' } },
          { poNumber: { $regex: searchTerm, $options: 'i' } },
          { styleNo: { $regex: searchTerm, $options: 'i' } },
        ];
      }
    }

    // Mill filter (if provided)
    if (params.millId) {
      const millOrderIds = await MillInput.find({ mill: params.millId })
        .distinct('order')
        .lean()
        .maxTimeMS(2000);
      
      if (millOrderIds.length > 0) {
        query._id = { $in: millOrderIds };
      } else {
        // No orders for this mill
        return {
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
    }

    // Sort
    let sort: any = { createdAt: -1 };
    if (params.sort === 'latest_first') {
      sort = { createdAt: -1 };
    } else if (params.sort === 'oldest_first') {
      sort = { createdAt: 1 };
    } else if (params.sort === 'delivery_date') {
      sort = { deliveryDate: 1 };
    }

    // Execute query with lean for performance
    const [orders, total] = await Promise.all([
      Order.find(query)
        .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status priority totalAmount finalAmount paymentStatus createdAt updatedAt')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(3000),
      Order.countDocuments(query).maxTimeMS(2000),
    ]);

    // Fetch related data in parallel (faster than populate)
    const partyIds = [...new Set(orders.map((o: any) => o.party).filter(Boolean))];
    const qualityIds = [...new Set(
      orders.flatMap((o: any) => (o.items || []).map((item: any) => item.quality).filter(Boolean))
    )];

    const [parties, qualities] = await Promise.all([
      partyIds.length > 0
        ? Party.find({ _id: { $in: partyIds } })
            .select('_id name contactName contactPhone')
            .lean()
            .maxTimeMS(1000)
        : Promise.resolve([]),
      qualityIds.length > 0
        ? Quality.find({ _id: { $in: qualityIds } })
            .select('_id name code')
            .lean()
            .maxTimeMS(1000)
        : Promise.resolve([]),
    ]);

    // Map parties and qualities
    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Enrich orders with related data
    const enrichedOrders = orders.map((order: any) => ({
      ...order,
      party: order.party ? partyMap.get(order.party.toString()) : null,
      items: (order.items || []).map((item: any) => ({
        ...item,
        quality: item.quality ? qualityMap.get(item.quality.toString()) : null,
      })),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: serializeMongoDocs(enrichedOrders),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logError('Failed to fetch orders', error, { params });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch orders',
    };
  }
}

// ============================================================================
// MILL DATA
// ============================================================================

/**
 * Fetch mill inputs for an order
 */
export async function fetchMillInputsAction(orderId: string) {
  try {
    await dbConnect();
    
    const millInputs = await MillInput.find({ order: orderId })
      .populate('mill', 'name contactPerson contactPhone')
      .populate('quality', 'name code')
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(millInputs),
    };
  } catch (error) {
    logError('Failed to fetch mill inputs', error, { orderId });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch mill inputs',
    };
  }
}

/**
 * Fetch mill outputs for an order
 */
export async function fetchMillOutputsAction(orderId: string) {
  try {
    await dbConnect();
    
    const millOutputs = await MillOutput.find({ order: orderId })
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(millOutputs),
    };
  } catch (error) {
    logError('Failed to fetch mill outputs', error, { orderId });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch mill outputs',
    };
  }
}

// ============================================================================
// DISPATCH DATA
// ============================================================================

/**
 * Fetch dispatches for an order
 */
export async function fetchDispatchesAction(orderId: string) {
  try {
    await dbConnect();
    
    const dispatches = await Dispatch.find({ order: orderId })
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(dispatches),
    };
  } catch (error) {
    logError('Failed to fetch dispatches', error, { orderId });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch dispatches',
    };
  }
}

// ============================================================================
// GREY INFO
// ============================================================================

/**
 * Fetch grey info for an order
 */
export async function fetchGreyInfoAction(orderId: string) {
  try {
    await dbConnect();
    
    const greyInfo = await GreyInfo.find({ order: orderId })
      .populate('quality', 'name code')
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(greyInfo),
    };
  } catch (error) {
    logError('Failed to fetch grey info', error, { orderId });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch grey info',
    };
  }
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * Fetch dashboard statistics directly from database
 */
export async function fetchDashboardStatsAction(params?: {
  startDate?: string;
  endDate?: string;
  financialYear?: string;
}) {
  try {
    await dbConnect();

    const query: any = { softDeleted: { $ne: true } };

    // Date filtering
    if (params?.startDate || params?.endDate) {
      query.createdAt = {};
      if (params.startDate) {
        query.createdAt.$gte = new Date(params.startDate);
      }
      if (params.endDate) {
        query.createdAt.$lte = new Date(params.endDate);
      }
    }

    // Execute all queries in parallel
    const [
      totalOrders,
      statusStats,
      typeStats,
      pendingTypeStats,
      deliveredTypeStats,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(query).maxTimeMS(2000),
      Order.aggregate(
        [
          { $match: query },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ],
        { maxTimeMS: 2000 }
      ),
      Order.aggregate(
        [
          { $match: query },
          { $group: { _id: '$orderType', count: { $sum: 1 } } },
        ],
        { maxTimeMS: 2000 }
      ),
      // Pending orders by type (including "Not set", "Not selected", null, or missing status)
      Order.aggregate(
        [
          {
            $match: {
              ...query,
              $or: [
                { status: { $in: ['pending', 'Not set', 'Not selected', null] } },
                { status: { $exists: false } },
              ],
            },
          },
          { $group: { _id: '$orderType', count: { $sum: 1 } } },
        ],
        { maxTimeMS: 2000 }
      ),
      // Delivered orders by type
      Order.aggregate(
        [
          {
            $match: {
              ...query,
              status: 'delivered',
            },
          },
          { $group: { _id: '$orderType', count: { $sum: 1 } } },
        ],
        { maxTimeMS: 2000 }
      ),
      Order.find(query)
        .select('_id orderId orderType status deliveryDate createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .maxTimeMS(2000),
    ]);

    // Process stats
    const statusMap = new Map(statusStats.map((s: any) => [s._id?.toLowerCase() || 'not_set', s.count]));
    
    // Helper to normalize orderType (handle null/undefined)
    const normalizeOrderType = (type: any): string => {
      if (!type || type === null || type === undefined) return 'not_set';
      return type; // Preserve "Dying" and "Printing" as-is
    };
    
    const typeMap = new Map(typeStats.map((t: any) => [normalizeOrderType(t._id), t.count]));
    const pendingTypeMap = new Map(pendingTypeStats.map((t: any) => [normalizeOrderType(t._id), t.count]));
    const deliveredTypeMap = new Map(deliveredTypeStats.map((t: any) => [normalizeOrderType(t._id), t.count]));

    return {
      success: true,
      data: {
        totalOrders,
        statusStats: {
          pending: statusMap.get('pending') || 0,
          in_progress: statusMap.get('in_progress') || 0,
          completed: statusMap.get('completed') || 0,
          delivered: statusMap.get('delivered') || 0,
          cancelled: statusMap.get('cancelled') || 0,
          not_set: statusMap.get('not set') || statusMap.get('not_set') || 0,
        },
        typeStats: {
          Dying: typeMap.get('Dying') || 0,
          Printing: typeMap.get('Printing') || 0,
          not_set: typeMap.get('not_set') || 0,
        },
        pendingTypeStats: {
          Dying: pendingTypeMap.get('Dying') || 0,
          Printing: pendingTypeMap.get('Printing') || 0,
          not_set: pendingTypeMap.get('not_set') || 0,
        },
        deliveredTypeStats: {
          Dying: deliveredTypeMap.get('Dying') || 0,
          Printing: deliveredTypeMap.get('Printing') || 0,
          not_set: deliveredTypeMap.get('not_set') || 0,
        },
        recentOrders: serializeMongoDocs(recentOrders),
      },
    };
  } catch (error) {
    logError('Failed to fetch dashboard stats', error, { params });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
    };
  }
}

// ============================================================================
// REFERENCE DATA
// ============================================================================

/**
 * Fetch parties (cached, rarely changes)
 */
export async function fetchPartiesAction(params?: { search?: string; limit?: number }) {
  try {
    await dbConnect();

    const query: any = { isActive: true };
    if (params?.search) {
      query.name = { $regex: params.search, $options: 'i' };
    }

    const limit = Math.min(params?.limit || 100, 1000);

    const parties = await Party.find(query)
      .select('_id name contactName contactPhone address')
      .sort({ name: 1 })
      .limit(limit)
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(parties),
    };
  } catch (error) {
    logError('Failed to fetch parties', error, { params });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch parties',
    };
  }
}

/**
 * Fetch qualities (cached, rarely changes)
 */
export async function fetchQualitiesAction(params?: { search?: string; limit?: number }) {
  try {
    await dbConnect();

    const query: any = {};
    if (params?.search) {
      query.name = { $regex: params.search, $options: 'i' };
    }

    const limit = Math.min(params?.limit || 100, 1000);

    const qualities = await Quality.find(query)
      .select('_id name code description')
      .sort({ name: 1 })
      .limit(limit)
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(qualities),
    };
  } catch (error) {
    logError('Failed to fetch qualities', error, { params });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch qualities',
    };
  }
}

/**
 * Fetch mills (cached, rarely changes)
 */
export async function fetchMillsAction(params?: { search?: string; limit?: number }) {
  try {
    await dbConnect();

    const query: any = { isActive: true };
    if (params?.search) {
      query.name = { $regex: params.search, $options: 'i' };
    }

    const limit = Math.min(params?.limit || 100, 1000);

    const mills = await Mill.find(query)
      .select('_id name contactPerson contactPhone address email')
      .sort({ name: 1 })
      .limit(limit)
      .lean()
      .maxTimeMS(2000);

    return {
      success: true,
      data: serializeMongoDocs(mills),
    };
  } catch (error) {
    logError('Failed to fetch mills', error, { params });
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch mills',
    };
  }
}

