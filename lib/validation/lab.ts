import { z } from 'zod';
import { isValidObjectId } from '../ids';

// Helper to safely parse ISO date strings
const coerceISODate = (val: any): Date | undefined => {
  if (!val) return undefined;
  const date = new Date(val);
  return isNaN(date.getTime()) ? undefined : date;
};

// Custom ObjectId validation that allows temporary IDs
const objectIdSchema = z.string().refine((val) => {
  // Allow temporary IDs like item_0, item_1, etc.
  if (val.startsWith('item_')) {
    return true;
  }
  return isValidObjectId(val);
}, {
  message: 'Must be a valid ObjectId or temporary item ID'
});

// Attachment schema
const attachmentSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  fileName: z.string().min(1, 'File name is required')
});

// Create Lab schema
export const createLabSchema = z.object({
  orderId: objectIdSchema,
  orderItemId: objectIdSchema,
  labSendDate: z.string().transform(coerceISODate).pipe(
    z.date({ error: 'Lab send date is required' })
  ),
  labSendData: z.union([
    z.string(),
    z.record(z.string(), z.any())
  ]).optional(),
  labSendNumber: z.string().optional().default(''),
  status: z.enum(['sent', 'received', 'cancelled']).optional().default('sent'),
  receivedDate: z.string().transform(coerceISODate).optional(),
  attachments: z.array(attachmentSchema).optional(),
  remarks: z.string().optional()
});

// Update Lab schema (all fields optional)
export const updateLabSchema = z.object({
  orderItemId: objectIdSchema.optional(), // Allow updating orderItemId for order updates
  labSendDate: z.string().transform(coerceISODate).optional(),
  labSendData: z.union([
    z.string(),
    z.record(z.string(), z.any())
  ]).optional(),
  labSendNumber: z.string().optional(),
  status: z.enum(['sent', 'received', 'cancelled']).optional(),
  receivedDate: z.string().transform(coerceISODate).optional(),
  attachments: z.array(attachmentSchema).optional(),
  remarks: z.string().optional()
});

// Query Labs schema for GET requests
export const queryLabsSchema = z.object({
  orderId: objectIdSchema.optional(),
  q: z.string().optional(), // Search in labSendNumber
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['sent', 'received', 'cancelled']).optional(),
  includeDeleted: z.coerce.boolean().default(false)
});

// Seed from order schema
export const seedFromOrderSchema = z.object({
  labSendDate: z.string().transform(coerceISODate).pipe(
    z.date({ error: 'Lab send date is required' })
  ),
  prefix: z.string().optional().default('LAB-'),
  startIndex: z.number().min(1).optional().default(1),
  overrideExisting: z.boolean().optional().default(false)
});

// Type exports
export type CreateLabInput = z.infer<typeof createLabSchema>;
export type UpdateLabInput = z.infer<typeof updateLabSchema>;
export type QueryLabsInput = z.infer<typeof queryLabsSchema>;
export type SeedFromOrderInput = z.infer<typeof seedFromOrderSchema>;
