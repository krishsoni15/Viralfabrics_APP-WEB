'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { TIMEOUTS } from './constants';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  EyeIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CurrencyDollarIcon,
  ScaleIcon,
  CubeIcon as CubeIconOutline,
  HashtagIcon,
  UserIcon,
  DevicePhoneMobileIcon,
  BuildingOfficeIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BarsArrowUpIcon,
  BarsArrowDownIcon,
  ArrowUpIcon,
  Squares2X2Icon,
  ListBulletIcon,
  SwatchIcon
} from '@heroicons/react/24/outline';
import WeaverIcon from '../components/WeaverIcon';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuthSession } from '../hooks/useAuthSession';
import { lazy, Suspense } from 'react';
import WeaverPageSkeleton from './components/WeaverPageSkeleton';
import UnauthorizedMessage from './components/UnauthorizedMessage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ImageGallery } from './components/ImageGallery';
import { generateSampleStickerPDF, downloadSampleStickerPDFDirect } from '@/lib/pdfGenerator';

// Lazy load heavy components for code-splitting
const SampleForm = lazy(() => import('./components/SampleForm'));
const WeaverModal = lazy(() => import('./components/WeaverModal'));
const preloadWeaverModal = () => import('./components/WeaverModal');

// Import shared types
import type { Weaver, Sample, PaginationInfo } from './types';

