import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/session';
import dbConnect from '@/lib/dbConnect';
import SystemConfig from '@/models/SystemConfig';
import { invalidateLogoutAllCache } from '@/lib/logoutAllCache';

/**
 * API endpoint to clear (reset) the logout-all timestamp
 * This allows new logins to work normally after a logout-all event
 * Only super admins can call this
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Only super admin can clear the logout-all timestamp
    const session = await requireSuperAdmin(request);
    
    if (!session) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Unauthorized - Super admin access required' 
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clear the logout-all timestamp from the database
    await SystemConfig.findOneAndDelete({ key: 'logout_all_timestamp' });
    
    // Invalidate the in-memory cache
    invalidateLogoutAllCache();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Logout-all timestamp cleared. New logins will work normally.',
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || 'Failed to clear logout-all timestamp' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
