import dbConnect from "@/lib/dbConnect";
import Fabric from "@/models/Fabric";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import mongoose from "mongoose";
// NO CACHING - Removed cache config imports
import { apiRateLimiter, writeRateLimiter, checkRateLimitOrError } from "@/lib/rateLimit";
import { sanitizeSearchQuery, sanitizeString } from "@/lib/sanitize";
import { invalidateAllFabricCaches, waitForDatabaseCommit, NO_CACHE_HEADERS, DATABASE_TIMEOUTS, COMMIT_DELAYS } from "./cacheUtils";

export async function GET(req: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(req, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session first (security check)
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    // Sanitize all search inputs to prevent NoSQL injection
    const search = sanitizeSearchQuery(searchParams.get('search') || '');
    const qualityName = sanitizeString(searchParams.get('qualityName') || '', { maxLength: 100 });
    const type = sanitizeString(searchParams.get('type') || '', { maxLength: 50 });
    const weaver = sanitizeString(searchParams.get('weaver') || '', { maxLength: 100 });
    const weaverQualityName = sanitizeString(searchParams.get('weaverQualityName') || '', { maxLength: 100 });
    const qualityCode = sanitizeString(searchParams.get('qualityCode') || '', { maxLength: 50 });
    const content = sanitizeString(searchParams.get('content') || '', { maxLength: 200 });
    const rack = sanitizeString(searchParams.get('rack') || '', { maxLength: 100 });
    const label = sanitizeString(searchParams.get('label') || '', { maxLength: 100 });
    const danierParam = sanitizeString(searchParams.get('danier') || '', { maxLength: 100 });

    // Numeric fields - properly handle null values
    const reedStr = searchParams.get('reed');
    const reedParam = reedStr ? Number(reedStr) : NaN;
    const pickStr = searchParams.get('pick');
    const pickParam = pickStr ? Number(pickStr) : NaN;
    const greighWidthStr = searchParams.get('greighWidth');
    const greighWidthParam = greighWidthStr ? Number(greighWidthStr) : NaN;
    const finishWidthStr = searchParams.get('finishWidth');
    const finishWidthParam = finishWidthStr ? Number(finishWidthStr) : NaN;
    const weightStr = searchParams.get('weight');
    const weightParam = weightStr ? Number(weightStr) : NaN;
    const gsmStr = searchParams.get('gsm');
    const gsmParam = gsmStr ? Number(gsmStr) : NaN;
    const greighRateStr = searchParams.get('greighRate');
    const greighRateParam = greighRateStr ? Number(greighRateStr) : NaN;
    const countStr = searchParams.get('count');
    const countParam = countStr ? Number(countStr) : NaN;
    const exact = searchParams.get('exact') === 'true';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100); // Enforce max 100
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1); // Enforce min page 1
    const skip = (page - 1) * limit; // Calculate skip value for pagination
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // Default sort field
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // Default sort order
    const groupByQuality = searchParams.get('groupByQuality') === 'true'; // New parameter for quality code pagination
    
    // Build query
    const query: any = {};
    
    if (search) {
      const or: any[] = [
        { qualityCode: { $regex: search, $options: 'i' } },
        { qualityName: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { weaver: { $regex: search, $options: 'i' } },
        { weaverQualityName: { $regex: search, $options: 'i' } },
        { danier: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { rack: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } },
      ];

      // Allow numeric search to match key numeric fields (exact match on number)
      const searchNumber = Number(search);
      const isNumericSearch = Number.isFinite(searchNumber);
      if (isNumericSearch) {
        [
          'greighWidth',
          'finishWidth',
          'weight',
          'gsm',
          'count',
          'reed',
          'pick',
          'greighRate',
        ].forEach((field) => {
          or.push({ [field]: searchNumber });
        });
      }

      // Allow searching directly by MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      query.$or = or;
    }
    
    if (qualityName) {
      query.qualityName = qualityName;
    }
    
    if (type) {
      // Use exact match for type filter (from dropdown selections)
      // This ensures dropdown selections work correctly with exact values
      query.type = type.trim();
    }
    
    if (weaver) {
      query.weaver = weaver;
    }
    
    if (weaverQualityName) {
      query.weaverQualityName = weaverQualityName;
    }

    if (content) {
      query.content = { $regex: content, $options: 'i' };
    }

    if (rack) {
      query.rack = { $regex: rack, $options: 'i' };
    }

    if (label) {
      query.label = { $regex: label, $options: 'i' };
    }

    if (danierParam) {
      query.danier = { $regex: danierParam, $options: 'i' };
    }

    if (Number.isFinite(reedParam)) {
      query.reed = reedParam;
    }

    if (Number.isFinite(pickParam)) {
      query.pick = pickParam;
    }

    if (Number.isFinite(greighWidthParam)) {
      query.greighWidth = greighWidthParam;
    }

    if (Number.isFinite(finishWidthParam)) {
      query.finishWidth = finishWidthParam;
    }

    if (Number.isFinite(weightParam)) {
      query.weight = weightParam;
    }

    if (Number.isFinite(gsmParam)) {
      query.gsm = gsmParam;
    }

    if (Number.isFinite(greighRateParam)) {
      query.greighRate = greighRateParam;
    }

    if (Number.isFinite(countParam)) {
      query.count = countParam;
    }
    
    // Handle exact quality code check
    if (qualityCode) {
      if (exact) {
        // Exact match for quality code checking
        query.qualityCode = qualityCode.trim();
      } else {
        // Partial match for search
        query.qualityCode = { $regex: qualityCode, $options: 'i' };
      }
    }
    
    let fabrics, totalCount, totalPages, hasNextPage, hasPrevPage;
    
    // Build sort object dynamically (needed for both branches)
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    if (groupByQuality) {
      try {
        // If cache-busting, wait longer to ensure database writes are fully committed and visible
        const forceFresh = searchParams.get('_nocache') || searchParams.get('t');
        if (forceFresh) {
          await waitForDatabaseCommit(400); // Longer wait to ensure writes are visible
        }
        
        // Get unique quality codes with aggregation - ensure we see all fabrics
        const qualityGroups = await Fabric.aggregate([
          { $match: query },
          {
            $group: {
              _id: { qualityCode: "$qualityCode", qualityName: "$qualityName" },
              firstCreated: { $min: "$createdAt" },
              lastCreated: { $max: "$createdAt" }
            }
          },
          {
            $project: {
              qualityCode: "$_id.qualityCode",
              qualityName: "$_id.qualityName",
              firstCreated: 1,
              lastCreated: 1
            }
          },
          { $sort: { [sortBy === 'createdAt' ? 'firstCreated' : 'qualityCode']: sortOrder === 'asc' ? 1 : -1 } }
        ], { maxTimeMS: 5000, allowDiskUse: true });
        
        totalCount = qualityGroups.length;
        const paginatedGroups = qualityGroups.slice(skip, skip + limit);
        const qualityCodes = paginatedGroups.map(group => group.qualityCode);
        const qualityNames = paginatedGroups.map(group => group.qualityName);
        
        // Get all fabrics for these quality codes
        // Use the quality codes/names from pagination, but apply other filters carefully
        // This ensures we get ALL fabrics for the selected quality codes
        const fabricQuery: any = {
          qualityCode: { $in: qualityCodes },
          qualityName: { $in: qualityNames }
        };
        
        // Apply other filters from original query (except $or which might exclude new fabrics)
        Object.keys(query).forEach(key => {
          if (key !== '$or' && key !== 'qualityCode' && key !== 'qualityName') {
            fabricQuery[key] = query[key];
          }
        });
        
        fabrics = await Fabric.find(fabricQuery)
          .sort(sortObj)
          .lean()
          .maxTimeMS(5000);
        
        totalPages = Math.ceil(totalCount / limit);
        hasNextPage = page < totalPages;
        hasPrevPage = page > 1;
      } catch (aggregationError) {
        console.error('Aggregation error, using fallback:', aggregationError);
        // Fallback to regular pagination
        totalCount = await Fabric.countDocuments(query).maxTimeMS(5000);
        fabrics = await Fabric.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean()
          .maxTimeMS(5000);
        totalPages = Math.ceil(totalCount / limit);
        hasNextPage = page < totalPages;
        hasPrevPage = page > 1;
      }
    } else {
      // Regular pagination - individual fabric records
      totalCount = await Fabric.countDocuments(query).maxTimeMS(5000);
      
      // Get fabrics directly from database - always fresh
      fabrics = await Fabric.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(5000);
      
      // Calculate pagination info
      totalPages = Math.ceil(totalCount / limit);
      hasNextPage = page < totalPages;
      hasPrevPage = page > 1;
    }
    
    // Always return fresh data - no caching to prevent stale data issues
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: fabrics,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        groupByQuality: groupByQuality
      }
    }), { status: 200, headers });
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching fabrics:', error);
    }
    return new Response(JSON.stringify({ 
      success: false, 
      message: `Failed to fetch fabrics: ${error instanceof Error ? error.message : 'Unknown error'}` 
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
    
    const requestData = await req.json();
    
    // Handle both single fabric and array of fabrics
    const fabricsData = Array.isArray(requestData) ? requestData : [requestData];
    
    const createdFabrics = [];
    const errors: string[] = [];
    const qualityCodesInRequest = new Set(); // Track quality codes in this request
    
    for (let i = 0; i < fabricsData.length; i++) {
      const fabricData = fabricsData[i];
      const {
        qualityCode,
        qualityName,
        type,
        weaver,
        weaverQualityName,
        rack,
        greighWidth,
        finishWidth,
        weight,
        gsm,
        content,
        danier,
        count,
        reed,
        pick,
        greighRate,
        label,
        images
      } = fabricData;
      
      // Validation for each fabric
      const fabricErrors: string[] = [];
      
      if (!qualityCode?.trim()) {
        fabricErrors.push("Quality code is required");
      }
      
      if (!qualityName?.trim()) {
        fabricErrors.push("Quality name is required");
      }
      
      if (!weaver?.trim()) {
        fabricErrors.push("Weaver is required");
      }
      
      if (!weaverQualityName?.trim()) {
        fabricErrors.push("Weaver quality name is required");
      }
      
      // Validate numeric fields properly - check for NaN and valid numbers
      if (greighWidth) {
        const val = parseFloat(greighWidth);
        if (!Number.isFinite(val)) {
          fabricErrors.push("Greigh width must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("Greigh width must be a positive number");
        }
      }
      
      if (finishWidth) {
        const val = parseFloat(finishWidth);
        if (!Number.isFinite(val)) {
          fabricErrors.push("Finish width must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("Finish width must be a positive number");
        }
      }
      
      if (weight) {
        const val = parseFloat(weight);
        if (!Number.isFinite(val)) {
          fabricErrors.push("Weight must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("Weight must be a positive number");
        }
      }
      
      if (gsm) {
        const val = parseFloat(gsm);
        if (!Number.isFinite(val)) {
          fabricErrors.push("GSM must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("GSM must be a positive number");
        }
      }
      
      if (reed) {
        const val = parseFloat(reed);
        if (!Number.isFinite(val)) {
          fabricErrors.push("Reed must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("Reed must be a positive number");
        }
      }
      
      if (pick) {
        const val = parseFloat(pick);
        if (!Number.isFinite(val)) {
          fabricErrors.push("Pick must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("Pick must be a positive number");
        }
      }
      
      if (greighRate) {
        const val = parseFloat(greighRate);
        if (!Number.isFinite(val)) {
          fabricErrors.push("Greigh rate must be a valid number");
        } else if (val <= 0) {
          fabricErrors.push("Greigh rate must be a positive number");
        }
      }
      
      if (fabricErrors.length > 0) {
        errors.push(`Item ${i + 1}: ${fabricErrors.join(", ")}`);
        continue;
      }
      
      // Create fabric (duplicates are allowed)
      const fabric = new Fabric({
        qualityCode: qualityCode.trim(),
        qualityName: qualityName.trim(),
        type: type?.trim() || '',
        weaver: weaver.trim(),
        weaverQualityName: weaverQualityName.trim(),
        rack: rack?.trim() || '',
        greighWidth: greighWidth ? parseFloat(greighWidth) : 0,
        finishWidth: finishWidth ? parseFloat(finishWidth) : 0,
        weight: weight ? parseFloat(weight) : 0,
        gsm: gsm ? parseFloat(gsm) : 0,
        content: content?.trim() || '',
        danier: danier?.trim() || '',
        count: count ? parseFloat(count) : 0,
        reed: reed ? parseFloat(reed) : 0,
        pick: pick ? parseFloat(pick) : 0,
        greighRate: greighRate ? parseFloat(greighRate) : 0,
        label: label?.trim() || '',
        images: images || []
      });
      
      const saved = await fabric.save();
      createdFabrics.push(saved);
    }
    
    if (errors.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: errors.join("; ") 
      }), { status: 400 });
    }
    
    // Wait longer for database commit to ensure all writes are fully committed and visible
    await waitForDatabaseCommit(500);
    
    // Verify all created fabrics exist in database by querying them
    const verifiedFabrics = [];
    for (const fabric of createdFabrics) {
      if (fabric && fabric._id) {
        try {
          // Query by ID to ensure it exists
          const verified = await Fabric.findById(fabric._id).lean() as any;
          if (verified) {
            verifiedFabrics.push(verified);
          } else {
            console.error('⚠️ Fabric not found after save:', fabric._id);
            // Try finding by fields as fallback
            const found = await Fabric.findOne({
              qualityCode: fabric.qualityCode,
              qualityName: fabric.qualityName,
              weaver: fabric.weaver,
              weaverQualityName: fabric.weaverQualityName
            }).lean() as any;
            if (found) {
              verifiedFabrics.push(found);
            }
          }
        } catch (e) {
          console.error('❌ Error verifying fabric:', e);
        }
      }
    }
    
    // Invalidate caches
    const createdFabricIds = createdFabrics
      .map(f => f._id?.toString())
      .filter((id): id is string => Boolean(id));
    await invalidateAllFabricCaches(createdFabricIds);
    
    // Return verified fabrics (from database, not from save response)
    const fabricsToReturn = verifiedFabrics.length > 0 ? verifiedFabrics : createdFabrics.map(f => f.toObject ? f.toObject() : f);
    
    // Return verified fabrics from database
    return new Response(JSON.stringify({ 
      success: true, 
      message: fabricsData.length === 1 ? "Fabric created successfully" : `${fabricsData.length} fabrics created successfully`,
      data: fabricsToReturn,
      createdCount: fabricsToReturn.length
    }), { 
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Error creating fabric:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to create fabric" 
    }), { status: 500 });
  }
}

// DELETE /api/fabrics - Delete multiple fabrics by quality code and quality name OR by fabric IDs
export async function DELETE(req: NextRequest) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(req, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session - only master can delete
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    if (session.role !== 'master') {
      return Response.json({ success: false, message: 'Access denied - Only master can delete fabrics' }, { status: 403 });
    }

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const qualityCode = sanitizeString(searchParams.get('qualityCode') || '', { maxLength: 50 });
    const qualityName = sanitizeString(searchParams.get('qualityName') || '', { maxLength: 100 });
    
    // Check if we're deleting by fabric IDs (from request body)
    // ⚡ FIX: Clone request to check body without consuming it
    const contentType = req.headers.get('content-type');
    let fabricIds: string[] | null = null;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        // Clone the request to read body
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        fabricIds = body?.fabricIds;
        
        if (fabricIds && Array.isArray(fabricIds) && fabricIds.length > 0) {
          // Delete by fabric IDs
          const deleteResult = await Fabric.deleteMany({
            _id: { $in: fabricIds }
          });
          
          // ⚡ FIX: Invalidate all cache layers for deleted fabrics
          await invalidateAllFabricCaches(fabricIds.filter((id): id is string => typeof id === 'string'));
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully deleted ${deleteResult.deletedCount} fabric(s)`,
            deletedCount: deleteResult.deletedCount
          }), { 
            status: 200,
            headers: NO_CACHE_HEADERS
          });
        }
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        // Continue to fallback logic
      }
    }
    
    // Fallback to quality code and quality name deletion
    if (!qualityCode || !qualityName) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Quality code and quality name are required for bulk deletion, or fabric IDs must be provided in request body" 
      }), { 
        status: 400,
        headers: NO_CACHE_HEADERS
      });
    }
    
    // ⚡ FIX: Delete directly without checking first (more efficient)
    // Delete all matching fabrics
    const deleteResult = await Fabric.deleteMany({
      qualityCode: qualityCode.trim(),
      qualityName: qualityName.trim()
    });
    
    // Return success even if no fabrics were found (idempotent operation)
    if (deleteResult.deletedCount === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No fabrics found with the specified quality code and quality name (already deleted or never existed)",
        deletedCount: 0
      }), { 
        status: 200,
        headers: NO_CACHE_HEADERS
      });
    }
    
    // ⚡ FIX: Invalidate all cache layers (bulk delete)
    await invalidateAllFabricCaches();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully deleted ${deleteResult.deletedCount} fabric(s)`,
      deletedCount: deleteResult.deletedCount
    }), { 
      status: 200,
      headers: NO_CACHE_HEADERS
    });
    
  } catch (error) {
    console.error('Error deleting fabrics:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to delete fabrics" 
    }), { 
      status: 500,
      headers: NO_CACHE_HEADERS
    });
  }
}
