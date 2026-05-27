import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Log from '@/models/Log';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Allow both users and superadmins to view logs
    if (session.role !== 'superadmin' && session.role !== 'user') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get total count
    const totalCount = await Log.countDocuments({});
    
    // Get counts by action type
    const actionCounts = await Log.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get counts by resource type
    const resourceCounts = await Log.aggregate([
      {
        $group: {
          _id: '$resource',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get recent logs (last 10)
    const recentLogs = await Log.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .select('action resource username timestamp')
      .lean();
    
    return NextResponse.json({
      totalCount,
      actionCounts,
      resourceCounts,
      recentLogs
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
