import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SystemConfig, { ISystemConfigModel } from '@/models/SystemConfig';
import { jwtVerify } from 'jose';
import { getCachedLogoutAllTimestamp, setCachedLogoutAllTimestamp, getCachedTriggeredBy } from '@/lib/logoutAllCache';

/**
 * API endpoint to check logout-all status
 * Used as fallback when Socket.IO is not available (e.g., on Vercel)
 * ⚡ OPTIMIZED: Uses in-memory cache to avoid database queries on every request
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No token provided' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid token format' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify token and get login time
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Server configuration error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    
    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid token' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get login time from token
    const loginTime = (payload as any).loginTime ? (payload as any).loginTime * 1000 : (payload.iat ? payload.iat * 1000 : 0);

    // ⚡ OPTIMIZATION: Check cache first (avoids database query)
    let logoutAllTimestamp = getCachedLogoutAllTimestamp();
    let triggeredBy = getCachedTriggeredBy() || 'Super Admin';

    // If cache miss, fetch from database
    if (logoutAllTimestamp === undefined) {
      try {
        await dbConnect();
        logoutAllTimestamp = await (SystemConfig as ISystemConfigModel).getLogoutAllTimestamp();
        
        // Cache the result (even if null)
        setCachedLogoutAllTimestamp(logoutAllTimestamp, triggeredBy);
      } catch (error) {
        // Database error - fail open (assume no logout-all)
        console.warn('Database error checking logout-all status:', error);
        return new Response(JSON.stringify({ 
          success: true,
          shouldLogout: false,
          logoutAllTimestamp: null,
          triggeredBy: null
        }), { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    }

    if (!logoutAllTimestamp) {
      // No logout-all has been triggered
      return new Response(JSON.stringify({ 
        success: true,
        shouldLogout: false,
        logoutAllTimestamp: null,
        triggeredBy: null
      }), { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    const logoutAllTime = logoutAllTimestamp.getTime();
    const shouldLogout = loginTime < logoutAllTime;

    // ⚡ OPTIMIZATION: Use cached triggeredBy (removed slow log query)
    // The triggeredBy is set when logout-all is triggered, so we can use cached value

    return new Response(JSON.stringify({ 
      success: true,
      shouldLogout,
      logoutAllTimestamp: logoutAllTimestamp.toISOString(),
      triggeredBy,
      loginTime: new Date(loginTime).toISOString()
    }), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || 'Failed to check logout status' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

