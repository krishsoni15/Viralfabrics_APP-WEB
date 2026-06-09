/**
 * Centralized cache invalidation utility for fabrics
 * NO CACHING - All caching has been removed
 */

/**
 * Shared cache header constants
 */
export const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// NO CACHING - Removed SHORT_CACHE_HEADERS

/**
 * Database operation timeout constants
 */
export const DATABASE_TIMEOUTS = {
  SHORT: 1000,   // Quick queries
  MEDIUM: 3000,  // Standard queries  
  LONG: 5000,    // Complex aggregations
};

/**
 * Commit delay constants for database writes
 */
export const COMMIT_DELAYS = {
  FAST: 150,     // Simple updates
  STANDARD: 200, // Multi-document updates
  SLOW: 500,     // Bulk operations
};

/**
 * NO CACHING - This function is kept for compatibility but does nothing
 * All caching has been removed from the fabrics page
 */
export async function invalidateAllFabricCaches(fabricIds?: string[]) {
  // NO CACHING - Function kept for compatibility but does nothing
  // All data is fetched fresh from the database on every request
}

/**
 * Wait for database writes to commit
 * Use this before returning responses to ensure data is persisted
 */
export async function waitForDatabaseCommit(delayMs: number = 200): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Verify fabrics exist in database after save
 * Returns verified fabrics from database
 */
export async function verifyFabricsInDatabase(fabrics: any[]): Promise<any[]> {
  const Fabric = (await import('@/models/Fabric')).default;
  const verifiedFabrics = [];
  
  for (const fabric of fabrics) {
    if (fabric && fabric._id) {
      try {
        const verified = await Fabric.findById(fabric._id).lean() as any;
        if (verified) {
          verifiedFabrics.push(verified);
        } else {
          console.error('⚠️ Fabric not found in database after save:', fabric._id);
        }
      } catch (verifyError) {
        console.error('❌ Error verifying fabric:', verifyError);
      }
    }
  }
  
  return verifiedFabrics;
}

