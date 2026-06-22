// Shared cache for user routes to avoid Next.js compile errors and resolve singleton issues
const globalForCache = globalThis as unknown as {
  usersCacheNormal?: Map<string, { data: any; timestamp: number }>;
  usersCacheInstant?: Map<string, { data: any; timestamp: number }>;
};

export const usersCacheNormal = globalForCache.usersCacheNormal ?? new Map<string, { data: any; timestamp: number }>();
export const usersCacheInstant = globalForCache.usersCacheInstant ?? new Map<string, { data: any; timestamp: number }>();

if (process.env.NODE_ENV !== 'production') {
  globalForCache.usersCacheNormal = usersCacheNormal;
  globalForCache.usersCacheInstant = usersCacheInstant;
}

