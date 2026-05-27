import { NextRequest } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/auth';
import { unauthorized } from '@/lib/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{}> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized('No token provided');
    }

    const token = authHeader.substring(7);
    
    // Check logout all timestamp when validating
    let decoded: TokenPayload | null = null;
    try {
      decoded = await Promise.race([
        verifyToken(token, true), // Check logout all timestamp
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Token verification timeout')), 5000) // 5 second timeout (increased from 3s)
        )
      ]) as TokenPayload | null;
    } catch (error) {
      // Distinguish between different error types
      if (error instanceof Error) {
        // Database connection errors - return 503 (Service Unavailable) with retry flag
        if (error.message.includes('database') || error.message.includes('connection') || error.message.includes('MongoDB')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Database connection failed',
            retry: true // Signal client to retry
          }), { 
            status: 503,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
        }
        
        // Timeout errors - return 408 (Request Timeout) with retry flag
        if (error.message.includes('timeout')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Request timeout',
            retry: true
          }), { 
            status: 408,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
        }
      }
      
      // Invalid token - return 401 (only for actual auth failures)
      return unauthorized('Invalid token or session expired');
    }
    
    if (!decoded) {
      return unauthorized('Invalid token or session expired');
    }

    // Return minimal user info for session validation
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      }
    }), { 
      status: 200, 
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Don't cache - need fresh validation
      }
    });

  } catch (error) {
    // Only return 401 for actual authentication failures
    // For other errors (network, database), return 503 (Service Unavailable)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a database/connection error
    if (errorMessage.includes('database') || errorMessage.includes('connection') || errorMessage.includes('MongoDB')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database connection failed',
        retry: true
      }), { 
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
    
    // For other errors, return 503 (Service Unavailable) instead of 401
    return new Response(JSON.stringify({
      success: false,
      error: 'Session validation service unavailable',
      retry: true
    }), { 
      status: 503,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}
