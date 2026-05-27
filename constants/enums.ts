/**
 * Application-wide Enums and Constants
 * Centralized definitions for type safety and consistency
 */

// ============================================================================
// ORDER ENUMS
// ============================================================================

export const ORDER_TYPE = {
  DYING: 'Dying',
  PRINTING: 'Printing',
} as const;

export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE];

export const ORDER_STATUS = {
  NOT_SET: 'Not set',
  NOT_SELECTED: 'Not selected',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// ============================================================================
// USER ENUMS
// ============================================================================

export const USER_ROLE = {
  SUPERADMIN: 'superadmin',
  USER: 'user',
} as const;

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];

export const USER_THEME = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type UserTheme = typeof USER_THEME[keyof typeof USER_THEME];

export const USER_LANGUAGE = {
  EN: 'en',
  ES: 'es',
  FR: 'fr',
} as const;

export type UserLanguage = typeof USER_LANGUAGE[keyof typeof USER_LANGUAGE];

// ============================================================================
// PARTY ENUMS
// ============================================================================

export const PARTY_CATEGORY = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  PARTNER: 'partner',
  OTHER: 'other',
} as const;

export type PartyCategory = typeof PARTY_CATEGORY[keyof typeof PARTY_CATEGORY];

// ============================================================================
// METADATA ENUMS
// ============================================================================

export const URGENCY_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type UrgencyLevel = typeof URGENCY_LEVEL[keyof typeof URGENCY_LEVEL];

export const COMPLEXITY_LEVEL = {
  SIMPLE: 'simple',
  MODERATE: 'moderate',
  COMPLEX: 'complex',
} as const;

export type ComplexityLevel = typeof COMPLEXITY_LEVEL[keyof typeof COMPLEXITY_LEVEL];

// ============================================================================
// LOG ENUMS
// ============================================================================

export const LOG_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type LogSeverity = typeof LOG_SEVERITY[keyof typeof LOG_SEVERITY];

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

export const VALIDATION_LIMITS = {
  ORDER_ID_MAX_LENGTH: 50,
  PO_NUMBER_MAX_LENGTH: 50,
  STYLE_NO_MAX_LENGTH: 50,
  CONTACT_NAME_MAX_LENGTH: 50,
  CONTACT_PHONE_MAX_LENGTH: 20,
  CONTACT_EMAIL_MAX_LENGTH: 100,
  PAYMENT_METHOD_MAX_LENGTH: 50,
  NOTES_MAX_LENGTH: 500,
  ORDER_NOTES_MAX_LENGTH: 1000,
  PRIORITY_MIN: 1,
  PRIORITY_MAX: 10,
  AMOUNT_MIN: 0,
} as const;

// ============================================================================
// PAGINATION CONSTANTS
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
} as const;

// ============================================================================
// CACHE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  ORDERS_SEARCH_TERM: 'ordersSearchTerm',
  ORDERS_SEARCH_TYPE: 'ordersSearchType',
  PROCESS_DATA_CACHE: 'process-data-cache',
  DARK_MODE: 'darkMode',
} as const;

// ============================================================================
// TIME CONSTANTS
// ============================================================================

export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

export const CACHE_TTL = {
  PROCESS_DATA: 5 * TIME_MS.MINUTE, // 5 minutes
  SEARCH_STATE: Infinity, // Persist until cleared
} as const;

// ============================================================================
// API CONSTANTS
// ============================================================================

export const API_TIMEOUT = {
  DEFAULT: 5000,
  DATABASE: 2000,
  UPLOAD: 30000,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a value is a valid order status
 */
export function isValidOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
}

/**
 * Check if a value is a valid order type
 */
export function isValidOrderType(type: string): type is OrderType {
  return Object.values(ORDER_TYPE).includes(type as OrderType);
}

/**
 * Check if a value is a valid payment status
 */
export function isValidPaymentStatus(status: string): status is PaymentStatus {
  return Object.values(PAYMENT_STATUS).includes(status as PaymentStatus);
}

/**
 * Check if a value is a valid user role
 */
export function isValidUserRole(role: string): role is UserRole {
  return Object.values(USER_ROLE).includes(role as UserRole);
}

/**
 * Get all valid order statuses as array
 */
export function getOrderStatuses(): readonly OrderStatus[] {
  return Object.values(ORDER_STATUS);
}

/**
 * Get all valid order types as array
 */
export function getOrderTypes(): readonly OrderType[] {
  return Object.values(ORDER_TYPE);
}

