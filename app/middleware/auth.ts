import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';

/**
 * Middleware to require authentication
 * Throws UnauthorizedError if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<void> {
  const session = await getSession(req);
  if (!session) {
    throw new UnauthorizedError('Authentication required');
  }
}

/**
 * Middleware to require superadmin role
 * Throws ForbiddenError if not superadmin
 */
export async function requireSuperAdmin(req: NextRequest): Promise<void> {
  await requireAuth(req);
  const session = await getSession(req);
  
  if (session?.role !== 'superadmin') {
    throw new ForbiddenError('Superadmin access required');
  }
}

/**
 * Helper to get authenticated user from request
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    throw new UnauthorizedError('Authentication required');
  }
  return session;
}

