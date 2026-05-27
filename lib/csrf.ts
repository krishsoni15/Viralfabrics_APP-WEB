/**
 * CSRF Protection Middleware
 */

import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const CSRF_SECRET = new TextEncoder().encode(
  process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-change-in-production'
);

/**
 * Generate CSRF token
 */
export async function generateCSRFToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(CSRF_SECRET);
}

/**
 * Validate CSRF token
 */
export async function validateCSRFToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, CSRF_SECRET);
    return true;
  } catch {
    return false;
  }
}

/**
 * CSRF middleware for state-changing operations
 */
export async function csrfMiddleware(req: NextRequest): Promise<Response | null> {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken || !(await validateCSRFToken(csrfToken))) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid CSRF token' 
        }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  return null;
}

