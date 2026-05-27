/**
 * Validation Library - Centralized Exports
 * 
 * Import from here to ensure consistency between frontend and backend
 */

// Shared base schemas
export * from './shared';

// Complete schemas for all entities
export * from './schemas';

// Security utilities
export * from './security';

// Re-export validation helpers
export { validateData, safeParse, getFirstError, getAllErrors } from './shared';

