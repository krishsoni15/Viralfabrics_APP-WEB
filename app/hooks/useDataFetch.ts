'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/app/store/useAppStore';

export interface UseDataFetchOptions<T> {
  fetchFn: () => Promise<T>;
  cacheKey?: string;
  cacheTTL?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  refetchInterval?: number;
}

export interface UseDataFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
}

export function useDataFetch<T>({
  fetchFn,
  cacheKey,
  cacheTTL = 300000, // 5 minutes default
  enabled = true,
  onSuccess,
  onError,
  refetchInterval,
}: UseDataFetchOptions<T>): UseDataFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getCache, setCache, clearCache: clearStoreCache } = useAppStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    // Prevent duplicate fetches
    if (fetchingRef.current) {
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Check cache first
      if (cacheKey) {
        const cached = getCache(cacheKey, cacheTTL);
        if (cached) {
          setData(cached);
          setLoading(false);
          onSuccess?.(cached);
          return;
        }
      }

      // Fetch fresh data
      const result = await fetchFn();
      
      if (!mountedRef.current) return;

      setData(result);
      
      // Cache the result
      if (cacheKey) {
        setCache(cacheKey, result);
      }
      
      onSuccess?.(result);
    } catch (err) {
      if (!mountedRef.current) {
        fetchingRef.current = false;
        return;
      }
      
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [fetchFn, cacheKey, cacheTTL, enabled, getCache, setCache, onSuccess, onError]);

  const refetch = useCallback(async () => {
    if (cacheKey) {
      clearStoreCache(cacheKey);
    }
    await fetchData();
  }, [fetchData, cacheKey, clearStoreCache]);

  const clearCache = useCallback(() => {
    if (cacheKey) {
      clearStoreCache(cacheKey);
      setData(null);
    }
  }, [cacheKey, clearStoreCache]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Only fetch if enabled
    if (enabled) {
      // Initial fetch
      fetchData().catch((error) => {
        if (mountedRef.current) {
          const err = error instanceof Error ? error : new Error('Unknown error');
          setError(err);
          onError?.(err);
        }
      });
    } else {
      // If disabled, set loading to false immediately
      setLoading(false);
    }

    // Set up refetch interval if provided and enabled
    if (enabled && refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (mountedRef.current && enabled) {
          fetchData().catch((error) => {
            if (mountedRef.current) {
              const err = error instanceof Error ? error : new Error('Unknown error');
              setError(err);
              onError?.(err);
            }
          });
        }
      }, refetchInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData, refetchInterval, onError]);

  return {
    data,
    loading,
    error,
    refetch,
    clearCache,
  };
}

