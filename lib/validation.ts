import { z } from 'zod';
import { ValidationError } from './errors';

// Base validation schemas
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const searchSchema = z.object({
  search: z.string().min(1).optional(),
  ...paginationSchema.shape
});

// Password validation with strong requirements
export const passwordSchema = z.string()
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
  );

// User validation schemas
export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: passwordSchema,
  email: z.string().email('Invalid email format').optional(),
  phoneNumber: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format').optional(),
  address: z.string().max(200, 'Address cannot exceed 200 characters').optional(),
  role: z.enum(['superadmin', 'user']).default('user')
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: objectIdSchema
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Party validation schemas
export const createPartySchema = z.object({
  name: z.string().min(2, 'Party name must be at least 2 characters').max(100, 'Party name cannot exceed 100 characters'),
  contactName: z.string().max(50, 'Contact name cannot exceed 50 characters').optional(),
  contactPhone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format').optional(),
  address: z.string().max(200, 'Address cannot exceed 200 characters').optional()
});

export const updatePartySchema = createPartySchema.partial().extend({
  id: objectIdSchema
});

// Quality validation schemas
export const createQualitySchema = z.object({
  name: z.string().min(2, 'Quality name must be at least 2 characters').max(100, 'Quality name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_\.\(\)\/]+$/, 'Quality name can only contain letters, numbers, spaces, hyphens, underscores, dots, parentheses, and forward slashes'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional()
});

export const updateQualitySchema = createQualitySchema.partial().extend({
  id: objectIdSchema
});

// Order item validation schema
export const orderItemSchema = z.object({
  quality: objectIdSchema.optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative').optional(),
  imageUrls: z.array(z.string().url('Invalid image URL')).optional(),
  description: z.string().max(200, 'Description cannot exceed 200 characters').optional()
});

// Order validation schemas
export const createOrderSchema = z.object({
  orderType: z.enum(['Dying', 'Printing']).optional(),
  arrivalDate: z.coerce.date().optional(),
  party: objectIdSchema.optional(),
  contactName: z.string().max(50, 'Contact name cannot exceed 50 characters').optional(),
  contactPhone: z.string().max(20, 'Contact phone cannot exceed 20 characters').optional(),
  poNumber: z.string().max(50, 'PO number cannot exceed 50 characters').optional(),
  styleNo: z.string().max(50, 'Style number cannot exceed 50 characters').optional(),
  poDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  weaverSupplierName: z.string().max(100, 'Weaver supplier name cannot exceed 100 characters').optional(),
  purchaseRate: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  items: z.array(orderItemSchema).optional().default([])
});

export const updateOrderSchema = createOrderSchema.partial().extend({
  id: objectIdSchema
});

export const orderQuerySchema = searchSchema.extend({
  orderType: z.enum(['Dying', 'Printing']).optional(),
  status: z.enum(['pending', 'delivered']).optional(),
  party: objectIdSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
});

// Lab validation schemas are now in @/lib/validation/lab.ts

// Validation helper function
export const validateRequest = <T>(schema: z.ZodSchema<T>, data: any): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as any;
      const messages = zodError.errors?.map((err: any) => `${err.path?.join('.')}: ${err.message}`) || ['Validation failed'];
      throw new ValidationError(messages.join(', '));
    }
    throw error;
  }
};

// Type exports for TypeScript
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreatePartyRequest = z.infer<typeof createPartySchema>;
export type UpdatePartyRequest = z.infer<typeof updatePartySchema>;
export type CreateQualityRequest = z.infer<typeof createQualitySchema>;
export type UpdateQualityRequest = z.infer<typeof updateQualitySchema>;
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;
export type OrderQueryRequest = z.infer<typeof orderQuerySchema>;
// Lab types are now in @/lib/validation/lab.ts
export type PaginationRequest = z.infer<typeof paginationSchema>;
export type SearchRequest = z.infer<typeof searchSchema>;

// Re-export validation utilities from validation directory
export { validateData } from './validation/shared';
export { sanitizeObject, containsXSS } from './validation/security';
