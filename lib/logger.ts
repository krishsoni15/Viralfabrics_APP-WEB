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
  
  if (request) {
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    context.clientId = clientId;
  }
  
  logger.info(`Created ${type}: ${id}`, context);
}

/**
 * Log an order change event
 */
export async function logOrderChange(
  changeType: string,
  orderId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Promise<void> {
  const context: Record<string, unknown> = {
    type: 'order',
    id: orderId,
    changeType,
    oldValues,
    newValues,
    action: 'change'
  };
  
  logger.info(`Order ${changeType}: ${orderId}`, context);
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
export function logUpdate(
  type: string,
  id: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  request?: Request
): void {
  const context: Record<string, unknown> = {
    type,
    id,
    oldValues,
    newValues,
    action: 'update'
  };
  
  if (request) {
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    context.clientId = clientId;
  }
  
  logger.info(`Updated ${type}: ${id}`, context);
}

/**
 * Log a delete event
 */
export function logDelete(
  type: string,
  id: string,
  data?: Record<string, unknown>,
  request?: Request
): void {
  const context: Record<string, unknown> = {
    type,
    id,
    data,
    action: 'delete'
  };
  
  if (request) {
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    context.clientId = clientId;
  }
  
  logger.info(`Deleted ${type}: ${id}`, context);
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
