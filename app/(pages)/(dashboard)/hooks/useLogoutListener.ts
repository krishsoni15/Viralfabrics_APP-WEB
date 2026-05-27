'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook to listen for real-time logout events via Server-Sent Events (SSE)
 * When super admin logs out all users, this hook will immediately trigger logout
 */
export function useLogoutListener(onLogout: () => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  useEffect(() => {
    // Only connect if we have a token (user is logged in)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return;
    }

    const connect = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        // Create EventSource connection to SSE endpoint
        // Note: EventSource uses cookies automatically, but we need to ensure credentials are sent
        // For cross-origin requests, we'd need withCredentials, but for same-origin, cookies are sent automatically
        const eventSource = new EventSource('/api/auth/logout-events', {
          // EventSource doesn't support withCredentials option, but same-origin requests
          // automatically include cookies, so this should work
        });

        eventSourceRef.current = eventSource;

        // Handle all message events (including logout_all)
        eventSource.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'logout_all') {
              console.log('🚨 Logout-all event received, logging out immediately...', data);
              // Close the connection immediately
              if (eventSource.readyState !== EventSource.CLOSED) {
                eventSource.close();
              }
              // Trigger logout
              onLogout();
            } else if (data.type === 'connected') {
              console.log('✅ Logout listener connected to server');
              reconnectAttemptsRef.current = 0;
            } else if (data.type === 'keepalive') {
              // Reset reconnect attempts on keepalive
              reconnectAttemptsRef.current = 0;
            }
          } catch (error) {
            console.error('Error parsing logout event:', error, event.data);
          }
        });

        // Handle connection open
        eventSource.onopen = () => {
          console.log('✅ Logout event listener connected (onopen)');
          reconnectAttemptsRef.current = 0;
        };

        // Handle connection errors
        // Note: EventSource automatically reconnects on error, but we track attempts
        eventSource.onerror = (error) => {
          // EventSource will automatically try to reconnect
          // We just track attempts to prevent infinite reconnection
          if (eventSource.readyState === EventSource.CLOSED) {
            reconnectAttemptsRef.current++;
            if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
              console.warn('⚠️ Max reconnect attempts reached for logout listener, stopping...');
              eventSource.close();
              eventSourceRef.current = null;
            } else {
              console.log(`🔄 Logout listener reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
            }
          }
        };
      } catch (error) {
        console.error('Error creating logout event listener:', error);
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [onLogout]);
}

