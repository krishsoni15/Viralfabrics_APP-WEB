/**
 * Constants for Weaver Module
 * Centralized configuration values
 */

// Timeout values (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 10000, // 10 seconds
  OPTIMISTIC_SAVE: 15000, // 15 seconds
  LONG_REQUEST: 30000, // 30 seconds for long operations
  SEARCH_DEBOUNCE: 500, // 500ms
  ANIMATION_DELAY: 550, // 550ms (500ms animation + 50ms buffer)
  SORT_ANIMATION: 800, // 800ms for sort flip animation
  GLOW_ANIMATION: 2000, // 2 seconds for glow effect
  MESSAGE_DISPLAY: 4000, // 4 seconds
  RETRY_DELAY: 100, // 100ms for retry attempts
  MOUNT_DELAY: 100, // 100ms for mount state updates
  COMPONENT_READY: 100, // 100ms delay for component readiness
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 25,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  MAX_SAMPLES_LIMIT: 1000,
} as const;

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
} as const;

// Validation limits
export const VALIDATION = {
  NAME_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
  ADDRESS_MAX_LENGTH: 500,
  CONTENT_MAX_LENGTH: 100,
  DANIER_MAX_LENGTH: 50,
  LABEL_MAX_LENGTH: 500,
  NOTE_MAX_LENGTH: 1000,
} as const;

// Valid fabric types
export const FABRIC_TYPES = [
  'Polyester',
  'Blend',
  'Viscose',
  'Cotton',
  'Rayon',
  'Other'
] as const;

export type FabricType = typeof FABRIC_TYPES[number];

// Sort options
export const SORT_OPTIONS = {
  NEWEST: 'newest' as const,
  OLDEST: 'oldest' as const,
} as const;

export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

