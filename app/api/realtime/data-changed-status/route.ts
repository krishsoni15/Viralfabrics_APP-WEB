import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SystemConfig from '@/models/SystemConfig';

/**
 * API route to check the latest data change status.
 * Used as a fallback for real-time synchronization in serverless environments like Vercel.
 */
export async function GET(request: NextRequest) {
  try {
    // ⚡ OPTIMIZATION: Ensure DB is connected
    await dbConnect();

    // ⚡ OPTIMIZATION: Use lean() and short timeout for maximum performance
    const config = await SystemConfig.findOne({ key: 'last_data_change' })
      .select('value')
      .lean()
      .maxTimeMS(2000);

    return NextResponse.json({
      success: true,
      lastChange: config ? (config as any).value : null
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('❌ Error checking data change status:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to check data change status'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}
