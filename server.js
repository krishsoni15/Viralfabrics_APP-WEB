/**
 * Custom Next.js Server with Socket.IO Support
 * This file enables Socket.IO real-time communication
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    path: '/api/socket.io',
    addTrailingSlash: false,
    cors: {
      origin: dev ? '*' : process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Store io instance globally for use in API routes
  global.io = io;

  io.on('connection', (socket) => {
    console.log(`✅ Socket.IO client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Send connection confirmation immediately
    socket.emit('connected', {
      type: 'connected',
      timestamp: new Date().toISOString(),
      socketId: socket.id,
    });

    // Handle any errors
    socket.on('error', (error) => {
      console.error(`❌ Socket.IO error for ${socket.id}:`, error);
    });
  });

  // Log when Socket.IO is ready
  io.engine.on('connection_error', (err) => {
    console.error('❌ Socket.IO connection error:', err);
  });

  httpServer
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, '0.0.0.0', () => {
      console.log(`🚀 Ready on http://${hostname}:${port}`);
      console.log(`🔌 Socket.IO server initialized on /api/socket.io`);
    });
});

