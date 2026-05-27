/**
 * Cached Immutable Data
 * 
 * Uses unstable_cache for frequently accessed, rarely-changing data.
 * These caches persist across requests and reduce database load significantly.
 */

import { unstable_cache } from 'next/cache';
import dbConnect from './dbConnect';

// ============================================================================
// QUALITIES CACHE
// ============================================================================

export async function getCachedQualities() {
  return unstable_cache(
    async () => {
      await dbConnect();
      const Quality = (await import('@/models/Quality')).default;
      return await Quality.find({ isActive: { $ne: false } })
        .select('_id name description')
        .lean()
        .maxTimeMS(2000);
    },
    ['qualities-cache'],
    { revalidate: 3600 } // 1 hour
  )();
}

// ============================================================================
// PARTIES CACHE
// ============================================================================

export async function getCachedParties() {
  return unstable_cache(
    async () => {
      await dbConnect();
      const Party = (await import('@/models/Party')).default;
      return await Party.find()
        .select('_id name contactName contactPhone address')
        .lean()
        .maxTimeMS(2000);
    },
    ['parties-cache'],
    { revalidate: 3600 } // 1 hour
  )();
}

// ============================================================================
// MILLS CACHE
// ============================================================================

export async function getCachedMills() {
  return unstable_cache(
    async () => {
      await dbConnect();
      const { Mill } = await import('@/models/Mill');
      return await Mill.find()
        .select('_id name contactPerson contactPhone')
        .lean()
        .maxTimeMS(2000);
    },
    ['mills-cache'],
    { revalidate: 3600 } // 1 hour
  )();
}

// ============================================================================
// PROCESSES CACHE
// ============================================================================

export async function getCachedProcesses() {
  return unstable_cache(
    async () => {
      await dbConnect();
      const Process = (await import('@/models/Process')).default;
      return await Process.find({ isActive: { $ne: false } })
        .select('_id name priority description')
        .sort({ priority: 1 })
        .lean()
        .maxTimeMS(2000);
    },
    ['processes-cache'],
    { revalidate: 3600 } // 1 hour
  )();
}

// ============================================================================
// USERS CACHE (for dropdowns, not sensitive data)
// ============================================================================

export async function getCachedUsers() {
  return unstable_cache(
    async () => {
      await dbConnect();
      const User = (await import('@/models/User')).default;
      return await User.find()
        .select('_id name username role')
        .lean()
        .maxTimeMS(2000);
    },
    ['users-cache'],
    { revalidate: 1800 } // 30 minutes (users change more frequently)
  )();
}

// ============================================================================
// CACHE INVALIDATION HELPERS
// ============================================================================

import { revalidateTag } from 'next/cache';

export async function invalidateQualitiesCache() {
  revalidateTag('qualities-cache');
}

export async function invalidatePartiesCache() {
  revalidateTag('parties-cache');
}

export async function invalidateMillsCache() {
  revalidateTag('mills-cache');
}

export async function invalidateProcessesCache() {
  revalidateTag('processes-cache');
}

export async function invalidateUsersCache() {
  revalidateTag('users-cache');
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// In API routes or Server Components:
import { getCachedQualities, getCachedParties } from '@/lib/cachedData';

// Fast cached fetch - no DB hit if cache is valid
const qualities = await getCachedQualities();
const parties = await getCachedParties();

// After creating/updating, invalidate cache:
import { invalidateQualitiesCache } from '@/lib/cachedData';
await invalidateQualitiesCache();
*/

