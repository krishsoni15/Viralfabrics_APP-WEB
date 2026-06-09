import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Party from "@/models/Party";
import Quality from "@/models/Quality";
import Lab from "@/models/Lab";
import mongoose from "mongoose";
import { requireAuth, getSession } from "@/lib/session";
import { type NextRequest } from "next/server";
import { logOrderChange, logView } from "@/lib/logger";
import { CACHE_TAGS, getCacheHeaders, CACHE_DURATIONS } from "@/lib/cacheConfig";
import { revalidateTag, revalidatePath } from 'next/cache';
import { clearDashboardCache } from '@/lib/dashboardCache';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check
    const { checkRateLimitOrError, apiRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    await requireAuth(req);
    const session = await getSession(req);

    await dbConnect();
    
    const { id } = await params;
    
    const query: any = { _id: id };
    if (session && session.partyId && session.role !== 'master' && session.role !== 'superadmin') {
      const mongoose = await import('mongoose');
      query.party = mongoose.default.Types.ObjectId.isValid(session.partyId)
        ? new mongoose.default.Types.ObjectId(session.partyId)
        : session.partyId;
    }
    
    // ⚡ OPTIMIZED: Use lean() and fetch related data separately (much faster than populate)
    const order = await Order.findOne(query)
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status labData createdAt updatedAt')
      .lean()
      .maxTimeMS(2000);

    if (!order) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Order not found" 
        }), 
        { status: 404 }
      );
    }

    // ⚡ OPTIMIZED: Fetch party and qualities separately (faster than populate)
    const partyId = (order as any).party;
    const qualityIds = [...new Set((order as any).items?.flatMap((item: any) => 
      item.quality ? [item.quality] : []
    ) || [])];

    const [party, qualities] = await Promise.all([
      partyId ? Party.findById(partyId)
        .select('_id name contactName contactPhone address')
        .lean()
        .maxTimeMS(1000) : Promise.resolve(null),
      qualityIds.length > 0 ? Quality.find({ _id: { $in: qualityIds } })
        .select('_id name description')
        .lean()
        .maxTimeMS(1000) : Promise.resolve([])
    ]);

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
    
    // Attach party and qualities to order, and format dates
    (order as any).party = party;
    (order as any).arrivalDate = formatDateForResponse((order as any).arrivalDate);
    (order as any).poDate = formatDateForResponse((order as any).poDate);
    (order as any).deliveryDate = formatDateForResponse((order as any).deliveryDate);
    (order as any).items = (order as any).items?.map((item: any) => ({
      ...item,
      quality: item.quality ? qualityMap.get(item.quality.toString()) || null : null
    })) || [];

    // Fetch lab data and mill input process data for this order and attach to items
    if (order.items && order.items.length > 0) {
      try {
        const [Lab, { MillInput }, { MillOutput }, DispatchModule] = await Promise.all([
          import('@/models/Lab'),
          import('@/models/Mill'),
          import('@/models/MillOutput'),
          import('@/models/Dispatch')
        ]);
        
        const Dispatch = DispatchModule.default;
        
      const itemIds = order.items.map((item: any) => item._id);
      
        let [labs, millInputs, millOutputs, dispatches] = await Promise.all([
          Lab.default.find({ 
        order: id,
        orderItemId: { $in: itemIds },
        softDeleted: { $ne: true }
        })
        .select('orderItemId labSendDate labSendData labSendNumber status remarks')
        .lean()
          .maxTimeMS(3000),
          
          MillInput.find({ 
            order: id
          })
          .select('mill millDate chalanNo greighMtr pcs quality processName additionalMeters')
          .lean()
          .maxTimeMS(3000),
          
          MillOutput.find({ 
            order: id
          })
          .select('recdDate millBillNo finishedMtr millRate quality')
          .lean()
          .maxTimeMS(3000),
          
          Dispatch.find({ 
            order: id
          })
          .select('dispatchDate billNo transportNo lrNo finishMtr saleRate totalValue quality')
          .lean()
          .maxTimeMS(3000)
        ]);
      
      // ⚡ OPTIMIZED: Fetch mills and qualities for mill inputs/outputs separately
      const millIds = [...new Set(millInputs.flatMap((mi: any) => mi.mill ? [mi.mill] : []))];
      const allQualityIds = [
        ...new Set(millInputs.flatMap((mi: any) => [
          ...(mi.quality ? [mi.quality] : []),
          ...(mi.additionalMeters?.flatMap((am: any) => am.quality ? [am.quality] : []) || [])
        ])),
        ...new Set(millOutputs.flatMap((mo: any) => mo.quality ? [mo.quality] : [])),
        ...new Set(dispatches.flatMap((d: any) => d.quality ? [d.quality] : []))
      ];

      const [mills, allQualities] = await Promise.all([
        millIds.length > 0 ? (await import('@/models/Mill')).Mill.find({ _id: { $in: millIds } })
          .select('_id name')
          .lean()
          .maxTimeMS(1000) : Promise.resolve([]),
        allQualityIds.length > 0 ? Quality.find({ _id: { $in: allQualityIds } })
          .select('_id name')
          .lean()
          .maxTimeMS(1000) : Promise.resolve([])
      ]);

      const millMap = new Map(mills.map((m: any) => [m._id.toString(), m]));
      const allQualityMap = new Map(allQualities.map((q: any) => [q._id.toString(), q]));

      // Populate mill and quality references in mill inputs/outputs/dispatches
      millInputs = millInputs.map((mi: any) => ({
        ...mi,
        mill: mi.mill ? millMap.get(mi.mill.toString()) || null : null,
        quality: mi.quality ? allQualityMap.get(mi.quality.toString()) || null : null,
        additionalMeters: mi.additionalMeters?.map((am: any) => ({
          ...am,
          quality: am.quality ? allQualityMap.get(am.quality.toString()) || null : null
        })) || []
      }));

      millOutputs = millOutputs.map((mo: any) => ({
        ...mo,
        quality: mo.quality ? allQualityMap.get(mo.quality.toString()) || null : null
      }));

      dispatches = dispatches.map((d: any) => ({
        ...d,
        quality: d.quality ? allQualityMap.get(d.quality.toString()) || null : null
      }));
      
      // Create a map of orderItemId to lab data
      const labMap = new Map();
      labs.forEach((lab: any) => {
        labMap.set(lab.orderItemId.toString(), lab);
      });
      
        // Attach lab data and process data to order items
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
          if (millInputs.length > 0) {
            const itemQualityId = item.quality?._id?.toString() || item.quality?.toString();
            const itemQualityName = item.quality?.name || item.quality;
            
            // Find process data for this specific quality
            let qualityProcessData = null;
            
            // Collect all processes for this quality from all mill inputs
            const allProcesses: string[] = [];
            
            for (const millInputData of millInputs) {
              // Check main quality
              if (millInputData.quality?._id?.toString() === itemQualityId || 
                  millInputData.quality?.name === itemQualityName) {
                if (millInputData.processName && millInputData.processName.trim() !== '') {
                  allProcesses.push(millInputData.processName.trim());
                }
              }
              
              // Check additional meters for this quality
              if (millInputData.additionalMeters) {
                millInputData.additionalMeters.forEach((additional: any) => {
                  if ((additional.quality?._id?.toString() === itemQualityId || 
                       additional.quality?.name === itemQualityName) &&
                      additional.processName && additional.processName.trim() !== '') {
                    allProcesses.push(additional.processName.trim());
                  }
                });
              }
            }
            
            // Remove duplicates and sort by priority
            const uniqueProcesses = [...new Set(allProcesses)];
            
            // Define process priority order (higher number = higher priority)
            const processPriority = [
              'Lot No Greigh',    // 1
              'Charkha',          // 2
              'Drum',             // 3
              'Soflina WR',       // 4
              'long jet',         // 5
              'setting',          // 6
              'In Dyeing',        // 7
              'jigar',            // 8
              'in printing',      // 9
              'loop',             // 10
              'washing',          // 11
              'Finish',           // 12
              'folding',          // 13
              'ready to dispatch', // 14
              'In House'          // 15 - Highest priority, shows first
            ];
            
            // Sort by priority (highest number first)
            const sortedProcesses = uniqueProcesses.sort((a, b) => {
              const aIndex = processPriority.indexOf(a);
              const bIndex = processPriority.indexOf(b);
              if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return bIndex - aIndex; // Higher index = higher priority
            });
            
            if (sortedProcesses.length > 0) {
              qualityProcessData = {
                mainProcess: sortedProcesses[0], // Highest priority process
                additionalProcesses: sortedProcesses.slice(1) // Rest of the processes
              };
            }
            
            // If no quality-specific data found, collect all processes from all mill inputs as fallback
            if (!qualityProcessData && millInputs.length > 0) {
              const fallbackProcesses: string[] = [];
              
              millInputs.forEach((millInput: any) => {
                if (millInput.processName && millInput.processName.trim() !== '') {
                  fallbackProcesses.push(millInput.processName.trim());
                }
                if (millInput.additionalMeters) {
                  millInput.additionalMeters.forEach((additional: any) => {
                    if (additional.processName && additional.processName.trim() !== '') {
                      fallbackProcesses.push(additional.processName.trim());
                    }
                  });
                }
              });
              
              const uniqueFallbackProcesses = [...new Set(fallbackProcesses)];
              
              // Define process priority order (higher number = higher priority)
              const processPriority = [
                'Lot No Greigh',    // 1
                'Charkha',          // 2
                'Drum',             // 3
                'Soflina WR',       // 4
                'long jet',         // 5
                'setting',          // 6
                'In Dyeing',        // 7
                'jigar',            // 8
                'in printing',      // 9
                'loop',             // 10
                'washing',          // 11
                'Finish',           // 12
                'folding',          // 13
                'ready to dispatch' // 14
              ];
              
              // Sort by priority (highest number first)
              const sortedFallbackProcesses = uniqueFallbackProcesses.sort((a, b) => {
                const aIndex = processPriority.indexOf(a);
                const bIndex = processPriority.indexOf(b);
                if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return bIndex - aIndex; // Higher index = higher priority
              });
              
              if (sortedFallbackProcesses.length > 0) {
                qualityProcessData = {
                  mainProcess: sortedFallbackProcesses[0],
                  additionalProcesses: sortedFallbackProcesses.slice(1)
                };
              }
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
        
        // Add mill inputs, mill outputs, and dispatches to the order object for PDF generation
        (order as any).millInputs = millInputs;
        (order as any).millOutputs = millOutputs;
        (order as any).dispatches = dispatches;
        
      } catch (error) {
        // Initialize empty lab data and process data for all items if there's an error
        order.items.forEach((item: any) => {
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
          item.processData = {
            mainProcess: '',
            additionalProcesses: []
          };
        });
        
        // Initialize empty mill inputs, mill outputs, and dispatches arrays
        (order as any).millInputs = [];
        (order as any).millOutputs = [];
        (order as any).dispatches = [];
      }
    } else {
      // Initialize empty mill inputs, mill outputs, and dispatches arrays if no items
      (order as any).millInputs = [];
      (order as any).millOutputs = [];
      (order as any).dispatches = [];
    }

    // Log the order view
    logView('order', id, req);

    // ⚡ Add ISR cache headers with specific order tag
    return new Response(JSON.stringify({ 
      success: true, 
      data: order 
    }), { 
      status: 200,
      headers: {
        ...getCacheHeaders(CACHE_DURATIONS.ORDER_DETAILS),
        'X-Cache-Tags': `${CACHE_TAGS.ORDERS},${CACHE_TAGS.ORDER(id)}`
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Unauthorized" 
        }), { status: 401 });
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const { checkRateLimitOrError, writeRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await requireAuth(req);
    if (session.role === 'party') {
      return new Response(
        JSON.stringify({ success: false, message: "Access denied - Party users cannot modify orders" }),
        { status: 403 }
      );
    }

    const requestData = await req.json();
    
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
      items,
      status
    } = requestData;

    // Validation
    const errors: string[] = [];
    
    if (orderType !== undefined && !['Dying', 'Printing'].includes(orderType)) {
      errors.push("Order type must be either 'Dying' or 'Printing'");
    }
    
    if (arrivalDate !== undefined) {
      const arrival = parseDateString(arrivalDate);
      if (arrivalDate && !arrival) {
        errors.push("Invalid arrival date format");
      }
    }
    
    if (party !== undefined && party !== null && party !== '' && party !== 'null' && party !== 'undefined') {
      if (!party.match(/^[0-9a-fA-F]{24}$/)) {
        errors.push("Invalid party ID format");
      }
    }
    
    if (contactName !== undefined && contactName && contactName.trim().length > 50) {
      errors.push("Contact name cannot exceed 50 characters");
    }
    
    if (contactPhone !== undefined && contactPhone && contactPhone.trim().length > 20) {
      errors.push("Contact phone cannot exceed 20 characters");
    }
    
    if (poNumber !== undefined && poNumber && poNumber.trim().length > 50) {
      errors.push("PO number cannot exceed 50 characters");
    }
    
    if (styleNo !== undefined && styleNo && styleNo.trim().length > 50) {
      errors.push("Style number cannot exceed 50 characters");
    }
    
    if (poDate !== undefined && poDate) {
      const po = parseDateString(poDate);
      if (!po) {
        errors.push("Invalid PO date format");
      }
    }
    
    if (deliveryDate !== undefined && deliveryDate) {
      const delivery = parseDateString(deliveryDate);
      if (!delivery) {
        errors.push("Invalid delivery date format");
      }
    }
    
    if (status !== undefined && !['pending', 'delivered'].includes(status)) {
      errors.push("Status must be one of: pending, delivered");
    }
    
    // Validate items if provided
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        errors.push("At least one order item is required");
      } else {
        items.forEach((item, index) => {
          // Quality is optional for each item
          if (item.quality && item.quality !== null && item.quality !== '' && item.quality !== 'null' && item.quality !== 'undefined' && !item.quality.match(/^[0-9a-fA-F]{24}$/)) {
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
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ message: errors.join(", ") }), 
        { status: 400 }
      );
    }

    await dbConnect();

    // ⚡ OPTIMIZED: Check if order exists using lean() for speed
    const { id } = await params;
    const existingOrder = await Order.findById(id)
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status')
      .lean()
      .maxTimeMS(2000);
    if (!existingOrder) {
      return new Response(
        JSON.stringify({ message: "Order not found" }), 
        { status: 404 }
      );
    }

    // ⚡ OPTIMIZED: Verify party and qualities in parallel (non-blocking for logging)
    let newPartyName = null;
    const validationPromises: Promise<any>[] = [];
    
    if (party && party !== '' && party !== 'null' && party !== 'undefined') {
      validationPromises.push(
        Party.findById(party).select('name').lean().maxTimeMS(1000)
          .then((partyDoc: any) => {
            if (!partyDoc) {
              throw new Error("Party not found");
            }
            newPartyName = partyDoc.name;
            return partyDoc;
          })
      );
    }

    // ⚡ OPTIMIZED: Verify all qualities in parallel instead of sequential loop
    if (items && Array.isArray(items) && items.length > 0) {
      const Quality = (await import('@/models/Quality')).default;
      const qualityIds = items
        .map(item => item?.quality)
        .filter(q => q && typeof q === 'string' && q.trim() && q !== 'null' && q !== 'undefined');
      
      if (qualityIds.length > 0) {
        validationPromises.push(
          Quality.find({ _id: { $in: qualityIds } }).select('_id').lean().maxTimeMS(1000)
            .then(qualities => {
              if (qualities.length !== qualityIds.length) {
                throw new Error("One or more qualities not found");
              }
              return qualities;
            })
        );
      }
    }

    // Wait for all validations in parallel
    try {
      await Promise.all(validationPromises);
    } catch (validationError: any) {
      return new Response(
        JSON.stringify({ message: validationError.message || "Validation failed" }), 
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (orderType !== undefined) updateData.orderType = orderType;
    if (arrivalDate !== undefined) updateData.arrivalDate = arrivalDate ? parseDateString(arrivalDate) : undefined;
    if (party !== undefined) {
      if (party && party !== '' && party !== 'null' && party !== 'undefined') {
        updateData.party = party;
      } else {
        updateData.party = null;
      }
    }
    if (contactName !== undefined) updateData.contactName = contactName !== null ? contactName.trim() : '';
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone !== null ? contactPhone.trim() : '';
    if (poNumber !== undefined) updateData.poNumber = poNumber !== null ? poNumber.trim() : '';
    if (styleNo !== undefined) updateData.styleNo = styleNo !== null ? styleNo.trim() : '';
    if (poDate !== undefined) updateData.poDate = poDate ? parseDateString(poDate) : undefined;
    if (deliveryDate !== undefined) updateData.deliveryDate = deliveryDate ? parseDateString(deliveryDate) : undefined;
    if (status !== undefined) updateData.status = status;
    if (items !== undefined) {
      // ⚡ CRITICAL FIX: Preserve item _id when updating to maintain lab data associations
      // If _id is provided, use it; otherwise MongoDB will generate a new one
      const mongoose = (await import('mongoose')).default;
      updateData.items = items.map((item: any) => {
        const itemData: any = {
          quality: item.quality && item.quality !== '' && item.quality !== 'null' && item.quality !== 'undefined' ? item.quality : null,
          quantity: item.quantity !== undefined && item.quantity !== null ? item.quantity : undefined,
          imageUrls: item.imageUrls && Array.isArray(item.imageUrls) ? item.imageUrls.map((url: string) => url.trim()) : [],
          description: item.description !== null ? item.description.trim() : '',
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
        };
        
        // ⚡ CRITICAL: Preserve _id if it exists (for existing items) to maintain lab data associations
        // This ensures that when items are updated, their IDs don't change and lab data remains linked
        // Convert string _id to ObjectId if needed for proper MongoDB matching
        if (item._id) {
          try {
            // If _id is already an ObjectId, use it directly; otherwise convert from string
            if (mongoose.Types.ObjectId.isValid(item._id)) {
              itemData._id = typeof item._id === 'string' 
                ? new mongoose.Types.ObjectId(item._id) 
                : item._id;
            } else {
              // If not a valid ObjectId format, use as-is (might be a different ID format)
              itemData._id = item._id;
            }
          } catch (error) {
            // If conversion fails, use the _id as-is (MongoDB might still handle it)
            if (process.env.NODE_ENV === 'development') {
              console.warn('Warning: Could not convert item _id to ObjectId:', item._id, error);
            }
            itemData._id = item._id;
          }
        }
        
        return itemData;
      });
    }

    // Capture old values for logging
    const oldValues: any = {};
    const newValues: any = {};
    const changedFields: string[] = [];
    
    if (orderType !== undefined && orderType !== existingOrder.orderType) {
      oldValues.orderType = existingOrder.orderType;
      newValues.orderType = orderType;
      changedFields.push('orderType');
    }
    if (arrivalDate !== undefined) {
      const newArrivalDate = arrivalDate ? parseDateString(arrivalDate) : undefined;
      const existingArrivalDate = existingOrder.arrivalDate ? (existingOrder.arrivalDate instanceof Date ? existingOrder.arrivalDate : parseDateString(String(existingOrder.arrivalDate))) : undefined;
      
      const normalizeDate = (date: Date | undefined) => {
        if (!date) return null;
        // Extract date components in local timezone to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const existingDateStr = normalizeDate(existingArrivalDate);
      const newDateStr = normalizeDate(newArrivalDate);
      
      const arrivalDateChanged = existingDateStr !== newDateStr;
      
      if (arrivalDateChanged) {
        oldValues.arrivalDate = existingOrder.arrivalDate;
        newValues.arrivalDate = newArrivalDate;
        changedFields.push('arrivalDate');
      }
    }
    if (party !== undefined) {
      const currentPartyId = existingOrder.party?.toString() || null;
      const newPartyId = party && party !== '' && party !== 'null' && party !== 'undefined' ? party : null;
      
      if (currentPartyId !== newPartyId) {
        // Handle both populated and unpopulated party objects
        const oldPartyName = typeof existingOrder.party === 'object' && existingOrder.party !== null && 'name' in existingOrder.party 
          ? (existingOrder.party as any).name 
          : existingOrder.party || 'Not set';
        oldValues.party = oldPartyName;
        newValues.party = newPartyName || newPartyId || 'Not set';
        changedFields.push('party');
      }
    }
    if (contactName !== undefined) {
      const newContactName = contactName !== null && contactName !== '' ? contactName.trim() : '';
      if (existingOrder.contactName !== newContactName) {
        oldValues.contactName = existingOrder.contactName;
        newValues.contactName = newContactName;
        changedFields.push('contactName');
      }
    }
    if (contactPhone !== undefined) {
      const newContactPhone = contactPhone !== null && contactPhone !== '' ? contactPhone.trim() : '';
      if (existingOrder.contactPhone !== newContactPhone) {
        oldValues.contactPhone = existingOrder.contactPhone;
        newValues.contactPhone = newContactPhone;
        changedFields.push('contactPhone');
      }
    }
    if (poNumber !== undefined) {
      const newPoNumber = poNumber !== null && poNumber !== '' ? poNumber.trim() : '';
      if (existingOrder.poNumber !== newPoNumber) {
        oldValues.poNumber = existingOrder.poNumber;
        newValues.poNumber = newPoNumber;
        changedFields.push('poNumber');
      }
    }
    if (styleNo !== undefined) {
      const newStyleNo = styleNo !== null && styleNo !== '' ? styleNo.trim() : '';
      if (existingOrder.styleNo !== newStyleNo) {
        oldValues.styleNo = existingOrder.styleNo;
        newValues.styleNo = newStyleNo;
        changedFields.push('styleNo');
      }
    }
    if (poDate !== undefined) {
      const newPoDate = poDate ? parseDateString(poDate) : undefined;
      const existingPoDate = existingOrder.poDate ? (existingOrder.poDate instanceof Date ? existingOrder.poDate : parseDateString(String(existingOrder.poDate))) : undefined;
      
      const normalizeDate = (date: Date | undefined) => {
        if (!date) return null;
        // Extract date components in local timezone to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const existingDateStr = normalizeDate(existingPoDate);
      const newDateStr = normalizeDate(newPoDate);
      
      const poDateChanged = existingDateStr !== newDateStr;
      
      if (poDateChanged) {
        oldValues.poDate = existingOrder.poDate;
        newValues.poDate = newPoDate;
        changedFields.push('poDate');
      }
    }
    if (deliveryDate !== undefined) {
      const newDeliveryDate = deliveryDate ? parseDateString(deliveryDate) : undefined;
      const existingDeliveryDate = existingOrder.deliveryDate ? (existingOrder.deliveryDate instanceof Date ? existingOrder.deliveryDate : parseDateString(String(existingOrder.deliveryDate))) : undefined;
      
      const normalizeDate = (date: Date | undefined) => {
        if (!date) return null;
        // Extract date components in local timezone to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const existingDateStr = normalizeDate(existingDeliveryDate);
      const newDateStr = normalizeDate(newDeliveryDate);
      
      const deliveryDateChanged = existingDateStr !== newDateStr;
      
      if (deliveryDateChanged) {
        oldValues.deliveryDate = existingOrder.deliveryDate;
        newValues.deliveryDate = newDeliveryDate;
        changedFields.push('deliveryDate');
      }
    }
    if (status !== undefined && status !== existingOrder.status) {
      oldValues.status = existingOrder.status;
      newValues.status = status;
      changedFields.push('status');
    }
    if (items !== undefined) {
      const oldItems = existingOrder.items.map((item: any) => ({
        quality: item.quality, // Keep the original quality structure for proper comparison
        quantity: item.quantity,
        imageUrls: item.imageUrls || [],
        description: item.description || '',
        weaverSupplierName: item.weaverSupplierName || '',
        purchaseRate: item.purchaseRate || 0
      }));
      
      const newItems = items.map((item: any) => ({
        quality: item.quality && item.quality !== '' && item.quality !== 'null' && item.quality !== 'undefined' ? item.quality : 'Not set',
        quantity: item.quantity !== undefined && item.quantity !== null ? item.quantity : 0,
        imageUrls: item.imageUrls && Array.isArray(item.imageUrls) ? item.imageUrls.map((url: string) => url.trim()) : [],
        description: item.description !== null ? item.description.trim() : '',
        weaverSupplierName: item.weaverSupplierName ? item.weaverSupplierName.trim() : '',
        purchaseRate: item.purchaseRate !== undefined && item.purchaseRate !== null && item.purchaseRate !== '' ? 
          (() => {
            const rate = parseFloat(item.purchaseRate);
            return isNaN(rate) ? 0 : rate;
          })() : 0,
      }));
      
      const itemChanges: any[] = [];
      
      // Process all existing items for changes
      for (let index = 0; index < oldItems.length; index++) {
        const oldItem = oldItems[index];
        const newItem = newItems[index];
        if (!newItem) {
          itemChanges.push({ type: 'item_removed', index });
          continue;
        }
        
        const changes: any = {};
        let hasItemChanges = false;
        
        // Compare quality values properly with debugging
        const oldQualityValue = oldItem.quality;
        const newQualityValue = newItem.quality;
        
        // Check if quality actually changed
        let qualityChanged = false;
        let oldQualityName = 'Not set';
        let newQualityName = 'Not set';
        
        // Extract old quality name
        if (oldQualityValue) {
          if (typeof oldQualityValue === 'object' && oldQualityValue.name) {
            oldQualityName = oldQualityValue.name;
          } else if (typeof oldQualityValue === 'string') {
            oldQualityName = oldQualityValue;
          }
        }
        
        // Extract new quality name
        if (newQualityValue) {
          if (typeof newQualityValue === 'string' && newQualityValue.match(/^[0-9a-fA-F]{24}$/)) {
            // It's an ID, fetch the name
            try {
              const Quality = (await import('@/models/Quality')).default;
              const qualityDoc = await Quality.findById(newQualityValue).select('name');
              if (qualityDoc) {
                newQualityName = qualityDoc.name;
              } else {
                newQualityName = 'Unknown Quality';
              }
            } catch (error) {
              newQualityName = 'Unknown Quality';
            }
          } else if (typeof newQualityValue === 'string') {
            newQualityName = newQualityValue;
          }
        }
        
        // Compare the actual values
        const oldQualityId = oldQualityValue?._id?.toString() || oldQualityValue?.toString() || null;
        const newQualityId = newQualityValue?.toString() || null;
        
        qualityChanged = oldQualityId !== newQualityId;
        
        if (qualityChanged) {
          changes.quality = { old: oldQualityName, new: newQualityName };
          hasItemChanges = true;
        }
        
        // Compare quantity
        if (oldItem.quantity !== newItem.quantity) {
          changes.quantity = { old: oldItem.quantity, new: newItem.quantity };
          hasItemChanges = true;
        }
        
                 // Compare description
         const oldDesc = oldItem.description || '';
         const newDesc = newItem.description || '';
         if (oldDesc !== newDesc) {
           changes.description = { old: oldDesc, new: newDesc };
          hasItemChanges = true;
        }
        
                 // Compare weaver supplier name
         const oldWeaver = oldItem.weaverSupplierName || '';
         const newWeaver = newItem.weaverSupplierName || '';
         if (oldWeaver !== newWeaver) {
           changes.weaverSupplierName = { old: oldWeaver, new: newWeaver };
          hasItemChanges = true;
        }
        
                 // Compare purchase rate
         const oldRate = oldItem.purchaseRate || 0;
         const newRate = newItem.purchaseRate || 0;
         if (oldRate !== newRate) {
           changes.purchaseRate = { old: oldRate, new: newRate };
          hasItemChanges = true;
        }
        
        const oldImageUrls = oldItem.imageUrls || [];
        const newImageUrls = newItem.imageUrls || [];
        if (JSON.stringify(oldImageUrls) !== JSON.stringify(newImageUrls)) {
          const addedImages = newImageUrls.filter((url: string) => !oldImageUrls.includes(url));
          const removedImages = oldImageUrls.filter((url: string) => !newImageUrls.includes(url));
          
          changes.imageUrls = { 
            old: oldImageUrls, 
            new: newImageUrls,
            added: addedImages,
            removed: removedImages,
            addedCount: addedImages.length,
            removedCount: removedImages.length
          };
          hasItemChanges = true;
        }
        
        if (hasItemChanges) {
          itemChanges.push({ type: 'item_updated', index, changes });
        }
        }
      
      if (newItems.length > oldItems.length) {
        for (let i = oldItems.length; i < newItems.length; i++) {
          const newItem = newItems[i];
          
          // Fetch quality name for added items to show in logs
          let qualityName = newItem.quality;
          if (newItem.quality && newItem.quality !== 'Not set' && typeof newItem.quality === 'string') {
            try {
              const Quality = (await import('@/models/Quality')).default;
              const qualityDoc = await Quality.findById(newItem.quality).select('name');
              if (qualityDoc) {
                qualityName = qualityDoc.name;
              }
            } catch (error) {
              qualityName = newItem.quality; // Fallback to ID if fetch fails
            }
          }
          
          const itemDetail = {
            type: 'item_added',
            index: i,
            item: {
              quality: qualityName,
              quantity: newItem.quantity,
              description: newItem.description || '',
              weaverSupplierName: newItem.weaverSupplierName || '',
              purchaseRate: newItem.purchaseRate || 0,
              imageUrls: newItem.imageUrls || [],
              imageCount: (newItem.imageUrls || []).length
            }
          };
          itemChanges.push(itemDetail);
        }
      }
      
      if (itemChanges.length > 0) {
         // Store the itemChanges in both oldValues and newValues for the logger
         oldValues.itemChanges = itemChanges;
         newValues.itemChanges = itemChanges;
         changedFields.push('items');
      }
    }

    // ⚡ OPTIMIZED: Update the order and return immediately
    let updatedOrder;
    try {
      updatedOrder = await Order.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
      .select('_id orderId orderType arrivalDate party contactName contactPhone poNumber styleNo poDate deliveryDate items status createdAt updatedAt')
      .lean()
      .maxTimeMS(3000);
    } catch (updateError) {
      throw updateError;
    }

    if (!updatedOrder) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to update order" 
        }), 
        { status: 500 }
      );
    }

    // ⚡ FIX: Populate party and qualities like POST endpoint does
    // Party and Quality are already imported at the top of the file
    const partyId = updatedOrder.party;
    const qualityIds = [...new Set(
      (updatedOrder.items || []).map((item: any) => item.quality).filter(Boolean)
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

    // ⚡ FIX: Fetch and attach lab data to items (like GET endpoint does)
    const orderObjectId = new mongoose.Types.ObjectId(id);
    const labs = await Lab.find({ 
      order: orderObjectId,
      softDeleted: false 
    })
      .select('orderItemId labSendDate labSendNumber labSendData status remarks')
      .lean()
      .maxTimeMS(2000);
    
    // Create a map of orderItemId to lab data
    const labMap = new Map();
    labs.forEach((lab: any) => {
      labMap.set(lab.orderItemId.toString(), lab);
    });
    
    // ⚡ CRITICAL FIX: Attach parties and qualities to order, and attach lab data to items
    // Ensure lab data is properly matched by orderItemId even if item IDs changed
    const populatedOrder = {
      ...updatedOrder,
      arrivalDate: formatDateForResponse(updatedOrder.arrivalDate),
      poDate: formatDateForResponse(updatedOrder.poDate),
      deliveryDate: formatDateForResponse(updatedOrder.deliveryDate),
      party: partyId ? partyMap.get(partyId.toString()) || partyId : null,
      items: (updatedOrder.items || []).map((item: any) => {
        // ⚡ CRITICAL: Match lab data by orderItemId (item._id)
        // This ensures lab data is attached even if items were reordered or updated
        const itemId = item._id?.toString();
        const labData = itemId ? labMap.get(itemId) : null;
        
        const itemWithLabData = {
          ...item,
          quality: item.quality ? qualityMap.get(item.quality.toString()) || item.quality : null
        };
        
        // ⚡ CRITICAL: Only attach lab data if it actually exists and has data
        if (labData && labData.labSendData) {
          (itemWithLabData as any).labData = {
            color: labData.labSendData.color || '',
            shade: labData.labSendData.shade || '',
            notes: labData.labSendData.notes || '',
            labSendDate: labData.labSendDate || null,
            approvalDate: labData.labSendData.approvalDate || null,
            sampleNumber: labData.labSendData.sampleNumber || '',
            imageUrl: labData.labSendData.imageUrl || '',
            labSendNumber: labData.labSendNumber || '',
            status: labData.status || 'sent',
            remarks: labData.remarks || ''
          };
        } else if (labData && labData.labSendDate) {
          // Lab data exists but labSendData might be missing - still attach what we have
          (itemWithLabData as any).labData = {
            color: '',
            shade: '',
            notes: '',
            labSendDate: labData.labSendDate || null,
            approvalDate: null,
            sampleNumber: '',
            imageUrl: '',
            labSendNumber: labData.labSendNumber || '',
            status: labData.status || 'sent',
            remarks: labData.remarks || ''
          };
        } else {
          // No lab data found for this item - don't attach empty structure
          // Let frontend handle it
          (itemWithLabData as any).labData = undefined;
        }
        
        return itemWithLabData;
      })
    };

    // ⚡ CACHE REVALIDATION - Revalidate all order-related caches
    clearDashboardCache(); // Clear in-memory dashboard cache immediately
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.ORDER(id));
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    revalidatePath('/dashboard');

    // ⚡ OPTIMIZED: Log changes asynchronously (non-blocking) - don't wait for it
    if (changedFields.length > 0) {
      // Fix: logOrderChange expects 3-4 arguments; pass only id, oldValues, newValues, and type
      logOrderChange('update', id, oldValues, newValues)
        .catch(() => {}); // Silent error handling
    }

    // ⚡ FIX: Return populated order data so frontend can display quality/party names immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Order updated successfully", 
        data: populatedOrder 
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      
      if (error.message.includes('E11000')) {
        if (error.message.includes('orderId')) {
          return new Response(
            JSON.stringify({ 
              message: "Order ID already exists - please use a different order ID" 
            }), 
            { status: 400 }
          );
        }
        
        if (error.message.includes('party') && error.message.includes('poNumber') && error.message.includes('styleNo')) {
          return new Response(
            JSON.stringify({ 
              message: "This combination of Party, PO Number, and Style Number already exists. Please use different values." 
            }), 
            { status: 400 }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            message: "Duplicate key error - please check your data and try again" 
          }), 
          { status: 400 }
        );
      }
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
        return new Response(
          JSON.stringify({ message: validationErrors.join(", ") }), 
          { status: 400 }
        );
      }
    }
    
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ message }), { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const { checkRateLimitOrError, writeRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session - only master can delete orders
    const session = await requireAuth(req);
    if (session.role !== 'master') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Access denied - Only master can delete orders" 
        }), 
        { status: 403 }
      );
    }

    await dbConnect();
    
    const { id } = await params;
    
    // Check if order exists
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Order not found" 
        }), 
        { status: 404 }
      );
    }

    // Store order details for logging before deletion
    const orderDetails = {
      orderId: existingOrder.orderId,
      orderType: existingOrder.orderType,
      poNumber: existingOrder.poNumber,
      styleNo: existingOrder.styleNo,
      party: existingOrder.party,
      status: existingOrder.status
    };

    // Delete the order
    const deletedOrder = await Order.findByIdAndDelete(id);
    
    if (!deletedOrder) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to delete order" 
        }), 
        { status: 500 }
      );
    }

    // ⚡ CACHE REVALIDATION - Revalidate all order-related caches
    clearDashboardCache(); // Clear in-memory dashboard cache immediately
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.ORDER(id));
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidatePath('/orders');
    revalidatePath('/dashboard');

    // Log the order deletion (async, non-blocking)
    logOrderChange('delete', id, orderDetails, {})
      .catch(() => {}); // Silent error handling

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Order deleted successfully" 
      }), 
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message 
      }), 
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const { checkRateLimitOrError, writeRateLimiter } = await import('@/lib/rateLimit');
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    await requireAuth(req);

    await dbConnect();
    
    const { id } = await params;
    const requestData = await req.json();
    const { status, action, itemIndex } = requestData;

    // Handle item deletion
    if (action === 'deleteItem' && itemIndex !== undefined) {
      const order = await Order.findById(id);
      if (!order) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Order not found" 
          }), 
          { status: 404 }
        );
      }

      // Validate item index
      const index = parseInt(itemIndex);
      if (isNaN(index) || index < 0 || index >= order.items.length) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Invalid item index" 
          }), 
          { status: 400 }
        );
      }

      // Remove the item using $pull operator with the item's _id
      const itemToRemove = order.items[index];
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { $pull: { items: { _id: (itemToRemove as any)._id } } },
        { new: true }
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Item deleted successfully",
          data: updatedOrder 
        }), 
        { status: 200 }
      );
    }

    // Fast status change - minimal validation but WITH logging
    if (status && ['pending', 'delivered'].includes(status)) {
      // Get old status before update
      const existingOrder = await Order.findById(id).select('status orderId').lean();
      const oldStatus = existingOrder?.status || 'Not set';
      
      // Direct update without validation for maximum speed
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: false, select: '_id orderId status' }
      );

      if (!updatedOrder) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Order not found" 
          }), 
          { status: 404 }
        );
      }

      // ⚡ CACHE REVALIDATION
      revalidateTag(CACHE_TAGS.ORDERS);
      revalidateTag(CACHE_TAGS.ORDER(id));
      revalidateTag(CACHE_TAGS.DASHBOARD);
      revalidateTag(CACHE_TAGS.STATS);
      revalidatePath('/orders');
      revalidatePath(`/orders/${id}`);
      revalidatePath('/dashboard');

      // Log the status change (async, don't wait for it)
      logOrderChange('status_change', id, { status: oldStatus }, { status: updatedOrder.status })
        .catch(error => {}); // Silent error handling

      // Return minimal response immediately
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Order status updated successfully", 
          data: {
            _id: updatedOrder._id,
            orderId: updatedOrder.orderId,
            status: updatedOrder.status
          }
        }), 
        { status: 200 }
      );
    }

    // Fallback for other status values
    const validStatuses = ['Not selected', 'pending', 'delivered'];
    if (status && !validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Invalid status. Must be one of: Not selected, pending, delivered" 
        }), 
        { status: 400 }
      );
    }

    // Check if order exists
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Order not found" 
        }), 
        { status: 404 }
      );
    }

    // Store old status for logging
    const oldStatus = existingOrder.status;

    // Update the order - optimized for status change only
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: false }
    );

    if (!updatedOrder) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to update order status" 
        }), 
        { status: 500 }
      );
    }

    // ⚡ CACHE REVALIDATION
    revalidateTag(CACHE_TAGS.ORDERS);
    revalidateTag(CACHE_TAGS.ORDER(id));
    revalidateTag(CACHE_TAGS.DASHBOARD);
    revalidateTag(CACHE_TAGS.STATS);
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    revalidatePath('/dashboard');

    // Log the status change (async, don't wait for it)
    logOrderChange('status_change', id, { status: oldStatus }, { status: updatedOrder.status })
      .catch(error => {}); // Silent error handling

    // Return minimal response for faster performance
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Order status updated successfully", 
        data: {
          _id: updatedOrder._id,
          orderId: updatedOrder.orderId,
          status: updatedOrder.status
        }
      }), 
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values((error as any).errors).map((err: any) => err.message);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: validationErrors.join(", ") 
          }), 
          { status: 400 }
        );
      }
      
      if (error.message.includes('E11000')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Duplicate key error" 
          }), 
          { status: 400 }
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

