/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize user input to prevent XSS and injection attacks.
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Remove dangerous characters from strings (for database queries)
 */
export function sanitizeString(str: string, options: {
  maxLength?: number;
  allowedChars?: RegExp;
  trim?: boolean;
} = {}): string {
  if (!str || typeof str !== 'string') return '';
  
  const { 
    maxLength = 1000, 
    allowedChars,
    trim = true 
  } = options;
  
  let result = str;
  
  // Trim whitespace
  if (trim) {
    result = result.trim();
  }
  
  // Remove null bytes
  result = result.replace(/\0/g, '');
  
  // Filter to allowed characters if specified
  if (allowedChars) {
    result = result.split('').filter(char => allowedChars.test(char)).join('');
  }
  
  // Truncate to max length
  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  
  return result;
}

/**
 * Sanitize object fields recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    maxStringLength?: number;
    maxDepth?: number;
    excludeFields?: string[];
  } = {}
): T {
  const { 
    maxStringLength = 10000, 
    maxDepth = 10,
    excludeFields = ['password', 'token', 'secret']
  } = options;
  
  function sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > maxDepth) return value;
    
    if (typeof value === 'string') {
      return sanitizeString(value, { maxLength: maxStringLength });
    }
    
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item, depth + 1));
    }
    
    if (value !== null && typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        // Skip sensitive fields
        if (excludeFields.includes(key.toLowerCase())) {
          sanitized[key] = val;
        } else {
          sanitized[key] = sanitizeValue(val, depth + 1);
        }
      }
      return sanitized;
    }
    
    return value;
  }
  
  return sanitizeValue(obj, 0) as T;
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '')
    .substring(0, 254); // Max email length per RFC
}

/**
 * Sanitize phone number - keep only digits and +
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  return phone
    .replace(/[^\d+]/g, '')
    .substring(0, 20);
}

/**
 * Sanitize username - alphanumeric and underscore only
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') return '';
  
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 30);
}

/**
 * Sanitize search query - prevent NoSQL injection
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return '';
  
  // Remove MongoDB operators
  return query
    .trim()
    .replace(/[${}]/g, '')
    .substring(0, 200);
}

/**
 * Validate MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Sanitize array of ObjectIds
 */
export function sanitizeObjectIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  
  return ids
    .filter((id): id is string => typeof id === 'string' && isValidObjectId(id))
    .slice(0, 1000); // Limit array size
}

