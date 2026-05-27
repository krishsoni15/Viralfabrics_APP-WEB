import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '@/lib/validation';

/**
 * Order item validation schema
 */
export const orderItemSchema = z.object({
  quality: objectIdSchema.optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1').optional(),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional(),
  totalPrice: z.number().min(0, 'Total price cannot be negative').optional(),
  imageUrls: z.array(z.string().url('Invalid image URL').max(500, 'Image URL too long')).optional(),
  description: z.string().max(200, 'Description cannot exceed 200 characters').optional(),
  weaverSupplierName: z.string().max(100, 'Weaver supplier name cannot exceed 100 characters').optional(),
  purchaseRate: z.number().min(0, 'Purchase rate cannot be negative').optional(),
  millRate: z.number().min(0, { message: 'Mill rate cannot be negative' }).optional(),
  salesRate: z.number().min(0, { message: 'Sales rate cannot be negative' }).optional(),
  specifications: z.record(z.string(), z.any()).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled'], { message: 'Invalid status' }).optional(),
  priority: z.number().min(1, { message: 'Priority must be at least 1' }).max(10, { message: 'Priority cannot exceed 10' }).optional(),
  notes: z.string().max(500, { message: 'Notes cannot exceed 500 characters' }).optional(),
});

/**
 * Create order validation schema
 */
export const createOrderSchema = z.object({
  orderType: z.enum(['Dying', 'Printing']).optional(),
  arrivalDate: z.coerce.date().optional(),
  party: objectIdSchema.optional(),
  contactName: z.string().max(50, 'Contact name cannot exceed 50 characters').optional(),
  contactPhone: z.string().max(20, 'Contact phone cannot exceed 20 characters').optional(),
  contactEmail: z.string().email('Invalid email format').max(100, 'Email cannot exceed 100 characters').optional(),
  poNumber: z.string().max(50, 'PO number cannot exceed 50 characters').optional(),
  styleNo: z.string().max(50, 'Style number cannot exceed 50 characters').optional(),
  poDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  items: z.array(orderItemSchema).min(0).optional().default([]),
  status: z.enum(['Not set', 'Not selected', 'pending', 'in_progress', 'completed', 'delivered', 'cancelled']).optional(),
  priority: z.number().min(1).max(10).optional(),
  totalAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  finalAmount: z.number().min(0).optional(),
  paymentStatus: z.enum(['pending', 'partial', 'paid']).optional(),
  paymentMethod: z.string().max(50).optional(),
  shippingAddress: z.string().max(300).optional(),
  billingAddress: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.object({
    createdBy: z.string().max(50).optional(),
    tags: z.array(z.string().max(30)).optional(),
    source: z.string().max(50).optional(),
    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
  }).optional(),
});

/**
 * Update order validation schema
 */
export const updateOrderSchema = createOrderSchema.partial().extend({
  id: objectIdSchema.optional(),
});

/**
 * Order query validation schema
 */
export const orderQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  orderType: z.enum(['Dying', 'Printing']).optional(),
  status: z.string().optional(),
  party: objectIdSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  millId: objectIdSchema.optional(),
  force: z.coerce.boolean().optional(),
  timestamp: z.string().optional(),
  sort: z.string().optional(),
});

/**
 * Type exports
 */
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;
export type OrderQueryRequest = z.infer<typeof orderQuerySchema>;
export type OrderItemRequest = z.infer<typeof orderItemSchema>;

