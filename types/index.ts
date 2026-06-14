import type {
  OrderType,
  OrderStatus,
  PaymentStatus,
  PartyCategory,
  UrgencyLevel,
  ComplexityLevel,
} from '@/constants/enums';

export type { User } from './user';
export type * from './greyMaterial';

export interface Party {
  _id: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  isActive?: boolean;
  category?: PartyCategory;
  priority?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  _id?: string; // Added _id property for item identification
  quality?: string | Quality;
  quantity: number | string; // Quantity can be string in form, number in final data
  imageUrls?: string[]; // Changed from imageUrl to imageUrls array
  description?: string;
  weaverSupplierName?: string; // Weaver / Supplier Name moved to item level
  purchaseRate?: number | string; // Purchase Rate moved to item level (can be string in form)
  millRate?: number | string; // Mill Rate field
  salesRate?: number | string; // Sales Rate field
  labData?: {
    color?: string;
    shade?: string;
    notes?: string;
    imageUrl?: string;
    labSendDate?: string;
    approvalDate?: string;
    sampleNumber?: string;
    labSendNumber?: string;
    status?: string;
    remarks?: string;
  };
  processData?: {
    mainProcess?: string;
    additionalProcesses?: string[];
  };
}

export interface Quality {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  _id: string;
  orderId: string;
  orderNo?: string;
  orderType?: OrderType;
  arrivalDate?: string;
  party?: string | Party;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: string;
  deliveryDate?: string;
  items: OrderItem[];
  status?: OrderStatus;
  priority?: number;
  totalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  shippingAddress?: string;
  billingAddress?: string;
  notes?: string;
  labData?: any;
  greyInformation?: any[];
  millInputs?: any[];
  millOutputs?: any[];
  dispatches?: any[];
  metadata?: {
    createdBy?: string;
    tags?: string[];
    source?: string;
    urgency?: UrgencyLevel;
    complexity?: ComplexityLevel;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrderFormData {
  orderType?: OrderType;
  arrivalDate?: string;
  party?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: string;
  deliveryDate?: string;
  status?: OrderStatus;
  priority?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  shippingAddress?: string;
  billingAddress?: string;
  notes?: string;
  items: OrderItem[];
}

export interface PartyFormData {
  name: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
}

export interface Mill {
  _id: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MillInput {
  _id: string;
  orderId: string;
  order: string | Order;
  mill: string | Mill;
  millDate: string;
  chalanNo: string;
  greighMtr: number;
  pcs: number;
  quality?: string | Quality;
  additionalMeters?: {
    greighMtr: number;
    pcs: number;
    quality?: string | Quality;
  }[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MillFormData {
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  email?: string;
}

export interface MillInputFormData {
  orderId: string;
  mill: string;
  millDate: string;
  chalanNo: string;
  greighMtr: string;
  pcs: string;
  notes?: string;
}

export interface MillOutput {
  _id: string;
  orderId: string;
  order: string | Order;
  recdDate: string;
  millBillNo: string;
  finishedMtr: number;
  createdAt: string;
  updatedAt: string;
}

export interface MillOutputFormData {
  orderId: string;
  recdDate: string;
  millBillNo: string;
  finishedMtr: string;
}
