/**
 * Socket.IO Server Setup
 * Singleton instance for managing Socket.IO connections
 */

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || '*'
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket.IO client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`❌ Socket.IO client disconnected: ${socket.id}`);
    });

    // Send connection confirmation
    socket.emit('connected', {
      type: 'connected',
      timestamp: new Date().toISOString(),
      socketId: socket.id,
    });
  });

  console.log('🚀 Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO server instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit logout-all event to all connected clients
 */
export function emitLogoutAll(): void {
  if (!io) {
    console.warn('⚠️ Socket.IO server not initialized, cannot emit logout-all');
    return;
  }

  const event = {
    type: 'logout_all',
    timestamp: new Date().toISOString(),
  };

  const connectedClients = io.sockets.sockets.size;
  console.log(`📢 Emitting logout-all event to ${connectedClients} Socket.IO clients...`);

  io.emit('logout_all', event);
  console.log(`✅ Logout-all event emitted to ${connectedClients} clients via Socket.IO`);
}

/**
 * Get count of connected clients
 */
export function getConnectedClientsCount(): number {
  if (!io) {
    return 0;
  }
  return io.sockets.sockets.size;
}

