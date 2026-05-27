import { NextResponse } from 'next/server';

// HTTP response helpers for consistent API responses
export const httpHelpers = {
  ok: (data: any) => NextResponse.json({ success: true, data }),
  
  created: (data: any) => NextResponse.json({ success: true, data }, { status: 201 }),
  
  badRequest: (message: string) => NextResponse.json(
    { success: false, error: message },
    { status: 400 }
  ),
  
  notFound: (message: string) => NextResponse.json(
    { success: false, error: message },
    { status: 404 }
  ),
  
  conflict: (message: string) => NextResponse.json(
    { success: false, error: message },
    { status: 409 }
  ),
  
  serverError: (error: any) => NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  ),
  
  unauthorized: (message: string = 'Unauthorized') => NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  )
};

export const { ok, created, badRequest, notFound, conflict, serverError, unauthorized } = httpHelpers;
