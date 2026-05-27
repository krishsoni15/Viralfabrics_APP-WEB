import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Log, { ILogModel } from '@/models/Log';
import { ok, serverError, unauthorized } from '@/lib/http';
import { getSession } from '@/lib/session';
import { logView } from '@/lib/logger';

// GET /api/logs/stats - Get log statistics
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return unauthorized('Authentication required');
    }
    
    // Only superadmin can view log stats
    if (session.role !== 'superadmin') {
      return unauthorized('Superadmin access required');
    }
    
    const stats = await (Log as ILogModel).getActivityStats();
    
    // Log this view action
    logView('log', 'stats', request);
    
    return ok(stats);
    
  } catch (error) {
    return serverError(error);
  }
}
