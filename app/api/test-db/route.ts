import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV,
      mongoUriPreview: process.env.MONGODB_URI 
        ? `${process.env.MONGODB_URI.substring(0, 30)}...` 
        : 'NOT SET'
    };

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({
        success: false,
        error: 'MONGODB_URI not set',
        envCheck
      }, { status: 500 });
    }

    // Try to connect
    try {
      await dbConnect();

      return NextResponse.json({
        success: true,
        message: 'Database connection successful!',
        envCheck
      });
    } catch (dbError: any) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        errorMessage: dbError.message,
        errorName: dbError.name,
        envCheck
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      errorMessage: error.message,
      errorName: error.name
    }, { status: 500 });
  }
}

