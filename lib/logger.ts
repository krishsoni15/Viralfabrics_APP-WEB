/**
 * Structured logging utility for the application
 * Replaces console.error with proper logging that can be extended for production
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  error?: Error;
  context?: Record<string, unknown>;
  timestamp: string;
}

class Logger {
  private logQueue: LogEntry[] = [];
  private batchSize = 10;
  private flushInterval = 1000; // 1 second
  private flushTimer: any = null;

  constructor() {
    this.startBatchProcessor();
  }

  /**
   * Cross-platform immediate execution (works in both Node.js and browser)
   * Uses setImmediate in Node.js, setTimeout(0) in browser
   */
  private nextTick(callback: () => void): void {
    if (typeof setImmediate !== 'undefined') {
      // Node.js environment
      setImmediate(callback);
    } else {
      // Browser environment - use setTimeout with 0 delay
      setTimeout(callback, 0);
    }
  }

  private startBatchProcessor() {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  private async flushLogs() {
    if (this.logQueue.length === 0) return;

    const batch = this.logQueue.splice(0, this.batchSize);
    
    // Process in background (non-blocking)
    this.nextTick(async () => {
      for (const entry of batch) {
        await this.writeLog(entry);
      }
    });
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    // In development, log to console with formatting
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
      if (entry.error) {
        console.error(prefix, entry.message, entry.error, entry.context || '');
      } else {
        console[entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log'](prefix, entry.message, entry.context || '');
      }
    }
    
    // In production, you can extend this to send to a logging service
    // Example: await sendToLoggingService(entry);
    
    // For now, still log errors in production (can be replaced with external service)
    if (entry.level === 'error' && process.env.NODE_ENV === 'production') {
      // In production, you might want to send to Sentry, LogRocket, etc.
      // For now, we'll still use console.error but in a structured way
      console.error(JSON.stringify(entry));
    }
  }

  private formatMessage(level: LogLevel, message: string, error?: Error, context?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as Error : undefined,
      context,
      timestamp: new Date().toISOString()
    };
  }

  private log(level: LogLevel, message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = this.formatMessage(level, message, error, context);
    
    // Add to queue (non-blocking)
    this.logQueue.push(entry);
    
    // Immediate flush for errors (high priority)
    if (level === 'error') {
      this.nextTick(() => this.flushLogs());
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, error, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, undefined, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, undefined, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, undefined, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogLevel, LogEntry };

// Convenience functions for common logging patterns

/**
 * Log an error
 */
export function logError(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
  // Convert unknown error to Error if needed
  const errorObj = error instanceof Error ? error : (error ? new Error(String(error)) : undefined);
  logger.error(message, errorObj, context);
}

/**
 * Log a creation event
 */
export async function logCreate(
  type: string,
  id: string,
  data: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const context: Record<string, unknown> = {
    type,
    id,
    data,
    action: 'create'
  };
  
  let ipAddress, userAgent;
  if (request) {
    ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    userAgent = request.headers.get('user-agent') || 'unknown';
    context.clientId = ipAddress;
  }
  
  logger.info(`Created ${type}: ${id}`, context);

  try {
    const { default: dbConnect } = await import('@/lib/dbConnect');
    const { getSession } = await import('@/lib/session');
    const { default: Log } = await import('@/models/Log');
    
    await dbConnect();
    
    let user = { id: 'system', name: 'System', username: 'System', role: 'system' };
    if (request && typeof request.headers?.get === 'function') {
      try {
        const session = await getSession(request as any);
        if (session) user = { ...user, ...session };
      } catch (e) {}
    }

    // Attempt to extract orderId if present
    const orderId = data.orderId || data.orderObjectId || undefined;

    await (Log as any).logUserAction({
      userId: user.id,
      username: user.username || user.name || 'System',
      userRole: user.role,
      action: `${type}_create`,
      resource: type,
      resourceId: id,
      details: { newValues: data, orderId },
      ipAddress,
      userAgent,
      severity: 'info'
    });
  } catch (error) {
    logger.error(`Failed to save DB log for create ${type}`, error as Error);
  }
}


/**
 * Log an order change event
 */
export async function logOrderChange(
  changeType: string,
  orderId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const context: Record<string, unknown> = {
    type: 'order',
    id: orderId,
    changeType,
    oldValues,
    newValues,
    action: 'change'
  };
  
  let ipAddress, userAgent;
  if (request) {
    ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    userAgent = request.headers.get('user-agent') || 'unknown';
    context.clientId = ipAddress;
  }
  
  logger.info(`Order ${changeType}: ${orderId}`, context);

  try {
    const { default: dbConnect } = await import('@/lib/dbConnect');
    const { getSession } = await import('@/lib/session');
    const { default: Log } = await import('@/models/Log');
    
    await dbConnect();
    
    let user = { id: 'system', name: 'System', username: 'System', role: 'system' };
    if (request && typeof request.headers?.get === 'function') {
      try {
        const session = await getSession(request as any);
        if (session) user = { ...user, ...session };
      } catch (e) {}
    }

    let actionName = 'order_update';
    if (changeType.includes('delete')) actionName = 'order_delete';
    else if (changeType.includes('status')) actionName = 'order_status_change';
    else if (changeType.includes('create')) actionName = 'order_create';

    await (Log as any).logUserAction({
      userId: user.id,
      username: user.username || user.name || 'System',
      userRole: user.role,
      action: actionName,
      resource: 'order',
      resourceId: orderId,
      details: { 
        oldValues, 
        newValues, 
        orderId 
      },
      ipAddress,
      userAgent,
      severity: 'info'
    });
  } catch (error) {
    logger.error(`Failed to save DB log for order change ${changeType}`, error as Error);
  }
}

/**
 * Log a view event
 */
export function logView(
  type: string,
  id: string,
  request?: Request
): void {
  const context: Record<string, unknown> = {
    type,
    id,
    action: 'view'
  };
  
  if (request) {
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    context.clientId = clientId;
  }
  
  logger.info(`Viewed ${type}: ${id}`, context);
}

/**
 * Log an update event
 */
export async function logUpdate(
  type: string,
  id: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const context: Record<string, unknown> = {
    type,
    id,
    oldValues,
    newValues,
    action: 'update'
  };
  
  let ipAddress, userAgent;
  if (request) {
    ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    userAgent = request.headers.get('user-agent') || 'unknown';
    context.clientId = ipAddress;
  }
  
  logger.info(`Updated ${type}: ${id}`, context);

  try {
    const { default: dbConnect } = await import('@/lib/dbConnect');
    const { getSession } = await import('@/lib/session');
    const { default: Log } = await import('@/models/Log');
    
    await dbConnect();
    
    let user = { id: 'system', name: 'System', username: 'System', role: 'system' };
    if (request && typeof request.headers?.get === 'function') {
      try {
        const session = await getSession(request as any);
        if (session) user = { ...user, ...session };
      } catch (e) {}
    }

    const orderId = newValues.orderId || oldValues.orderId || undefined;

    await (Log as any).logUserAction({
      userId: user.id,
      username: user.username || user.name || 'System',
      userRole: user.role,
      action: `${type}_update`,
      resource: type,
      resourceId: id,
      details: { oldValues, newValues, orderId },
      ipAddress,
      userAgent,
      severity: 'info'
    });
  } catch (error) {
    logger.error(`Failed to save DB log for update ${type}`, error as Error);
  }
}

/**
 * Log a delete event
 */
export async function logDelete(
  type: string,
  id: string,
  data?: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const context: Record<string, unknown> = {
    type,
    id,
    data,
    action: 'delete'
  };
  
  let ipAddress, userAgent;
  if (request) {
    ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    userAgent = request.headers.get('user-agent') || 'unknown';
    context.clientId = ipAddress;
  }
  
  logger.info(`Deleted ${type}: ${id}`, context);

  try {
    const { default: dbConnect } = await import('@/lib/dbConnect');
    const { getSession } = await import('@/lib/session');
    const { default: Log } = await import('@/models/Log');
    
    await dbConnect();
    
    let user = { id: 'system', name: 'System', username: 'System', role: 'system' };
    if (request && typeof request.headers?.get === 'function') {
      try {
        const session = await getSession(request as any);
        if (session) user = { ...user, ...session };
      } catch (e) {}
    }

    const orderId = data?.orderId || undefined;

    await (Log as any).logUserAction({
      userId: user.id,
      username: user.username || user.name || 'System',
      userRole: user.role,
      action: `${type}_delete`,
      resource: type,
      resourceId: id,
      details: { oldValues: data, orderId },
      ipAddress,
      userAgent,
      severity: 'warning'
    });
  } catch (error) {
    logger.error(`Failed to save DB log for delete ${type}`, error as Error);
  }
}

/**
 * Log a login event
 */
export function logLogin(
  userId: string,
  username: string,
  request?: Request
): void {
  const context: Record<string, unknown> = {
    type: 'user',
    id: userId,
    username,
    action: 'login'
  };
  
  if (request) {
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    context.clientId = clientId;
  }
  
  logger.info(`User login: ${username} (${userId})`, context);
}