export default function WeaverPage() {
  const router = useRouter();
  const { isDarkMode, mounted: darkModeMounted } = useDarkMode();
  // Preload the Weaver modal chunk so the first open is instant
  useEffect(() => {
    preloadWeaverModal().catch(() => {
      // Ignore preload failures; modal will lazy-load normally
    });
  }, []);
  const { isSuperAdmin, isMaster, isLoading: authLoading, isAuthenticated } = useAuthSession();

  // useTransition for non-urgent updates (search, filters)
  const [isPending, startTransition] = useTransition();

  // Get initial theme synchronously to prevent white flash
  const [initialTheme] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Check window object first (set by layout script)
    const windowTheme = (window as any).__INITIAL_THEME__;
    if (windowTheme !== undefined) return windowTheme;
    // Check document class
    if (document.documentElement.classList.contains('dark')) return true;
    // Check localStorage
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
    } catch { }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Use initial theme until mounted, then use hook value
  const currentTheme = darkModeMounted ? isDarkMode : initialTheme;

  // Initialize state with persisted data if available
  const [weavers, setWeavers] = useState<Weaver[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('weaverWeavers');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return [];
  });
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(() => {
    // If we have persisted data, start with loading false
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('weaverWeavers');
        if (saved && JSON.parse(saved).length > 0) {
          return false;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return true;
  });
  const [showWeaverModal, setShowWeaverModal] = useState(false);
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [editingWeaver, setEditingWeaver] = useState<Weaver | null>(null);
  const [selectedWeaver, setSelectedWeaver] = useState<Weaver | null>(null);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedWeaverId, setSelectedWeaverId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    type: 'weaver' | 'sample';
    id: string;
    name?: string;
    sampleCount?: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingSample, setViewingSample] = useState<Sample | null>(null);
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(null);
  const [currentStickerSample, setCurrentStickerSample] = useState<Sample | null>(null);
  const [isLoadingStickerPreview, setIsLoadingStickerPreview] = useState(false);

  // Pagination state
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const setCookie = (name: string, value: string, days: number = 365): void => {
    if (typeof document === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
  };

  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedItemsPerPage = getCookie('weaverItemsPerPage');
      if (savedItemsPerPage) {
        const parsed = parseInt(savedItemsPerPage, 10);
        if ([10, 25, 50, 100].includes(parsed)) {
          return parsed;
        }
      }
    }
    return 10; // Default to 10 items per page
  });

  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('weaverPagination');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.currentPage || 1;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return 1;
  });
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('weaverPagination');
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
  const [isChangingPage, setIsChangingPage] = useState(false);
  const itemsPerPageOptions = [10, 25, 50, 100] as const;
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<any>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(() => {
    if (typeof window !== 'undefined') {
      const savedSortOrder = getCookie('weaverSortOrder');
      if (savedSortOrder === 'newest' || savedSortOrder === 'oldest') {
        return savedSortOrder;
      }
    }
    return 'newest'; // Default to newest
  });
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const hasInitialLoadRef = useRef(false); // Track if initial load has completed
  const isInitialMountRef = useRef(true); // Track if this is the first mount
  const isFetchingRef = useRef(false); // Prevent duplicate concurrent fetches
  const abortControllerRef = useRef<AbortController | null>(null); // Store AbortController for cleanup
  const lastFetchParamsRef = useRef<{ page: number; limit: number; search: string; sort: string } | null>(null); // Track last fetch to prevent duplicates

  // Helper function to update weavers and persist to sessionStorage
  const updateWeavers = useCallback((updater: (prev: Weaver[]) => Weaver[]) => {
    setWeavers(prevWeavers => {
      const newWeavers = updater(prevWeavers);
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('weaverWeavers', JSON.stringify(newWeavers));
        } catch (e) {
          // Ignore storage errors
        }
      }
      return newWeavers;
    });
  }, []);

  // Helper function to update pagination and persist to sessionStorage
  const updatePaginationInfo = useCallback((updater: (prev: PaginationInfo) => PaginationInfo) => {
    setPaginationInfo((prevPagination: PaginationInfo) => {
      const newPagination = updater(prevPagination);
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('weaverPagination', JSON.stringify(newPagination));
        } catch (e) {
          // Ignore storage errors
        }
      }
      return newPagination;
    });
  }, []);
  const [windowWidth, setWindowWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // Default to desktop width
  });
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = getCookie('weaverViewMode');
      if (savedViewMode === 'table' || savedViewMode === 'cards') {
        return savedViewMode;
      }
      // Default: cards on screens under 600px, table on larger screens
      const isSmallScreen = window.innerWidth < 600;
      const defaultMode = isSmallScreen ? 'cards' : 'table';
      // Save the default to cookie
      setCookie('weaverViewMode', defaultMode, 365);
      return defaultMode;
    }
    return 'table';
  });

  // Check if mobile device
  const isMobileDevice = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768)
  );

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
  }, []);

  // Track optimistic updates for rollback
  const optimisticUpdatesRef = useRef<Map<string, { originalWeaver?: Weaver; isNew: boolean }>>(new Map());
  // Track newly added weavers for animation
  const newlyAddedWeaversRef = useRef<Set<string>>(new Set());
  // Track edited weavers for animation
  const editedWeaversRef = useRef<Set<string>>(new Set());
  // Track deleting weavers for animation
  const deletingWeaversRef = useRef<Set<string>>(new Set());
  // Track weavers with new samples (for green glow animation)
  const weaversWithNewSamplesRef = useRef<Set<string>>(new Set());
  // Track weavers whose View button should glow purple (after sample save)
  const weaversWithPurpleViewRef = useRef<Set<string>>(new Set());
  // Track sort flip animation
  const [sortFlipDirection, setSortFlipDirection] = useState<'top-to-bottom' | 'bottom-to-top' | null>(null);
  // Store fetchWeavers in a ref to avoid initialization issues
  const fetchWeaversRef = useRef<((page: number, limit: number, search: string, sort: 'newest' | 'oldest') => Promise<void>) | null>(null);

  // Retry function with exponential backoff
  const retryApiCall = async <T,>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Unknown error');
  };

  // Fetch weavers with pagination - defined first to avoid initialization issues
  const fetchWeavers = useCallback(async (page: number = 1, limit: number = itemsPerPage, search: string = '', sort: 'newest' | 'oldest' = sortOrder) => {
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    // Check if this exact fetch was already made (but allow initial mount to always fetch)
    const fetchKey = `${page}-${limit}-${search}-${sort}`;
    const lastKey = lastFetchParamsRef.current
      ? `${lastFetchParamsRef.current.page}-${lastFetchParamsRef.current.limit}-${lastFetchParamsRef.current.search}-${lastFetchParamsRef.current.sort}`
      : null;

    // Allow fetch on initial mount, if params changed, or if lastFetchParamsRef was reset (for search)
    if (fetchKey === lastKey && !isInitialMountRef.current && hasInitialLoadRef.current && lastFetchParamsRef.current !== null) {
      return; // Same fetch, skip (but only after initial load is complete)
    }

    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    isFetchingRef.current = true;
    setIsChangingPage(true);

    // Store fetch parameters
    lastFetchParamsRef.current = { page, limit, search, sort };

    let controller: AbortController | null = null;
    let timeoutId: any = null;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logger.warn('No authentication token found, skipping fetch');
        isFetchingRef.current = false;
        setIsChangingPage(false);
        // If this is initial load and no token, show error message
        if (isInitialMountRef.current && !hasInitialLoadRef.current) {
          setMessage({ type: 'error', text: 'Authentication required. Please login again.' });
          setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
        }
        return;
      }

      // Create AbortController for request cancellation
      controller = new AbortController();
      abortControllerRef.current = controller; // Store for cleanup
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 10000); // 10 second timeout

      const url = new URL('/api/weaver/weavers', window.location.origin);
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

      // Clear timeout on successful response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const weaversData = data.data || [];
          setWeavers(weaversData);
          // Persist to sessionStorage
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('weaverWeavers', JSON.stringify(weaversData));
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
            // Persist to sessionStorage
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('weaverPagination', JSON.stringify(paginationData));
              } catch (e) {
                // Ignore storage errors
              }
            }
            // Only update currentPage if it's different (prevents infinite loop)
            if (currentPage !== paginationPage) {
              setCurrentPage(paginationPage);
            }
          }
        }
      }
    } catch (error) {
      // Ignore abort errors
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
      // Clear AbortController ref if this was the current request
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [itemsPerPage, sortOrder, currentPage]);

  // Store fetchWeavers in ref
  useEffect(() => {
    fetchWeaversRef.current = fetchWeavers;
  }, [fetchWeavers]);

  // Optimistic save handler - updates UI first, then API in background
  const handleOptimisticWeaverSave = useCallback(async (formData: { name: string; phone: string; address: string }) => {
    // Check if editingWeaver exists and has a valid MongoDB ObjectId (not a temp ID)
    const isValidMongoId = (id: string): boolean => {
      return /^[0-9a-fA-F]{24}$/.test(id);
    };

    const isEdit = !!editingWeaver && editingWeaver._id && isValidMongoId(editingWeaver._id);
    const editingId = editingWeaver?._id || '';
    const tempId = isEdit ? editingId : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic weaver
    const optimisticWeaver: Weaver = {
      _id: tempId,
      name: formData.name.trim(),
      phone: formData.phone?.trim() || '',
      address: formData.address?.trim() || ''
    };

    // Store original state for rollback
    if (isEdit) {
      const originalWeaver = weavers.find(w => w._id === editingId);
      if (originalWeaver) {
        optimisticUpdatesRef.current.set(tempId, { originalWeaver, isNew: false });
      }
    } else {
      optimisticUpdatesRef.current.set(tempId, { isNew: true });
    }

    // Update UI immediately (optimistic update) with animation
    updateWeavers(prevWeavers => {
      if (isEdit) {
        // Update existing weaver
        return prevWeavers.map(w => w._id === editingId ? optimisticWeaver : w);
      } else {
        // Mark as newly added for animation
        newlyAddedWeaversRef.current.add(tempId);
        // Remove animation class after animation completes
        setTimeout(() => {
          newlyAddedWeaversRef.current.delete(tempId);
        }, TIMEOUTS.ANIMATION_DELAY);

        // Add new weaver at the beginning (if sorting by newest) or end (if sorting by oldest)
        if (sortOrder === 'newest') {
          return [optimisticWeaver, ...prevWeavers];
        } else {
          return [...prevWeavers, optimisticWeaver];
        }
      }
    });

    // Update pagination for new weavers
    if (!isEdit) {
      updatePaginationInfo(prev => ({
        ...prev,
        totalCount: prev.totalCount + 1
      }));

      // If sorting by newest, go to page 1 to see the new weaver
      if (sortOrder === 'newest') {
        setCurrentPage(1);
      }
    }

    // Close modal immediately
    setShowWeaverModal(false);
    setEditingWeaver(null);

    // Make API call in background with retry logic
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Only use PUT if we have a valid MongoDB ObjectId, otherwise use POST
      const url = isEdit && editingId && isValidMongoId(editingId)
        ? `/api/weaver/weavers/${editingId}`
        : '/api/weaver/weavers';
      const method = isEdit && editingId && isValidMongoId(editingId) ? 'PUT' : 'POST';

      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.OPTIMISTIC_SAVE);

      const response = await retryApiCall(async () => {
        try {
          const res = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            let errorData;
            try {
              errorData = await res.json();
            } catch {
              errorData = { message: `HTTP ${res.status}: ${res.statusText}` };
            }
            const error = new Error(errorData.message || `HTTP ${res.status}`);
            (error as any).status = res.status;
            throw error;
          }

          return res;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new Error('Request timeout. Please check your connection and try again.');
            (timeoutError as any).status = 408;
            throw timeoutError;
          }
          // Handle network errors
          if (error instanceof TypeError && error.message.includes('fetch')) {
            const networkError = new Error('Network error. Please check your connection and try again.');
            (networkError as any).status = 0;
            throw networkError;
          }
          throw error;
        }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to save weaver');
      }

      // Replace optimistic weaver with real data from server
      const realWeaver: Weaver = {
        _id: data.data._id,
        name: data.data.name,
        phone: data.data.phone || '',
        address: data.data.address || ''
      };

      updateWeavers(prevWeavers => {
        if (isEdit) {
          // Mark as edited for animation
          editedWeaversRef.current.add(realWeaver._id);
          setTimeout(() => {
            editedWeaversRef.current.delete(realWeaver._id);
          }, 600);

          return prevWeavers.map(w => w._id === tempId ? realWeaver : w);
        } else {
          // Replace temp weaver with real one
          return prevWeavers.map(w => w._id === tempId ? realWeaver : w);
        }
      });

      // Clean up optimistic update tracking
      optimisticUpdatesRef.current.delete(tempId);
      // Remove from newly added set (animation already completed)
      newlyAddedWeaversRef.current.delete(tempId);

      // Don't show success message - UI already updated, no need for popup
      // Only show errors if something goes wrong

      // No need to refresh - optimistic update already shows the correct data
      // The server data will be synced on next natural refresh (pagination, search, etc.)

    } catch (error) {
      // Rollback optimistic update
      const updateInfo = optimisticUpdatesRef.current.get(tempId);
      if (updateInfo) {
        updateWeavers(prevWeavers => {
          if (updateInfo.isNew) {
            // Remove the optimistic weaver
            return prevWeavers.filter(w => w._id !== tempId);
          } else if (updateInfo.originalWeaver) {
            // Restore original weaver
            return prevWeavers.map(w => w._id === tempId ? updateInfo.originalWeaver! : w);
          }
          return prevWeavers;
        });

        // Rollback pagination
        if (updateInfo.isNew) {
          updatePaginationInfo(prev => ({
            ...prev,
            totalCount: Math.max(0, prev.totalCount - 1)
          }));
        }
      }

      // Clean up
      optimisticUpdatesRef.current.delete(tempId);

      // Show error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to save weaver. Please try again.';
      showMessage('error', errorMessage);

      logger.error('Error saving weaver (after retries)', error instanceof Error ? error : new Error(String(error)));
    }
  }, [editingWeaver, weavers, sortOrder, currentPage, itemsPerPage, searchQuery, showMessage]);

  // Store AbortController for samples fetch
  const samplesAbortControllerRef = useRef<AbortController | null>(null);

  // Fetch samples - only when needed (not on every mount)
  const fetchSamples = useCallback(async (weaverId?: string) => {
    // Abort previous request if still pending
    if (samplesAbortControllerRef.current) {
      samplesAbortControllerRef.current.abort();
    }

    let controller: AbortController | null = null;
    let timeoutId: any = null;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      // Create AbortController for request cancellation
      controller = new AbortController();
      samplesAbortControllerRef.current = controller; // Store for cleanup
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 10000); // 10 second timeout

      const url = weaverId
        ? `/api/weaver/samples?weaverId=${weaverId}`
        : '/api/weaver/samples';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });

      // Clear timeout on successful response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSamples(data.data || []);
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.error('Error fetching samples', error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Clear AbortController ref if this was the current request
      if (samplesAbortControllerRef.current === controller) {
        samplesAbortControllerRef.current = null;
      }
    }
  }, []);

  // Initial load - wait for auth to be ready before fetching
  useEffect(() => {
    // Check sessionStorage to see if we just navigated back (component persisted)
    const wasNavigatingBack = typeof window !== 'undefined' && sessionStorage.getItem('weaverNavigatedBack') === 'true';

    // If weavers are already loaded from persisted state (e.g., navigating back), skip initial load
    if (weavers.length > 0 && paginationInfo.totalCount > 0) {
      hasInitialLoadRef.current = true;
      isInitialMountRef.current = false;
      setLoading(false);
      // Clear the navigation flag
      if (wasNavigatingBack) {
        sessionStorage.removeItem('weaverNavigatedBack');
      }
      return;
    }

    // If we just navigated back but data is empty, it means component remounted
    // In this case, we should still skip if we're just viewing (no data changed)
    if (wasNavigatingBack) {
      const dataChanged = sessionStorage.getItem('weaverDataChanged') === 'true';
      if (!dataChanged) {
        // User just viewed, no changes - try to restore from sessionStorage
        try {
          const savedWeavers = sessionStorage.getItem('weaverWeavers');
          const savedPagination = sessionStorage.getItem('weaverPagination');
          if (savedWeavers && savedPagination) {
            const parsedWeavers = JSON.parse(savedWeavers);
            const parsedPagination = JSON.parse(savedPagination);
            if (parsedWeavers.length > 0) {
              setWeavers(parsedWeavers);
              setPaginationInfo(parsedPagination);
              setCurrentPage(parsedPagination.currentPage || 1);
              hasInitialLoadRef.current = true;
              isInitialMountRef.current = false;
              setLoading(false);
              sessionStorage.removeItem('weaverNavigatedBack');
              return;
            }
          }
        } catch (e) {
          // Ignore parse errors, continue with fetch
        }
        // If restore failed, skip fetch anyway (user just viewed)
        hasInitialLoadRef.current = true;
        isInitialMountRef.current = false;
        setLoading(false);
        sessionStorage.removeItem('weaverNavigatedBack');
        return;
      }
      // Data changed, we'll fetch below
      sessionStorage.removeItem('weaverNavigatedBack');
    }

    if (hasInitialLoadRef.current) return; // Prevent duplicate initial loads
    if (authLoading) return; // Wait for auth to finish loading

    const loadData = async (retryCount = 0) => {
      // Double check token is available before fetching
      const token = localStorage.getItem('token');
      if (!token) {
        // Token not available yet, retry up to 10 times (1 second total wait)
        if (retryCount < 10) {
          setTimeout(() => {
            if (!hasInitialLoadRef.current) {
              loadData(retryCount + 1);
            }
          }, TIMEOUTS.RETRY_DELAY);
        } else {
          // Give up after 1 second, show error
          setLoading(false);
          setMessage({ type: 'error', text: 'Authentication required. Please login again.' });
          setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
          hasInitialLoadRef.current = true; // Mark as attempted to prevent infinite retries
        }
        return;
      }

      setLoading(true);
      try {
        // Reset fetch state to ensure initial fetch happens
        isFetchingRef.current = false;
        lastFetchParamsRef.current = null;

        // Store initial fetch params to prevent duplicate calls
        lastFetchParamsRef.current = { page: currentPage, limit: itemsPerPage, search: searchQuery, sort: sortOrder };
        await fetchWeavers(currentPage, itemsPerPage, searchQuery, sortOrder);
        // Only fetch all samples if needed (for card view with sample counts)
        // For table view, we don't need all samples upfront
        if (viewMode === 'cards') {
          await fetchSamples();
        }
      } finally {
        setLoading(false);
        // Mark initial load as complete AFTER fetch completes
        hasInitialLoadRef.current = true;
        // Small delay before marking mount as done to ensure all effects have run
        setTimeout(() => {
          isInitialMountRef.current = false;
        }, TIMEOUTS.MOUNT_DELAY);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]); // Re-run when auth loading state changes

  // Close dropdowns when clicking outside - only one dropdown open at a time
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.sort-dropdown-container') && !target.closest('.items-per-page-dropdown-container')) {
        setShowSortDropdown(false);
        setShowItemsPerPageDropdown(false);
      }
    };
    if (showSortDropdown || showItemsPerPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortDropdown, showItemsPerPageDropdown]);

  // Fetch weavers when pagination/sort changes (but not on initial load or search - search is handled by debounced handler)
  useEffect(() => {
    // Skip on initial mount - let the initial load useEffect handle it
    if (isInitialMountRef.current) return;
    // Skip if initial load hasn't completed yet
    if (!hasInitialLoadRef.current) return;
    // Skip if currently loading (prevents duplicate calls during transitions)
    if (loading || isChangingPage) return;
    // Skip if already fetching (prevents duplicate concurrent calls)
    if (isFetchingRef.current) return;

    // Check if we just navigated back - if so, skip unless data changed
    const wasNavigatingBack = typeof window !== 'undefined' && sessionStorage.getItem('weaverNavigatedBack') === 'true';
    if (wasNavigatingBack) {
      const dataChanged = sessionStorage.getItem('weaverDataChanged') === 'true';
      if (!dataChanged) {
        // Just viewing, no changes - skip fetch
        sessionStorage.removeItem('weaverNavigatedBack');
        return;
      }
      // Data changed, continue with fetch below
      sessionStorage.removeItem('weaverNavigatedBack');
    }

    // Check if this is the same fetch as the last one (prevents duplicate calls)
    const fetchKey = `${currentPage}-${itemsPerPage}-${searchQuery}-${sortOrder}`;
    const lastKey = lastFetchParamsRef.current
      ? `${lastFetchParamsRef.current.page}-${lastFetchParamsRef.current.limit}-${lastFetchParamsRef.current.search}-${lastFetchParamsRef.current.sort}`
      : null;

    if (fetchKey === lastKey) {
      return; // Same parameters, skip fetch
    }

    // Only fetch if weavers are already loaded (pagination/item change)
    // This prevents fetching when weavers array is empty on initial load
    // Note: searchQuery changes are handled by the debounced handleSearchChange, not here
    if (weavers.length > 0 || paginationInfo.totalCount > 0) {
      // Store fetch parameters before calling
      lastFetchParamsRef.current = { page: currentPage, limit: itemsPerPage, search: searchQuery, sort: sortOrder };
      fetchWeavers(currentPage, itemsPerPage, searchQuery, sortOrder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: searchQuery is intentionally excluded - search is handled by debounced handleSearchChange
  }, [currentPage, itemsPerPage, sortOrder, loading, isChangingPage, weavers.length, paginationInfo.totalCount]);

  // Check if data was changed when navigating back from view page
  useEffect(() => {
    // Only check if weavers are already loaded (not on initial mount)
    if (!hasInitialLoadRef.current && weavers.length === 0) {
      return; // Skip if initial load hasn't happened yet
    }

    const checkDataChanged = () => {
      if (typeof window !== 'undefined') {
        const dataChanged = sessionStorage.getItem('weaverDataChanged');
        const wasNavigatingBack = sessionStorage.getItem('weaverNavigatedBack') === 'true';

        if (dataChanged === 'true') {
          // Clear both flags
          sessionStorage.removeItem('weaverDataChanged');
          sessionStorage.removeItem('weaverNavigatedBack');
          // Refresh the weavers list only if we're not currently loading and data exists
          if (!loading && !isChangingPage && !isFetchingRef.current && hasInitialLoadRef.current) {
            fetchWeavers(currentPage, itemsPerPage, searchQuery, sortOrder);
          }
        } else if (wasNavigatingBack) {
          // Just navigating back, no data changed - clear flag
          sessionStorage.removeItem('weaverNavigatedBack');
        }
      }
    };

    // Check immediately on mount (in case user navigated back)
    // But only if weavers are already loaded (component persisted)
    if (weavers.length > 0) {
      checkDataChanged();
    }

    // Also check when page becomes visible (user navigates back)
    // But only check once, not on every visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && weavers.length > 0) {
        // Small delay to ensure component is ready
        setTimeout(() => {
          checkDataChanged();
        }, TIMEOUTS.COMPONENT_READY);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPage, itemsPerPage, searchQuery, sortOrder, loading, isChangingPage, fetchWeavers, weavers.length]);

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showSampleForm || viewingSample) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSampleForm, viewingSample]);


  const handleAddWeaver = () => {
    setEditingWeaver(null);
    // Close any open dropdowns when opening modal
    setShowSortDropdown(false);
    setShowItemsPerPageDropdown(false);
    setShowWeaverModal(true);
  };

  const handleEditWeaver = (weaver: Weaver) => {
    // Prevent editing weavers with temp IDs (from optimistic updates that haven't completed)
    const isValidMongoId = (id: string): boolean => {
      return /^[0-9a-fA-F]{24}$/.test(id);
    };

    if (weaver._id && !isValidMongoId(weaver._id)) {
      // This is a temp ID - wait for the real ID to be available
      logger.warn('Cannot edit weaver with temp ID, waiting for real ID', {
        tempId: weaver._id,
        weaverName: weaver.name
      });
      showMessage('error', 'Please wait for the weaver to be saved before editing.');
      return;
    }

    setEditingWeaver(weaver);
    // Close any open dropdowns when opening modal
    setShowSortDropdown(false);
    setShowItemsPerPageDropdown(false);
    setShowWeaverModal(true);
  };

  const handleDeleteWeaver = (id: string, name: string) => {
    // Show confirmation modal without making any API call
    // Explicitly prevent any sample fetching or other side effects
    setDeleteConfirmation({
      show: true,
      type: 'weaver',
      id,
      name
    });
    // Ensure we don't accidentally select the weaver or trigger sample fetching
    // Don't set selectedWeaverId here - only set it when explicitly needed (like Add Sample)
  };

  const confirmDeleteWeaver = async () => {
    if (!deleteConfirmation) return;

    const weaverId = deleteConfirmation.id;
    const weaverToDelete = weavers.find(w => w._id === weaverId);

    // Close confirmation modal immediately
    setDeleteConfirmation(null);
    setIsDeleting(false);

    // Optimistic delete - start animation immediately
    deletingWeaversRef.current.add(weaverId);

    // Remove from UI after animation completes
    setTimeout(() => {
      updateWeavers(prevWeavers => prevWeavers.filter(w => w._id !== weaverId));
      updatePaginationInfo(prev => ({
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1)
      }));

      // Check if we need to go to previous page if current page becomes empty
      const remainingCount = weavers.length - 1;
      if (remainingCount === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }

      // Clean up animation tracking
      deletingWeaversRef.current.delete(weaverId);
    }, 650);

    // Clear selected weaver if it's the one being deleted
    if (selectedWeaverId === weaverId) {
      setSelectedWeaverId(null);
      setSelectedWeaver(null);
      setSamples([]);
    }

    // Make API call in background
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Rollback on auth error
        if (weaverToDelete) {
          updateWeavers(prevWeavers => {
            const index = weavers.findIndex(w => w._id === weaverId);
            if (index === -1) {
              return [...prevWeavers, weaverToDelete];
            }
            return prevWeavers;
          });
          updatePaginationInfo(prev => ({
            ...prev,
            totalCount: prev.totalCount + 1
          }));
        }
        deletingWeaversRef.current.delete(weaverId);
        showMessage('error', 'Authentication required');
        return;
      }

      const response = await fetch(`/api/weaver/weavers/${weaverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!data.success) {
        // Rollback on API error
        if (weaverToDelete) {
          updateWeavers(prevWeavers => {
            const exists = prevWeavers.find(w => w._id === weaverId);
            if (!exists) {
              return [...prevWeavers, weaverToDelete];
            }
            return prevWeavers;
          });
          updatePaginationInfo(prev => ({
            ...prev,
            totalCount: prev.totalCount + 1
          }));
        }
        deletingWeaversRef.current.delete(weaverId);
        showMessage('error', data.message || 'Failed to delete weaver');
      }
      // No success message - animation already shows the deletion
    } catch (error) {
      // Rollback on network error
      if (weaverToDelete) {
        updateWeavers(prevWeavers => {
          const exists = prevWeavers.find(w => w._id === weaverId);
          if (!exists) {
            return [...prevWeavers, weaverToDelete];
          }
          return prevWeavers;
        });
        updatePaginationInfo(prev => ({
          ...prev,
          totalCount: prev.totalCount + 1
        }));
      }
      deletingWeaversRef.current.delete(weaverId);
      logger.error('Error deleting weaver', error instanceof Error ? error : new Error(String(error)));
      showMessage('error', 'Error deleting weaver. Please try again.');
    }
  };

  const handleWeaverSaved = () => {
    setShowWeaverModal(false);
    // Reset fetch params to force refresh
    lastFetchParamsRef.current = null;
    isFetchingRef.current = false;

    // If adding a new weaver (not editing) and sorting by newest, go to page 1 to see the new weaver
    if (!editingWeaver && sortOrder === 'newest') {
      setCurrentPage(1);
      fetchWeavers(1, itemsPerPage, searchQuery, sortOrder);
    } else {
      // For edits or when sorting by oldest, refresh current page
      fetchWeavers(currentPage, itemsPerPage, searchQuery, sortOrder);
    }
    showMessage('success', editingWeaver ? 'Weaver updated successfully' : 'Weaver created successfully');
  };

  const handleViewWeaverSamples = async (weaver: Weaver) => {
    // Navigate to separate view page
    router.push(`/weaver/view/${weaver._id}`);
  };


  const handleEditSample = (sample: Sample) => {
    // weaverId is always populated as an object from the API
    const weaver = sample.weaverId;
    if (typeof weaver === 'string') {
      // If weaverId is a string, we need to fetch weaver data
      setSelectedWeaverId(weaver);
      fetchSamples(weaver);
      return;
    }
    const weaverId = typeof weaver === 'object' && weaver !== null && '_id' in weaver ? weaver._id : '';

    setSelectedWeaver({
      _id: typeof weaver === 'object' && weaver !== null && '_id' in weaver ? weaver._id : '',
      name: typeof weaver === 'object' && weaver !== null && 'name' in weaver ? weaver.name : '',
      phone: typeof weaver === 'object' && weaver !== null && 'phone' in weaver ? weaver.phone : undefined,
      address: typeof weaver === 'object' && weaver !== null && 'address' in weaver ? weaver.address : undefined
    });
    setSelectedWeaverId(weaverId);
    fetchSamples(weaverId);
    setEditingSample(sample);
    setShowSampleForm(true);
  };

  const handleDeleteSample = (id: string, name?: string) => {
    setDeleteConfirmation({
      show: true,
      type: 'sample',
      id,
      name: name || 'this sample'
    });
  };

  const confirmDeleteSample = async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);

    // Ensure form is closed before deleting
    setShowSampleForm(false);
    setEditingSample(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showMessage('error', 'Authentication required');
        setIsDeleting(false);
        setDeleteConfirmation(null);
        return;
      }
      const response = await fetch(`/api/weaver/samples/${deleteConfirmation.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Sample deleted successfully');
        if (selectedWeaverId && selectedWeaver) {
          await fetchSamples(selectedWeaverId);
        }
      } else {
        showMessage('error', data.message || 'Failed to delete sample');
      }
    } catch (error) {
      logger.error('Error deleting sample', error instanceof Error ? error : new Error(String(error)));
      showMessage('error', 'Error deleting sample');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation(null);
    }
  };

  // Optimistic sample save handler - UI updates first, API in background
  const handleOptimisticSampleSave = useCallback(async (sampleData: any, wasEdit: boolean, filesToUpload?: Array<{ file: File; previewUrl: string }>) => {
    if (!selectedWeaverId || !selectedWeaver) {
      throw new Error('No weaver selected');
    }

    // Update UI immediately - form already closed
    // Mark weaver as having new sample (for green glow animation)
    if (!wasEdit) {
      weaversWithNewSamplesRef.current.add(selectedWeaverId);
      // Remove glow after 2 seconds
      setTimeout(() => {
        weaversWithNewSamplesRef.current.delete(selectedWeaverId);
      }, 2000);

      // Mark View button to glow purple
      weaversWithPurpleViewRef.current.add(selectedWeaverId);
      // Remove purple glow after 2 seconds
      setTimeout(() => {
        weaversWithPurpleViewRef.current.delete(selectedWeaverId);
      }, 2000);
    }

    // Upload images in background, then make API call
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Upload images in background (if any)
      let uploadedUrls: string[] = [];
      if (filesToUpload && filesToUpload.length > 0) {
        try {
          // Import upload function
          const uploadFileToS3 = async (file: File): Promise<string> => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'weaver');
            if (selectedWeaver?._id) {
              formData.append('weaverId', selectedWeaver._id);
            }

            const response = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });

            if (!response.ok) {
              throw new Error('Upload failed');
            }

            const data = await response.json();
            if (data.success && (data.url || data.imageUrl)) {
              return data.url || data.imageUrl;
            }
            throw new Error('Upload failed: No URL received');
          };

          // Upload all images in parallel
          const uploadPromises = filesToUpload.map(pendingFile =>
            uploadFileToS3(pendingFile.file).catch(error => {
              logger.error('Error uploading image', error instanceof Error ? error : new Error(String(error)));
              return null; // Return null for failed uploads
            })
          );
          const results = await Promise.all(uploadPromises);
          uploadedUrls = results.filter((url): url is string => url !== null);
        } catch (error) {
          logger.error('Error during image uploads', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Combine existing images with newly uploaded ones
      const allImages = [...sampleData.images, ...uploadedUrls];

      const url = wasEdit && editingSample
        ? `/api/weaver/samples/${editingSample._id}`
        : '/api/weaver/samples';
      const method = wasEdit && editingSample ? 'PUT' : 'POST';

      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.LONG_REQUEST);

      const response = await retryApiCall(async () => {
        try {
          const res = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ...sampleData, images: allImages }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            let errorData;
            try {
              errorData = await res.json();
            } catch {
              errorData = { message: `HTTP ${res.status}: ${res.statusText}` };
            }
            const error = new Error(errorData.message || `HTTP ${res.status}`);
            (error as any).status = res.status;
            throw error;
          }

          return res;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new Error('Request timeout. Please check your connection and try again.');
            (timeoutError as any).status = 408;
            throw timeoutError;
          }
          // Handle network errors
          if (error instanceof TypeError && error.message.includes('fetch')) {
            const networkError = new Error('Network error. Please check your connection and try again.');
            (networkError as any).status = 0;
            throw networkError;
          }
          throw error;
        }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to save sample');
      }

      // Success - UI already updated, no need to do anything else

    } catch (error) {
      // Show error popup if API fails
      const errorMessage = error instanceof Error ? error.message : 'Failed to save sample. Please try again.';
      showMessage('error', errorMessage);
      logger.error('Error saving sample', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [selectedWeaverId, selectedWeaver, editingSample, showMessage]);

  const handleSampleSaved = async (wasEdit: boolean) => {
    // This is the fallback for non-optimistic saves
    setShowSampleForm(false);
    setEditingSample(null);

    // Mark weaver as having new sample (for green glow animation)
    if (!wasEdit && selectedWeaverId) {
      weaversWithNewSamplesRef.current.add(selectedWeaverId);
      // Remove glow after 2 seconds
      setTimeout(() => {
        weaversWithNewSamplesRef.current.delete(selectedWeaverId);
      }, 2000);
    }

    if (selectedWeaverId) {
      await fetchSamples(selectedWeaverId);
    }

    // Refresh weavers list to get updated counts
    await fetchWeavers(currentPage, itemsPerPage, searchQuery, sortOrder);

    showMessage('success', wasEdit ? 'Sample updated successfully' : 'Sample created successfully');
  };

  // Page change handler
  const handlePageChange = useCallback(async (newPage: number) => {
    if (newPage === currentPage || isChangingPage || newPage < 1 || newPage > paginationInfo.totalPages) {
      return;
    }

    setIsChangingPage(true);
    setCurrentPage(newPage);

    try {
      // Reset fetch params to force refresh
      lastFetchParamsRef.current = null;
      isFetchingRef.current = false;
      await fetchWeavers(newPage, itemsPerPage, searchQuery, sortOrder);
    } catch (error) {
      logger.error('Error changing page', error instanceof Error ? error : new Error(String(error)));
      setCurrentPage(currentPage);
    } finally {
      setIsChangingPage(false);
    }
  }, [currentPage, isChangingPage, paginationInfo.totalPages, fetchWeavers, itemsPerPage, searchQuery, sortOrder]);

  // Items per page change handler
  const handleItemsPerPageChange = useCallback(async (newItemsPerPage: number) => {
    if (newItemsPerPage === itemsPerPage || isChangingPage) {
      return;
    }

    setIsChangingPage(true);
    setItemsPerPage(newItemsPerPage);
    setCookie('weaverItemsPerPage', newItemsPerPage.toString(), 365);
    setCurrentPage(1);

    try {
      await fetchWeavers(1, newItemsPerPage, searchQuery, sortOrder);
    } catch (error) {
      logger.error('Error changing items per page', error instanceof Error ? error : new Error(String(error)));
      setItemsPerPage(itemsPerPage);
    } finally {
      setIsChangingPage(false);
    }
  }, [itemsPerPage, isChangingPage, fetchWeavers, searchQuery]);

  // Search handler with debounce - triggers fetch after user stops typing
  const handleSearchChange = useCallback((value: string) => {
    // Urgent: Update input immediately for instant UI feedback
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // Cancel previous search request if still pending
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }

    // Reset fetch params to force new fetch
    lastFetchParamsRef.current = null;
    isFetchingRef.current = false;

    // Debounce search - wait for user to stop typing (500ms)
    // After debounce, fetch with the latest value
    searchTimeoutRef.current = setTimeout(() => {
      setIsChangingPage(true);

      // Create new AbortController for this search
      const searchController = new AbortController();
      searchAbortControllerRef.current = searchController;

      // Fetch with all parameters including sortOrder
      fetchWeavers(1, itemsPerPage, value, sortOrder)
        .then(() => {
          setIsChangingPage(false);
          // Clear abort controller if this was the current search
          if (searchAbortControllerRef.current === searchController) {
            searchAbortControllerRef.current = null;
          }
        })
        .catch((error) => {
          // Ignore abort errors
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          logger.error('Error searching weavers', error instanceof Error ? error : new Error(String(error)));
          setIsChangingPage(false);
          // Clear abort controller if this was the current search
          if (searchAbortControllerRef.current === searchController) {
            searchAbortControllerRef.current = null;
          }
        });
    }, TIMEOUTS.SEARCH_DEBOUNCE);
  }, [fetchWeavers, itemsPerPage, sortOrder]);

  // Sort handler with flip animation
  const handleSortChange = useCallback((sort: 'newest' | 'oldest') => {
    // Determine flip direction based on sort change
    const previousSort = sortOrder;
    let flipDirection: 'top-to-bottom' | 'bottom-to-top' | null = null;

    if (previousSort !== sort) {
      // Newest: flip from top to bottom (items move down)
      // Oldest: flip from bottom to top (items move up)
      flipDirection = sort === 'newest' ? 'top-to-bottom' : 'bottom-to-top';
      setSortFlipDirection(flipDirection);

      // Clear animation after it completes
      setTimeout(() => {
        setSortFlipDirection(null);
      }, TIMEOUTS.SORT_ANIMATION);
    }

    setSortOrder(sort);
    setCookie('weaverSortOrder', sort, 365); // Save to cookie
    setCurrentPage(1); // Reset to first page on sort change
    // Don't set isChangingPage for sort changes - we want smooth flip animation without skeleton
    fetchWeavers(1, itemsPerPage, searchQuery, sort);
  }, [fetchWeavers, itemsPerPage, searchQuery, sortOrder]);

  // Cleanup on unmount - abort pending requests and clear timeouts
  useEffect(() => {
    return () => {
      // Cleanup search timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      // Abort pending search request
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }
      // Abort pending weaver fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Abort pending samples fetch
      if (samplesAbortControllerRef.current) {
        samplesAbortControllerRef.current.abort();
        samplesAbortControllerRef.current = null;
      }
      // Cleanup sticker preview blob URL
      if (stickerPreviewUrl) {
        URL.revokeObjectURL(stickerPreviewUrl);
      }
    };
  }, [stickerPreviewUrl]);

  // Track window width for responsive pagination
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;

      // Show scroll to top button when scrolled more than 300px
      setShowScrollToTop(scrollPosition > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for Escape key to close modals/dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showStickerPreview) {
          if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(stickerPreviewUrl);
          }
          setShowStickerPreview(false);
          setStickerPreviewUrl(null);
          setCurrentStickerSample(null);
        } else if (deleteConfirmation) {
          setDeleteConfirmation(null);
        } else if (showSortDropdown) {
          setShowSortDropdown(false);
        } else if (showItemsPerPageDropdown) {
          setShowItemsPerPageDropdown(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showStickerPreview, stickerPreviewUrl, currentStickerSample, deleteConfirmation, showSortDropdown, showItemsPerPageDropdown]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((newMode: 'table' | 'cards') => {
    setViewMode(newMode);
    setCookie('weaverViewMode', newMode, 365);
  }, []);

  // Get first letter of name for avatar
  const getInitial = (name: string): string => {
    if (!name || name.trim().length === 0) return '?';
    return name.trim().charAt(0).toUpperCase();
  };

  // Pagination display info
  const paginationDisplayInfo = useMemo(() => {
    const total = paginationInfo.totalCount || 0;
    const currentPageNum = paginationInfo.currentPage || currentPage || 1;
    const itemsPerPageValue = itemsPerPage;

    if (total === 0) {
      return {
        showing: 0,
        total: 0,
        start: 0,
        end: 0
      };
    }

    const start = total > 0 ? (currentPageNum - 1) * itemsPerPageValue + 1 : 0;
    const end = Math.min(currentPageNum * itemsPerPageValue, total);
    return {
      showing: weavers.length,
      total: total,
      start: start,
      end: end
    };
  }, [paginationInfo, itemsPerPage, weavers.length, currentPage]);

  const totalPages = useMemo(() => {
    return paginationInfo.totalPages || 1;
  }, [paginationInfo.totalPages]);

  // Handle sticker download - show preview first (or direct download on mobile)
  const handleStickerDownload = async (sample: Sample) => {
    try {
      // Prepare sample data for sticker
      const weaverName = typeof sample.weaverId === 'object' && sample.weaverId !== null && 'name' in sample.weaverId
        ? sample.weaverId.name
        : undefined;
      const stickerData = {
        qualityName: sample.qualityName || '-',
        weaverName: weaverName,
        width: sample.finishWidth || undefined,
        gsm: sample.gsm || undefined,
        content: sample.content || undefined,
        count: sample.count || undefined,
        rxP: sample.reed && sample.pick ? `${sample.reed}/${sample.pick}` : undefined,
        danier: sample.danier || undefined,
        moq: undefined, // MOQ not stored in database, always empty for sticker
        rack: sample.rack || undefined
      };

      // On mobile devices, download directly without preview
      if (isMobileDevice) {
        try {
          downloadSampleStickerPDFDirect(stickerData);
          showMessage('success', 'Sticker PDF downloading...');
        } catch (error) {
          logger.error('Error downloading sticker on mobile', error instanceof Error ? error : new Error(String(error)));
          showMessage('error', 'Failed to download sticker. Please try again.');
        }
        return;
      }

      // Desktop: Show preview first
      setIsLoadingStickerPreview(true);

      // Generate PDF preview
      const pdfDataUrl = generateSampleStickerPDF(stickerData);

      // Convert data URL to blob URL for better CSP compatibility
      try {
        const base64Data = pdfDataUrl.split(',')[1] || pdfDataUrl.split('base64,')[1];
        if (base64Data) {
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);

          setStickerPreviewUrl(blobUrl);
          setCurrentStickerSample(sample);
          setShowStickerPreview(true);

          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, TIMEOUTS.SEARCH_DEBOUNCE);
        } else {
          setStickerPreviewUrl(pdfDataUrl);
          setCurrentStickerSample(sample);
          setShowStickerPreview(true);
          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, TIMEOUTS.SEARCH_DEBOUNCE);
        }
      } catch (error) {
        logger.error('Error converting PDF to blob', error instanceof Error ? error : new Error(String(error)));
        setStickerPreviewUrl(pdfDataUrl);
        setCurrentStickerSample(sample);
        setShowStickerPreview(true);
        setTimeout(() => {
          setIsLoadingStickerPreview(false);
        }, TIMEOUTS.SEARCH_DEBOUNCE);
      }
    } catch (error) {
      logger.error('Error generating sticker preview', error instanceof Error ? error : new Error(String(error)));
      setIsLoadingStickerPreview(false);
      showMessage('error', 'Failed to generate sticker preview. Please try again.');
    }
  };

  // Handle final PDF download from preview
  const handleFinalStickerDownload = () => {
    if (!currentStickerSample) return;

    try {
      // Prepare sample data for sticker
      const weaverName = typeof currentStickerSample.weaverId === 'object' && currentStickerSample.weaverId !== null && 'name' in currentStickerSample.weaverId
        ? currentStickerSample.weaverId.name
        : undefined;
      const stickerData = {
        qualityName: currentStickerSample.qualityName || '-',
        weaverName: weaverName,
        width: currentStickerSample.finishWidth || undefined,
        gsm: currentStickerSample.gsm || undefined,
        content: currentStickerSample.content || undefined,
        count: currentStickerSample.count || undefined,
        rxP: currentStickerSample.reed && currentStickerSample.pick ? `${currentStickerSample.reed}/${currentStickerSample.pick}` : undefined,
        danier: currentStickerSample.danier || undefined,
        moq: undefined, // MOQ not stored in database, always empty for sticker
        rack: currentStickerSample.rack || undefined
      };

      // Use direct download method
      downloadSampleStickerPDFDirect(stickerData);

      // Clean up blob URL if it exists
      if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(stickerPreviewUrl);
      }
      // Close preview
      setShowStickerPreview(false);
      setStickerPreviewUrl(null);
      setCurrentStickerSample(null);

      showMessage('success', 'Sticker PDF downloaded successfully!');
    } catch (error) {
      logger.error('Error downloading sticker PDF', error instanceof Error ? error : new Error(String(error)));
      showMessage('error', 'Failed to download sticker PDF. Please try again.');
    }
  };

  // Weaver page is accessible to all authenticated users
  // No redirect needed for non-superadmin users

  // Show skeleton while loading auth or dark mode (only if authenticated)
  if (!darkModeMounted || authLoading) {
    // Only show skeleton if user is authenticated or still loading
    if (authLoading || isAuthenticated) {
      return <WeaverPageSkeleton />;
    }
    // If not authenticated and not loading, return null (will redirect via layout)
    return null;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated && !authLoading) {
    return null; // Layout will handle redirect
  }

  // Check if user is superadmin - Weaver page is only for superadmin
  if (isAuthenticated && !authLoading && !isSuperAdmin) {
    return <UnauthorizedMessage />;
  }

  return (
    <ErrorBoundary>
      <div
        id="weaver-page"
        className={`min-h-screen w-full transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
          }`}
        suppressHydrationWarning
      >
        {/* Message Toast */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 min-w-80 max-w-md p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm transform transition-all duration-300 animate-fade-in ${message.type === 'success'
            ? isDarkMode
              ? 'bg-green-900/90 border-green-500 text-green-100'
              : 'bg-green-50 border-green-500 text-green-800'
            : isDarkMode
              ? 'bg-red-900/90 border-red-500 text-red-100'
              : 'bg-red-50 border-red-500 text-red-800'
            }`}>
            <div className="flex items-center space-x-3">
              {message.type === 'success' ? (
                <CheckIcon className={`h-6 w-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
              ) : (
                <XMarkIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
              )}
              <p className="font-medium flex-1">{message.text}</p>
              <button
                onClick={() => setMessage(null)}
                className={`shrink-0 p-1 rounded-full transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'
                  }`}
                aria-label="Close message"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="w-full pb-6">
          <div className={`border-2 shadow-xl overflow-hidden ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-white'
            }`}>
            {/* Search and Action Bar - Top Row */}
            <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-col gap-2 max-[900px]:gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-3 ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-gray-50'
              }`}>
              {/* Search Bar and Sort - Same row on all screens */}
              <div className="flex flex-row items-center gap-2 min-[900px]:flex-1 min-[900px]:gap-3">
                {/* Search Bar */}
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
                    {isChangingPage && searchQuery ? (
                      <ArrowPathIcon className={`h-5 w-5 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                    ) : (
                      <MagnifyingGlassIcon className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className={`w-full pl-10 ${searchQuery ? 'pr-10' : 'pr-4'} py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } ${isChangingPage && searchQuery ? (isDarkMode ? 'border-blue-500/50' : 'border-blue-400/50') : ''}`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        // Clear search immediately
                        setSearchQuery('');
                        // Clear timeout
                        if (searchTimeoutRef.current) {
                          clearTimeout(searchTimeoutRef.current);
                          searchTimeoutRef.current = null;
                        }
                        // Cancel pending search
                        if (searchAbortControllerRef.current) {
                          searchAbortControllerRef.current.abort();
                          searchAbortControllerRef.current = null;
                        }
                        // Reset fetch params and fetch with empty search
                        lastFetchParamsRef.current = null;
                        isFetchingRef.current = false;
                        setCurrentPage(1);
                        setIsChangingPage(false);
                        // Fetch immediately with empty search
                        fetchWeavers(1, itemsPerPage, '', sortOrder);
                      }}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 z-10 p-1 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${isDarkMode
                        ? 'text-gray-400 hover:text-white hover:bg-gray-600'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                        }`}
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Sort Filter */}
                <div className="flex items-center gap-2 relative flex-shrink-0 z-[40]">
                  <span className={`text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sort:</span>
                  <div className="relative sort-dropdown-container z-[40]">
                    <button
                      onClick={() => {
                        setShowSortDropdown(!showSortDropdown);
                        setShowItemsPerPageDropdown(false); // Close other dropdown
                      }}
                      disabled={isChangingPage || loading}
                      className={`px-2 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border-2 transition-all duration-200 flex items-center gap-1.5 min-w-[70px] ${isDarkMode
                        ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40'
                        : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                        } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label={`Sort by ${sortOrder === 'newest' ? 'newest' : 'oldest'}`}
                      aria-expanded={showSortDropdown}
                      aria-haspopup="true"
                    >
                      {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                      <svg className={`h-3 w-3 transition-transform duration-300 ease-out ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      className={`fixed inset-0 z-[40] transition-opacity duration-300 ${showSortDropdown ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className={`absolute top-full left-0 mt-1 w-32 rounded-lg border shadow-xl z-[40] transition-all duration-300 ease-out ${showSortDropdown
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                      } ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                      }`}>
                      <button
                        onClick={() => {
                          handleSortChange('newest');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg ${sortOrder === 'newest'
                          ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                          : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        Newest
                      </button>
                      <button
                        onClick={() => {
                          handleSortChange('oldest');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg ${sortOrder === 'oldest'
                          ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                          : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        Oldest
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-3 max-[900px]:justify-between min-[900px]:flex-shrink-0">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>View:</span>
                  <div className={`flex rounded-lg border-2 overflow-hidden shadow-sm ${isDarkMode ? 'border-gray-600' : 'border-gray-300'
                    }`}>
                    <button
                      onClick={() => handleViewModeChange('table')}
                      className={`min-[400px]:px-1.5 sm:px-2 px-2 py-1.5 sm:py-2 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center min-[400px]:space-x-1 ${viewMode === 'table'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-blue-500 text-white shadow-md'
                        : isDarkMode
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-r border-gray-600'
                          : 'bg-white text-gray-700 hover:bg-blue-50 border-r border-gray-300'
                        }`}
                      title="Table View"
                      aria-label="Switch to table view"
                      aria-pressed={viewMode === 'table'}
                    >
                      <ListBulletIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs hidden min-[400px]:inline">Table</span>
                    </button>
                    <button
                      onClick={() => handleViewModeChange('cards')}
                      className={`min-[400px]:px-1.5 sm:px-2 px-2 py-1.5 sm:py-2 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center min-[400px]:space-x-1 ${viewMode === 'cards'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-blue-500 text-white shadow-md'
                        : isDarkMode
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-white text-gray-700 hover:bg-blue-50'
                        }`}
                      title="Card View"
                      aria-label="Switch to card view"
                      aria-pressed={viewMode === 'cards'}
                    >
                      <Squares2X2Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs hidden min-[400px]:inline">Cards</span>
                    </button>
                  </div>
                </div>

                {/* Refresh and Add Weaver Buttons */}
                <div className="flex items-center gap-3">
                  {/* Refresh Button */}
                  <button
                    onClick={() => {
                      // Reset fetch params to force refresh
                      lastFetchParamsRef.current = null;
                      isFetchingRef.current = false;
                      fetchWeavers(currentPage, itemsPerPage, searchQuery, sortOrder);
                    }}
                    disabled={loading || isChangingPage}
                    className={`min-[430px]:px-3 px-2.5 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center min-[430px]:space-x-2 ${isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                      } ${(loading || isChangingPage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Refresh"
                    aria-label="Refresh weavers list"
                  >
                    <ArrowPathIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${(loading || isChangingPage) ? 'animate-spin' : ''}`} />
                    <span className="hidden min-[430px]:inline text-xs sm:text-sm">Refresh</span>
                  </button>

                  {/* Add Weaver Button */}
                  <button
                    onClick={handleAddWeaver}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 flex items-center space-x-2 ${isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    title="Add Weaver"
                    aria-label="Add new weaver"
                  >
                    <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xs sm:text-sm">Add Weaver</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pagination Info Bar - Second Row */}
            <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-col gap-2 max-[900px]:gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-gray-50'
              }`}>
              {/* Row 1: Showing text and Show dropdown (under 900px) / All in one row (900px+) */}
              <div className="flex flex-row items-center justify-between min-[900px]:flex-row min-[900px]:items-center min-[900px]:space-x-3 lg:space-x-4">
                <span className={`text-[10px] xs:text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <span className="hidden min-[640px]:inline">Showing {paginationDisplayInfo.start} to {paginationDisplayInfo.end} of {paginationDisplayInfo.total} weavers</span>
                  <span className="min-[640px]:hidden">Showing {paginationDisplayInfo.start} to {paginationDisplayInfo.end} of {paginationDisplayInfo.total}</span>
                </span>

                {/* Items per page dropdown */}
                <div className="flex items-center gap-2 relative flex-shrink-0 z-[40]">
                  <span className={`text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
                  <div className="relative items-per-page-dropdown-container z-[40]">
                    <button
                      onClick={() => {
                        setShowItemsPerPageDropdown(!showItemsPerPageDropdown);
                        setShowSortDropdown(false); // Close other dropdown
                      }}
                      disabled={isChangingPage || loading}
                      className={`px-2 py-1.5 text-[10px] xs:text-xs font-medium rounded-lg border-2 transition-all duration-200 flex items-center justify-between min-w-[70px] ${isDarkMode
                        ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40'
                        : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                        } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label={`Show ${itemsPerPage} items per page`}
                      aria-expanded={showItemsPerPageDropdown}
                      aria-haspopup="true"
                    >
                      <span>{itemsPerPage}</span>
                      <svg className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ease-out ${showItemsPerPageDropdown ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      className={`fixed inset-0 z-[40] transition-opacity duration-300 ${showItemsPerPageDropdown ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      onClick={() => setShowItemsPerPageDropdown(false)}
                    />
                    <div className={`absolute top-full left-0 mt-1 w-28 rounded-lg border shadow-xl z-[40] transition-all duration-300 ease-out ${showItemsPerPageDropdown
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                      } ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                      }`}>
                      {itemsPerPageOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            handleItemsPerPageChange(option);
                            setShowItemsPerPageDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg ${itemsPerPage === option
                            ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Pagination Navigation (under 900px) / Same row (900px+) */}
              {(totalPages > 1 || weavers.length > 0) && (
                <div className="flex items-center justify-between w-full max-[900px]:w-full min-[900px]:justify-end min-[900px]:w-auto space-x-2 sm:space-x-3">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || isChangingPage || loading}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 ${currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                  >
                    {isChangingPage ? (
                      <span className="flex items-center space-x-2">
                        <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-gray-400' : 'border-gray-600'
                          }`}></div>
                        <span className="hidden sm:inline">Loading...</span>
                        <span className="sm:hidden">...</span>
                      </span>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </>
                    )}
                  </button>

                  {/* Page numbers - Dynamic based on screen size */}
                  <div className="flex items-center space-x-1 flex-1 justify-center max-[900px]:overflow-x-auto max-[900px]:scrollbar-hide">
                    {(() => {
                      const pages = [];

                      // Calculate max visible pages based on screen width
                      let maxVisiblePages: number;
                      if (windowWidth < 480) {
                        maxVisiblePages = 3; // Very small screens: 3 pages
                      } else if (windowWidth < 640) {
                        maxVisiblePages = 5; // Small screens: 5 pages
                      } else if (windowWidth < 768) {
                        maxVisiblePages = 7; // Medium screens: 7 pages
                      } else if (windowWidth < 1024) {
                        maxVisiblePages = 9; // Large screens: 9 pages
                      } else {
                        maxVisiblePages = 11; // Very large screens: 11 pages
                      }

                      // If total pages is less than or equal to max visible, show all
                      if (totalPages <= maxVisiblePages) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => handlePageChange(i)}
                              disabled={isChangingPage || loading}
                              className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-110 active:scale-95 whitespace-nowrap ${currentPage === i
                                ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                                : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {i}
                            </button>
                          );
                        }
                      } else {
                        // Smart pagination - dynamically adjust based on maxVisiblePages
                        const halfVisible = Math.floor(maxVisiblePages / 2);

                        // Always show first page
                        pages.push(
                          <button
                            key={1}
                            onClick={() => handlePageChange(1)}
                            disabled={isChangingPage || loading}
                            className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${currentPage === 1
                              ? isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-500 text-white border-blue-400'
                              : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400'
                              } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            1
                          </button>
                        );

                        if (currentPage <= halfVisible + 1) {
                          // Near the beginning: Show 1, 2, 3, ..., last
                          const endPage = Math.min(maxVisiblePages - 1, totalPages - 1);
                          for (let i = 2; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => handlePageChange(i)}
                                disabled={isChangingPage || loading}
                                className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${currentPage === i
                                  ? isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-500 text-white border-blue-400'
                                  : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400'
                                  } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {i}
                              </button>
                            );
                          }
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                ...
                              </span>
                            );
                          }
                        } else if (currentPage >= totalPages - halfVisible) {
                          // Near the end: Show 1, ..., last-3, last-2, last-1, last
                          if (totalPages - maxVisiblePages + 2 > 1) {
                            pages.push(
                              <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                ...
                              </span>
                            );
                          }
                          const startPage = Math.max(2, totalPages - maxVisiblePages + 2);
                          for (let i = startPage; i < totalPages; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => handlePageChange(i)}
                                disabled={isChangingPage || loading}
                                className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${currentPage === i
                                  ? isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-500 text-white border-blue-400'
                                  : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400'
                                  } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {i}
                              </button>
                            );
                          }
                        } else {
                          // Middle: Show 1, ..., current-1, current, current+1, ..., last
                          pages.push(
                            <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              ...
                            </span>
                          );
                          const startPage = Math.max(2, currentPage - halfVisible + 1);
                          const endPage = Math.min(totalPages - 1, currentPage + halfVisible - 1);
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => handlePageChange(i)}
                                disabled={isChangingPage || loading}
                                className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${currentPage === i
                                  ? isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-500 text-white border-blue-400'
                                  : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400'
                                  } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {i}
                              </button>
                            );
                          }
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="ellipsis2" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                ...
                              </span>
                            );
                          }
                        }

                        // Always show last page (if not already shown and not page 1)
                        if (totalPages > 1 && currentPage < totalPages - halfVisible) {
                          pages.push(
                            <button
                              key={totalPages}
                              onClick={() => handlePageChange(totalPages)}
                              disabled={isChangingPage || loading}
                              className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${currentPage === totalPages
                                ? isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-500 text-white border-blue-400'
                                : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400'
                                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {totalPages}
                            </button>
                          );
                        }
                      }

                      return pages;
                    })()}
                  </div>

                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || isChangingPage || loading}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 ${currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                  >
                    {isChangingPage ? (
                      <span className="flex items-center space-x-1 sm:space-x-2">
                        <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-gray-400' : 'border-gray-600'
                          }`}></div>
                        <span className="hidden sm:inline">Loading...</span>
                        <span className="sm:hidden">...</span>
                      </span>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">Next</span>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}
                    style={{
                      borderBottom: isDarkMode
                        ? '2px solid rgba(75, 85, 99, 0.6)'
                        : '2px solid rgba(209, 213, 219, 1)'
                    }}
                  >
                    <tr>
                      <th className={`px-3 sm:px-4 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <UserIcon className="h-4 w-4" />
                          <span>Name</span>
                        </div>
                      </th>
                      <th className={`px-3 sm:px-4 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <DevicePhoneMobileIcon className="h-4 w-4" />
                          <span>Phone</span>
                        </div>
                      </th>
                      <th className={`px-3 sm:px-4 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <BuildingOfficeIcon className="h-4 w-4" />
                          <span>Address</span>
                        </div>
                      </th>
                      <th className={`px-3 sm:px-4 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <WeaverIcon className="h-4 w-4" />
                          <span>Actions</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-gray-200 dark:divide-gray-700 ${sortFlipDirection === 'top-to-bottom'
                    ? 'animate-flip-top-to-bottom'
                    : sortFlipDirection === 'bottom-to-top'
                      ? 'animate-flip-bottom-to-top'
                      : ''
                    }`}>
                    {(loading || isChangingPage) && !sortFlipDirection && !showWeaverModal && !showSampleForm ? (
                      // Skeleton loader - matches exact table structure
                      Array.from({ length: itemsPerPage }).map((_, index) => (
                        <tr
                          key={`skeleton-${index}`}
                          className="animate-pulse"
                          style={{
                            borderBottom: index < itemsPerPage - 1
                              ? isDarkMode
                                ? '2px solid rgba(75, 85, 99, 0.6)'
                                : '2px solid rgba(209, 213, 219, 1)'
                              : 'none'
                          }}
                        >
                          {/* Name column */}
                          <td className={`px-3 sm:px-4 py-4 ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <div className={`flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full border ${isDarkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-gray-200 border-gray-300'
                                }`}></div>
                              <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </td>
                          {/* Phone column - with icon placeholder */}
                          <td className={`px-3 sm:px-4 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                            <div className="flex items-center space-x-2">
                              <div className={`h-4 w-4 rounded ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                              <div className={`h-4 rounded w-24 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </td>
                          {/* Address column - with icon placeholder */}
                          <td className={`px-3 sm:px-4 py-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                            <div className="flex items-start space-x-2 max-w-xs">
                              <div className={`h-4 w-4 rounded flex-shrink-0 mt-0.5 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                              <div className={`h-4 rounded w-40 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </td>
                          {/* Actions column - skeleton buttons matching responsive layout */}
                          <td className="px-3 sm:px-4 py-4">
                            <div className={`grid grid-cols-1 ${isMaster
                                ? 'min-[900px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'
                                : 'min-[900px]:grid-cols-3'
                              } gap-1.5 sm:gap-2`}>
                              {/* Edit Button Skeleton */}
                              <div className={`h-9 w-full col-span-1 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                              {/* View Button Skeleton */}
                              <div className={`h-9 w-full col-span-1 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                              {/* Add Sample Button Skeleton */}
                              <div className={`h-9 w-full col-span-1 ${isMaster
                                  ? 'min-[900px]:col-span-2 max-[1023px]:col-span-2 lg:col-span-1 xl:col-span-1'
                                  : ''
                                } rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                              {/* Delete Button Skeleton */}
                              {isMaster && (
                                <div className={`h-9 w-full col-span-1 min-[900px]:col-span-2 max-[1023px]:col-span-2 lg:col-span-1 xl:col-span-1 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : weavers.length === 0 ? (
                      // Empty state
                      <tr>
                        <td colSpan={4} className="px-3 sm:px-4 py-8 sm:py-20">
                          <div className={`flex flex-col items-center justify-center min-h-[30vh] sm:min-h-[50vh] space-y-3 sm:space-y-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                            <WeaverIcon className={`w-12 h-12 sm:w-20 sm:h-20 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                            <h3 className={`text-base sm:text-xl font-semibold text-center px-2 ${isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                              {searchQuery ? 'No Weavers Found' : 'No Weavers Registered'}
                            </h3>
                            <p className={`text-xs sm:text-sm text-center px-4 max-w-md ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                              {searchQuery ? 'Try a different search term' : 'Click "Add Weaver" to get started.'}
                            </p>
                            {!searchQuery && (
                              <button
                                onClick={handleAddWeaver}
                                className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-2 shadow-sm text-xs sm:text-base font-medium ${isDarkMode
                                  ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                                  : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                                  }`}
                                title="Add Weaver"
                              >
                                <PlusIcon className="h-4 w-4 sm:h-6 sm:w-6" />
                                <span className="whitespace-nowrap">Add Weaver</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      weavers.map((weaver, index) => {
                        const isNewlyAdded = newlyAddedWeaversRef.current.has(weaver._id);
                        const isEdited = editedWeaversRef.current.has(weaver._id);
                        const isDeleting = deletingWeaversRef.current.has(weaver._id);
                        const hasNewSample = weaversWithNewSamplesRef.current.has(weaver._id);
                        return (
                          <tr
                            key={weaver._id}
                            className={`relative border-l-4 border-transparent transition-all duration-300 hover:shadow-md ${isDeleting
                              ? 'animate-weaver-delete-fade-out'
                              : isNewlyAdded
                                ? 'animate-weaver-slide-in'
                                : hasNewSample
                                  ? 'animate-weaver-green-glow'
                                  : isEdited
                                    ? 'animate-weaver-edit-pulse'
                                    : ''
                              } ${isDarkMode
                                ? 'hover:bg-white/5 hover:border-l-blue-600'
                                : 'hover:bg-gray-100/50 hover:border-l-blue-500'
                              }`}
                            style={{
                              borderBottom: index < weavers.length - 1
                                ? isDarkMode
                                  ? '2px solid rgba(75, 85, 99, 0.6)'
                                  : '2px solid rgba(209, 213, 219, 1)'
                                : 'none'
                            }}
                          >
                            <td className={`px-3 sm:px-4 py-4 ${isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleViewWeaverSamples(weaver);
                                }}
                                className="flex items-center space-x-2 sm:space-x-3 w-full text-left group cursor-pointer hover:opacity-90 active:opacity-75 transition-all duration-200"
                                title="Click to view samples"
                              >
                                <div className={`flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border transition-all duration-200 group-hover:scale-110 active:scale-95 ${isDarkMode
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 group-hover:bg-blue-500/20 group-hover:border-blue-500/50'
                                  : 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-100 group-hover:border-blue-300'
                                  }`}>
                                  {getInitial(weaver.name)}
                                </div>
                                <span className="font-semibold break-words min-w-0 group-hover:opacity-80 transition-all duration-200">{weaver.name}</span>
                              </button>
                            </td>
                            <td className={`px-3 sm:px-4 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                              }`}>
                              {weaver.phone ? (
                                <div className="flex items-center space-x-2">
                                  <DevicePhoneMobileIcon className="h-4 w-4" />
                                  <span>{weaver.phone}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No data</span>
                              )}
                            </td>
                            <td className={`px-3 sm:px-4 py-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                              }`}>
                              {weaver.address ? (
                                <div className="flex items-start space-x-2 max-w-xs">
                                  <BuildingOfficeIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span className="break-words min-w-0">{weaver.address}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No data</span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-4">
                              <div className={`grid grid-cols-1 ${isMaster
                                  ? 'min-[900px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'
                                  : 'min-[900px]:grid-cols-3'
                                } gap-1.5 sm:gap-2`}>
                                {/* Edit Button - Row 1 under 900px */}
                                <button
                                  onClick={() => handleEditWeaver(weaver)}
                                  className={`w-full col-span-1 max-[899px]:col-span-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${isDarkMode
                                    ? 'text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 bg-blue-500/10'
                                    : 'text-blue-600 hover:bg-blue-100 border border-blue-200 bg-blue-50'
                                    }`}
                                  title="Edit Weaver"
                                >
                                  <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="font-medium whitespace-nowrap">Edit</span>
                                </button>
                                {/* View Button - Row 2 under 900px */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewWeaverSamples(weaver);
                                  }}
                                  className={`w-full col-span-1 max-[899px]:col-span-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${weaversWithPurpleViewRef.current.has(weaver._id) ? 'animate-purple-glow' : ''
                                    } ${isDarkMode
                                      ? 'text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 bg-purple-500/10'
                                      : 'text-purple-600 hover:bg-purple-100 border border-purple-200 bg-purple-50'
                                    }`}
                                  title="View Samples"
                                >
                                  <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="font-medium whitespace-nowrap">View</span>
                                </button>
                                {/* Add Sample Button - Full width on 900px-1023px, normal on others */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedWeaver(weaver);
                                    setSelectedWeaverId(weaver._id);
                                    setEditingSample(null);
                                    setShowSampleForm(true);
                                  }}
                                  className={`w-full col-span-1 max-[899px]:col-span-1 ${isMaster
                                      ? 'min-[900px]:col-span-2 max-[1023px]:col-span-2 lg:col-span-1 xl:col-span-1'
                                      : ''
                                    } px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${isDarkMode
                                      ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                                      : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                                    }`}
                                  title="Add Sample"
                                >
                                  <SwatchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="font-medium whitespace-nowrap">Add Sample</span>
                                </button>
                                {/* Delete Button - Show for master only */}
                                {isMaster && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteWeaver(weaver._id, weaver.name);
                                    }}
                                    className={`w-full col-span-1 max-[899px]:col-span-1 min-[900px]:col-span-2 max-[1023px]:col-span-2 lg:col-span-1 xl:col-span-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${isDarkMode
                                      ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                                      : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                                      }`}
                                    title="Delete Weaver"
                                  >
                                    <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                    <span className="font-medium whitespace-nowrap">Delete All</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Card View */
              <div className="p-3 sm:p-4">
                {(loading || isChangingPage) && !sortFlipDirection && !showWeaverModal && !showSampleForm ? (
                  /* Skeleton loader for cards - matches exact card structure */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: itemsPerPage }).map((_, index) => (
                      <div
                        key={`card-skeleton-${index}`}
                        className={`rounded-xl border-2 p-4 sm:p-5 animate-pulse ${isDarkMode ? 'border-gray-700 bg-gray-800/90' : 'border-gray-200 bg-white'
                          }`}
                      >
                        {/* Name skeleton */}
                        <div className="flex items-center space-x-3 mb-4">
                          <div className={`flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full border ${isDarkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-gray-200 border-gray-300'
                            }`}></div>
                          <div className={`h-6 sm:h-7 rounded w-3/4 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                            }`}></div>
                        </div>
                        {/* Phone skeleton with icon */}
                        <div className="mb-3">
                          <div className="flex items-center space-x-2">
                            <div className={`h-4 w-4 sm:h-5 sm:w-5 rounded flex-shrink-0 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                              }`}></div>
                            <div className={`h-4 sm:h-5 rounded w-24 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                              }`}></div>
                          </div>
                        </div>
                        {/* Address skeleton with icon */}
                        <div className="mb-4 sm:mb-5">
                          <div className="flex items-start space-x-2">
                            <div className={`h-4 w-4 sm:h-5 sm:w-5 rounded flex-shrink-0 mt-0.5 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                              }`}></div>
                            <div className={`h-4 sm:h-5 rounded w-32 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                              }`}></div>
                          </div>
                        </div>
                        {/* Action buttons skeleton - 2x2 grid matching actual layout */}
                        <div className="grid grid-cols-1 min-[350px]:grid-cols-2 gap-2">
                          <div className={`h-10 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                          <div className={`h-10 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                          <div className={`h-10 rounded-lg ${isMaster ? '' : 'col-span-1 min-[350px]:col-span-2'} ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                          {/* Delete Button Skeleton - only show if isMaster */}
                          {isMaster && (
                            <div className={`h-10 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'}`}></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : weavers.length === 0 ? (
                  /* Empty state */
                  <div className={`flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[60vh] py-8 sm:py-20 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                    }`}>
                    <div className={`flex flex-col items-center justify-center space-y-3 sm:space-y-6 max-w-md ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                      <WeaverIcon className={`w-12 h-12 sm:w-20 sm:h-20 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      <h3 className={`text-base sm:text-xl font-semibold text-center ${isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                        {searchQuery ? 'No Weavers Found' : 'No Weavers Registered'}
                      </h3>
                      <p className={`text-xs sm:text-sm text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        {searchQuery ? 'Try a different search term' : 'Click "Add Weaver" to get started.'}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={handleAddWeaver}
                          className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-2 shadow-sm text-xs sm:text-base font-medium ${isDarkMode
                            ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                            : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                            }`}
                          title="Add Weaver"
                        >
                          <PlusIcon className="h-4 w-4 sm:h-6 sm:w-6" />
                          <span className="whitespace-nowrap">Add Weaver</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${sortFlipDirection === 'top-to-bottom'
                    ? 'animate-flip-card-top-to-bottom'
                    : sortFlipDirection === 'bottom-to-top'
                      ? 'animate-flip-card-bottom-to-top'
                      : ''
                    }`}>
                    {weavers.map((weaver, index) => {
                      const isNewlyAdded = newlyAddedWeaversRef.current.has(weaver._id);
                      const isEdited = editedWeaversRef.current.has(weaver._id);
                      const isDeleting = deletingWeaversRef.current.has(weaver._id);
                      const hasNewSample = weaversWithNewSamplesRef.current.has(weaver._id);
                      return (
                        <div
                          key={weaver._id}
                          className={`relative rounded-xl border-2 p-4 sm:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${isDeleting
                            ? 'animate-weaver-card-delete-fade-out'
                            : isNewlyAdded
                              ? 'animate-weaver-card-slide-in'
                              : hasNewSample
                                ? 'animate-weaver-green-glow'
                                : isEdited
                                  ? 'animate-weaver-edit-pulse'
                                  : ''
                            } ${isDarkMode
                              ? 'border-gray-700 bg-gray-800/90 hover:border-gray-600 hover:bg-gray-800'
                              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                          {/* Name - Clickable to view samples */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewWeaverSamples(weaver);
                            }}
                            className="flex items-center space-x-3 mb-4 w-full text-left group cursor-pointer hover:opacity-90 active:opacity-75 transition-all duration-200"
                            title="Click to view samples"
                          >
                            <div className={`flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-sm sm:text-base border transition-all duration-200 group-hover:scale-110 active:scale-95 ${isDarkMode
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 group-hover:bg-blue-500/20 group-hover:border-blue-500/50'
                              : 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-100 group-hover:border-blue-300'
                              }`}>
                              {getInitial(weaver.name)}
                            </div>
                            <span className={`text-lg sm:text-xl font-bold break-words flex-1 transition-all duration-200 group-hover:opacity-80 ${isDarkMode ? 'text-white group-hover:text-blue-400' : 'text-gray-900 group-hover:text-blue-600'
                              }`}>
                              {weaver.name}
                            </span>
                          </button>

                          {/* Phone */}
                          <div className="mb-3">
                            <div className={`flex items-center space-x-2 text-sm sm:text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                              <DevicePhoneMobileIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                              <span className="break-words">{weaver.phone || 'No data'}</span>
                            </div>
                          </div>

                          {/* Address */}
                          <div className="mb-4 sm:mb-5">
                            <div className={`flex items-start space-x-2 text-sm sm:text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                              <BuildingOfficeIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{weaver.address || 'No data'}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-1 min-[350px]:grid-cols-2 gap-2">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleEditWeaver(weaver)}
                              className={`w-full px-2 sm:px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${isDarkMode
                                ? 'text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 bg-blue-500/10'
                                : 'text-blue-600 hover:bg-blue-100 border border-blue-200 bg-blue-50'
                                }`}
                              title="Edit Weaver"
                            >
                              <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                              <span className="font-medium whitespace-nowrap">Edit</span>
                            </button>
                            {/* Add Sample Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWeaver(weaver);
                                setSelectedWeaverId(weaver._id);
                                setEditingSample(null);
                                setShowSampleForm(true);
                              }}
                              className={`w-full px-2 sm:px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${isDarkMode
                                ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                                : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                                }`}
                              title="Add Sample"
                            >
                              <SwatchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                              <span className="font-medium whitespace-nowrap">Add Sample</span>
                            </button>
                            {/* View Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewWeaverSamples(weaver);
                              }}
                              className={`w-full px-2 sm:px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${weaversWithPurpleViewRef.current.has(weaver._id) ? 'animate-purple-glow' : ''
                                } ${isDarkMode
                                  ? 'text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 bg-purple-500/10'
                                  : 'text-purple-600 hover:bg-purple-100 border border-purple-200 bg-purple-50'
                                } ${isMaster ? '' : 'col-span-1 min-[350px]:col-span-2'}`}
                              title="View Samples"
                            >
                              <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                              <span className="font-medium whitespace-nowrap">View</span>
                            </button>
                            {/* Delete Button - Show for master only */}
                            {isMaster && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteWeaver(weaver._id, weaver.name);
                                }}
                                className={`w-full px-2 sm:px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm ${isDarkMode
                                  ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                                  : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                                  }`}
                                title="Delete Weaver"
                              >
                                <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                <span className="font-medium whitespace-nowrap flex-shrink-0">Delete All</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Weaver Modal */}
        {showWeaverModal && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">Loading...</div>
          </div>}>
            <WeaverModal
              weaver={editingWeaver}
              onClose={() => {
                setShowWeaverModal(false);
                setEditingWeaver(null);
              }}
              onSave={handleWeaverSaved}
              isDarkMode={isDarkMode}
              onMessage={showMessage}
              onOptimisticSave={handleOptimisticWeaverSave}
            />
          </Suspense>
        )}


        {/* Sample Form Modal */}
        {showSampleForm && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">Loading form...</div>
          </div>}>
            <SampleForm
              weaver={selectedWeaver}
              sample={editingSample}
              onClose={() => {
                setShowSampleForm(false);
                setEditingSample(null);
                // Don't clear selectedWeaver - keep samples visible
              }}
              onSave={(wasEdit) => handleSampleSaved(wasEdit)}
              onDelete={(sampleId) => {
                handleDeleteSample(sampleId);
              }}
              isDarkMode={isDarkMode}
              onOptimisticSave={handleOptimisticSampleSave}
            />
          </Suspense>
        )}

        {/* Sample View Modal */}
        {viewingSample && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className={`w-full max-w-4xl rounded-xl shadow-2xl border my-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
              <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                  {viewingSample.qualityName}
                </h2>
                <button
                  onClick={() => setViewingSample(null)}
                  className={`p-2 rounded-lg transition-all ${isDarkMode
                    ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  aria-label="Close sample view"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Weaver Info */}
                <div>
                  <h3 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Weaver</h3>
                  <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    {typeof viewingSample.weaverId === 'object' && viewingSample.weaverId !== null && 'name' in viewingSample.weaverId
                      ? viewingSample.weaverId.name
                      : 'Unknown Weaver'}
                    {typeof viewingSample.weaverId === 'object' && viewingSample.weaverId !== null && 'phone' in viewingSample.weaverId && viewingSample.weaverId.phone && (
                      <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        - {viewingSample.weaverId.phone}
                      </span>
                    )}
                  </p>
                </div>

                {/* Images */}
                {viewingSample.images && viewingSample.images.length > 0 && (
                  <div>
                    <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Images ({viewingSample.images.length})</h3>
                    <ImageGallery
                      images={viewingSample.images}
                      onImageClick={(idx: number) => {
                        // Handle image click if needed
                      }}
                      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3"
                      imageClassName="w-full aspect-square object-cover rounded-lg border-2"
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}

                {/* Sample Details */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {viewingSample.greighWidth > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Greigh Width</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.greighWidth} inches
                      </p>
                    </div>
                  )}
                  {viewingSample.finishWidth > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Finish Width</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.finishWidth} inches
                      </p>
                    </div>
                  )}
                  {viewingSample.weight > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Weight</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.weight} KG
                      </p>
                    </div>
                  )}
                  {viewingSample.gsm > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>GSM</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.gsm}
                      </p>
                    </div>
                  )}
                  {viewingSample.content && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Content</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.content}
                      </p>
                    </div>
                  )}
                  {viewingSample.danier && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Danier</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.danier}
                      </p>
                    </div>
                  )}
                  {viewingSample.count > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Count</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.count}
                      </p>
                    </div>
                  )}
                  {viewingSample.reed > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Reed</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.reed}
                      </p>
                    </div>
                  )}
                  {viewingSample.pick > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Pick</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.pick}
                      </p>
                    </div>
                  )}
                  {viewingSample.greighRate > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Greigh Rate</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        ₹{viewingSample.greighRate}
                      </p>
                    </div>
                  )}
                  {viewingSample.rack && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Rack</h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {viewingSample.rack}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end flex-wrap gap-1.5 sm:gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {/* View Sticker Button */}
                  <button
                    onClick={() => {
                      if (viewingSample) {
                        handleStickerDownload(viewingSample);
                      }
                    }}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${isDarkMode
                      ? 'text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 bg-purple-500/10'
                      : 'text-purple-600 hover:bg-purple-100 border border-purple-200 bg-purple-50'
                      }`}
                    title="View Sticker"
                  >
                    <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="whitespace-nowrap">View Sticker</span>
                  </button>
                  {/* Edit Button */}
                  <button
                    onClick={() => {
                      setViewingSample(null);
                      handleEditSample(viewingSample);
                    }}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${isDarkMode
                      ? 'text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 bg-blue-500/10'
                      : 'text-blue-600 hover:bg-blue-100 border border-blue-200 bg-blue-50'
                      }`}
                    title="Edit Sample"
                  >
                    <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="whitespace-nowrap">Edit</span>
                  </button>
                  {/* Add Sample Button */}
                  <button
                    onClick={() => {
                      if (viewingSample && viewingSample.weaverId) {
                        const weaver = viewingSample.weaverId;
                        if (typeof weaver === 'string') {
                          setSelectedWeaverId(weaver);
                          setEditingSample(null);
                          setViewingSample(null);
                          setShowSampleForm(true);
                          return;
                        }
                        if (typeof weaver === 'object' && weaver !== null && '_id' in weaver) {
                          setSelectedWeaver({
                            _id: weaver._id,
                            name: weaver.name,
                            phone: weaver.phone,
                            address: weaver.address
                          });
                          setSelectedWeaverId(weaver._id);
                        }
                        setEditingSample(null);
                        setViewingSample(null);
                        setShowSampleForm(true);
                      }
                    }}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${isDarkMode
                      ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                      : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                      }`}
                    title="Add Sample"
                  >
                    <SwatchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="whitespace-nowrap">Add Sample</span>
                  </button>
                  {/* Delete Button */}
                  {isMaster && (
                    <button
                      onClick={() => {
                        if (viewingSample) {
                          handleDeleteSample(viewingSample._id, viewingSample.qualityName);
                          setViewingSample(null);
                        }
                      }}
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${isDarkMode
                        ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                        : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                        }`}
                      title="Delete Sample"
                    >
                      <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      <span className="whitespace-nowrap">Delete</span>
                    </button>
                  )}
                  {/* Close Button */}
                  <button
                    onClick={() => setViewingSample(null)}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${isDarkMode
                      ? 'text-gray-400 hover:bg-gray-500/20 border border-gray-500/30 bg-gray-500/10'
                      : 'text-gray-600 hover:bg-gray-100 border border-gray-200 bg-gray-50'
                      }`}
                    title="Close"
                  >
                    <XMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="whitespace-nowrap">Close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Delete Confirmation Modal */}
        {deleteConfirmation && deleteConfirmation.show && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeleting) {
                setDeleteConfirmation(null);
              }
            }}
          >
            <div
              className={`w-full max-w-md rounded-xl shadow-2xl border animate-scale-in ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                  Confirm Delete
                </h3>
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  disabled={isDeleting}
                  className={`p-1.5 rounded-lg transition-all duration-200 hover:rotate-90 active:scale-95 ${isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <p className={`text-base mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Are you sure you want to delete this {deleteConfirmation.type}?
                  {deleteConfirmation.name && (
                    <span className={`font-semibold block mt-2 ${isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                      {deleteConfirmation.name}
                    </span>
                  )}
                </p>
                {deleteConfirmation.type === 'weaver' && (
                  <div className={`mb-4 p-4 rounded-lg border-2 ${isDarkMode
                    ? 'bg-red-900/20 border-red-500/50'
                    : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center space-x-2 mb-2">
                      <WeaverIcon className={`h-5 w-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`} />
                      <p className={`font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'
                        }`}>
                        Warning: This weaver has samples
                      </p>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'
                      }`}>
                      All samples will be permanently deleted along with the weaver.
                    </p>
                  </div>
                )}
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  This action cannot be undone.
                </p>
              </div>
              <div className={`p-6 border-t flex items-center justify-end space-x-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md ${isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirmation.type === 'weaver') {
                      confirmDeleteWeaver();
                    } else {
                      confirmDeleteSample();
                    }
                  }}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg flex items-center space-x-2 ${isDeleting
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                    } ${isDarkMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete All</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticker PDF Preview Modal */}
        {showStickerPreview && stickerPreviewUrl && currentStickerSample && (
          <div
            className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(stickerPreviewUrl);
                }
                setShowStickerPreview(false);
                setStickerPreviewUrl(null);
                setCurrentStickerSample(null);
              }
            }}
          >
            <div className={`w-full max-w-5xl max-h-[95vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
              }`}>
              {/* Modal Header */}
              <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                } flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    Sticker Preview
                  </h3>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {currentStickerSample.qualityName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFinalStickerDownload}
                    className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 ${isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    title="Download PDF"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    <span className="hidden sm:inline">Download PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(stickerPreviewUrl);
                      }
                      setShowStickerPreview(false);
                      setStickerPreviewUrl(null);
                      setCurrentStickerSample(null);
                    }}
                    className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${isDarkMode
                      ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    title="Close Preview"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* PDF Preview Container */}
              <div className={`flex-1 overflow-auto p-2 sm:p-4 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
                }`}>
                <div className="w-full h-full">
                  <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
                    {isLoadingStickerPreview && (
                      <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${isDarkMode ? 'bg-gray-900/90' : 'bg-white/90'
                        } backdrop-blur-sm`}>
                        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'
                          }`}></div>
                        <p className={`text-lg font-semibold mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          Generating Preview...
                        </p>
                      </div>
                    )}

                    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
                      {stickerPreviewUrl && (
                        <>
                          {!isMobileDevice && (
                            <iframe
                              key={stickerPreviewUrl}
                              src={`${stickerPreviewUrl}#toolbar=1&navpanes=0&scrollbar=1&zoom=150`}
                              className="absolute inset-0 w-full h-full border-0"
                              title="Sample Sticker PDF Preview"
                              style={{
                                minHeight: '600px',
                                opacity: isLoadingStickerPreview ? 0 : 1,
                                transition: 'opacity 0.3s ease-in-out'
                              }}
                              onLoad={() => {
                                setIsLoadingStickerPreview(false);
                              }}
                              onError={() => {
                                setIsLoadingStickerPreview(false);
                              }}
                              allow="fullscreen"
                              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                            />
                          )}
                          {isMobileDevice && (
                            <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'
                              }`}>
                              <DocumentTextIcon className="h-16 w-16 mb-4 text-blue-500" />
                              <p className="text-lg font-semibold mb-2">PDF Ready for Download</p>
                              <p className="text-sm text-center mb-6">Mobile preview not available. Click below to download.</p>
                              <button
                                onClick={handleFinalStickerDownload}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 ${isDarkMode
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                              >
                                <ArrowDownTrayIcon className="h-5 w-5 inline mr-2" />
                                Download PDF
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {!isLoadingStickerPreview && !stickerPreviewUrl && (
                        <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'
                          }`}>
                          <DocumentTextIcon className="h-16 w-16 mb-4 text-gray-400" />
                          <p className="text-lg font-semibold mb-2">PDF Preview Not Available</p>
                          <p className="text-sm text-center mb-4">Unable to load PDF preview. Please try downloading instead.</p>
                          <button
                            onClick={handleFinalStickerDownload}
                            className={`px-6 py-3 rounded-lg font-semibold transition-all ${isDarkMode
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                          >
                            Download PDF Instead
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll to Top Button */}
        {showScrollToTop && (
          <button
            onClick={scrollToTop}
            className={`fixed bottom-6 right-6 z-40 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 scroll-to-top-btn ${isDarkMode
              ? 'bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-sm border border-blue-500/30'
              : 'bg-white hover:bg-gray-50 text-blue-600 backdrop-blur-sm border-2 border-blue-500 shadow-xl'
              }`}
            aria-label="Scroll to top"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
}

