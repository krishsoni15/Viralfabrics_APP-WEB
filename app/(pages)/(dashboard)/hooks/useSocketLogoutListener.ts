'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketConnectedRef = useRef(false);
  const lastCheckedTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    // Only connect if we have a token (user is logged in)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return;
    }

    // Polling fallback function (for Vercel/serverless where Socket.IO doesn't work)
    const startPolling = () => {
      // ⚡ OPTIMIZATION: Poll every 10 seconds instead of 2 seconds (reduces load by 80%)
      // Also add request deduplication to prevent multiple simultaneous requests
      let isPolling = false;
      
      pollingIntervalRef.current = setInterval(async () => {
        // Prevent duplicate requests
        if (isPolling) {
          return;
        }
        
        isPolling = true;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch('/api/auth/logout-all-status', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store',
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            
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
      }, 10000); // ⚡ OPTIMIZATION: Poll every 10 seconds (was 2 seconds)
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
          console.log('✅ Socket.IO connected:', socket.id);
          reconnectAttemptsRef.current = 0;
          socketConnectedRef.current = true;
          
          // Stop polling when Socket.IO connects
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        });

        // Handle connection confirmation
        socket.on('connected', (data) => {
          console.log('✅ Socket.IO connection confirmed:', data);
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
          
          // Trigger logout callback with event data (will show modal first)
          onLogout(data);
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
          console.log('❌ Socket.IO disconnected:', reason);
          
          // Only attempt reconnection if it wasn't intentional
          if (reason === 'io server disconnect') {
            // Server disconnected, don't reconnect
            return;
          }
          
          if (reason === 'io client disconnect') {
            // Client disconnected, don't reconnect
            return;
          }

          // Attempt reconnection
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.warn('⚠️ Max reconnect attempts reached for Socket.IO, stopping...');
            socket.disconnect();
            socketRef.current = null;
          } else {
            console.log(`🔄 Socket.IO reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          }
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
          console.error('❌ Socket.IO connection error:', error);
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.warn('⚠️ Max connection attempts reached for Socket.IO, falling back to polling...');
            socket.disconnect();
            socketRef.current = null;
            socketConnectedRef.current = false;
            
            // Start polling as fallback when Socket.IO fails
            if (!pollingIntervalRef.current) {
              console.log('🔄 Starting polling fallback for logout-all detection...');
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

    // Try Socket.IO first, with polling as fallback
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [onLogout]);
}

