/**
 * Constants for Fabrics Module
 * Centralized configuration values
 */

// Timeout values (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 10000, // 10 seconds
  OPTIMISTIC_SAVE: 15000, // 15 seconds
  LONG_REQUEST: 30000, // 30 seconds for long operations
  SEARCH_DEBOUNCE: 500, // 500ms - matches sampling page
  ANIMATION_DELAY: 150, // 150ms fast animations
  SORT_ANIMATION: 150, // 150ms for sort animations
  GLOW_ANIMATION: 2000, // 2 seconds for glow effect (success feedback)
  DELETE_ANIMATION: 300, // 300ms for delete scale-fade
  MESSAGE_DISPLAY: 4000, // 4 seconds
  RETRY_DELAY: 100, // 100ms for retry attempts
  MOUNT_DELAY: 100, // 100ms for mount state updates
  COMPONENT_READY: 100, // 100ms delay for component readiness
  REFRESH_COOLDOWN: 2000, // 2 seconds between refreshes
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  MAX_FABRICS_LIMIT: 1000,
  ITEMS_PER_PAGE_OPTIONS: [10, 20, 50, 100, 'All'] as const,
} as const;

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
} as const;

// Validation limits
export const VALIDATION = {
  QUALITY_CODE_MAX_LENGTH: 50,
  QUALITY_NAME_MAX_LENGTH: 100,
  WEAVER_MAX_LENGTH: 100,
  WEAVER_QUALITY_MAX_LENGTH: 100,
  CONTENT_MAX_LENGTH: 100,
  DANIER_MAX_LENGTH: 50,
  LABEL_MAX_LENGTH: 500,
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

// Search type options
export const SEARCH_TYPES = {
  ALL: 'all',
  QUALITY_CODE: 'qualityCode',
  QUALITY_NAME: 'qualityName',
  TYPE: 'type',
  WEAVER: 'weaver',
  WEAVER_QUALITY: 'weaverQualityName',
  CONTENT: 'content',
  RACK: 'rack',
  LABEL: 'label',
  DANIER: 'danier',
  REED: 'reed',
  PICK: 'pick',
  GREIGH_WIDTH: 'greighWidth',
  FINISH_WIDTH: 'finishWidth',
  WEIGHT: 'weight',
  GSM: 'gsm',
  GREIGH_RATE: 'greighRate',
  COUNT: 'count',
} as const;

export type SearchType = typeof SEARCH_TYPES[keyof typeof SEARCH_TYPES];

// Z-Index system - centralized to prevent conflicts
export const Z_INDEX = {
  MODAL_BACKDROP: 1000,
  MODAL: 1100,
  DROPDOWN: 1200,
  TOAST: 1300,
  DELETE_CONFIRMATION: 1400,
  MAX: 9999, // For critical overlays that must be on top
} as const;

// Animation timing constants
export const ANIMATIONS = {
  FAST: '150ms',
  NORMAL: '300ms',
  SLOW: '500ms',
  DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  EASING: {
    EASE_OUT: 'cubic-bezier(0.16, 1, 0.3, 1)',
    EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)',
    EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

