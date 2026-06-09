import dbConnect from "@/lib/dbConnect";
import Order, { IOrderModel, IOrder } from "@/models/Order";
import Party from "@/models/Party";
import Quality from "@/models/Quality";
import Counter from "@/models/Counter";
import { Mill } from "@/models";
import { getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { logView, logOrderChange, logError } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/response";
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from "@/lib/cacheConfig";
import { revalidateTag, revalidatePath } from 'next/cache';
import { clearDashboardCache } from '@/lib/dashboardCache';
import { apiRateLimiter, writeRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";
import { sanitizeSearchQuery } from "@/lib/sanitize";

// Helper function to convert YYYY-MM-DD string to Date object at UTC midnight
function parseDateString(dateString: string | undefined | null): Date | undefined {
  if (!dateString) return undefined;

  // If it's already a YYYY-MM-DD format, create date at UTC midnight to avoid timezone shifts
  const yyyyMmDdMatch = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch;
    // Create date at UTC midnight (month is 0-indexed)
    return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
  }

  // Fallback to standard Date parsing
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? undefined : date;
}

// Simple in-memory cache for frequently accessed data
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

// Export function to clear cache (used by renumber route)
export function clearOrdersCache() {
  queryCache.clear();
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️ Orders cache cleared');
  }
}

// Ensure all models are registered
const models = { Order, Party, Quality, Counter };

