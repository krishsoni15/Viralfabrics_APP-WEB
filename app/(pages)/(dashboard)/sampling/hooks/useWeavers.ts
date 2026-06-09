import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import type { Weaver, PaginationInfo } from '../types';

// Re-export for backward compatibility
export type { Weaver, PaginationInfo } from '../types';

interface UseWeaversOptions {
  itemsPerPage: number;
  sortOrder: 'newest' | 'oldest';
  onMessage?: (type: 'success' | 'error', text: string) => void;
}

export function useWeavers(options: UseWeaversOptions) {
  const { itemsPerPage, sortOrder, onMessage } = options;
  
  const [weavers, setWeavers] = useState<Weaver[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('samplingWeavers');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return [];
  });
  
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('samplingPagination');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return {
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      hasNextPage: false,
      hasPrevPage: false
    };
  });
  
  const [loading, setLoading] = useState(false);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParamsRef = useRef<{ page: number; limit: number; search: string; sort: string } | null>(null);
  const hasInitialLoadRef = useRef(false);
  const isInitialMountRef = useRef(true);
  
  // Helper function to update weavers and persist to sessionStorage
  const updateWeavers = useCallback((updater: (prev: Weaver[]) => Weaver[]) => {
    setWeavers(prevWeavers => {
      const newWeavers = updater(prevWeavers);
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('samplingWeavers', JSON.stringify(newWeavers));
        } catch (e) {
          // Ignore storage errors
        }
      }
      return newWeavers;
    });
  }, []);
  
  // Helper function to update pagination and persist to sessionStorage
  const updatePaginationInfo = useCallback((updater: (prev: PaginationInfo) => PaginationInfo) => {
    setPaginationInfo(prev => {
      const newPagination = updater(prev);
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('samplingPagination', JSON.stringify(newPagination));
        } catch (e) {
          // Ignore storage errors
        }
      }
      return newPagination;
    });
  }, []);
  
  // Fetch weavers with pagination
  const fetchWeavers = useCallback(async (
    page: number = 1,
    limit: number = itemsPerPage,
    search: string = '',
    sort: 'newest' | 'oldest' = sortOrder
  ) => {
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      return;
    }
    
    // Check if this exact fetch was already made
    const fetchKey = `${page}-${limit}-${search}-${sort}`;
    const lastKey = lastFetchParamsRef.current 
      ? `${lastFetchParamsRef.current.page}-${lastFetchParamsRef.current.limit}-${lastFetchParamsRef.current.search}-${lastFetchParamsRef.current.sort}`
      : null;
    
    // Allow fetch on initial mount or if params changed
    if (fetchKey === lastKey && !isInitialMountRef.current && hasInitialLoadRef.current) {
      return;
    }
    
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    isFetchingRef.current = true;
    setIsChangingPage(true);
    lastFetchParamsRef.current = { page, limit, search, sort };
    
    let controller: AbortController | null = null;
    let timeoutId: any = null;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logger.warn('No authentication token found, skipping fetch');
        isFetchingRef.current = false;
        setIsChangingPage(false);
        if (isInitialMountRef.current && !hasInitialLoadRef.current) {
          onMessage?.('error', 'Authentication required. Please login again.');
        }
        return;
      }
      
      controller = new AbortController();
      abortControllerRef.current = controller;
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 10000);
      
      const url = new URL('/api/sampling/weavers', window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('limit', limit.toString());
      url.searchParams.append('sort', sort);
      if (search.trim()) {
        url.searchParams.append('search', search.trim());
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const weaversData = data.data || [];
          setWeavers(weaversData);
          
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('samplingWeavers', JSON.stringify(weaversData));
            } catch (e) {
              // Ignore storage errors
            }
          }
          
          if (data.pagination) {
            const paginationPage = data.pagination.page || 1;
            const paginationData = {
              totalCount: data.pagination.total || 0,
              totalPages: data.pagination.pages || 1,
              currentPage: paginationPage,
              hasNextPage: paginationPage < (data.pagination.pages || 1),
              hasPrevPage: paginationPage > 1
            };
            setPaginationInfo(paginationData);
            
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('samplingPagination', JSON.stringify(paginationData));
              } catch (e) {
                // Ignore storage errors
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.error('Error fetching weavers', error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsChangingPage(false);
      isFetchingRef.current = false;
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [itemsPerPage, sortOrder, onMessage]);
  
  return {
    weavers,
    setWeavers,
    updateWeavers,
    paginationInfo,
    setPaginationInfo,
    updatePaginationInfo,
    loading,
    setLoading,
    isChangingPage,
    setIsChangingPage,
    fetchWeavers,
    isFetchingRef,
    abortControllerRef,
    lastFetchParamsRef,
    hasInitialLoadRef,
    isInitialMountRef
  };
}

