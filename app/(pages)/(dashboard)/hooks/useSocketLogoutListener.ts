'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Singleton pattern variables to prevent duplicate socket connections and intervals
let activeSocketHooks = 0;
let globalSocket: Socket | null = null;
let globalPollingInterval: any = null;
let globalLogoutCallback: ((data?: any) => void) | null = null;

/**
 * Hook to listen for real-time logout events via Socket.IO
 * When super admin logs out all users, this hook will immediately trigger logout
 */
export function useSocketLogoutListener(onLogout: (data?: {
  type: string;
  timestamp: string;
  triggeredBy?: string;
  triggeredById?: string;
  message?: string;
}) => void) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  const pollingIntervalRef = useRef<any>(null);
  const socketConnectedRef = useRef(false);
  const lastCheckedTimestampRef = useRef<string | null>(null);

  // Keep the global callback updated with the latest function reference
  useEffect(() => {
    globalLogoutCallback = onLogout;
  }, [onLogout]);

  useEffect(() => {
    // Only connect if we have a token (user is logged in)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return;
    }

    activeSocketHooks++;

    // Only set up connections if this is the FIRST hook instance
    if (activeSocketHooks > 1) {
      // Just return cleanup for subsequent hooks
      return () => {
        activeSocketHooks--;
      };
    }

    // Polling fallback function (for Vercel/serverless where Socket.IO doesn't work)
    // Only polls for logout-all status — data-change auto-refresh has been intentionally removed
    // to prevent unwanted page reloads when new deployments are pushed.
    const startPolling = () => {
      let isPolling = false;

      pollingIntervalRef.current = setInterval(async () => {
        // Prevent duplicate requests
        if (isPolling) {
          return;
        }

        isPolling = true;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

          const logoutRes = await fetch('/api/auth/logout-all-status', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store',
            signal: controller.signal
          }).catch(err => {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Logout check error:', err);
            }
            return null;
          });

          clearTimeout(timeoutId);

          // Process logout status
          if (logoutRes && logoutRes.ok) {
            const data = await logoutRes.json();

            if (data.shouldLogout && data.logoutAllTimestamp) {
              // Only trigger if this is a new logout-all (timestamp changed)
              if (lastCheckedTimestampRef.current !== data.logoutAllTimestamp) {
                lastCheckedTimestampRef.current = data.logoutAllTimestamp;

                // Clear polling
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }

                // Trigger logout with data
                onLogout({
                  type: 'logout_all',
                  timestamp: data.logoutAllTimestamp,
                  triggeredBy: data.triggeredBy || 'Super Admin',
                  message: 'Logout all detected via polling'
                });
              }
            }
          }
        } catch (error) {
          // Ignore polling errors - continue polling
          if (error instanceof Error && error.name !== 'AbortError') {
            console.warn('Polling error (non-critical):', error);
          }
        } finally {
          isPolling = false;
        }
      }, 8000); // Poll every 8 seconds

      globalPollingInterval = pollingIntervalRef.current;
    };

    const connect = () => {
      // Close existing connection if any
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }

      try {
        // Create Socket.IO connection with optimized settings for immediate logout
        const socket = io(window.location.origin, {
          path: '/api/socket.io',
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: reconnectDelay,
          reconnectionAttempts: maxReconnectAttempts,
          timeout: 10000, // Faster timeout
          forceNew: false, // Reuse connection if available
          upgrade: true, // Allow transport upgrades
          rememberUpgrade: true,
          auth: {
            token: token,
          },
        });

        socketRef.current = socket;

        // Handle connection
        socket.on('connect', () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Socket.IO connected:', socket.id);
          }
          reconnectAttemptsRef.current = 0;
          socketConnectedRef.current = true;
          
          // Stop polling when Socket.IO connects
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        });

        // Handle connection confirmation
        socket.on('connected', () => {
          reconnectAttemptsRef.current = 0;
        });

        // Handle logout-all event - Show modal with info, then logout on OK click
        socket.on('logout_all', (data: {
          type: string;
          timestamp: string;
          triggeredBy?: string;
          triggeredById?: string;
          message?: string;
        }) => {
          console.log('🚨 Logout-all event received via Socket.IO...', data);
          
          // Disconnect socket immediately (this prevents reconnection)
          socket.disconnect();
          
          // Clear the socket reference to prevent reconnection attempts
          socketRef.current = null;
          globalSocket = null;
          
          // Trigger logout callback with event data using the latest global callback
          if (globalLogoutCallback) {
            globalLogoutCallback(data);
          } else {
            onLogout(data);
          }
        });

        // 🚫 data_changed Socket.IO handler intentionally removed.
        // Auto-refreshing page data when server-side changes are detected caused unwanted
        // reloads whenever a new deployment was pushed. Data is fetched fresh on user
        // navigation and explicit refreshes — no silent background reload needed.

        // Handle disconnection
        socket.on('disconnect', (reason) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Socket.IO disconnected:', reason);
          }
          
          // Only attempt reconnection if it wasn't intentional
          if (reason === 'io server disconnect' || reason === 'io client disconnect') {
            return;
          }

          // Attempt reconnection
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            socket.disconnect();
            socketRef.current = null;
          }
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
          // Only log in development - on Vercel/production these are expected
          if (process.env.NODE_ENV === 'development') {
            console.warn('Socket.IO connection error (expected on serverless):', error.message);
          }
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            socket.disconnect();
            socketRef.current = null;
            socketConnectedRef.current = false;
            
            // Start polling as fallback when Socket.IO fails
            if (!pollingIntervalRef.current) {
              startPolling();
            }
          }
        });
      } catch (error) {
        console.error('Error creating Socket.IO connection:', error);
        // Start polling as fallback
        if (!pollingIntervalRef.current) {
          console.log('🔄 Starting polling fallback for logout-all detection...');
          startPolling();
        }
      }
    };

    // ⚡ VERCEL DETECTION: Vercel serverless doesn't support persistent WebSocket connections.
    // Skip Socket.IO on Vercel and go straight to polling (which works everywhere).
    const isVercel = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('vercel.com') ||
      process.env.NEXT_PUBLIC_VERCEL === '1'
    );

    if (isVercel) {
      // On Vercel: skip Socket.IO entirely, use polling directly
      startPolling();
      return;
    }

    // Try Socket.IO first (works on self-hosted server with server.js), with polling as fallback
    connect();
    
    // ⚡ OPTIMIZATION: Wait longer before starting polling (Socket.IO usually connects quickly)
    // This prevents unnecessary polling when Socket.IO is available
    setTimeout(() => {
      if (!socketConnectedRef.current && !pollingIntervalRef.current) {
        console.log('🔄 Socket.IO not connected, starting polling fallback...');
        startPolling();
      }
    }, 10000); // ⚡ OPTIMIZATION: Wait 10 seconds (was 5) - Socket.IO usually connects in 1-2 seconds

    // Cleanup on unmount
    return () => {
      activeSocketHooks--;

      // Only actually disconnect and clear intervals if this was the LAST hook instance
      if (activeSocketHooks === 0) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (globalPollingInterval) {
          clearInterval(globalPollingInterval);
          globalPollingInterval = null;
        }
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        if (globalSocket) {
          globalSocket.disconnect();
          globalSocket = null;
        }
        globalLogoutCallback = null;
      }
    };
  }, []); // Remove onLogout from dependency array to prevent re-running connection logic
}

