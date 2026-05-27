/**
 * LocalStorage utility functions
 * Type-safe storage helpers with error handling
 */

import { STORAGE_KEYS } from '@/constants/enums';

// ============================================================================
// GENERIC STORAGE FUNCTIONS
// ============================================================================

/**
 * Safely get item from localStorage
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to get storage item "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely set item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set storage item "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove storage item "${key}":`, error);
    return false;
  }
}

/**
 * Clear all localStorage items
 */
export function clearStorage(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.warn('Failed to clear storage:', error);
    return false;
  }
}

// ============================================================================
// SPECIFIC STORAGE FUNCTIONS
// ============================================================================

/**
 * Get orders search term from storage
 */
export function getOrdersSearchTerm(): string {
  return getStorageItem<string>(STORAGE_KEYS.ORDERS_SEARCH_TERM, '');
}

/**
 * Set orders search term in storage
 */
export function setOrdersSearchTerm(term: string): void {
  setStorageItem(STORAGE_KEYS.ORDERS_SEARCH_TERM, term);
}

/**
 * Get orders search type from storage
 */
export function getOrdersSearchType(): string {
  return getStorageItem<string>(STORAGE_KEYS.ORDERS_SEARCH_TYPE, 'all');
}

/**
 * Set orders search type in storage
 */
export function setOrdersSearchType(type: string): void {
  setStorageItem(STORAGE_KEYS.ORDERS_SEARCH_TYPE, type);
}

/**
 * Get process data cache from storage
 */
export interface ProcessDataCache {
  timestamp: number;
  millInputs: Record<string, any[]>;
  millOutputs: Record<string, any[]>;
  dispatches: Record<string, any[]>;
  greyInfo: Record<string, any[]>;
  processData: Record<string, string[]>;
}

export function getProcessDataCache(): ProcessDataCache | null {
  const cache = getStorageItem<ProcessDataCache | null>(
    STORAGE_KEYS.PROCESS_DATA_CACHE,
    null
  );

  if (!cache) return null;

  // Check if cache is expired (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  if (Date.now() - cache.timestamp > CACHE_TTL) {
    removeStorageItem(STORAGE_KEYS.PROCESS_DATA_CACHE);
    return null;
  }

  return cache;
}

/**
 * Set process data cache in storage
 */
export function setProcessDataCache(cache: Omit<ProcessDataCache, 'timestamp'>): void {
  const cacheWithTimestamp: ProcessDataCache = {
    ...cache,
    timestamp: Date.now(),
  };
  setStorageItem(STORAGE_KEYS.PROCESS_DATA_CACHE, cacheWithTimestamp);
}

/**
 * Clear process data cache
 */
export function clearProcessDataCache(): void {
  removeStorageItem(STORAGE_KEYS.PROCESS_DATA_CACHE);
}

