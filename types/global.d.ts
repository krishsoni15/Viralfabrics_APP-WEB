/**
 * Global type definitions for Socket.IO server instance
 */

import { Server as SocketIOServer } from 'socket.io';

declare global {
  var io: SocketIOServer | undefined;
}

export {};

