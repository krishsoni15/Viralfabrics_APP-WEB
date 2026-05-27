/**
 * Request Body Size Limit Middleware
 */

import { NextRequest } from 'next/server';

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Check request body size and return error if exceeded
 */
export function checkBodySizeLimit(req: NextRequest): Response | null {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_BODY_SIZE) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Request body too large',
            maxSize: `${MAX_BODY_SIZE / 1024 / 1024}MB`,
          }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  }
  return null;
}

