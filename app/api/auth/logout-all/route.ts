import { NextRequest } from 'next/server';
import { getSession, requireSuperAdmin } from '@/lib/session';
import Log, { ILogModel } from '@/models/Log';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import SystemConfig, { ISystemConfigModel } from '@/models/SystemConfig';
import { Server as SocketIOServer } from 'socket.io';
import { invalidateLogoutAllCache, setCachedLogoutAllTimestamp } from '@/lib/logoutAllCache';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Only super admin can logout all users
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

    // Set logout all timestamp - this will invalidate all tokens issued before now
    // This is the critical step that logs out all users
    const logoutAllTimestamp = new Date();
    await (SystemConfig as ISystemConfigModel).setLogoutAllTimestamp();
    
    // ⚡ OPTIMIZATION: Update cache immediately with new timestamp and triggeredBy
    const triggeredBy = session.username || session.name || 'Super Admin';
    setCachedLogoutAllTimestamp(logoutAllTimestamp, triggeredBy);
    
    // ⚡ BROADCAST LOGOUT EVENT: Notify all connected clients IMMEDIATELY via Socket.IO
    const io = (global as any).io as SocketIOServer | undefined;
    if (io) {
      const connectedClients = io.sockets.sockets.size;
      console.log(`📢 Broadcasting logout-all event to ${connectedClients} Socket.IO clients IMMEDIATELY...`);
      
      const event = {
        type: 'logout_all',
        timestamp: new Date().toISOString(),
        message: 'All users must logout immediately',
        triggeredBy: session.username || session.name || 'Super Admin',
        triggeredById: session.id,
      };
      
      // Emit to ALL connected clients IMMEDIATELY (including the super admin who triggered it)
      io.emit('logout_all', event);
      
      // Also emit to all rooms/namespaces to ensure no one is missed
      io.sockets.emit('logout_all', event);
      
      console.log(`✅ Logout-all event broadcasted IMMEDIATELY to ${connectedClients} clients via Socket.IO`);
    } else {
      console.warn('⚠️ Socket.IO server not available, logout-all event not broadcasted');
      console.warn('⚠️ Make sure server.js is running (not just "next dev")');
    }

    // Log the logout all action (non-blocking - don't wait if it fails)
    (Log as ILogModel).logUserAction({
      userId: session.id,
      username: session.username || session.name,
      userRole: session.role,
      action: 'logout_all',
      resource: 'auth',
      details: {
        username: session.username || session.name,
        userId: session.id,
        action: 'Logged out all users, super admins, and devices',
        timestamp: new Date().toISOString()
      },
      success: true,
      severity: 'warning',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    }).catch(() => {
      // Ignore logging errors - logout-all should still succeed
    });

    // Get count of active users for logging (non-blocking)
    User.countDocuments({ isActive: true }).catch(() => {
      // Ignore if count fails
    });
    
    // Return success immediately - don't wait for logging
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'All users logged out successfully',
      timestamp: new Date().toISOString()
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    // Even on error, try to set logout-all timestamp if possible
    try {
      await dbConnect();
      await (SystemConfig as ISystemConfigModel).setLogoutAllTimestamp();
    } catch {
      // Ignore if this also fails
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || 'Logout all failed' 
    }), { 
      status: error.message?.includes('Superadmin') ? 403 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

