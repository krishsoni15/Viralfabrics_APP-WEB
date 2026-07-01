import mongoose, { type Mongoose } from "mongoose";
import SystemConfig from "../models/SystemConfig";

// 🌟 100% Risk-Free Global Database Watcher
// This plugin automatically tells the frontend when data changes, without touching any API files.
mongoose.plugin((schema) => {
  const emitChange = function (this: any) {
    try {
      const modelName = this.constructor?.modelName || this.model?.modelName || 'unknown';
      
      // ⚡ CRITICAL FIX: Only emit for actual business data!
      // If we emit for 'Log' or 'User' (which save on every API call), it creates an infinite refresh loop!
      const whitelistedModels = [
        'Order', 'Party', 'Mill', 'Quality', 'GreyMaterial', 
        'Dispatch', 'Fabric', 'GreyInfo', 'MillOutput', 'Process', 
        'Sample', 'Sampling', 'FinishLotStock', 'Lab'
      ];

      if (whitelistedModels.includes(modelName)) {
        // 1. Broadcast the tiny empty ping to all connected Socket.IO clients (for local / custom server)
        if ((global as any).io) {
          (global as any).io.emit('data_changed', { module: modelName });
        }

        // 2. Write to MongoDB SystemConfig so serverless environments (Vercel) can poll and detect updates
        try {
          SystemConfig.findOneAndUpdate(
            { key: 'last_data_change' },
            { 
              key: 'last_data_change',
              value: {
                module: modelName,
                timestamp: new Date().toISOString()
              }
            },
            { upsert: true, new: true }
          ).maxTimeMS(2000).catch((err) => {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Real-time sync last_data_change write failed (non-critical):', err);
            }
          });
        } catch (dbErr) {
          // Silent catch to guarantee main DB operations never fail
        }
      }
    } catch (error) {
      // Strict try/catch ensures database saves NEVER fail even if Socket or SystemConfig is down
      if (process.env.NODE_ENV === 'development') {
        console.warn('Real-time sync silent failure:', error);
      }
    }
  };

  // Watch every possible database mutation
  schema.post('save', emitChange);
  schema.post('findOneAndUpdate', emitChange);
  schema.post('findOneAndDelete', emitChange);
  schema.post('updateOne', emitChange);
  schema.post('updateMany', emitChange);
  schema.post('deleteOne', emitChange);
  schema.post('deleteMany', emitChange);
  schema.post('insertMany', emitChange);
});

// Connection pool monitoring
let poolMonitoringInterval: any = null;

function startPoolMonitoring() {
  if (poolMonitoringInterval) return;
  
  poolMonitoringInterval = setInterval(() => {
    if (mongoose.connection.readyState === 1) {
      const client = mongoose.connection.getClient();
      const poolSize = (client as any)?.topology?.s?.pool?.totalConnectionCount || 0;
      const maxPoolSize = (client as any)?.options?.maxPoolSize || 10;
      const activeConnections = (client as any)?.topology?.s?.pool?.availableConnectionCount || 0;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`MongoDB pool: ${poolSize}/${maxPoolSize} connections (${activeConnections} active)`);
      }
      
      // Log warning if pool is near capacity
      if (poolSize > maxPoolSize * 0.8) {
        console.warn(`MongoDB connection pool is ${Math.round((poolSize / maxPoolSize) * 100)}% full`);
      }
    }
  }, 60000); // Check every minute
}

// Get MONGODB_URI from environment - check at runtime, not module load time
function getMongoDBUri(): string {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    // Verbose diagnostics are dev-only to avoid fingerprinting env var names in production logs.
    if (process.env.NODE_ENV !== 'production') {
      const relatedKeys = Object.keys(process.env).filter(key =>
        key.includes('MONGO') ||
        key.includes('JWT') ||
        key.includes('NODE') ||
        key.includes('AMPLIFY') ||
        key.includes('AWS')
      );
      console.error('MONGODB_URI is not set. Related env vars found:', relatedKeys.length ? relatedKeys : '(none)');
      if (process.env.mongodb_uri) {
        console.error('Found lowercase "mongodb_uri" instead — env var names are case-sensitive.');
      }
    }

    const errorMessage = process.env.NODE_ENV === 'production'
      ? "MONGODB_URI environment variable is not configured. Please set it in AWS Amplify → App settings → Environment variables, then redeploy."
      : "Please add MONGODB_URI to .env file";

    throw new Error(errorMessage);
  }
  
  // Ensure database name is included in the URI
  let uri = MONGODB_URI;
  
  // ⚡ FIX: Handle SSL/TLS configuration properly
  // MongoDB Atlas (mongodb.net or mongodb+srv://) already has TLS configured correctly
  // Don't modify Atlas connection strings - they're already correct
  const isAtlas = uri.includes('mongodb.net') || uri.includes('mongodb+srv://');
  
  if (!isAtlas) {
    // For non-Atlas MongoDB, ensure TLS is configured if needed
    // Only add if not already present
    if (!uri.includes('tls=') && !uri.includes('ssl=') && !uri.includes('ssl=true') && !uri.includes('tls=true')) {
      if (uri.includes('?')) {
        uri = uri + '&tls=true';
      } else {
        uri = uri + '?tls=true';
      }
    }
  }
  // For Atlas, don't modify the URI - it's already correctly configured
  
  // Check if database name is missing (URI ends with /? or just ? or @)
  const hasDatabaseName = uri.match(/@[^/]+\/([^?]+)/);
  const hasQueryParams = uri.includes('?');
  
  if (!hasDatabaseName) {
    // Database name is missing - add it
    console.warn('MongoDB URI is missing database name. Auto-adding /CRM_AdminPanel');
    
    if (uri.includes('/?')) {
      // Replace /? with /CRM_AdminPanel?
      uri = uri.replace('/?', '/CRM_AdminPanel?');
    } else if (uri.includes('?')) {
      // Insert /CRM_AdminPanel before ?
      uri = uri.replace('?', '/CRM_AdminPanel?');
    } else if (uri.endsWith('/')) {
      // URI ends with /, add database name
      uri = uri + 'CRM_AdminPanel';
    } else if (uri.includes('@') && !uri.split('@')[1].includes('/')) {
      // No slash after @, add /database
      uri = uri.replace('@', '@/CRM_AdminPanel');
    } else {
      // Add database name before any existing path
      uri = uri + '/CRM_AdminPanel';
    }
    
    // Ensure retryWrites and w=majority are in query params
    if (hasQueryParams && !uri.includes('retryWrites=true')) {
      uri = uri.includes('?') 
        ? uri + '&retryWrites=true&w=majority'
        : uri + '?retryWrites=true&w=majority';
    } else if (!hasQueryParams) {
      uri = uri + '?retryWrites=true&w=majority';
    }
    
    console.log('Fixed MongoDB URI (database name added)');
  }
  
  return uri;
}

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const globalWithCache = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached: MongooseCache =
  globalWithCache.mongooseCache ??
  (globalWithCache.mongooseCache = { conn: null, promise: null });

