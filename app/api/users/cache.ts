// Shared cache for user routes to avoid Next.js compile errors when exporting variables from route files
export const usersCacheNormal = new Map<string, { data: any; timestamp: number }>();
export const usersCacheInstant = new Map<string, { data: any; timestamp: number }>();
