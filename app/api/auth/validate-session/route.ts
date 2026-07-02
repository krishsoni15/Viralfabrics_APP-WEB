import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/auth';
import { unauthorized } from '@/lib/http';
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

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
        if (
          error.message.includes('database') || 
          error.message.includes('connection') || 
          error.message.includes('MongoDB') ||
          error.message.includes('buffering') ||
          error.message.includes('Mongoose')
        ) {
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

    // Fetch complete user profile from database
    await dbConnect();
    const userDoc = await User.findById(decoded.id)
      .select('_id name username email phoneNumber address role partyId profilePhoto createdAt updatedAt');
    
    if (!userDoc) {
      return unauthorized('User not found');
    }

    // Calculate remaining token lifetime so the cookie expiry matches
    const now = Math.floor(Date.now() / 1000);
    const tokenExp = decoded.exp ?? now + 7 * 24 * 60 * 60; // fallback: 7 days
    const remainingSeconds = Math.max(tokenExp - now, 0);

    const isHttps = request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    const response = NextResponse.json({
      success: true,
      user: {
        _id: userDoc._id.toString(),
        id: userDoc._id.toString(),
        name: userDoc.name,
        username: userDoc.username,
        email: userDoc.email,
        phoneNumber: userDoc.phoneNumber,
        address: userDoc.address,
        role: userDoc.role,
        partyId: userDoc.partyId ? userDoc.partyId.toString() : undefined,
        profilePhoto: userDoc.profilePhoto,
        createdAt: userDoc.createdAt,
        updatedAt: userDoc.updatedAt,
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

    // Re-set the auth-token cookie to keep it alive — this prevents the cookie from expiring
    // while localStorage still holds a valid token, which would cause middleware to log the user out.
    if (remainingSeconds > 0) {
      const token = request.headers.get('authorization')!.substring(7);
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: remainingSeconds,
        path: '/',
      });
    }

    return response;

  } catch (error) {
    // Only return 401 for actual authentication failures
    // For other errors (network, database), return 503 (Service Unavailable)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a database/connection error
    if (
      errorMessage.includes('database') || 
      errorMessage.includes('connection') || 
      errorMessage.includes('MongoDB') ||
      errorMessage.includes('buffering') ||
      errorMessage.includes('Mongoose')
    ) {
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
