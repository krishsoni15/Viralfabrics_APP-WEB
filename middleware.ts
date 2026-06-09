import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * JWT Payload interface for type safety
 */
interface JWTPayload {
  id: string;
  role: 'master' | 'superadmin' | 'admin' | 'user' | 'party';
  username: string;
  name?: string;
  iat?: number;
  exp?: number;
  loginTime?: number;
}

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/health',
  '/login',
  '/_next',
  '/icons',
  '/manifest.json',
  '/sw.js',
  '/browserconfig.xml',
  '/favicon.ico',
];

/**
 * Routes that require superadmin role
 */
const SUPERADMIN_ROUTES = [
  '/api/users',
  '/api/logs',
  '/api/orders/delete-all',
  '/api/orders/renumber-ids',
  '/api/orders/reset-counter',
  '/api/backup',
  '/fabrics',
  '/api/fabrics',
  // Sampling is accessible to all authenticated users
  // '/sampling',
  // '/api/sampling',
];

/**
 * Check if a path matches any of the given routes
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => {
    if (route.endsWith('/')) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
}

/**
 * Validate JWT payload structure
 */
function isValidPayload(payload: unknown): payload is JWTPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'role' in payload &&
    typeof (payload as JWTPayload).id === 'string' &&
    typeof (payload as JWTPayload).role === 'string'
  );
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Check request body size limit
  const { checkBodySizeLimit } = await import('@/lib/bodySizeLimit');
  const sizeLimitError = checkBodySizeLimit(req);
  if (sizeLimitError) {
    return sizeLimitError;
  }

  // Skip public routes
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Handle CORS preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Only apply auth check to API routes and protected pages
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/orders') && !pathname.startsWith('/fabrics') &&
    !pathname.startsWith('/users') && !pathname.startsWith('/logs') &&
    !pathname.startsWith('/access-denied')) {
    return NextResponse.next();
  }

  // Get token from Authorization header or cookies
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get('auth-token')?.value;
  const token = authHeader?.split(" ")[1] || cookieToken;

  // Check for token presence
  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: "Unauthorized - No token provided", timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }
    // For pages, redirect to login (but not if already on login to prevent loops)
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', req.url);
      // Add a query param to prevent redirect loops
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Already on login page, allow it
    return NextResponse.next();
  }

  // Verify JWT
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return NextResponse.json(
      { success: false, message: "Server configuration error", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);

    // Validate payload structure
    if (!isValidPayload(payload)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, message: "Invalid token structure", timestamp: new Date().toISOString() },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Check superadmin routes
    if (matchesRoute(pathname, SUPERADMIN_ROUTES)) {
      if (payload.role !== "superadmin" && payload.role !== "master") {
        // For API routes, return 403 JSON
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { success: false, message: "Access denied - Superadmin required", timestamp: new Date().toISOString() },
            { status: 403 }
          );
        }
        // For page routes, redirect to access denied
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // Add user info to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.id);
    response.headers.set('x-user-role', payload.role);
    response.headers.set('x-user-username', payload.username || '');

    // Add loginTime header for logout-all checking in API routes
    if (payload.loginTime) {
      response.headers.set('x-login-time', String(payload.loginTime));
    } else if (payload.iat) {
      response.headers.set('x-login-time', String(payload.iat));
    }

    return response;

  } catch (error) {
    // Token verification failed
    const errorMessage = error instanceof Error ? error.message : 'Token verification failed';

    // Check if token is expired
    if (errorMessage.includes('exp claim') || errorMessage.includes('expired')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, message: "Token expired", timestamp: new Date().toISOString() },
          { status: 401 }
        );
      }
      if (pathname !== '/login') {
        return NextResponse.redirect(new URL('/login?reason=expired', req.url));
      }
      // Already on login, allow it
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: "Invalid token", timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }
    // For pages, redirect to login (but not if already on login)
    if (pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    // Already on login, allow it
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|browserconfig.xml).*)',
  ],
};
