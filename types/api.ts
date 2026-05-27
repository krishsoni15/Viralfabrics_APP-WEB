/**
 * API-related TypeScript types
 * Request and response interfaces for API routes
 */

import type { Order, Party, Quality, Mill, User } from './index';

// ============================================================================
// COMMON API TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// ORDER API TYPES
// ============================================================================

export interface GetOrdersResponse extends PaginatedResponse<Order> {}

export interface GetOrderResponse extends ApiResponse<Order> {}

export interface CreateOrderRequest {
  orderType?: string;
  arrivalDate?: string;
  party?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: string;
  deliveryDate?: string;
  items: Array<{
    quality?: string;
    quantity: number | string;
    imageUrls?: string[];
    description?: string;
    weaverSupplierName?: string;
    purchaseRate?: number | string;
    millRate?: number | string;
    salesRate?: number | string;
  }>;
  status?: string;
  priority?: number;
  notes?: string;
}

export interface UpdateOrderRequest extends Partial<CreateOrderRequest> {
  _id: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: string;
}

// ============================================================================
// PARTY API TYPES
// ============================================================================

export interface GetPartiesResponse extends PaginatedResponse<Party> {}

export interface CreatePartyRequest {
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  category?: string;
  isActive?: boolean;
}

// ============================================================================
// QUALITY API TYPES
// ============================================================================

export interface GetQualitiesResponse extends ApiResponse<Quality[]> {}

export interface CreateQualityRequest {
  name: string;
  description?: string;
  code?: string;
}

// ============================================================================
// MILL API TYPES
// ============================================================================

export interface GetMillsResponse extends ApiResponse<Mill[]> {}

export interface CreateMillRequest {
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  email?: string;
  isActive?: boolean;
}

// ============================================================================
// USER API TYPES
// ============================================================================

export interface GetUsersResponse extends PaginatedResponse<User> {}

export interface CreateUserRequest {
  name: string;
  username: string;
  password: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  isActive?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse extends ApiResponse<{
  user: User;
  token: string;
}> {}

// ============================================================================
// SEARCH API TYPES
// ============================================================================

export interface SearchQuery {
  q?: string;
  searchType?: string;
  status?: string;
  type?: string;
  mill?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

