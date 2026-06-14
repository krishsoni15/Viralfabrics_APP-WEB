import dbConnect from "@/lib/dbConnect";
import Sampling from "@/models/Sampling";
import { getSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/response";
import { type NextRequest } from "next/server";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return Response.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const minMeter = searchParams.get('minMeter');
    const maxMeter = searchParams.get('maxMeter');
    const minPiece = searchParams.get('minPiece');
    const maxPiece = searchParams.get('maxPiece');
    
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const query: any = {};
    
    if (search) {
      const or: any[] = [
        { qualityName: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { whereToPut: { $regex: search, $options: 'i' } }
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ _id: new mongoose.Types.ObjectId(search) });
      }
      query.$or = or;
    }

    // Range Filters
    if (minMeter || maxMeter) {
      query.meter = {};
      if (minMeter) query.meter.$gte = parseFloat(minMeter);
      if (maxMeter) query.meter.$lte = parseFloat(maxMeter);
    }

    if (minPiece || maxPiece) {
      query.piece = {};
      if (minPiece) query.piece.$gte = parseInt(minPiece);
      if (maxPiece) query.piece.$lte = parseInt(maxPiece);
    }
    
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const totalCount = await Sampling.countDocuments(query);
    const samplings = await Sampling.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const summaryResult = await Sampling.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPieces: { $sum: "$piece" },
          totalMeters: { $sum: "$meter" },
          uniqueQualities: { $addToSet: { $toLower: "$qualityName" } }
        }
      }
    ]);

    const summary = {
      totalPieces: summaryResult[0]?.totalPieces || 0,
      totalMeters: summaryResult[0]?.totalMeters || 0,
      uniqueQualities: summaryResult[0]?.uniqueQualities?.length || 0
    };
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: samplings,
      summary,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      }
    }), { status: 200 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: `Failed to fetch samplings: ${error instanceof Error ? error.message : 'Unknown error'}` 
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
    
    const data = await req.json();
    const {
      qualityName,
      whereToPut,
      images,
      notes,
      meter,
      piece
    } = data;
    
    if (!qualityName?.trim()) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Quality name is required" 
      }), { status: 400 });
    }
    
    const sampling = new Sampling({
      qualityName: qualityName.trim(),
      whereToPut: whereToPut?.trim() || '',
      images: images || [],
      notes: notes || '',
      piece: piece ? Number(piece) : 0,
      meter: meter ? Number(meter) : 0
    });
    
    const saved = await sampling.save();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Sampling created successfully",
      data: saved
    }), { status: 201 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to create sampling" 
    }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || (session.role !== 'master' && session.role !== 'superadmin')) {
      return Response.json({ success: false, message: 'Access denied - Only master/superadmin can delete samplings' }, { status: 403 });
    }

    await dbConnect();
    
    const contentType = req.headers.get('content-type');
    let ids: string[] | null = null;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await req.json();
        ids = body?.ids;
        
        if (ids && Array.isArray(ids) && ids.length > 0) {
          const deleteResult = await Sampling.deleteMany({
            _id: { $in: ids }
          });
          return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully deleted ${deleteResult.deletedCount} sampling item(s)`,
            deletedCount: deleteResult.deletedCount
          }), { status: 200 });
        }
      } catch (e) {}
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      message: "IDs must be provided in request body for deletion" 
    }), { status: 400 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to delete sampling items" 
    }), { status: 500 });
  }
}
