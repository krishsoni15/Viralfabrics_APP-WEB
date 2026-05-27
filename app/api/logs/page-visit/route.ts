import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import Log, { ILogModel } from '@/models/Log';
import dbConnect from '@/lib/dbConnect';

export async function POST(request: NextRequest) {
  try {
    // Ensure database connection is established
    await dbConnect();
    
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let pathname = '/dashboard'; // Default pathname
    
    // Check if request has content
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await request.json();
        if (body && body.pathname) {
          pathname = body.pathname;
        }
      } catch (error) {
        // Silently continue with default pathname for malformed JSON
        }
    }

    // Determine the resource type based on the pathname
    let resource = 'dashboard';
    let resourceId = undefined;
    let details = { pathname };

    if (pathname.startsWith('/orders')) {
      resource = 'order';
      if (pathname.includes('/')) {
        const parts = pathname.split('/');
        if (parts.length > 2) {
          resourceId = parts[2]; // Extract order ID if present
        }
      }
    } else if (pathname.startsWith('/users')) {
      resource = 'user';
      if (pathname.includes('/')) {
        const parts = pathname.split('/');
        if (parts.length > 2) {
          resourceId = parts[2]; // Extract user ID if present
        }
      }
    } else if (pathname.startsWith('/labs')) {
      resource = 'lab';
      if (pathname.includes('/')) {
        const parts = pathname.split('/');
        if (parts.length > 2) {
          resourceId = parts[2]; // Extract lab ID if present
        }
      }
    } else if (pathname.startsWith('/logs')) {
      resource = 'log';
    } else if (pathname === '/dashboard') {
      resource = 'dashboard';
    }

    // Log the page visit
    await (Log as ILogModel).logUserAction({
      userId: session.id,
      username: session.username || session.name,
      userRole: session.role,
      action: 'view',
      resource,
      resourceId,
      details,
      success: true,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({ success: true, message: 'Page visit logged' });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
