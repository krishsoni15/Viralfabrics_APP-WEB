/**
 * Sanitization utilities for input validation
 */

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(input: string, options?: {
  maxLength?: number;
  allowHtml?: boolean;
}): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove HTML tags if not allowed
  if (!options?.allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }
  
  // Limit length
  if (options?.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize search query - prevent NoSQL injection
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  // Remove MongoDB operators
  const dangerous = ['$', '{', '}', '[', ']', '(', ')', '*', '+', '?', '|', '^', '\\'];
  let sanitized = query.trim();
  
  // Escape special regex characters but keep search functionality
  sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Limit length
  sanitized = sanitized.substring(0, 100);
  
  return sanitized;
}

/**
 * Sanitize ObjectId - ensure valid format
 */
export function sanitizeObjectId(id: string | undefined | null): string | null {
  if (!id || typeof id !== 'string') {
    return null;
  }
  
  // Only allow valid ObjectId format
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return null;
  }
  
  return id;
}

/**
 * Sanitize number - ensure valid numeric value
 */
export function sanitizeNumber(
  value: string | number | undefined | null,
  options?: { min?: number; max?: number; default?: number }
): number {
  if (value === null || value === undefined || value === '') {
    return options?.default ?? 0;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return options?.default ?? 0;
  }
  
  if (options?.min !== undefined && num < options.min) {
    return options.min;
  }
  
  if (options?.max !== undefined && num > options.max) {
    return options.max;
  }
  
  return num;
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(
  input: unknown,
  options?: { maxLength?: number; maxItems?: number }
): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  
  let sanitized = input
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeString(item, { maxLength: options?.maxLength }));
  
  if (options?.maxItems) {
    sanitized = sanitized.slice(0, options.maxItems);
  }
  
  return sanitized;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string | undefined | null): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return null;
  }
  
  return sanitized;
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string | undefined | null): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  // Remove all non-digit characters except +
  const sanitized = phone.replace(/[^\d+]/g, '');
  
  if (sanitized.length < 10 || sanitized.length > 16) {
    return null;
  }
  
  return sanitized;
}

