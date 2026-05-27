import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { logoutEventEmitter } from '@/lib/logoutEventEmitter';

/**
 * Server-Sent Events (SSE) endpoint for real-time logout notifications
 * Clients connect to this endpoint to receive immediate logout notifications
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getSession(request);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const encoder = new TextEncoder();
        let isClosed = false;
        
        const sendEvent = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch (error) {
              console.error('Error enqueueing SSE data:', error);
              isClosed = true;
            }
          }
        };

        // Send initial connection confirmation
        sendEvent(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

        // Send keepalive comment every 30 seconds to keep connection alive
        const keepAliveInterval = setInterval(() => {
          if (!isClosed) {
            try {
              sendEvent(JSON.stringify({ type: 'keepalive', timestamp: new Date().toISOString() }));
            } catch (error) {
              clearInterval(keepAliveInterval);
              isClosed = true;
            }
          } else {
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Subscribe to logout events
        const unsubscribe = logoutEventEmitter.subscribe((event) => {
          if (!isClosed) {
            try {
              console.log(`📤 Sending logout event to client: ${session.username || session.id}`);
              // Send as 'message' event type (default for EventSource)
              sendEvent(JSON.stringify(event));
              console.log(`✅ Logout event sent to client: ${session.username || session.id}`);
            } catch (error) {
              console.error(`❌ Error sending logout event to ${session.username || session.id}:`, error);
              isClosed = true;
              unsubscribe();
              clearInterval(keepAliveInterval);
              try {
                controller.close();
              } catch (e) {
                // Ignore close errors
              }
            }
          }
        });
        
        // Log connection
        const listenerCount = logoutEventEmitter.getListenerCount();
        console.log(`✅ SSE connection established for user: ${session.username || session.id} (Total connections: ${listenerCount})`);

        // Handle client disconnect
        const abortHandler = () => {
          isClosed = true;
          unsubscribe();
          clearInterval(keepAliveInterval);
          try {
            controller.close();
          } catch (e) {
            // Ignore close errors
          }
        };

        request.signal.addEventListener('abort', abortHandler);
      }
    });

    // Return SSE response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': '*', // Allow CORS if needed
      },
    });
  } catch (error: any) {
    console.error('SSE endpoint error:', error);
    return new Response(JSON.stringify({ error: 'Failed to establish SSE connection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

