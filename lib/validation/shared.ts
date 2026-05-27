/**
 * Shared Validation Schemas
 * 
 * These schemas are used by both frontend and backend to ensure consistency.
 * Import from here to avoid duplication.
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

/**
 * MongoDB ObjectId validation
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')
  .min(24, 'ID must be 24 characters')
  .max(24, 'ID must be 24 characters');

/**
 * Optional ObjectId (for updates)
 */
export const optionalObjectIdSchema = objectIdSchema.optional();

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Search schema
 */
export const searchSchema = paginationSchema.extend({
  search: z.string().min(1, 'Search query must be at least 1 character').optional(),
});

// ============================================================================
// STRING VALIDATION HELPERS
// ============================================================================

/**
 * Sanitized string (removes XSS patterns)
 */
export const sanitizedStringSchema = (min: number = 1, max: number = 1000) =>
  z
    .string()
    .min(min, `Must be at least ${min} character${min > 1 ? 's' : ''}`)
    .max(max, `Cannot exceed ${max} characters`)
    .refine(
      (val) => !/<script|javascript:|onerror=|onload=/i.test(val),
      'Invalid characters detected'
    );

/**
 * Email validation
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(100, 'Email cannot exceed 100 characters')
  .toLowerCase()
  .trim();

/**
 * Phone number validation (international format)
 */
export const phoneSchema = z
  .string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format')
  .max(20, 'Phone number cannot exceed 20 characters')
  .optional();

/**
 * URL validation
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(500, 'URL cannot exceed 500 characters');

/**
 * Strong password validation
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password cannot exceed 100 characters')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number'
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    'Password must contain at least one special character'
  );

/**
 * Username validation
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username cannot exceed 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .toLowerCase()
  .trim();

// ============================================================================
// DATE VALIDATION
// ============================================================================

/**
 * Date schema (accepts string or Date)
 */
export const dateSchema = z.union([
  z.string().datetime(),
  z.coerce.date(),
  z.date(),
]);

/**
 * Optional date schema
 */
export const optionalDateSchema = dateSchema.optional();

// ============================================================================
// NUMBER VALIDATION
// ============================================================================

/**
 * Positive number schema
 */
export const positiveNumberSchema = (min: number = 0) =>
  z.coerce.number().min(min, `Must be at least ${min}`);

/**
 * Price/amount schema
 */
export const priceSchema = z.coerce
  .number()
  .min(0, 'Price cannot be negative')
  .max(999999999, 'Price is too large')
  .optional();

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

/**
 * Order type enum
 */
export const orderTypeSchema = z.enum(['Dying', 'Printing']);

/**
 * Order status enum
 */
export const orderStatusSchema = z.enum([
  'Not set',
  'Not selected',
  'pending',
  'in_progress',
  'completed',
  'delivered',
  'cancelled',
]);

/**
 * Payment status enum
 */
export const paymentStatusSchema = z.enum(['pending', 'partial', 'paid']);

/**
 * User role enum
 */
export const userRoleSchema = z.enum(['superadmin', 'user']);

// ============================================================================
// COMMON FIELD SCHEMAS
// ============================================================================

/**
 * Name field (2-50 chars)
 */
export const nameSchema = sanitizedStringSchema(2, 50);

/**
 * Description field (optional, max 500 chars)
 */
export const descriptionSchema = sanitizedStringSchema(1, 500).optional();

/**
 * Notes field (optional, max 1000 chars)
 */
export const notesSchema = sanitizedStringSchema(1, 1000).optional();

/**
 * Address field (optional, max 300 chars)
 */
export const addressSchema = sanitizedStringSchema(1, 300).optional();

/**
 * Contact name (optional, max 50 chars)
 */
export const contactNameSchema = sanitizedStringSchema(1, 50).optional();

/**
 * Contact phone (optional)
 */
export const contactPhoneSchema = phoneSchema;

/**
 * Contact email (optional)
 */
export const contactEmailSchema = emailSchema.optional();

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate data against schema and return formatted errors
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((err) => {
        const path = err.path.join('.') || 'root';
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    throw error;
  }
}

/**
 * Safe parse with error formatting
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  return result;
}

/**
 * Get first error message from validation result
 */
export function getFirstError(errors: Record<string, string>): string {
  const firstKey = Object.keys(errors)[0];
  return errors[firstKey] || 'Validation failed';
}

/**
 * Get all error messages as array
 */
export function getAllErrors(errors: Record<string, string>): string[] {
  return Object.values(errors);
}