// Track connection health
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export default async function dbConnect(): Promise<Mongoose> {
  const now = Date.now();
  
  // If we have a cached connection, check if it's still valid
  if (cached.conn) {
    // Only ping if health check interval has passed
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
      return cached.conn;
    }
    
    try {
      // Test the connection
      if (cached.conn.connection.db) {
        await cached.conn.connection.db.admin().ping();
        lastHealthCheck = now;
        return cached.conn;
      }
    } catch (error) {
      // Cached connection is invalid, creating new connection...
      cached.conn = null;
      cached.promise = null;
    }
  }

  // If we don't have a connection promise, create one
  if (!cached.promise) {
    // Get MongoDB URI at runtime (will throw if not set)
    const MONGODB_URI = getMongoDBUri();
    
    // ⚡ FIX: Detect if this is MongoDB Atlas (which handles TLS automatically)
    const isAtlas = MONGODB_URI.includes('mongodb.net') || MONGODB_URI.includes('mongodb+srv://');
    
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false, // Disable buffering for faster responses
      maxPoolSize: 5, // Connection pool size (Reduced to prevent M0 limit issues)
      minPoolSize: 0, // Don't hold idle connections open on every instance (M0 has a hard 500-connection cap)
      serverSelectionTimeoutMS: 5000, // Timeout for server selection (fail faster instead of hanging ~30s under connection pressure)
      socketTimeoutMS: 45000, // Socket timeout
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true, // Enable retries for reliability
      retryReads: true, // Enable retries for reliability
      connectTimeoutMS: 5000, // Connection timeout (fail faster instead of hanging ~30s under connection pressure)
      maxIdleTimeMS: 30000, // Max idle time for connections
      heartbeatFrequencyMS: 10000, // Heartbeat frequency
      maxConnecting: 5, // Max concurrent connection attempts
      directConnection: false, // Use connection pooling
      compressors: ['zlib'] as ('zlib' | 'none' | 'snappy' | 'zstd')[], // Enable compression
      // ⚡ FIX: TLS configuration - only set if not Atlas (Atlas handles TLS automatically)
      // For Atlas, don't override TLS settings - let the connection string handle it
      ...(isAtlas ? {} : {
        tls: true, // Enable TLS for non-Atlas connections
        tlsAllowInvalidCertificates: false, // Validate certificates
        tlsAllowInvalidHostnames: false, // Validate hostnames
      }),
    };

    cached.promise = connectWithRetry(MONGODB_URI, opts, 2);
  }

  try {
    cached.conn = await cached.promise;
    lastHealthCheck = now;
    
    // Start pool monitoring after first connection
    startPoolMonitoring();
    
    // Set up connection event handlers
    mongoose.connection.on('connected', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('MongoDB connected');
      }
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    
    return cached.conn;
  } catch (error) {
    // Reset the promise if connection fails
    cached.promise = null;
    
    // Log the specific error for debugging
    console.error('Database connection failed:', error);
    
    throw error;
  }
}

/**
 * Connect to MongoDB with exponential backoff retry
 */
async function connectWithRetry(
  uri: string,
  opts: mongoose.ConnectOptions,
  maxRetries: number
): Promise<Mongoose> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, opts);
      if (attempt > 1) {
        console.warn(`MongoDB connected on attempt ${attempt}`);
      }
      return conn;
    } catch (error) {
      lastError = error as Error;
      console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, (error as Error).message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc. (max 10s)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to connect to MongoDB');
}

// Export a function to check if we're in offline mode
export function isOfflineMode(): boolean {
  return process.env.OFFLINE_MODE === 'true';
}

// Export a function to get mock data for offline development
export function getMockData() {
  return {
    users: [
      {
        _id: 'mock-user-1',
        username: 'admin',
        name: 'Admin User',
        role: 'admin',
        phoneNumber: '+1234567890',
        address: '123 Main St',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    orders: [],
    fabrics: [],
    parties: []
  };
}