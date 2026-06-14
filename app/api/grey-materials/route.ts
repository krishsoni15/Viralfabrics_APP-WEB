import dbConnect from "@/lib/dbConnect";
import GreyMaterial from "@/models/GreyMaterial";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import mongoose from "mongoose";
import { sanitizeSearchQuery } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const search = sanitizeSearchQuery(searchParams.get('search') || '');
    const qualityName = searchParams.get('qualityName') || '';
    const type = searchParams.get('type') || '';
    const weaver = searchParams.get('weaver') || '';
    const weaverQualityName = searchParams.get('weaverQualityName') || '';
    const qualityCode = searchParams.get('qualityCode') || '';
    const exact = searchParams.get('exact') === 'true';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const groupByQuality = searchParams.get('groupByQuality') === 'true';
    
    const query: any = {};
    
    if (search) {
      const or: any[] = [
        { qualityCode: { $regex: search, $options: 'i' } },
        { qualityName: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { weaver: { $regex: search, $options: 'i' } },
        { weaverQualityName: { $regex: search, $options: 'i' } },
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ _id: new mongoose.Types.ObjectId(search) });
      }
      query.$or = or;
    }
    
    if (qualityName) query.qualityName = qualityName;
    if (type) query.type = type.trim();
    if (weaver) query.weaver = weaver;
    if (weaverQualityName) query.weaverQualityName = weaverQualityName;
    if (qualityCode) {
      if (exact) {
        query.qualityCode = qualityCode.trim();
      } else {
        const escapedQualityCode = qualityCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.qualityCode = { $regex: escapedQualityCode, $options: 'i' };
      }
    }
    
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    let greyMaterials, totalCount, totalPages, hasNextPage, hasPrevPage;
    
    if (groupByQuality) {
      try {
        const qualityGroups = await GreyMaterial.aggregate([
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
        
        const gmQuery: any = {
          qualityCode: { $in: qualityCodes },
          qualityName: { $in: qualityNames }
        };
        
        // Apply other filters from original query (except $or which might exclude other items in the group)
        Object.keys(query).forEach(key => {
          if (key !== '$or' && key !== 'qualityCode' && key !== 'qualityName') {
            gmQuery[key] = query[key];
          }
        });
        
        greyMaterials = await GreyMaterial.find(gmQuery)
          .sort(sortObj)
          .lean()
          .maxTimeMS(5000);
        
        totalPages = Math.ceil(totalCount / limit);
        hasNextPage = page < totalPages;
        hasPrevPage = page > 1;
      } catch (e) {
        totalCount = await GreyMaterial.countDocuments(query).maxTimeMS(5000);
        greyMaterials = await GreyMaterial.find(query)
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
      totalCount = await GreyMaterial.countDocuments(query).maxTimeMS(5000);
      greyMaterials = await GreyMaterial.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(5000);
      
      totalPages = Math.ceil(totalCount / limit);
      hasNextPage = page < totalPages;
      hasPrevPage = page > 1;
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: greyMaterials,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        groupByQuality
      }
    }), { status: 200 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: `Failed to fetch grey materials: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    
    const requestData = await req.json();
    const gmData = Array.isArray(requestData) ? requestData : [requestData];
    
    const createdGMs = [];
    const errors: string[] = [];
    
    for (let i = 0; i < gmData.length; i++) {
      const data = gmData[i];
      const {
        qualityCode,
        qualityName,
        type,
        images,
        weavers,
        weaver,
        challanNumber,
        piece,
        meter
      } = data;
      
      if (!qualityCode?.trim()) errors.push(`Item ${i + 1}: Quality code is required`);
      if (!qualityName?.trim()) errors.push(`Item ${i + 1}: Quality name is required`);
      
      if (errors.length > 0) continue;

      if (weavers && Array.isArray(weavers) && weavers.length > 0) {
        for (const w of weavers) {
          if (!w.name?.trim()) continue;
          const greyMaterial = new GreyMaterial({
            qualityCode: qualityCode.trim(),
            qualityName: qualityName.trim(),
            type: type?.trim() || '',
            images: images || [],
            weaver: w.name.trim(),
            challanNumber: w.challanNumber?.trim() || '',
            piece: w.piece ? Number(w.piece) : 0,
            meter: w.meter ? Number(w.meter) : 0
          });
          const saved = await greyMaterial.save();
          createdGMs.push(saved);
        }
      } else {
        if (!weaver?.trim()) errors.push(`Item ${i + 1}: Weaver name is required`);
        if (errors.length > 0) continue;
        
        const greyMaterial = new GreyMaterial({
          qualityCode: qualityCode.trim(),
          qualityName: qualityName.trim(),
          type: type?.trim() || '',
          images: images || [],
          weaver: weaver.trim(),
          challanNumber: challanNumber?.trim() || '',
          piece: piece ? Number(piece) : 0,
          meter: meter ? Number(meter) : 0
        });
        const saved = await greyMaterial.save();
        createdGMs.push(saved);
      }
    }
    
    if (errors.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: errors.join("; ") 
      }), { status: 400 });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: gmData.length === 1 ? "Grey material created successfully" : `${gmData.length} grey materials created successfully`,
      data: createdGMs
    }), { status: 201 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to create grey material" 
    }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || session.role !== 'master') {
      return Response.json({ success: false, message: 'Access denied - Only master can delete grey materials' }, { status: 403 });
    }

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const qualityCode = searchParams.get('qualityCode') || '';
    const qualityName = searchParams.get('qualityName') || '';
    
    const contentType = req.headers.get('content-type');
    let ids: string[] | null = null;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        ids = body?.ids;
        
        if (ids && Array.isArray(ids) && ids.length > 0) {
          const deleteResult = await GreyMaterial.deleteMany({
            _id: { $in: ids }
          });
          return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully deleted ${deleteResult.deletedCount} grey material(s)`,
            deletedCount: deleteResult.deletedCount
          }), { status: 200 });
        }
      } catch (e) {}
    }
    
    if (!qualityCode || !qualityName) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Quality code and quality name are required for bulk deletion, or IDs must be provided in request body" 
      }), { status: 400 });
    }
    
    const deleteResult = await GreyMaterial.deleteMany({
      qualityCode: qualityCode.trim(),
      qualityName: qualityName.trim()
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully deleted ${deleteResult.deletedCount} grey material(s)`,
      deletedCount: deleteResult.deletedCount
    }), { status: 200 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to delete grey materials" 
    }), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    
    const data = await req.json();
    const {
      qualityCode,
      qualityName,
      type,
      images,
      weavers,
      originalQualityCode
    } = data;
    
    if (!qualityCode?.trim()) {
      return new Response(JSON.stringify({ success: false, message: "Quality code is required" }), { status: 400 });
    }
    if (!qualityName?.trim()) {
      return new Response(JSON.stringify({ success: false, message: "Quality name is required" }), { status: 400 });
    }

    const queryCode = originalQualityCode || qualityCode;
    const existingGMs = await GreyMaterial.find({ qualityCode: queryCode.trim() });
    const existingIds = existingGMs.map(gm => String(gm._id));
    
    const updatedOrCreatedGMs = [];
    const keptIds = new Set<string>();

    if (weavers && Array.isArray(weavers)) {
      for (const w of weavers) {
        if (!w.name?.trim()) continue;
        
        const gmData = {
          qualityCode: qualityCode.trim(),
          qualityName: qualityName.trim(),
          type: type?.trim() || '',
          images: images || [],
          weaver: w.name.trim(),
          challanNumber: w.challanNumber?.trim() || '',
          piece: w.piece ? Number(w.piece) : 0,
          meter: w.meter ? Number(w.meter) : 0
        };

        if (w._id && existingIds.includes(String(w._id))) {
          const updated = await GreyMaterial.findByIdAndUpdate(
            w._id,
            { $set: gmData },
            { new: true, runValidators: true }
          );
          if (updated) {
            updatedOrCreatedGMs.push(updated);
            keptIds.add(String(w._id));
          }
        } else {
          const newGM = new GreyMaterial(gmData);
          const saved = await newGM.save();
          updatedOrCreatedGMs.push(saved);
        }
      }
    }

    // Safely delete only the weavers that were explicitly deleted by the user,
    // or fall back to the old behavior if the client didn't supply deletedWeaverIds.
    const deletedWeaverIds = data.deletedWeaverIds;
    if (deletedWeaverIds && Array.isArray(deletedWeaverIds)) {
      if (deletedWeaverIds.length > 0) {
        await GreyMaterial.deleteMany({ 
          _id: { $in: deletedWeaverIds.map(id => new mongoose.Types.ObjectId(id)) },
          qualityCode: qualityCode.trim() // safety scope
        });
      }
    } else {
      const idsToDelete = existingIds.filter(id => !keptIds.has(id));
      if (idsToDelete.length > 0) {
        await GreyMaterial.deleteMany({ _id: { $in: idsToDelete } });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Grey materials updated successfully",
      data: updatedOrCreatedGMs
    }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to update grey materials" 
    }), { status: 500 });
  }
}
