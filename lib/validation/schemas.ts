/**
 * Complete Validation Schemas for All Entities
 * 
 * These schemas use the shared base schemas to ensure consistency.
 */

import { z } from 'zod';
import {
  objectIdSchema,
  optionalObjectIdSchema,
  paginationSchema,
  searchSchema,
  emailSchema,
  phoneSchema,
  passwordSchema,
  usernameSchema,
  sanitizedStringSchema,
  dateSchema,
  optionalDateSchema,
  priceSchema,
  positiveNumberSchema,
  orderTypeSchema,
  orderStatusSchema,
  paymentStatusSchema,
  userRoleSchema,
  nameSchema,
  descriptionSchema,
  notesSchema,
  addressSchema,
  contactNameSchema,
  contactPhoneSchema,
  contactEmailSchema,
  urlSchema,
} from './shared';

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const createUserSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: passwordSchema,
  email: emailSchema.optional(),
  phoneNumber: phoneSchema,
  address: addressSchema,
  role: userRoleSchema.default('user'),
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: objectIdSchema,
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ============================================================================
// PARTY SCHEMAS
// ============================================================================

export const createPartySchema = z.object({
  name: sanitizedStringSchema(2, 100),
  contactName: contactNameSchema,
  contactPhone: contactPhoneSchema,
  address: addressSchema,
  category: z.enum(['Customer', 'Supplier', 'Both']).optional(),
});

export const updatePartySchema = createPartySchema.partial().extend({
  id: objectIdSchema,
});

export const partyQuerySchema = searchSchema.extend({
  category: z.enum(['Customer', 'Supplier', 'Both']).optional(),
});

// ============================================================================
// QUALITY SCHEMAS
// ============================================================================

export const createQualitySchema = z.object({
  name: sanitizedStringSchema(2, 100).regex(
    /^[a-zA-Z0-9\s\-_\.\(\)\/]+$/,
    'Quality name can only contain letters, numbers, spaces, hyphens, underscores, dots, parentheses, and forward slashes'
  ),
  description: descriptionSchema,
  code: z.string().max(50).optional(),
});

export const updateQualitySchema = createQualitySchema.partial().extend({
  id: objectIdSchema,
});

export const qualityQuerySchema = searchSchema;

// ============================================================================
// ORDER ITEM SCHEMA
// ============================================================================

