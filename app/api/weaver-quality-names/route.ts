import dbConnect from "@/lib/dbConnect";
import WeaverQualityName from "@/models/WeaverQualityName";
import Weaver from "@/models/Weaver";
import QualityName from "@/models/QualityName";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const weaverId = searchParams.get('weaverId');
    
    const query: any = {};
    if (weaverId) {
      query.weaverId = weaverId;
    }
    
    const weaverQualityNames = await WeaverQualityName.find(query)
      .sort({ name: 1 });
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: weaverQualityNames 
    }), { status: 200 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: "Failed to fetch weaver quality names" 
    }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const { name, weaver } = await req.json();
    
    // Validation
    if (!name?.trim()) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Weaver quality name is required" 
      }), { status: 400 });
    }
    
    if (!weaver) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Weaver is required" 
      }), { status: 400 });
    }
    
    // Find or create weaver
    let weaverDoc = await Weaver.findOne({ name: weaver });
    if (!weaverDoc) {
      // Create a default quality name if weaver doesn't exist
      const defaultQualityName = new QualityName({ name: 'Default Quality' });
      await defaultQualityName.save();
      
      weaverDoc = new Weaver({ 
        name: weaver,
        qualityNameId: defaultQualityName._id
      });
      await weaverDoc.save();
    }
    
    // Check if weaver quality name already exists for this weaver
    const existingWeaverQualityName = await WeaverQualityName.findOne({ 
      name: name.trim(),
      weaverId: weaverDoc._id
    });
    
    if (existingWeaverQualityName) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Weaver quality name already exists for this weaver" 
      }), { status: 400 });
    }
    
    // Create weaver quality name
    const weaverQualityName = new WeaverQualityName({
      name: name.trim(),
      weaverId: weaverDoc._id
    });
    
    await weaverQualityName.save();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Weaver quality name created successfully",
      data: weaverQualityName 
    }), { status: 201 });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: "Failed to create weaver quality name" 
    }), { status: 500 });
  }
}
