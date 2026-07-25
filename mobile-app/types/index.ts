// ==========================================
// Viral Fabrics — Type Definitions
// ==========================================

export interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  profilePhoto?: string;
  role: 'superadmin' | 'admin' | 'weaver' | 'party' | 'master' | 'user';
  isActive: boolean;
  lastLogin?: string;
  loginCount?: number;
  preferences?: {
    theme?: string;
    language?: string;
    notifications?: boolean;
    timezone?: string;
  };
  metadata?: {
    createdBy?: string;
    department?: string;
    employeeId?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Party {
  _id: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  isActive?: boolean;
  category?: 'customer' | 'supplier' | 'partner' | 'other';
  priority?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quality {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  createdAt: string;
  updatedAt: string;
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

export type OrderStatus = 'Not set' | 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';
export type OrderType = 'Dying' | 'Printing';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface LabData {
  color?: string;
  shade?: string;
  notes?: string;
  imageUrl?: string;
  labSendDate?: string;
  approvalDate?: string;
  sampleNumber?: string;
  status?: string;
  remarks?: string;
}

export interface ProcessData {
  mainProcess?: string;
  additionalProcesses?: string[];
}

export interface OrderItem {
  _id?: string;
  quality: Quality | string;
  quantity: number;
  imageUrls?: string[];
  description?: string;
  weaverSupplierName?: string;
  purchaseRate?: number;
  millRate?: number;
  salesRate?: number;
  labData?: LabData;
  processData?: ProcessData;
}

export interface Order {
  _id: string;
  orderId: string;
  orderNo?: string;
  orderType: OrderType;
  arrivalDate?: string;
  party: Party | string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: string;
  deliveryDate?: string;
  items: OrderItem[];
  status: OrderStatus;
  priority?: string;
  totalAmount?: number;
  paymentStatus?: PaymentStatus;
  notes?: string;
  greyInformation?: any[];
  millInputs?: any[];
  millOutputs?: any[];
  dispatches?: any[];
  metadata?: {
    createdBy?: string;
    tags?: string[];
    source?: string;
    urgency?: string;
    complexity?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MillInput {
  _id: string;
  orderId: string;
  order: string;
  mill: Mill | string;
  millDate: string;
  chalanNo: string;
  greighMtr: number;
  pcs: number;
  quality?: Quality | string;
  additionalMeters?: number[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MillOutput {
  _id: string;
  orderId: string;
  order: string;
  recdDate: string;
  millBillNo: string;
  finishedMtr: number;
  createdAt: string;
  updatedAt: string;
}

export interface GreyInfo {
  _id: string;
  orderId: string;
  order: string;
  [key: string]: any;
  createdAt: string;
  updatedAt: string;
}

export interface Dispatch {
  _id: string;
  orderId: string;
  order: string;
  [key: string]: any;
  createdAt: string;
  updatedAt: string;
}

export interface Fabric {
  _id: string;
  qualityCode?: string;
  qualityName: string;
  type?: string;
  weaver: string;
  weaverQualityName?: string;
  rack?: string;
  greighWidth?: number;
  finishWidth?: number;
  weight?: number;
  gsm?: number;
  content?: string;
  danier?: string;
  count?: string;
  reed?: string;
  pick?: string;
  greighRate?: number;
  label?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SamplingWeaver {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  sampleCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sample {
  _id: string;
  weaverId: string;
  qualityName: string;
  type?: string;
  rack?: string;
  greighWidth?: number;
  finishWidth?: number;
  weight?: number;
  gsm?: number;
  content?: string;
  danier?: string;
  count?: string;
  reed?: string;
  pick?: string;
  greighRate?: number;
  label?: string;
  note?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  inProgressOrders?: number;
  deliveredOrders?: number;
  cancelledOrders?: number;
  statusBreakdown?: Record<string, number>;
}

export interface UpcomingDelivery {
  _id: string;
  orderId: string;
  party: Party | string;
  deliveryDate: string;
  status: OrderStatus;
  items?: OrderItem[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

export interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
  message?: string;
}

export interface ActivityLog {
  _id: string;
  user: string;
  action: string;
  details?: string;
  ip?: string;
  createdAt: string;
}

export interface GreyMaterial {
  _id: string;
  qualityCode?: string;
  qualityName: string;
  type?: string;
  weaver?: string;
  weaverQualityName?: string;
  piece?: number;
  meter?: number;
  challanNumber?: string;
  images?: string[];
  gsm?: number;
  weight?: number;
  greighWidth?: number;
  finishWidth?: number;
  content?: string;
  greighRate?: number;
  rack?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinishLotStock {
  _id: string;
  qualityName: string;
  images: string[];
  meter: number;
  piece: number;
  createdAt: string;
  updatedAt: string;
}

export interface SamplingItem {
  _id: string;
  qualityName: string;
  whereToPut?: string;
  images: string[];
  notes: string;
  meter: number;
  piece: number;
  createdAt: string;
  updatedAt: string;
}

export interface Weaver {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Log {
  _id: string;
  userId: string;
  username: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  success: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface PurchaseOrder {
  _id: string;
  companyHeader: 'Viral Fabrics' | 'Viral Enterprise';
  poNumber: string;
  poDate: string;
  brokerName: string;
  brokerPhone: string;
  supplierName: string;
  supplierAddress: string;
  supplierGstin: string;
  supplierPhone?: string;
  quality: string;
  pcsMtr: string;
  delivery: string;
  rate: string;
  greighMtr?: string;
  greighLeadTime?: string;
  images?: string[];
  paymentTerms: string;
  specs: {
    finishGsm: string;
    greyWidth: string;
    finishWidth: string;
    weight: string;
  };
  notes: string;
  financialYear: string;
  softDeleted?: boolean;
  createdBy?: { _id?: string; name: string; username: string };
  createdAt: string;
  updatedAt?: string;
}

export interface Broker {
  _id: string;
  name: string;
  phone?: string;
}

export interface POSupplier {
  _id: string;
  name: string;
  address?: string;
  gstin?: string;
  phone?: string;
}