export const orderItemSchema = z.object({
  quality: optionalObjectIdSchema,
  quantity: positiveNumberSchema(1).optional(),
  unitPrice: priceSchema,
  totalPrice: priceSchema,
  imageUrls: z.array(urlSchema).max(10, 'Maximum 10 images allowed').optional(),
  description: descriptionSchema,
  weaverSupplierName: sanitizedStringSchema(1, 100).optional(),
  purchaseRate: priceSchema,
  millRate: priceSchema,
  salesRate: priceSchema,
  specifications: z.record(z.string(), z.any()).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  notes: notesSchema,
});

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const createOrderSchema = z.object({
  orderType: orderTypeSchema.optional(),
  arrivalDate: optionalDateSchema,
  party: optionalObjectIdSchema,
  contactName: contactNameSchema,
  contactPhone: contactPhoneSchema,
  contactEmail: contactEmailSchema,
  poNumber: sanitizedStringSchema(1, 50).optional(),
  styleNo: sanitizedStringSchema(1, 50).optional(),
  poDate: optionalDateSchema,
  deliveryDate: optionalDateSchema,
  items: z.array(orderItemSchema).min(0).default([]),
  status: orderStatusSchema.optional(),
  priority: z.number().int().min(1).max(10).optional(),
  totalAmount: priceSchema,
  taxAmount: priceSchema,
  discountAmount: priceSchema,
  finalAmount: priceSchema,
  paymentStatus: paymentStatusSchema.optional(),
  paymentMethod: sanitizedStringSchema(1, 50).optional(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  notes: notesSchema,
  metadata: z.object({
    createdBy: sanitizedStringSchema(1, 50).optional(),
    tags: z.array(sanitizedStringSchema(1, 30)).max(10).optional(),
    source: sanitizedStringSchema(1, 50).optional(),
    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
  }).optional(),
});

export const updateOrderSchema = createOrderSchema.partial().extend({
  id: optionalObjectIdSchema,
});

export const orderQuerySchema = searchSchema.extend({
  orderType: orderTypeSchema.optional(),
  status: z.string().optional(),
  party: optionalObjectIdSchema,
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  millId: optionalObjectIdSchema,
  force: z.coerce.boolean().optional(),
  timestamp: z.string().optional(),
  sort: z.string().optional(),
});

// ============================================================================
// MILL SCHEMAS
// ============================================================================

export const createMillSchema = z.object({
  name: nameSchema,
  contactName: contactNameSchema,
  contactPhone: contactPhoneSchema,
  address: addressSchema,
  description: descriptionSchema,
});

export const updateMillSchema = createMillSchema.partial().extend({
  id: objectIdSchema,
});

export const millQuerySchema = searchSchema;

// ============================================================================
// FABRIC SCHEMAS
// ============================================================================

export const createFabricSchema = z.object({
  qualityCode: z.string().max(50).optional(),
  qualityName: sanitizedStringSchema(1, 100),
  weaver: sanitizedStringSchema(1, 100).optional(),
  weaverQualityName: sanitizedStringSchema(1, 100).optional(),
  description: descriptionSchema,
});

export const updateFabricSchema = createFabricSchema.partial().extend({
  id: objectIdSchema,
});

export const fabricQuerySchema = searchSchema.extend({
  qualityCode: z.string().optional(),
  weaver: z.string().optional(),
});

// ============================================================================
// LAB SCHEMAS
// ============================================================================

export const labDataSchema = z.object({
  orderId: objectIdSchema,
  itemId: z.string().min(1),
  labName: sanitizedStringSchema(1, 100),
  testDate: optionalDateSchema,
  results: z.record(z.string(), z.any()).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
  notes: notesSchema,
});

export const createLabSchema = z.object({
  orderId: objectIdSchema,
  items: z.array(
    z.object({
      itemId: z.string().min(1, 'Item ID is required'),
      labName: sanitizedStringSchema(1, 100),
      testDate: optionalDateSchema,
      results: z.record(z.string(), z.any()).optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
      notes: notesSchema,
    })
  ).min(1, 'At least one lab item is required'),
});

export const updateLabSchema = labDataSchema.partial().extend({
  id: objectIdSchema,
  itemId: z.string().min(1),
});

// ============================================================================
// MILL INPUT/OUTPUT SCHEMAS
// ============================================================================

export const millInputSchema = z.object({
  orderId: objectIdSchema,
  itemId: z.string().min(1),
  millId: objectIdSchema,
  inputDate: optionalDateSchema,
  quantity: positiveNumberSchema(0),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  notes: notesSchema,
});

export const millOutputSchema = z.object({
  orderId: objectIdSchema,
  itemId: z.string().min(1),
  millId: objectIdSchema,
  outputDate: optionalDateSchema,
  quantity: positiveNumberSchema(0),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  notes: notesSchema,
});

// ============================================================================
// DISPATCH SCHEMAS
// ============================================================================

export const dispatchSchema = z.object({
  orderId: objectIdSchema,
  itemId: z.string().min(1),
  dispatchDate: optionalDateSchema,
  quantity: positiveNumberSchema(0),
  status: z.enum(['pending', 'dispatched', 'delivered']).optional(),
  trackingNumber: sanitizedStringSchema(1, 100).optional(),
  notes: notesSchema,
});

// ============================================================================
// GREY INFO SCHEMAS
// ============================================================================

export const greyInfoSchema = z.object({
  orderId: objectIdSchema,
  itemId: z.string().min(1),
  greyInfo: z.record(z.string(), z.any()).optional(),
  status: z.enum(['pending', 'completed']).optional(),
  notes: notesSchema,
});

// ============================================================================
// UPLOAD SCHEMAS
// ============================================================================

export const uploadSchema = z.object({
  file: z.instanceof(File).optional(),
  orderId: optionalObjectIdSchema,
  itemId: z.string().optional(),
  type: z.enum(['image', 'document', 'other']).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export type CreatePartyRequest = z.infer<typeof createPartySchema>;
export type UpdatePartyRequest = z.infer<typeof updatePartySchema>;
export type PartyQueryRequest = z.infer<typeof partyQuerySchema>;

export type CreateQualityRequest = z.infer<typeof createQualitySchema>;
export type UpdateQualityRequest = z.infer<typeof updateQualitySchema>;
export type QualityQueryRequest = z.infer<typeof qualityQuerySchema>;

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;
export type OrderQueryRequest = z.infer<typeof orderQuerySchema>;
export type OrderItemRequest = z.infer<typeof orderItemSchema>;

export type CreateMillRequest = z.infer<typeof createMillSchema>;
export type UpdateMillRequest = z.infer<typeof updateMillSchema>;
export type MillQueryRequest = z.infer<typeof millQuerySchema>;

export type CreateFabricRequest = z.infer<typeof createFabricSchema>;
export type UpdateFabricRequest = z.infer<typeof updateFabricSchema>;
export type FabricQueryRequest = z.infer<typeof fabricQuerySchema>;

export type LabDataRequest = z.infer<typeof labDataSchema>;
export type CreateLabRequest = z.infer<typeof createLabSchema>;
export type UpdateLabRequest = z.infer<typeof updateLabSchema>;

export type MillInputRequest = z.infer<typeof millInputSchema>;
export type MillOutputRequest = z.infer<typeof millOutputSchema>;
export type DispatchRequest = z.infer<typeof dispatchSchema>;
export type GreyInfoRequest = z.infer<typeof greyInfoSchema>;
export type UploadRequest = z.infer<typeof uploadSchema>;

