/**
 * Security Utilities
 * 
 * XSS protection, input sanitization, and security helpers
 */

// ============================================================================
// XSS PROTECTION
// ============================================================================

/**
 * Sanitize string to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/<object/gi, '&lt;object')
    .replace(/<embed/gi, '&lt;embed')
    .replace(/<link/gi, '&lt;link')
    .replace(/<style/gi, '&lt;style')
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const sanitized = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        (sanitized as any)[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = sanitizeObject(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }
  }
  return sanitized;
}

/**
 * Check if string contains XSS patterns
 */
export function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<style/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

// ============================================================================
// SQL/NoSQL INJECTION PROTECTION
// ============================================================================

/**
 * Escape special characters for MongoDB queries
 */
export function escapeMongoQuery(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize MongoDB query operators
 */
export function sanitizeMongoQuery(query: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const dangerousOperators = ['$where', '$eval', '$function'];

  for (const key in query) {
    if (dangerousOperators.includes(key)) {
      continue; // Skip dangerous operators
    }

    const value = query[key];
    if (typeof value === 'string') {
      sanitized[key] = escapeMongoQuery(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMongoQuery(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// PASSWORD SECURITY
// ============================================================================

/**
 * Check password strength
 */
export function checkPasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string[];
  isStrong: boolean;
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Use at least 8 characters');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add numbers');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else feedback.push('Add special characters');

  return {
    score,
    feedback,
    isStrong: score >= 4,
  };
}

// ============================================================================
// FILE UPLOAD SECURITY
// ============================================================================

/**
 * Allowed file types
 */
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  other: ['*'],
} as const;

/**
 * Max file sizes (in bytes)
 */
export const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  other: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * Validate file type
 */
export function validateFileType(
  file: File,
  allowedTypes: readonly string[]
): boolean {
  if (allowedTypes.includes('*')) {
    return true;
  }
  return allowedTypes.includes(file.type);
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize;
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

/**
 * Default rate limit configs
 */
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  },
  // General API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },
  // Write operations
  write: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many write operations. Please slow down.',
  },
  // Upload endpoints
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many uploads. Please try again later.',
  },
} as const;