export async function GET(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session first (security check)
    const session = await getSession(request);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    // 🔍 DEBUG: Log session info for debugging party scoping
    console.log('🔍 Orders API Session:', {
      userId: session.id,
      role: session.role,
      partyId: session.partyId,
      hasPartyId: !!session.partyId
    });

    // Connect to database with timeout (increased for reliability)
    try {
      await Promise.race([
        dbConnect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database connection timeout')), 15000)
        )
      ]);
    } catch (dbError: any) {
      // If connection fails, try to use cached data if available
      const cacheKey = `orders_${JSON.stringify({ limit: 10, page: 1, status: '' })}`;
      const cached = queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL * 2) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Using cached data due to DB connection issue');
        }
        return Response.json({
          success: true,
          data: cached.data.data,
          message: 'Orders loaded from cache (DB connection issue)',
          pagination: cached.data.pagination
        }, { headers: getCacheHeaders(CACHE_DURATIONS.ORDERS_LIST) });
      }
      throw dbError;
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25'), 1), 100); // Enforce max 100
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1); // Enforce min page 1
    // Sanitize search input to prevent NoSQL injection
    const search = sanitizeSearchQuery(searchParams.get('search') || '');
    const orderType = searchParams.get('orderType') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const sort = searchParams.get('sort') || 'latest_first';
    const millId = searchParams.get('millId') || '';
    const fy = searchParams.get('fy') || ''; // Financial year filter (e.g. "2526", "legacy", or "" for all)
    const force = searchParams.get('force') === 'true';
    const timestamp = searchParams.get('t'); // Cache busting timestamp parameter

    // Create cache key for this query (include millId and fy for proper caching with multiple filters)
    const cacheKey = `orders_${JSON.stringify({ limit, page, search, orderType, status, startDate, endDate, sort, millId, fy })}`;

    // Check cache first (skip if force refresh OR timestamp provided for cache busting)
    if (!force && !timestamp) {
      const cached = queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return Response.json({
          success: true,
          data: cached.data.data,
          message: 'Orders loaded from cache',
          pagination: cached.data.pagination
        });
      }
    }

    // Build query with proper search logic
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

    // Restrict orders to the user's party if session has a partyId (applies to party users)
    if (session && session.partyId && session.role !== 'master' && session.role !== 'superadmin') {
      const mongoose = await import('mongoose');
      if (mongoose.default.Types.ObjectId.isValid(session.partyId)) {
        query.$and.push({ party: new mongoose.default.Types.ObjectId(session.partyId) });
      } else {
        query.$and.push({ party: session.partyId });
      }
      // 🔍 DEBUG: Confirm party filter was applied
      console.log('🔍 Party filter applied:', session.partyId);
    } else if (session) {
      // 🔍 DEBUG: Log why filter was NOT applied
      console.log('🔍 Party filter NOT applied - reason:', {
        hasPartyId: !!session.partyId,
        isMaster: session.role === 'master',
        isSuperAdmin: session.role === 'superadmin',
        role: session.role
      });
    }

    // If mill filter provided, prefetch order IDs that have mill inputs for that mill
    if (millId) {
      try {
        const { MillInput } = await import('@/models/Mill');
        const millOrderIds = await MillInput.find({ mill: millId })
          .distinct('order')
          .maxTimeMS(2000);
        if (millOrderIds && millOrderIds.length > 0) {
          query.$and.push({ _id: { $in: millOrderIds } });
        } else {
          // No orders for this mill; short-circuit by forcing empty result
          query.$and.push({ _id: { $in: [] } });
        }
      } catch (e) {
        console.error('Mill filter lookup error:', e);
        // In case of error, return empty set to avoid incorrect results
        query.$and.push({ _id: { $in: [] } });
      }
    }

    let searchConditions: any[] = [];
    if (search) {
      const searchPattern = search.trim();
      let needsPostProcessing = false;

      // Check if search has type prefix (e.g., "orderId:123", "party:ABC")
      if (searchPattern.includes(':')) {
        const [searchType, searchValue] = searchPattern.split(':', 2);
        const trimmedValue = searchValue.trim();

        switch (searchType.toLowerCase()) {
          case 'orderid':
          case 'order':
            searchConditions = [
              { orderId: { $regex: trimmedValue, $options: 'i' } },
              { orderId: trimmedValue } // Exact match
            ];
            break;
          case 'ponumber':
          case 'po':
            searchConditions = [
              { poNumber: { $regex: trimmedValue, $options: 'i' } }
            ];
            break;
          case 'styleno':
          case 'style':
            searchConditions = [
              { styleNo: { $regex: trimmedValue, $options: 'i' } }
            ];
            break;
          case 'party':
            // For party search, we need to find party IDs first, then search orders
            try {
              const parties = await Party.find({
                $or: [
                  { name: { $regex: trimmedValue, $options: 'i' } },
                  { contactName: { $regex: trimmedValue, $options: 'i' } },
                  { contactPhone: { $regex: trimmedValue, $options: 'i' } },
                  { contactEmail: { $regex: trimmedValue, $options: 'i' } },
                  { address: { $regex: trimmedValue, $options: 'i' } }
                ]
              }).select('_id').lean().maxTimeMS(2000);

              const partyIds = parties.map(p => p._id);
              if (process.env.NODE_ENV === 'development') {
                console.log(`🔍 Party Search: Found ${parties.length} parties matching "${trimmedValue}":`, partyIds);
              }
              if (partyIds.length > 0) {
                searchConditions = [
                  { party: { $in: partyIds } },
                  { orderId: { $regex: trimmedValue, $options: 'i' } },
                  { contactName: { $regex: trimmedValue, $options: 'i' } },
                  { contactEmail: { $regex: trimmedValue, $options: 'i' } },
                  { poNumber: { $regex: trimmedValue, $options: 'i' } },
                  { styleNo: { $regex: trimmedValue, $options: 'i' } },
                  { contactPhone: { $regex: trimmedValue, $options: 'i' } },
                  { notes: { $regex: trimmedValue, $options: 'i' } }
                ];
              } else {
                // No parties found, search other fields as fallback
                searchConditions = [
                  { orderId: { $regex: trimmedValue, $options: 'i' } },
                  { contactName: { $regex: trimmedValue, $options: 'i' } },
                  { contactEmail: { $regex: trimmedValue, $options: 'i' } },
                  { poNumber: { $regex: trimmedValue, $options: 'i' } },
                  { styleNo: { $regex: trimmedValue, $options: 'i' } },
                  { contactPhone: { $regex: trimmedValue, $options: 'i' } },
                  { notes: { $regex: trimmedValue, $options: 'i' } }
                ];
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Party search error:', error);
              }
              // Fallback to basic search
              searchConditions = [
                { orderId: { $regex: trimmedValue, $options: 'i' } },
                { contactName: { $regex: trimmedValue, $options: 'i' } },
                { contactEmail: { $regex: trimmedValue, $options: 'i' } },
                { poNumber: { $regex: trimmedValue, $options: 'i' } },
                { styleNo: { $regex: trimmedValue, $options: 'i' } },
                { contactPhone: { $regex: trimmedValue, $options: 'i' } },
                { notes: { $regex: trimmedValue, $options: 'i' } }
              ];
            }
            needsPostProcessing = true;
            break;
          case 'quality':
            // For quality search, we need to find quality IDs first, then search orders
            try {
              const qualities = await Quality.find({
                $or: [
                  { name: { $regex: trimmedValue, $options: 'i' } },
                  { description: { $regex: trimmedValue, $options: 'i' } },
                  { code: { $regex: trimmedValue, $options: 'i' } }
                ]
              }).select('_id').lean().maxTimeMS(2000);

              const qualityIds = qualities.map(q => q._id);
              if (process.env.NODE_ENV === 'development') {
                console.log(`🔍 Quality Search: Found ${qualities.length} qualities matching "${trimmedValue}":`, qualityIds);
              }
              if (qualityIds.length > 0) {
                searchConditions = [
                  { 'items.quality': { $in: qualityIds } },
                  { orderId: { $regex: trimmedValue, $options: 'i' } },
                  { 'items.description': { $regex: trimmedValue, $options: 'i' } },
                  { 'items.weaverSupplierName': { $regex: trimmedValue, $options: 'i' } },
                  { contactName: { $regex: trimmedValue, $options: 'i' } },
                  { notes: { $regex: trimmedValue, $options: 'i' } }
                ];
              } else {
                // No qualities found, search other fields as fallback
                searchConditions = [
                  { orderId: { $regex: trimmedValue, $options: 'i' } },
                  { 'items.description': { $regex: trimmedValue, $options: 'i' } },
                  { 'items.weaverSupplierName': { $regex: trimmedValue, $options: 'i' } },
                  { contactName: { $regex: trimmedValue, $options: 'i' } },
                  { notes: { $regex: trimmedValue, $options: 'i' } }
                ];
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Quality search error:', error);
              }
              // Fallback to basic search
              searchConditions = [
                { orderId: { $regex: trimmedValue, $options: 'i' } },
                { 'items.description': { $regex: trimmedValue, $options: 'i' } },
                { 'items.weaverSupplierName': { $regex: trimmedValue, $options: 'i' } },
                { contactName: { $regex: trimmedValue, $options: 'i' } },
                { notes: { $regex: trimmedValue, $options: 'i' } }
              ];
            }
            needsPostProcessing = true;
            break;
          case 'mill':
            // For mill search, we need to find mill IDs first, then search orders with mill inputs
            try {
              const mills = await Mill.find({
                name: { $regex: trimmedValue, $options: 'i' }
              }).select('_id').lean().maxTimeMS(2000);

              const millIds = mills.map(m => m._id);
              if (process.env.NODE_ENV === 'development') {
                console.log(`🔍 Mill Search: Found ${mills.length} mills matching "${trimmedValue}":`, millIds);
              }

              if (millIds.length > 0) {
                // Import MillInput model
                const { MillInput } = await import('@/models/Mill');

                // Find mill inputs for these mills and get the order IDs/order references
                const millInputs = await MillInput.find({ mill: { $in: millIds } })
                  .select('orderId order')
                  .lean()
                  .maxTimeMS(2000);

                // Collect both orderId strings and order ObjectIds
                const orderIds = new Set<string>();
                const orderObjectIds = new Set<string>();

                millInputs.forEach((mi: any) => {
                  if (mi.orderId) {
                    orderIds.add(mi.orderId.toString());
                  }
                  if (mi.order) {
                    orderObjectIds.add(mi.order.toString());
                  }
                });

                const orderIdsArray = Array.from(orderIds);
                const orderObjectIdsArray = Array.from(orderObjectIds);

                if (process.env.NODE_ENV === 'development') {
                  console.log(`🔍 Mill Search: Found ${millInputs.length} mill inputs, ${orderIdsArray.length} unique order IDs`);
                }

                if (orderIdsArray.length > 0 || orderObjectIdsArray.length > 0) {
                  searchConditions = [];
                  if (orderIdsArray.length > 0) {
                    searchConditions.push({ orderId: { $in: orderIdsArray } });
                  }
                  if (orderObjectIdsArray.length > 0) {
                    searchConditions.push({ _id: { $in: orderObjectIdsArray } });
                  }
                } else {
                  // No orders found with these mills, return empty result
                  searchConditions = [{ _id: { $in: [] } }];
                }
              } else {
                // No mills found, return empty result
                searchConditions = [{ _id: { $in: [] } }];
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Mill search error:', error);
              }
              // Fallback to empty result on error
              searchConditions = [{ _id: { $in: [] } }];
            }
            needsPostProcessing = true;
            break;
          case 'phone':
            searchConditions = [
              { contactPhone: { $regex: trimmedValue, $options: 'i' } }
            ];
            break;
          case 'weaver':
            // Search by weaver/supplier name in items
            searchConditions = [
              { 'items.weaverSupplierName': { $regex: trimmedValue, $options: 'i' } },
              { orderId: { $regex: trimmedValue, $options: 'i' } },
              { 'items.description': { $regex: trimmedValue, $options: 'i' } }
            ];
            break;
          default:
            // Fallback to general search - search all fields
            searchConditions = [
              { orderId: { $regex: trimmedValue, $options: 'i' } },
              { poNumber: { $regex: trimmedValue, $options: 'i' } },
              { styleNo: { $regex: trimmedValue, $options: 'i' } },
              { contactName: { $regex: trimmedValue, $options: 'i' } },
              { contactPhone: { $regex: trimmedValue, $options: 'i' } },
              { contactEmail: { $regex: trimmedValue, $options: 'i' } },
              { notes: { $regex: trimmedValue, $options: 'i' } },
              { shippingAddress: { $regex: trimmedValue, $options: 'i' } },
              { billingAddress: { $regex: trimmedValue, $options: 'i' } },
              { paymentMethod: { $regex: trimmedValue, $options: 'i' } },
              { 'items.description': { $regex: trimmedValue, $options: 'i' } },
              { 'items.weaverSupplierName': { $regex: trimmedValue, $options: 'i' } },
              { 'items.notes': { $regex: trimmedValue, $options: 'i' } },
              { 'metadata.tags': { $regex: trimmedValue, $options: 'i' } },
              { 'metadata.source': { $regex: trimmedValue, $options: 'i' } }
            ];
            needsPostProcessing = true;
        }
      } else {
        // Enhanced general search across all fields including party, quality, and mill
        // First, try to find matching parties, qualities, and mills
        let partyIds: any[] = [];
        let qualityIds: any[] = [];
        let orderIdsFromMills: string[] = [];

        try {
          // Search for matching parties - search all party fields
          const parties = await Party.find({
            $or: [
              { name: { $regex: searchPattern, $options: 'i' } },
              { contactName: { $regex: searchPattern, $options: 'i' } },
              { contactPhone: { $regex: searchPattern, $options: 'i' } },
              { contactEmail: { $regex: searchPattern, $options: 'i' } },
              { address: { $regex: searchPattern, $options: 'i' } }
            ]
          }).select('_id').lean().maxTimeMS(2000);
          partyIds = parties.map(p => p._id);

          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 General Search - Party: Found ${parties.length} parties matching "${searchPattern}"`);
          }

          // Search for matching qualities - search all quality fields
          const qualities = await Quality.find({
            $or: [
              { name: { $regex: searchPattern, $options: 'i' } },
              { description: { $regex: searchPattern, $options: 'i' } },
              { code: { $regex: searchPattern, $options: 'i' } }
            ]
          }).select('_id').lean().maxTimeMS(2000);
          qualityIds = qualities.map(q => q._id);

          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 General Search - Quality: Found ${qualities.length} qualities matching "${searchPattern}"`);
          }

          // Search for matching mills and get order IDs
          const mills = await Mill.find({
            name: { $regex: searchPattern, $options: 'i' }
          }).select('_id').lean().maxTimeMS(2000);

          if (mills.length > 0) {
            const millIds = mills.map(m => m._id);
            const { MillInput } = await import('@/models/Mill');

            const millInputs = await MillInput.find({ mill: { $in: millIds } })
              .select('orderId order')
              .lean()
              .maxTimeMS(2000);

            const orderIdsSet = new Set<string>();
            const orderObjectIdsSet = new Set<string>();

            millInputs.forEach((mi: any) => {
              if (mi.orderId) {
                orderIdsSet.add(mi.orderId.toString());
              }
              if (mi.order) {
                // Convert ObjectId to string properly
                const orderId = mi.order.toString();
                orderObjectIdsSet.add(orderId);
              }
            });

            // Convert ObjectIds to proper format for MongoDB query
            const mongoose = await import('mongoose');
            const orderObjectIds = Array.from(orderObjectIdsSet).map(id => {
              if (mongoose.default.Types.ObjectId.isValid(id)) {
                return new mongoose.default.Types.ObjectId(id);
              }
              return null;
            }).filter(Boolean);

            orderIdsFromMills = Array.from(orderIdsSet);

            // Store order ObjectIds for later use in search conditions
            if (orderObjectIds.length > 0) {
              // Store as strings for easier handling
              orderIdsFromMills.push(...orderObjectIds.map(id => id!.toString()));
            }

            if (process.env.NODE_ENV === 'development') {
              console.log(`🔍 General Search - Mill: Found ${mills.length} mills, ${orderIdsFromMills.length} orders (${orderIdsSet.size} orderId strings, ${orderObjectIds.length} ObjectIds)`);
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('General search party/quality/mill lookup error:', error);
          }
        }

        searchConditions = [
          // Exact matches - Order fields
          { orderId: { $regex: searchPattern, $options: 'i' } },
          { poNumber: { $regex: searchPattern, $options: 'i' } },
          { styleNo: { $regex: searchPattern, $options: 'i' } },
          { contactName: { $regex: searchPattern, $options: 'i' } },
          { contactPhone: { $regex: searchPattern, $options: 'i' } },
          { contactEmail: { $regex: searchPattern, $options: 'i' } },
          { notes: { $regex: searchPattern, $options: 'i' } },
          { shippingAddress: { $regex: searchPattern, $options: 'i' } },
          { billingAddress: { $regex: searchPattern, $options: 'i' } },
          { paymentMethod: { $regex: searchPattern, $options: 'i' } },
          // Item fields
          { 'items.description': { $regex: searchPattern, $options: 'i' } },
          { 'items.weaverSupplierName': { $regex: searchPattern, $options: 'i' } },
          { 'items.notes': { $regex: searchPattern, $options: 'i' } },
          // Metadata fields
          { 'metadata.tags': { $regex: searchPattern, $options: 'i' } },
          { 'metadata.source': { $regex: searchPattern, $options: 'i' } }
        ];

        // Add party, quality, and mill matches if found
        if (partyIds.length > 0) {
          searchConditions.push({ party: { $in: partyIds } });
        }
        if (qualityIds.length > 0) {
          searchConditions.push({ 'items.quality': { $in: qualityIds } });
        }
        if (orderIdsFromMills.length > 0) {
          // Separate orderId strings and ObjectIds
          const orderIdStrings = orderIdsFromMills.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
          const orderObjectIds = orderIdsFromMills.filter(id => id.match(/^[0-9a-fA-F]{24}$/));

          if (orderIdStrings.length > 0) {
            searchConditions.push({ orderId: { $in: orderIdStrings } });
          }
          if (orderObjectIds.length > 0) {
            searchConditions.push({ _id: { $in: orderObjectIds } });
          }
        }

        // Add exact match for numeric order IDs (highest priority)
        if (/^\d+$/.test(searchPattern)) {
          searchConditions.unshift({ orderId: searchPattern });
        }
        needsPostProcessing = true;
      }

      query.$and.push({
        $or: searchConditions
      });

    }

    if (orderType) {
      query.orderType = orderType;
    }

    // Financial Year filter
    if (fy) {
      if (fy === 'legacy') {
        // Show old orders that don't have the FY prefix
        query.$and.push({ orderId: { $not: /^FY/ } });
      } else if (fy === '2526') {
        // Special case for FY 25-26: show both prefixed (FY2526-) AND orders without FY prefix
        // Since app starts from FY 25-26, all non-prefixed orders belong to this period.
        query.$and.push({
          $or: [
            { orderId: { $regex: /^FY2526-/ } },
            { orderId: { $not: /^FY/ } }
          ]
        });
      } else {
        // Filter by specific FY (e.g., fy=2627 → match orderId starting with "FY2627-")
        query.$and.push({ orderId: { $regex: `^FY${fy}-` } });
      }
    }

    if (status) {
      // Support multiple status values separated by commas
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        query.status = statusArray[0];
      } else {
        query.status = { $in: statusArray };
      }
    }

    // Add date range filtering
    if (startDate && endDate) {
      query.deliveryDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Determine sort order for optimal performance
    let sortOrder: any = { createdAt: -1 }; // Default: latest first
    if (sort === 'oldest_first') {
      sortOrder = { createdAt: 1 }; // Oldest first
    } else if (sort === 'latest_first') {
      sortOrder = { createdAt: -1 }; // Latest first (explicit)
    }

    // ⚡ ULTRA-FAST: Query without populate (fetch related data separately)
    const orders = await Order.find(query)
      .select('orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status labData createdAt updatedAt')
      .sort(sortOrder)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean()
      .maxTimeMS(2000); // ⚡ Reduced to 2 seconds for speed

    // ⚡ Fetch parties and qualities separately (MUCH faster than populate)
    const partyIds = [...new Set(orders.map((o: any) => o.party).filter(Boolean))];
    const qualityIds = [...new Set(orders.flatMap((o: any) =>
      o.items?.map((item: any) => item.quality).filter(Boolean) || []
    ))];

    const [parties, qualities] = await Promise.all([
      partyIds.length > 0 ? Party.find({ _id: { $in: partyIds } })
        .select('_id name contactName contactPhone')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.find({ _id: { $in: qualityIds } })
        .select('_id name')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Helper to format date to YYYY-MM-DD string to avoid timezone issues
    const formatDateForResponse = (date: Date | string | null | undefined): string | null => {
      if (!date) return null;
      if (typeof date === 'string') {
        // If already a string, extract YYYY-MM-DD part
        const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
      }
      if (date instanceof Date) {
        // Extract date components from UTC to match how we store dates
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    // ⚡ Attach parties and qualities to orders
    const ordersWithPopulated = orders.map((order: any) => ({
      ...order,
      arrivalDate: formatDateForResponse(order.arrivalDate),
      poDate: formatDateForResponse(order.poDate),
      deliveryDate: formatDateForResponse(order.deliveryDate),
      party: order.party ? partyMap.get(order.party.toString()) || order.party : null,
      items: order.items?.map((item: any) => ({
        ...item,
        quality: item.quality ? qualityMap.get(item.quality.toString()) || item.quality : null
      })) || []
    }));

    // Debug search results
    if (search && process.env.NODE_ENV === 'development') {
      console.log(`🔍 Search completed: Found ${ordersWithPopulated.length} orders`);
    }

    // Use Promise.all to parallelize all data fetching
    const [labs, millInputs, millOutputs, dispatches, greyInfo, total] = await Promise.all([
      // Fetch lab data for all orders
      ordersWithPopulated.length > 0 ? (async () => {
        try {
          const Lab = (await import('@/models/Lab')).default;
          const orderIds = ordersWithPopulated.map(order => order._id);

          return await Lab.find({
            order: { $in: orderIds },
            softDeleted: { $ne: true }
          })
            .select('orderItemId labSendDate labSendData labSendNumber status')
            .lean()
            .maxTimeMS(1000); // ⚡ Reduced to 1 second
        } catch (labError) {
          return [];
        }
      })() : Promise.resolve([]),

      // ⚡ Fetch mill input data for process information (no populate)
      ordersWithPopulated.length > 0 ? (async () => {
        try {
          const { MillInput } = await import('@/models/Mill');
          const orderIds = ordersWithPopulated.map(order => order._id);

          const millInputs = await MillInput.find({
            order: { $in: orderIds }
          })
            .select('order mill millDate chalanNo greighMtr pcs quality processName')
            .lean()
            .maxTimeMS(1000); // ⚡ Reduced to 1 second

          return millInputs;
        } catch (millError) {
          console.error('Mill input fetch error:', millError);
          return [];
        }
      })() : Promise.resolve([]),

      // ⚡ Fetch mill output data for button states
      ordersWithPopulated.length > 0 ? (async () => {
        try {
          const MillOutput = (await import('@/models/MillOutput')).default;
          const orderIds = ordersWithPopulated.map(order => order._id);

          const millOutputs = await MillOutput.find({
            order: { $in: orderIds }
          })
            .select('order recdDate millBillNo finishedMtr')
            .lean()
            .maxTimeMS(1000); // ⚡ Reduced to 1 second

          return millOutputs;
        } catch (millError) {
          console.error('Mill output fetch error:', millError);
          return [];
        }
      })() : Promise.resolve([]),

      // ⚡ Fetch dispatch data for button states
      ordersWithPopulated.length > 0 ? (async () => {
        try {
          const Dispatch = (await import('@/models/Dispatch')).default;
          const orderIds = ordersWithPopulated.map(order => order._id);

          const dispatches = await Dispatch.find({
            order: { $in: orderIds }
          })
            .select('order dispatchDate dispatchNo quantity')
            .lean()
            .maxTimeMS(1000); // ⚡ Reduced to 1 second

          return dispatches;
        } catch (dispatchError) {
          console.error('Dispatch fetch error:', dispatchError);
          return [];
        }
      })() : Promise.resolve([]),

      // ⚡ Fetch grey info data for button states (batch fetch - like lab, mill inputs/outputs, dispatch)
      ordersWithPopulated.length > 0 ? (async () => {
        try {
          const { GreyInfo } = await import('@/models');
          const orderIds = ordersWithPopulated.map(order => order._id);

          const greyInfo = await GreyInfo.find({
            order: { $in: orderIds }
          })
            .select('order orderId')
            .lean()
            .maxTimeMS(1000); // ⚡ Reduced to 1 second

          return greyInfo;
        } catch (greyInfoError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Grey info fetch error:', greyInfoError);
          }
          return [];
        }
      })() : Promise.resolve([]),

      // ⚡ Get total count in parallel with optimized query
      Order.countDocuments(query).maxTimeMS(1000) // ⚡ Reduced to 1 second
    ]);

    // Super smart fuzzy search function with relevance scoring
    const calculateRelevanceScore = (text: string, searchTerm: string): number => {
      if (!text || !searchTerm) return 0;

      const textLower = text.toLowerCase().trim();
      const searchLower = searchTerm.toLowerCase().trim();
      const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);

      // Exact match (highest score: 1000)
      if (textLower === searchLower) return 1000;

      // Starts with match (high score: 800)
      if (textLower.startsWith(searchLower)) return 800;

      // Ends with match (high score: 700)
      if (textLower.endsWith(searchLower)) return 700;

      // Contains exact phrase (high score: 600)
      if (textLower.includes(searchLower)) return 600;

      // Multi-word search: all words present
      if (searchWords.length > 1) {
        const allWordsPresent = searchWords.every(word => textLower.includes(word));
        if (allWordsPresent) {
          // Calculate word proximity bonus
          let proximityBonus = 0;
          for (let i = 0; i < searchWords.length - 1; i++) {
            const word1Index = textLower.indexOf(searchWords[i]);
            const word2Index = textLower.indexOf(searchWords[i + 1]);
            if (word1Index !== -1 && word2Index !== -1) {
              const distance = Math.abs(word2Index - word1Index - searchWords[i].length);
              proximityBonus += Math.max(0, 100 - distance); // Closer words = higher bonus
            }
          }
          return 500 + proximityBonus;
        }
      }

      // Word boundary match - check if search term matches word boundaries
      const words = textLower.split(/\s+/);
      let wordMatchScore = 0;
      for (const word of words) {
        if (word === searchLower) {
          wordMatchScore = Math.max(wordMatchScore, 400); // Exact word match
        } else if (word.startsWith(searchLower)) {
          wordMatchScore = Math.max(wordMatchScore, 350); // Word starts with search
        } else if (word.includes(searchLower)) {
          wordMatchScore = Math.max(wordMatchScore, 300); // Word contains search
        }
      }
      if (wordMatchScore > 0) return wordMatchScore;

      // Fuzzy match - check if all characters in search term exist in order
      let searchIndex = 0;
      let consecutiveMatches = 0;
      let maxConsecutive = 0;
      for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
        if (textLower[i] === searchLower[searchIndex]) {
          searchIndex++;
          consecutiveMatches++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
        } else {
          consecutiveMatches = 0;
        }
      }

      // If we found all characters in order, calculate fuzzy score
      if (searchIndex === searchLower.length) {
        const completeness = searchIndex / searchLower.length; // 1.0 if all found
        const consecutiveness = maxConsecutive / searchLower.length; // Higher if consecutive
        return Math.floor(200 + (completeness * 100) + (consecutiveness * 50));
      }

      // Partial character match (lowest score)
      const matchedChars = searchIndex;
      if (matchedChars > 0) {
        return Math.floor(50 + (matchedChars / searchLower.length) * 100);
      }

      return 0;
    };

    // Enhanced fuzzy match function (backward compatible)
    const fuzzyMatch = (text: string, searchTerm: string): boolean => {
      return calculateRelevanceScore(text, searchTerm) > 0;
    };

    // Post-process search results for party and quality names with enhanced fuzzy search
    let filteredOrders = ordersWithPopulated;
    if (search) {
      const searchPattern = search.trim();
      const [searchType, searchValue] = searchPattern.includes(':') ? searchPattern.split(':', 2) : ['all', searchPattern];
      const trimmedValue = searchValue.trim();

      // Check if this search type needs post-processing
      // Post-processing is needed for: party, quality, mill, weaver, and 'all' searches
      const needsPostProcessing = ['party', 'quality', 'mill', 'weaver', 'all'].includes(searchType.toLowerCase());

      if (needsPostProcessing) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔍 Post-processing needed for search type: ${searchType}`);
        }

        // Pre-fetch mill names for mill search optimization
        let millNameMap = new Map<string, string>();
        if (searchType.toLowerCase() === 'mill' || searchType.toLowerCase() === 'all') {
          try {
            const { Mill } = await import('@/models/Mill');
            const uniqueMillIds = [...new Set(millInputs.map((mi: any) => mi.mill?.toString()).filter(Boolean))];
            if (uniqueMillIds.length > 0) {
              const mills = await Mill.find({ _id: { $in: uniqueMillIds } })
                .select('_id name')
                .lean()
                .maxTimeMS(1000);
              mills.forEach((mill: any) => {
                millNameMap.set(mill._id.toString(), mill.name || '');
              });
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Error pre-fetching mills for search:', error);
            }
          }
        }

        // Calculate relevance scores for each order
        const ordersWithScores = ordersWithPopulated.map(order => {
          let maxScore = 0;
          let hasMatch = false;
          let initialQueryMatch = false;

          // Check if order matched the initial MongoDB query - search ALL fields
          const orderFields = [
            { value: order.orderId, weight: 10 }, // Order ID has highest weight
            { value: order.poNumber, weight: 8 },
            { value: order.styleNo, weight: 8 },
            { value: order.contactName, weight: 6 },
            { value: order.contactPhone, weight: 5 },
            { value: order.contactEmail, weight: 5 },
            { value: order.notes, weight: 3 },
            { value: order.shippingAddress, weight: 2 },
            { value: order.billingAddress, weight: 2 },
            { value: order.paymentMethod, weight: 2 }
          ];

          // Check items fields
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              if (item.description) orderFields.push({ value: item.description, weight: 4 });
              if (item.weaverSupplierName) orderFields.push({ value: item.weaverSupplierName, weight: 6 });
              if (item.notes) orderFields.push({ value: item.notes, weight: 3 });
            });
          }

          // Check metadata fields
          if (order.metadata) {
            if (order.metadata.tags && Array.isArray(order.metadata.tags)) {
              order.metadata.tags.forEach((tag: string) => {
                orderFields.push({ value: tag, weight: 3 });
              });
            }
            if (order.metadata.source) {
              orderFields.push({ value: order.metadata.source, weight: 2 });
            }
          }

          // Calculate weighted scores for all fields
          orderFields.forEach(field => {
            if (field.value) {
              const score = calculateRelevanceScore(field.value.toString(), trimmedValue);
              if (score > 0) {
                const weightedScore = score * field.weight;
                maxScore = Math.max(maxScore, weightedScore);
                initialQueryMatch = true;
              }
            }
          });

          // Check party name search with fuzzy matching (weight: 9)
          if (searchType.toLowerCase() === 'party' || searchType.toLowerCase() === 'all') {
            if (order.party && typeof order.party === 'object' && 'name' in order.party) {
              const partyName = (order.party as any).name;
              if (partyName) {
                const score = calculateRelevanceScore(partyName, trimmedValue);
                if (score > 0) {
                  maxScore = Math.max(maxScore, score * 9); // Party name has high weight
                  hasMatch = true;
                }
              }
            }
          }

          // Check quality name search with fuzzy matching (weight: 7)
          if (searchType.toLowerCase() === 'quality' || searchType.toLowerCase() === 'all') {
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items) {
                if (item.quality && typeof item.quality === 'object' && 'name' in item.quality) {
                  const qualityName = (item.quality as any).name;
                  if (qualityName) {
                    const score = calculateRelevanceScore(qualityName, trimmedValue);
                    if (score > 0) {
                      maxScore = Math.max(maxScore, score * 7); // Quality name has good weight
                      hasMatch = true;
                    }
                  }
                }
              }
            }
          }

          // Check mill name search - check if order has mill inputs from matching mills (weight: 7)
          if (searchType.toLowerCase() === 'mill' || searchType.toLowerCase() === 'all') {
            if (millInputs && millInputs.length > 0) {
              const orderIdStr = order._id?.toString();
              const orderIdDisplay = order.orderId;

              const orderMillInputs = millInputs.filter((mi: any) => {
                const miOrderId = mi.order?.toString();
                const miOrderIdDisplay = mi.orderId?.toString();
                return miOrderId === orderIdStr || miOrderIdDisplay === orderIdStr || miOrderIdDisplay === orderIdDisplay;
              });

              if (orderMillInputs.length > 0) {
                for (const mi of orderMillInputs) {
                  const millId = mi.mill?.toString();
                  if (millId) {
                    const millName = millNameMap.get(millId);
                    if (millName) {
                      const score = calculateRelevanceScore(millName, trimmedValue);
                      if (score > 0) {
                        maxScore = Math.max(maxScore, score * 7);
                        hasMatch = true;
                      }
                    }
                  }
                  if (mi.mill && typeof mi.mill === 'object' && 'name' in mi.mill) {
                    const millName = (mi.mill as any).name;
                    if (millName) {
                      const score = calculateRelevanceScore(millName, trimmedValue);
                      if (score > 0) {
                        maxScore = Math.max(maxScore, score * 7);
                        hasMatch = true;
                      }
                    }
                  }
                }
              }
            }
          }

          // Check weaver/supplier name search (weight: 6)
          if (searchType.toLowerCase() === 'weaver' || searchType.toLowerCase() === 'all') {
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items) {
                if (item.weaverSupplierName) {
                  const score = calculateRelevanceScore(item.weaverSupplierName, trimmedValue);
                  if (score > 0) {
                    maxScore = Math.max(maxScore, score * 6);
                    hasMatch = true;
                  }
                }
              }
            }
          }

          // For specific search types, only return if we found a match
          if (searchType.toLowerCase() === 'party' || searchType.toLowerCase() === 'quality' || searchType.toLowerCase() === 'mill' || searchType.toLowerCase() === 'weaver') {
            return { order, score: hasMatch ? maxScore : 0 };
          }

          // For general search ('all'), return score if we found a match OR if it matched the initial MongoDB query
          return { order, score: (hasMatch || initialQueryMatch) ? maxScore : 0 };
        });

        // Filter out orders with score 0 and sort by relevance score (highest first)
        filteredOrders = ordersWithScores
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score) // Sort by score descending
          .map(({ order }) => order);
      }
    }

    // Attach lab data and mill input process data to order items
    if (filteredOrders.length > 0) {
      // Create a map of orderItemId to lab data
      const labMap = new Map();
      if (labs.length > 0) {
        labs.forEach(lab => {
          labMap.set(lab.orderItemId.toString(), lab);
        });
      }

      // Create a map of order ObjectId to mill input data arrays
      const millInputMap = new Map();
      if (millInputs.length > 0) {
        millInputs.forEach(millInput => {
          const orderId = millInput.order.toString();
          if (!millInputMap.has(orderId)) {
            millInputMap.set(orderId, []);
          }
          millInputMap.get(orderId).push(millInput);
        });
      }

      // Create a map of order ObjectId to mill output data arrays
      const millOutputMap = new Map();
      if (millOutputs.length > 0) {
        millOutputs.forEach(millOutput => {
          const orderId = millOutput.order.toString();
          if (!millOutputMap.has(orderId)) {
            millOutputMap.set(orderId, []);
          }
          millOutputMap.get(orderId).push(millOutput);
        });
      }

      // Create a map of order ObjectId to dispatch data arrays
      const dispatchMap = new Map();
      if (dispatches.length > 0) {
        dispatches.forEach(dispatch => {
          const orderId = dispatch.order.toString();
          if (!dispatchMap.has(orderId)) {
            dispatchMap.set(orderId, []);
          }
          dispatchMap.get(orderId).push(dispatch);
        });
      }

      // ⚡ Create a map of order ObjectId to grey info data arrays (batch fetch - like others)
      const greyInfoMap = new Map();
      if (greyInfo.length > 0) {
        greyInfo.forEach(greyInfoItem => {
          const orderId = greyInfoItem.order?.toString() || greyInfoItem.orderId;
          if (orderId) {
            if (!greyInfoMap.has(orderId)) {
              greyInfoMap.set(orderId, []);
            }
            greyInfoMap.get(orderId).push(greyInfoItem);
          }
        });
      }

      // Attach lab data and process data to order items
      filteredOrders.forEach(order => {
        if (order.items) {
          order.items.forEach((item: any) => {
            // Attach lab data
            const labData = labMap.get(item._id.toString());
            if (labData && labData.labSendData) {
              item.labData = {
                color: labData.labSendData.color || '',
                shade: labData.labSendData.shade || '',
                notes: labData.labSendData.notes || '',
                labSendDate: labData.labSendDate,
                approvalDate: labData.labSendData.approvalDate,
                sampleNumber: labData.labSendData.sampleNumber || '',
                imageUrl: labData.labSendData.imageUrl || '',
                labSendNumber: labData.labSendNumber || '',
                status: labData.status || 'sent',
                remarks: labData.remarks || ''
              };
            } else {
              // Initialize empty lab data structure for items without lab data
              item.labData = {
                color: '',
                shade: '',
                notes: '',
                labSendDate: null,
                approvalDate: null,
                sampleNumber: '',
                imageUrl: '',
                labSendNumber: '',
                status: 'not_sent',
                remarks: ''
              };
            }

            // Attach quality-specific process data from mill inputs
            const millInputData = millInputMap.get(order._id.toString());
            if (millInputData) {
              const itemQualityId = item.quality?._id?.toString() || item.quality?.toString();
              const itemQualityName = item.quality?.name || item.quality;

              // Find process data for this specific quality
              let qualityProcessData = null;

              // Check main quality
              if (millInputData.quality?._id?.toString() === itemQualityId ||
                millInputData.quality?.name === itemQualityName) {
                qualityProcessData = {
                  mainProcess: millInputData.processName || '',
                  additionalProcesses: []
                };
              }

              // Check additional meters for this quality
              if (!qualityProcessData && millInputData.additionalMeters) {
                const matchingAdditional = millInputData.additionalMeters.find((additional: any) =>
                  additional.quality?._id?.toString() === itemQualityId ||
                  additional.quality?.name === itemQualityName
                );

                if (matchingAdditional) {
                  qualityProcessData = {
                    mainProcess: matchingAdditional.processName || '',
                    additionalProcesses: []
                  };
                }
              }

              // If no quality-specific data found, use the main process data as fallback
              if (!qualityProcessData) {
                qualityProcessData = {
                  mainProcess: millInputData.processName || '',
                  additionalProcesses: millInputData.additionalMeters?.map((additional: any) => additional.processName || '') || []
                };
              }

              item.processData = qualityProcessData;
            } else {
              // Initialize empty process data structure
              item.processData = {
                mainProcess: '',
                additionalProcesses: []
              };
            }
          });
        }

        // Add mill inputs, mill outputs, dispatches, and grey info to each order for button states
        (order as any).millInputs = millInputMap.get(order._id.toString()) || [];
        (order as any).millOutputs = millOutputMap.get(order._id.toString()) || [];
        (order as any).dispatches = dispatchMap.get(order._id.toString()) || [];
        (order as any).greyInformation = greyInfoMap.get(order._id.toString()) || [];
      });
    }

    // ⚡ Add ISR cache headers with tags
    const cacheHeaders = getCacheHeaders(CACHE_DURATIONS.ORDERS_LIST);
    // Set no-cache headers when force refresh OR timestamp provided (cache busting)
    const headers: HeadersInit = (force || timestamp)
      ? {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
      : {
        'Content-Type': 'application/json',
        ...(cacheHeaders as Record<string, string>),
        'X-Cache-Tags': CACHE_TAGS.ORDERS
      };

    // Cache the result for future requests
    // Note: For post-processed searches, the total count is from the database query
    // which represents all orders matching the MongoDB query. Post-processing refines
    // results with relevance scoring but doesn't significantly change the total count.
    const responseData = {
      success: true,
      data: filteredOrders,
      pagination: {
        page,
        limit,
        total: total, // Use database total count for accurate pagination
        pages: Math.ceil(total / limit)
      },
      searchInfo: search ? {
        query: search,
        resultsCount: filteredOrders.length, // Results on current page
        hasResults: filteredOrders.length > 0,
        totalMatches: total // Total matches from database query
      } : null
    };

    // Store in cache (skip if force refresh or timestamp provided for cache busting)
    if (!force && !timestamp) {
      queryCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });
    }

    // Clean up old cache entries (keep only last 100 entries)
    if (queryCache.size > 100) {
      const entries = Array.from(queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - 100);
      toDelete.forEach(([key]) => queryCache.delete(key));
    }

    return new Response(JSON.stringify(responseData), { headers });

  } catch (error) {
    console.error('Orders API Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Request timeout. Please try again with a simpler search.'
        }), { status: 408 });
      }

      if (error.message.includes('Database connection')) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Database connection failed. Please try again.'
        }), { status: 503 });
      }
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch orders. Please try again.'
    }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session first (security check)
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    // Extract and validate request body
    const {
      orderType,
      arrivalDate,
      party,
      contactName,
      contactPhone,
      poNumber,
      styleNo,
      poDate,
      deliveryDate,
      status,
      items
    } = await req.json();

    // Validation
    const errors: string[] = [];

    // Optional fields validation (only validate if provided)
    if (orderType && !['Dying', 'Printing'].includes(orderType)) {
      errors.push("Order type must be either 'Dying' or 'Printing' if provided");
    }

    if (arrivalDate) {
      const arrival = parseDateString(arrivalDate);
      if (!arrival) {
        errors.push("Invalid arrival date format");
      }
    }

    if (party && party !== '' && !party.match(/^[0-9a-fA-F]{24}$/)) {
      errors.push("Invalid party ID format");
    }

    if (contactName && contactName.trim().length > 50) {
      errors.push("Contact name cannot exceed 50 characters");
    }

    if (contactPhone && contactPhone.trim().length > 20) {
      errors.push("Contact phone cannot exceed 20 characters");
    }

    if (poNumber && poNumber.trim().length > 50) {
      errors.push("PO number cannot exceed 50 characters");
    }

    if (styleNo && styleNo.trim().length > 50) {
      errors.push("Style number cannot exceed 50 characters");
    }

    if (poDate) {
      const po = parseDateString(poDate);
      if (!po) {
        errors.push("Invalid PO date format");
      }
    }

    if (deliveryDate) {
      const delivery = parseDateString(deliveryDate);
      if (!delivery) {
        errors.push("Invalid delivery date format");
      }
    }

    // Validate status if provided - temporarily allow all valid statuses
    const validStatuses = ['Not set', 'Not selected', 'pending', 'in_progress', 'completed', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate items - quality is optional, quantity is required
    if (items && Array.isArray(items)) {
      items.forEach((item, index) => {
        // Quality is optional for each item
        if (item.quality && item.quality !== '' && !item.quality.match(/^[0-9a-fA-F]{24}$/)) {
          errors.push(`Invalid quality ID format in item ${index + 1}`);
        }

        // Quantity is required for each item
        if (item.quantity === undefined || item.quantity === null) {
          errors.push(`Quantity is required for item ${index + 1}`);
        } else if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          errors.push(`Quantity must be a positive number in item ${index + 1}`);
        }
        if (item.imageUrls && Array.isArray(item.imageUrls)) {
          item.imageUrls.forEach((url: string, urlIndex: number) => {
            if (url && url.trim().length > 500) {
              errors.push(`Image URL cannot exceed 500 characters in item ${index + 1}, image ${urlIndex + 1}`);
            }
          });
        }
        if (item.description && item.description.trim().length > 200) {
          errors.push(`Description cannot exceed 200 characters in item ${index + 1}`);
        }

        // Validate millRate if provided
        if (item.millRate !== undefined && item.millRate !== null && item.millRate !== '') {
          if (typeof item.millRate !== 'number' || item.millRate < 0) {
            errors.push(`Mill rate must be a non-negative number in item ${index + 1}`);
          }
        }

        // Validate salesRate if provided
        if (item.salesRate !== undefined && item.salesRate !== null && item.salesRate !== '') {
          if (typeof item.salesRate !== 'number' || item.salesRate < 0) {
            errors.push(`Sales rate must be a non-negative number in item ${index + 1}`);
          }
        }
      });
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ message: errors.join(", ") }),
        { status: 400 }
      );
    }

    // Improved database connection with retry logic
    let connectionAttempts = 0;
    const maxAttempts = 3;
    let dbConnection = null;

    while (connectionAttempts < maxAttempts) {
      try {
        dbConnection = await dbConnect();
        break;
      } catch (dbError) {
        connectionAttempts++;
        if (connectionAttempts >= maxAttempts) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Database connection failed after multiple attempts"
            }),
            { status: 503 }
          );
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
      }
    }

    // Use Promise.all to parallelize party and quality validation
    const validationPromises = [];

    // Add party validation promise if party is provided
    if (party && party !== '' && party !== 'null' && party !== 'undefined') {
      validationPromises.push(
        Party.findById(party).maxTimeMS(5000).then(partyExists => ({
          type: 'party',
          exists: !!partyExists,
          id: party
        }))
      );
    }

    // Add quality validation promises for all items
    if (items && items.length > 0) {
      const uniqueQualityIds = [...new Set(
        items
          .filter((item: any) => item.quality && item.quality !== '' && item.quality !== 'null' && item.quality !== 'undefined')
          .map((item: any) => item.quality)
      )];

      uniqueQualityIds.forEach(qualityId => {
        validationPromises.push(
          Quality.findById(qualityId).maxTimeMS(5000).then(qualityExists => ({
            type: 'quality',
            exists: !!qualityExists,
            id: qualityId
          }))
        );
      });
    }

    // Execute all validations in parallel
    if (validationPromises.length > 0) {
      const validationResults = await Promise.all(validationPromises);

      // Check validation results
      for (const result of validationResults) {
        if (!result.exists) {
          const message = result.type === 'party'
            ? "Party not found"
            : `Quality not found for item`;
          return new Response(
            JSON.stringify({ message }),
            { status: 400 }
          );
        }
      }
    }

    // Removed duplicate PO + Style combination check - allowing multiple orders with same PO/Style

    // Create order data object with optional fields
    const orderData: any = {
      contactName: contactName ? contactName.trim() : undefined,
      contactPhone: contactPhone ? contactPhone.trim() : undefined,
      poNumber: poNumber ? poNumber.trim() : undefined,
      styleNo: styleNo ? styleNo.trim() : undefined,
      poDate: poDate ? parseDateString(poDate) : undefined,
      deliveryDate: deliveryDate ? parseDateString(deliveryDate) : undefined,

      items: items && items.length > 0 ? items.map((item: any) => ({
        quality: item.quality && item.quality !== '' && item.quality !== 'null' && item.quality !== 'undefined' ? item.quality : undefined,
        quantity: item.quantity !== undefined && item.quantity !== null ? item.quantity : undefined,
        imageUrls: item.imageUrls && Array.isArray(item.imageUrls) ? item.imageUrls.map((url: string) => url.trim()) : [],
        description: item.description ? item.description.trim() : undefined,
        weaverSupplierName: item.weaverSupplierName ? item.weaverSupplierName.trim() : undefined,
        purchaseRate: item.purchaseRate !== undefined && item.purchaseRate !== null && item.purchaseRate !== '' ?
          (() => {
            const rate = parseFloat(item.purchaseRate);
            return isNaN(rate) ? undefined : rate;
          })() : undefined,
        millRate: item.millRate !== undefined && item.millRate !== null && item.millRate !== '' ?
          (() => {
            const rate = parseFloat(item.millRate);
            return isNaN(rate) ? undefined : rate;
          })() : undefined,
        salesRate: item.salesRate !== undefined && item.salesRate !== null && item.salesRate !== '' ?
          (() => {
            const rate = parseFloat(item.salesRate);
            return isNaN(rate) ? undefined : rate;
          })() : undefined,
      })) : [],
    };

    // Add optional fields only if they are provided
    if (orderType) {
      orderData.orderType = orderType;
    }
    if (arrivalDate) {
      orderData.arrivalDate = parseDateString(arrivalDate);
    }
    if (party && party !== '' && party !== 'null' && party !== 'undefined') {
      orderData.party = party;
    }
    if (status && status !== '' && status !== 'null' && status !== 'undefined') {
      orderData.status = status;
    } else {
      // Don't set status - let database default handle it
    }
    // Use the new sequential order creation method with timeout
    // Temporarily bypass schema validation for status
    const orderPromise = (Order as IOrderModel).createOrder(orderData);
    const order = await Promise.race([
      orderPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Order creation timeout')), 15000)
      )
    ]) as IOrder & { _id: string };

    // ⚡ ULTRA-FAST: Fetch order without populate (fetch related data separately)
    const fetchedOrder = await Order.findById(order._id)
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status labData createdAt updatedAt')
      .lean()
      .maxTimeMS(2000); // ⚡ Reduced to 2 seconds

    if (!fetchedOrder) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to retrieve created order"
        }),
        { status: 500 }
      );
    }

    // ⚡ Fetch parties and qualities separately (MUCH faster than populate)
    const partyId = fetchedOrder.party;
    const qualityIds = [...new Set(
      (fetchedOrder.items || []).map((item: any) => item.quality).filter(Boolean)
    )];

    const [parties, qualities] = await Promise.all([
      partyId ? Party.find({ _id: partyId })
        .select('_id name contactName contactPhone address')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([]),
      qualityIds.length > 0 ? Quality.find({ _id: { $in: qualityIds } })
        .select('_id name description')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

    const partyMap = new Map(parties.map((p: any) => [p._id.toString(), p]));
    const qualityMap = new Map(qualities.map((q: any) => [q._id.toString(), q]));

    // Helper to format date to YYYY-MM-DD string to avoid timezone issues
    const formatDateForResponse = (date: Date | string | null | undefined): string | null => {
      if (!date) return null;
      if (typeof date === 'string') {
        // If already a string, extract YYYY-MM-DD part
        const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
      }
      if (date instanceof Date) {
        // Extract date components from UTC to match how we store dates
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    // ⚡ Attach parties and qualities to order
    const populatedOrder = {
      ...fetchedOrder,
      arrivalDate: formatDateForResponse(fetchedOrder.arrivalDate),
      poDate: formatDateForResponse(fetchedOrder.poDate),
      deliveryDate: formatDateForResponse(fetchedOrder.deliveryDate),
      party: partyId ? partyMap.get(partyId.toString()) || partyId : null,
      items: (fetchedOrder.items || []).map((item: any) => ({
        ...item,
        quality: item.quality ? qualityMap.get(item.quality.toString()) || item.quality : null
      }))
    };

    // Log the order creation with complete details including items
    const itemChanges = populatedOrder.items.map((item: any, index: number) => {
      const details = [];

      // Add quality details
      if (item.quality) {
        details.push(`Quality: "${item.quality.name || item.quality}"`);
      }

      // Add quantity details
      if (item.quantity) {
        details.push(`Quantity: ${item.quantity}`);
      }

      // Add description details
      if (item.description) {
        details.push(`Description: "${item.description}"`);
      }

      // Add weaver details
      if (item.weaverSupplierName) {
        details.push(`Weaver: "${item.weaverSupplierName}"`);
      }

      // Add purchase rate details
      if (item.purchaseRate) {
        details.push(`Rate: ₹${Number(item.purchaseRate).toFixed(2)}`);
      }

      // Add image details
      if (item.imageUrls && item.imageUrls.length > 0) {
        details.push(`${item.imageUrls.length} image(s)`);
      }

      return {
        type: 'item_added',
        index,
        item: {
          quality: item.quality?.name || item.quality || 'Not set',
          quantity: item.quantity || 0,
          description: item.description || '',
          weaverSupplierName: item.weaverSupplierName || '',
          purchaseRate: item.purchaseRate || 0,
          imageUrls: item.imageUrls || [],
          imageCount: (item.imageUrls || []).length
        }
      };
    });

    // ⚡ CACHE REVALIDATION - Revalidate all order-related caches
    const orderId = (order as any)._id.toString();
    clearDashboardCache(); // Clear in-memory dashboard cache immediately
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.ORDER(orderId));
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidatePath('/orders');
    revalidatePath('/dashboard');

    // Log the order creation (async, non-blocking)
    logOrderChange('create', orderId, {}, {
      orderId: populatedOrder.orderId,
      orderType: populatedOrder.orderType,
      arrivalDate: populatedOrder.arrivalDate,
      party: populatedOrder.party,
      contactName: populatedOrder.contactName,
      contactPhone: populatedOrder.contactPhone,
      poNumber: populatedOrder.poNumber,
      styleNo: populatedOrder.styleNo,
      poDate: populatedOrder.poDate,
      deliveryDate: populatedOrder.deliveryDate,
      status: populatedOrder.status,
      itemChanges: itemChanges
    }).catch(error => console.error('Logging error (non-blocking):', error));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order created successfully",
        data: populatedOrder
      }),
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({
          success: false,
          message: "Unauthorized"
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (error.message.includes("Database connection failed")) {
        return new Response(JSON.stringify({
          success: false,
          message: "Database connection failed. Please try again."
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (error.message.includes("Order creation timeout")) {
        return new Response(JSON.stringify({
          success: false,
          message: "Order creation timeout. Please try again."
        }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Handle MongoDB duplicate key errors
      if (error.message.includes('E11000')) {
        if (error.message.includes('orderId')) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Order ID already exists. Please try again."
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
        return new Response(
          JSON.stringify({
            success: false,
            message: validationErrors.join(", ")
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({
      success: false,
      message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
