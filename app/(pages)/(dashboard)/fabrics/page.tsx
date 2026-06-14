'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  CheckCircleIcon,
  PhotoIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSession } from '../hooks/useSession';
import { Fabric, FabricFilters } from '@/types/fabric';

// Development-only logging utility
const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args: any[]): void => { if (isDev) console.log(...args); };
const devError = (...args: any[]): void => { if (isDev) console.error(...args); };

// Helper function to check if an ID is a temporary ID
const isTemporaryId = (id: string | undefined | null): boolean => {
  if (!id) return false;
  const idStr = String(id);
  return idStr.startsWith('temp-') || idStr.includes('temp-');
};

// Helper function to check if a fabric is temporary/optimistic
const isTemporaryFabric = (fabric: Fabric | any): boolean => {
  if (!fabric) return false;
  const id = String(fabric._id || '');
  return isTemporaryId(id) ||
    (fabric as any)._isOptimistic === true ||
    (fabric as any).clientTempId !== undefined;
};

import FabricDetails from './components/FabricDetails';
import DeleteConfirmation from './components/DeleteConfirmation';
import { Z_INDEX } from './constants';
import ToastNotification, { useToast } from '../components/ToastNotification';
import { generateFabricStickerPDF, downloadFabricStickerPDF, downloadFabricStickerPDFDirect } from '@/lib/pdfGenerator';
import FabricsPageSkeleton from './components/FabricsPageSkeleton';
import { lazy, Suspense } from 'react';

// Lazy load FabricForm for better performance
const FabricForm = lazy(() => import('./components/FabricForm'));
import { TIMEOUTS, PAGINATION } from './constants';

export default function FabricsPage() {
  const { isDarkMode, mounted } = useDarkMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isUser, isMaster, user } = useSession();

  // useTransition for non-urgent updates (search, filters) - matches sampling page pattern
  const [isPending, startTransition] = useTransition();

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [selectedFabricGroup, setSelectedFabricGroup] = useState<Fabric[]>([]);
  const [deletingFabric, setDeletingFabric] = useState<Fabric | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDependencies, setDeleteDependencies] = useState<string[]>([]);
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [bulkDeleteGroup, setBulkDeleteGroup] = useState<{ qualityCode: string; qualityName: string; items: Fabric[] } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [fadeOutRows, setFadeOutRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FabricFilters>({
    qualityCode: '',
    qualityName: '',
    type: '',
    weaver: '',
    weaverQualityName: '',
    search: '',
    minGsm: '',
    maxGsm: '',
    minWeight: '',
    maxWeight: '',
    minRate: '',
    maxRate: '',
    minWidth: '',
    maxWidth: '',
    hasImages: false,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [qualityNames, setQualityNames] = useState<string[]>([]);
  const [weavers, setWeavers] = useState<string[]>([]);
  const [weaverQualityNames, setWeaverQualityNames] = useState<string[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const [searchType, setSearchType] = useState<
    | 'all'
    | 'qualityCode'
    | 'qualityName'
    | 'type'
    | 'weaver'
    | 'weaverQualityName'
  >('all');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(() => {
    if (typeof window !== 'undefined') {
      const savedItemsPerPage = localStorage.getItem('fabricsItemsPerPage');
      if (savedItemsPerPage) {
        if (savedItemsPerPage === 'All') {
          return 'All';
        }
        const parsed = parseInt(savedItemsPerPage, 10);
        // Validate it's one of the allowed options
        if ([10, 20, 50, 100].includes(parsed)) {
          return parsed;
        }
      }
    }
    return 10;
  });
  const itemsPerPageOptions = PAGINATION.ITEMS_PER_PAGE_OPTIONS;
  const [paginationInfo, setPaginationInfo] = useState({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Enhanced UI states
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    // Load view mode from localStorage on component mount
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('fabricsViewMode');
      return savedViewMode === 'table' ? 'table' : 'cards';
    }
    return 'cards';
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [selectedFabrics, setSelectedFabrics] = useState<Set<string>>(new Set());
  const [bulkActions, setBulkActions] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'popular' | 'trending'>('all');
  const [showIndividualFabrics, setShowIndividualFabrics] = useState(false);

  // ✨ Track glowing items for add/edit success feedback (2 second glow)
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
  // ⚡ RED GLOW: Track items being deleted for red glow animation
  const [redGlowingIds, setRedGlowingIds] = useState<Set<string>>(new Set());
  // ⚡ SWIPE: Track items for swipe right-to-left animation
  const [swipingIds, setSwipingIds] = useState<Set<string>>(new Set());
  // Track quality groups being deleted for bulk delete animation
  const [deletingQualityGroups, setDeletingQualityGroups] = useState<Set<string>>(new Set());

  // Track current image index for each card
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});

  // Track if we've already handled refresh to prevent duplicate refreshes
  const refreshHandledRef = useRef<string>('');
  // ⚡ FIX: Track if refresh is in progress to prevent multiple simultaneous refreshes
  const refreshingRef = useRef<boolean>(false);
  // ⚡ FIX: Track last refresh time to prevent rapid consecutive refreshes
  const lastRefreshTimeRef = useRef<number>(0);
  const REFRESH_COOLDOWN_MS = TIMEOUTS.REFRESH_COOLDOWN;
  // ⚡ FIX: Track updated fabric IDs to prevent them from being overwritten
  const updatedFabricIdsRef = useRef<Set<string>>(new Set());
  // Track recently updated/created fabrics to preserve them during GET calls
  const recentlyUpdatedFabricsRef = useRef<Map<string, Fabric>>(new Map());
  // ⚡ FIX: Track if page is mounted to prevent unnecessary refreshes
  const isMountedRef = useRef<boolean>(false);
  // ⚡ FIX: Track last route to detect navigation changes
  const lastRouteRef = useRef<string>('');
  // ⚡ FIX: Track permanently deleted fabric IDs to prevent them from reappearing
  const deletedFabricIdsRef = useRef<Set<string>>(new Set());
  // Debounce search input to avoid rapid network calls
  const searchDebounceRef = useRef<any>(null);
  // Skip first render for search effect (initial fetch already runs)
  const hasInitializedSearchRef = useRef<boolean>(false);
  // Track active fabrics fetch to cancel stale requests
  const fetchAbortRef = useRef<AbortController | null>(null);
  // Skip first run for individual filter-triggered effects to avoid duplicate initial fetches
  const typeFilterInitializedRef = useRef<boolean>(false);
  const weaverFilterInitializedRef = useRef<boolean>(false);
  const weaverQualityFilterInitializedRef = useRef<boolean>(false);
  // Prevent duplicate initial fetches
  const initialFetchStartedRef = useRef<boolean>(false);
  // Track items per page change timeout for cleanup
  const itemsPerPageTimeoutRef = useRef<any>(null);
  // Track if initial fetch has completed to prevent duplicate calls
  const hasInitialFetchRef = useRef<boolean>(false);
  // Track if filters effect should run (skip on mount)
  const filtersInitializedRef = useRef<boolean>(false);

  // Clear stale session data so we don't render partial lists before the fresh fetch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('createdFabricData');
      sessionStorage.removeItem('editedFabricData');
      sessionStorage.removeItem('fabricsPageShouldRefresh');
      sessionStorage.removeItem('fabricsPageRefreshTime');
    }

    // Cleanup function to clear any pending timeouts on unmount
    return () => {
      if (itemsPerPageTimeoutRef.current) {
        clearTimeout(itemsPerPageTimeoutRef.current);
        itemsPerPageTimeoutRef.current = null;
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, []);

  // Redirect users (non-superadmin) away from fabrics page
  useEffect(() => {
    if (isUser) {
      router.push('/access-denied');
    }
  }, [isUser, router]);

  // Auto-switch view mode based on screen size (only if no saved preference exists)
  useEffect(() => {
    const handleResize = () => {
      // Check if user has a saved preference - if yes, respect it and don't auto-switch
      const savedViewMode = localStorage.getItem('fabricsViewMode');
      if (savedViewMode === 'table' || savedViewMode === 'cards') {
        // User has a saved preference, don't auto-switch
        return;
      }

      // Only auto-switch if no saved preference exists
      if (window.innerWidth < 800 && viewMode === 'table') {
        setViewMode('cards');
        localStorage.setItem('fabricsViewMode', 'cards');
      } else if (window.innerWidth >= 800 && viewMode === 'cards') {
        setViewMode('table');
        localStorage.setItem('fabricsViewMode', 'table');
      }
    };

    // Only run auto-switch on mount if no saved preference exists
    const savedViewMode = localStorage.getItem('fabricsViewMode');
    if (!savedViewMode || (savedViewMode !== 'table' && savedViewMode !== 'cards')) {
      handleResize(); // Check on mount only if no preference
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Handle manual view mode changes
  const handleViewModeChange = (newMode: 'table' | 'cards') => {
    setViewMode(newMode);
    // Save view mode to localStorage for persistence
    localStorage.setItem('fabricsViewMode', newMode);
    // Store timestamp of manual change
    localStorage.setItem('lastViewModeChange', Date.now().toString());
  };

  // Handle image navigation in cards
  const handleCardImageNavigation = (qualityCode: string, direction: 'prev' | 'next') => {
    setCardImageIndices(prev => {
      const currentIndex = prev[qualityCode] || 0;
      const fabric = fabrics.find(f => f.qualityCode === qualityCode);
      if (!fabric || !fabric.images || fabric.images.length === 0) return prev;

      let newIndex;
      if (direction === 'prev') {
        newIndex = currentIndex === 0 ? fabric.images.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex === fabric.images.length - 1 ? 0 : currentIndex + 1;
      }

      return { ...prev, [qualityCode]: newIndex };
    });
  };

  const getCurrentCardImage = (fabric: Fabric, qualityCode: string) => {
    if (!fabric.images) return null;
    const validImages = fabric.images.filter(img => img && img.trim() !== '');
    if (validImages.length === 0) return null;
    const currentIndex = cardImageIndices[qualityCode] || 0;
    return validImages[currentIndex % validImages.length] || validImages[0];
  };

  // Enhanced image and selection states
  const [showImageModal, setShowImageModal] = useState<{ fabric: Fabric; imageIndex: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isImageLoading, setIsImageLoading] = useState<{ [key: string]: boolean }>({});
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [lastSelectedFabric, setLastSelectedFabric] = useState<string | null>(null);
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(null);
  const [currentStickerFabric, setCurrentStickerFabric] = useState<Fabric | null>(null);
  const [isLoadingStickerPreview, setIsLoadingStickerPreview] = useState(false);
  const stickerBlobUrlRef = useRef<string | null>(null); // Track blob URLs for cleanup

  // Cleanup blob URLs on unmount or when preview closes
  useEffect(() => {
    return () => {
      if (stickerBlobUrlRef.current) {
        URL.revokeObjectURL(stickerBlobUrlRef.current);
        stickerBlobUrlRef.current = null;
      }
    };
  }, []);

  // Cleanup blob URL when preview closes
  useEffect(() => {
    if (!showStickerPreview && stickerBlobUrlRef.current) {
      URL.revokeObjectURL(stickerBlobUrlRef.current);
      stickerBlobUrlRef.current = null;
    }
  }, [showStickerPreview]);
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);
  const [showFabricForm, setShowFabricForm] = useState(false);
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [fetchInFlight, setFetchInFlight] = useState(0);
  const [fetchedDataOnce, setFetchedDataOnce] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Keep loading true whenever initial loading is active or any fetch is in flight
  // ⚡ CRITICAL: Keep loading true until initial fetch completes to prevent "no data" flash
  useEffect(() => {
    // Always show loading if:
    // 1. Initial loading is active
    // 2. Any fetch is in flight
    // 3. Initial fetch hasn't completed yet
    // 4. We haven't done the initial fetch yet
    if (initialLoading || fetchInFlight > 0 || !initialFetchDone || !hasInitialFetchRef.current) {
      setLoading(true);
    } else if (hasInitialFetchRef.current && initialFetchDone && fetchInFlight === 0) {
      // Only set loading to false when:
      // 1. Initial fetch has completed
      // 2. No fetches are in flight
      setLoading(false);
    }
  }, [fetchInFlight, initialFetchDone, initialLoading]);

  // Helper function to sort fabrics based on sort criteria
  const sortFabrics = (fabrics: Fabric[], sortBy: string, sortOrder: string) => {
    return [...fabrics].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt || a.updatedAt || 0);
          bValue = new Date(b.createdAt || b.updatedAt || 0);
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt || a.createdAt || 0);
          bValue = new Date(b.updatedAt || b.createdAt || 0);
          break;
        case 'qualityName':
          aValue = a.qualityName?.toLowerCase() || '';
          bValue = b.qualityName?.toLowerCase() || '';
          break;
        case 'weaver':
          aValue = a.weaver?.toLowerCase() || '';
          bValue = b.weaver?.toLowerCase() || '';
          break;
        case 'gsm':
          aValue = a.gsm || 0;
          bValue = b.gsm || 0;
          break;
        case 'weight':
          aValue = a.weight || 0;
          bValue = b.weight || 0;
          break;
        case 'greighRate':
          aValue = a.greighRate || 0;
          bValue = b.greighRate || 0;
          break;
        default:
          aValue = new Date(a.createdAt || a.updatedAt || 0);
          bValue = new Date(b.createdAt || b.updatedAt || 0);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Clear sessionStorage flags only (not actual data caching)
  const clearAllFabricCaches = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Clear sessionStorage flags only
    sessionStorage.removeItem('fabricsPageShouldRefresh');
    sessionStorage.removeItem('fabricsPageRefreshTime');
    sessionStorage.removeItem('createdFabricData');
    sessionStorage.removeItem('editedFabricData');

    devLog('✅ Session storage flags cleared');
  }, []);

  // Fetch fabrics with proper cache handling
  const fetchFabrics = async (forceRefresh = false, page = currentPage, limit = itemsPerPage, retryCount = 0, showLoading = true) => {
    // Prevent duplicate initial fetches when called in quick succession
    if (!hasInitialFetchRef.current && forceRefresh && initialFetchStartedRef.current && retryCount === 0) {
      devLog('⏸️ Skipping duplicate initial fetch');
      return;
    }
    if (!hasInitialFetchRef.current && forceRefresh) {
      initialFetchStartedRef.current = true;
    }

    setFetchInFlight(prev => prev + 1);
    // DISABLED: No automatic refresh based on sessionStorage flags
    // Only refresh when explicitly requested (forceRefresh=true) or for user actions (pagination, search)

    // NO CACHING - Always fetch fresh data from API

    // Only show loading for initial load or manual refresh, not for pagination
    if (showLoading) {
      setLoading(true);
    }

    let timeoutId: any = null;
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (fetchAbortRef.current) {
        fetchAbortRef.current = null;
      }
    };

    try {
      // Abort any in-flight fabrics request before starting a new one
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }

      const controller = new AbortController();
      fetchAbortRef.current = controller;
      // Increased timeout for file uploads and slow server responses
      const timeoutDuration = retryCount > 0 ? 30000 : 20000; // 20s first try, 30s for retries
      timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      const params = new URLSearchParams();
      // Handle search based on searchType
      if (filters.search) {
        switch (searchType) {
          case 'all':
            params.append('search', filters.search);
            break;
          case 'qualityCode':
            params.append('qualityCode', filters.search);
            break;
          case 'qualityName':
            params.append('qualityName', filters.search);
            break;
          case 'type':
            if (!typeFilter) params.append('type', filters.search);
            break;
          case 'weaver':
            params.append('weaver', filters.search);
            break;
          case 'weaverQualityName':
            params.append('weaverQualityName', filters.search);
            break;
          default:
            params.append('search', filters.search);
            break;
        }
      }

      // Type filter (separate from search) - takes precedence over type search
      if (typeFilter) params.append('type', typeFilter);

      // Use filter dropdowns only if not searching by the same field
      // Only use weaver filter if not searching by weaver
      if (searchType !== 'weaver' && filters.weaver) params.append('weaver', filters.weaver);
      // Only use weaverQualityName filter if not searching by weaverQualityName
      if (searchType !== 'weaverQualityName' && filters.weaverQualityName) params.append('weaverQualityName', filters.weaverQualityName);

      // Add sorting parameters
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      // Add pagination parameters
      const limitValue = limit === 'All' ? 1000 : limit;
      params.append('limit', limitValue.toString());
      params.append('page', page.toString());
      params.append('groupByQuality', 'true'); // Enable quality code pagination

      const token = localStorage.getItem('token');

      // NO CACHING - Always fetch fresh data

      // ⚡ FIX: Use cache: 'no-store' to ensure fresh data
      const response = await fetch(`/api/fabrics?${params}`, {
        headers: {
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        // ⚡ FIX: Always use no-store to ensure fresh data
        cache: 'no-store',
        signal: controller.signal // Support abort for canceling stale requests
      });

      cleanup();

      if (!response.ok) {
        // Check for session/auth errors - redirect to login immediately
        if (response.status === 401 || response.status === 403 || response.status === 503 || response.status === 500 || response.status === 502) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Update pagination info first
        if (data.pagination) {
          setPaginationInfo({
            totalCount: data.pagination.totalCount,
            totalPages: data.pagination.totalPages,
            currentPage: data.pagination.currentPage,
            hasNextPage: data.pagination.hasNextPage,
            hasPrevPage: data.pagination.hasPrevPage
          });
        }

        // Update fabrics state immediately
        let fabricsToSet = data.data;

        // ⚡ FIX: Filter out temporary/optimistic fabrics from API response
        // These should never come from the API, but filter just in case
        if (Array.isArray(fabricsToSet)) {
          fabricsToSet = fabricsToSet.filter((f: Fabric | any) => !isTemporaryFabric(f));
        }

        // Track that we received data (even if empty, we've fetched)
        // This prevents "no data" message from showing during refresh
        if (Array.isArray(fabricsToSet)) {
          setFetchedDataOnce(true);
        }

        // ⚡ FIX: Merge with created fabrics from sessionStorage if they exist
        // This ensures newly created fabrics are included even if they're not in the API response yet
        const createdFabricData = sessionStorage.getItem('createdFabricData');
        if (createdFabricData && page === 1) {
          try {
            const createdFabrics = JSON.parse(createdFabricData);
            if (Array.isArray(createdFabrics) && createdFabrics.length > 0) {
              devLog('🔄 Merging', createdFabrics.length, 'created fabrics with fetched data...');
              // Create a map of fetched fabrics by _id
              const fabricMap = new Map(data.data.map((f: Fabric) => [String(f._id), f]));

              // Add created fabrics that aren't already in the fetched data
              createdFabrics.forEach((createdFabric: Fabric) => {
                if (createdFabric._id && !fabricMap.has(String(createdFabric._id))) {
                  fabricMap.set(String(createdFabric._id), createdFabric);
                }
              });

              // Convert back to array and sort
              fabricsToSet = Array.from(fabricMap.values() as Iterable<Fabric>).sort((a, b) => {
                const aDate = new Date(a.createdAt || 0);
                const bDate = new Date(b.createdAt || 0);
                return aDate.getTime() - bDate.getTime();
              });

              devLog('✅ Merged created fabrics:', fabricsToSet.length, 'total');
            }
          } catch (error) {
            devError('Error merging created fabrics:', error);
          }
        }

        // ⚡ FIX: Also merge edited fabrics from sessionStorage
        // Always check sessionStorage again here in case it was set after fetch started
        const currentEditedFabricData = sessionStorage.getItem('editedFabricData');
        if (currentEditedFabricData) {
          try {
            const parsedData = JSON.parse(currentEditedFabricData);
            const updatedFabricsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
            if (updatedFabricsArray.length > 0) {
              devLog('🔄 Merging', updatedFabricsArray.length, 'edited fabric(s) with fetched data...');
              // Create a map of fetched fabrics by _id
              const fabricMap = new Map(fabricsToSet.map((f: Fabric) => [String(f._id), f]));

              // Update or add each edited fabric
              updatedFabricsArray.forEach(updatedFabric => {
                if (updatedFabric && updatedFabric._id) {
                  const fabricId = String(updatedFabric._id);
                  // Track this fabric ID as updated
                  updatedFabricIdsRef.current.add(fabricId);
                  // Always use the edited fabric data (it's more recent)
                  fabricMap.set(fabricId, {
                    ...updatedFabric,
                    updatedAt: updatedFabric.updatedAt || new Date().toISOString()
                  });
                  devLog('✅ Updated fabric in map:', fabricId);
                }
              });

              // Convert back to array and sort
              fabricsToSet = Array.from(fabricMap.values() as Iterable<Fabric>).sort((a, b) => {
                const aDate = new Date(a.createdAt || 0);
                const bDate = new Date(b.createdAt || 0);
                return aDate.getTime() - bDate.getTime();
              });

              devLog('✅ Merged edited fabrics:', fabricsToSet.length, 'total');
            }
          } catch (error) {
            devError('Error merging edited fabrics:', error);
          }
        }

        // ⚡ CRITICAL: Use setFabrics with a function to ensure updated/created fabrics are preserved
        // This ensures newly created/updated fabrics are always shown, even if API hasn't indexed them yet
        // ⚡ FIX: Check if filters are active - if yes, show empty state when no results (don't preserve old data)
        setFabrics(prevFabrics => {
          // Check if any filters are active
          const hasActiveFilters = typeFilter || filters.search || filters.weaver || filters.weaverQualityName ||
            filters.qualityCode || filters.qualityName;

          // If API returned empty data and we have existing fabrics:
          // - If filters are active: show empty state (don't preserve old data - user is filtering)
          // - If no filters and not forceRefresh: preserve existing data (might be temporary API issue)
          if ((!fabricsToSet || fabricsToSet.length === 0) && prevFabrics.length > 0 && !forceRefresh && !hasActiveFilters) {
            devLog('⚠️ API returned empty data, preserving existing fabrics (no active filters):', prevFabrics.length);
            return prevFabrics; // Don't overwrite with empty data only if no filters are active
          }

          // If filters are active and API returns empty, show empty state (clear old data)
          if (hasActiveFilters && (!fabricsToSet || fabricsToSet.length === 0)) {
            devLog('⚠️ Filter active but no results - showing empty state');
            return []; // Clear data to show "no results" message
          }

          // Check sessionStorage again to ensure we have the latest edited/created data
          const latestEditedData = sessionStorage.getItem('editedFabricData');
          const latestCreatedData = sessionStorage.getItem('createdFabricData');

          // Create a map starting with fetched data (or existing if API was empty)
          const fabricMap = new Map((fabricsToSet && fabricsToSet.length > 0 ? fabricsToSet : prevFabrics).map((f: Fabric) => [String(f._id), f]));

          // ⚡ CRITICAL: Merge edited fabrics (these take precedence over fetched data)
          if (latestEditedData) {
            try {
              const parsedData = JSON.parse(latestEditedData);
              const updatedFabricsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
              if (updatedFabricsArray.length > 0) {
                updatedFabricsArray.forEach(updatedFabric => {
                  if (updatedFabric && updatedFabric._id) {
                    const fabricId = String(updatedFabric._id);
                    updatedFabricIdsRef.current.add(fabricId);
                    // Always use the edited fabric data (it's more recent and accurate)
                    fabricMap.set(fabricId, {
                      ...updatedFabric,
                      updatedAt: updatedFabric.updatedAt || new Date().toISOString()
                    });
                    devLog('✅ Merged edited fabric into final state:', fabricId);
                  }
                });
              }
            } catch (error) {
              devError('Error parsing latestEditedData in final merge:', error);
            }
          }

          // ⚡ CRITICAL: Merge created fabrics (add them if not already in fetched data)
          if (latestCreatedData && page === 1) {
            try {
              const createdFabrics = JSON.parse(latestCreatedData);
              if (Array.isArray(createdFabrics) && createdFabrics.length > 0) {
                createdFabrics.forEach((createdFabric: Fabric) => {
                  if (createdFabric && createdFabric._id) {
                    const fabricId = String(createdFabric._id);
                    // Only add if not already in the map (from API or edited data)
                    if (!fabricMap.has(fabricId)) {
                      fabricMap.set(fabricId, createdFabric);
                      devLog('✅ Merged created fabric into final state:', fabricId);
                    }
                  }
                });
              }
            } catch (error) {
              devError('Error parsing latestCreatedData in final merge:', error);
            }
          }

          // ⚡ FIX: Helper function to check if fabric matches current search/filter criteria
          const fabricMatchesSearch = (fabric: Fabric): boolean => {
            // If no search is active, include all fabrics
            if (!filters.search && !typeFilter && !filters.weaver && !filters.weaverQualityName) {
              return true;
            }

            // Check search criteria
            if (filters.search) {
              const searchLower = filters.search.toLowerCase();
              switch (searchType) {
                case 'all':
                  // Search in all fields
                  const allFields = [
                    fabric.qualityCode || '',
                    fabric.qualityName || '',
                    fabric.type || '',
                    fabric.weaver || '',
                    fabric.weaverQualityName || ''
                  ].join(' ').toLowerCase();
                  if (!allFields.includes(searchLower)) return false;
                  break;
                case 'qualityCode':
                  if (!(fabric.qualityCode || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'qualityName':
                  if (!(fabric.qualityName || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'type':
                  if (!(fabric.type || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'weaver':
                  if (!(fabric.weaver || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'weaverQualityName':
                  if (!(fabric.weaverQualityName || '').toLowerCase().includes(searchLower)) return false;
                  break;
              }
            }

            // Check type filter
            if (typeFilter && fabric.type !== typeFilter) {
              return false;
            }

            // Check weaver filter
            if (filters.weaver && searchType !== 'weaver' && fabric.weaver !== filters.weaver) {
              return false;
            }

            // Check weaverQualityName filter
            if (filters.weaverQualityName && searchType !== 'weaverQualityName' && fabric.weaverQualityName !== filters.weaverQualityName) {
              return false;
            }

            return true;
          };

          // ⚡ CRITICAL: Preserve recently updated/created fabrics from previous state
          // BUT ONLY if they match the current search/filter criteria
          // This ensures they don't disappear when GET runs before database commit completes
          prevFabrics.forEach((f: Fabric) => {
            const fabricId = String(f._id);
            // If fabric was recently updated/created, preserve it even if not in API response
            // BUT ONLY if it matches current search criteria
            if (updatedFabricIdsRef.current.has(fabricId) || recentlyUpdatedFabricsRef.current.has(fabricId)) {
              if (!fabricMap.has(fabricId)) {
                // Use the recently updated version if available, otherwise use previous state
                const recentFabric = recentlyUpdatedFabricsRef.current.get(fabricId) || f;
                // ⚡ FIX: Only preserve if it matches current search criteria
                if (fabricMatchesSearch(recentFabric)) {
                  fabricMap.set(fabricId, recentFabric);
                  devLog('✅ Preserved recently updated fabric (matches search):', fabricId);
                } else {
                  devLog('⚠️ Skipped recently updated fabric (does not match search):', fabricId);
                }
              } else {
                // If in API response, use the recent version if it's newer
                const recentFabric = recentlyUpdatedFabricsRef.current.get(fabricId);
                if (recentFabric) {
                  const apiFabric = fabricMap.get(fabricId) as Fabric | undefined;
                  const recentDate = new Date(
                    (recentFabric as Fabric)?.updatedAt || (recentFabric as Fabric)?.createdAt || 0
                  );
                  const apiDate = new Date(apiFabric?.updatedAt || apiFabric?.createdAt || 0);
                  if (recentDate > apiDate) {
                    fabricMap.set(fabricId, recentFabric);
                    devLog('✅ Using recent version (newer):', fabricId);
                  }
                }
              }
            }
          });

          // Also add any recently updated fabrics that might not be in prevFabrics
          // BUT ONLY if they match current search criteria
          recentlyUpdatedFabricsRef.current.forEach((fabric, fabricId) => {
            if (!fabricMap.has(fabricId)) {
              // ⚡ FIX: Only add if it matches current search criteria
              if (fabricMatchesSearch(fabric)) {
                fabricMap.set(fabricId, fabric);
                devLog('✅ Added recently updated fabric from ref (matches search):', fabricId);
              } else {
                devLog('⚠️ Skipped recently updated fabric from ref (does not match search):', fabricId);
              }
            }
          });

          // ⚡ FIX: Filter out deleted fabric IDs and temporary fabrics to prevent them from reappearing
          const finalFabrics = Array.from(fabricMap.values() as Iterable<Fabric>)
            .filter(f => {
              const id = String(f._id);
              // Remove deleted fabrics
              if (deletedFabricIdsRef.current.has(id)) return false;
              // Remove temporary/optimistic fabrics (they should be replaced by real ones)
              if (isTemporaryFabric(f)) return false;
              return true;
            })
            .sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });

          // NO CLEANUP: Keep recentlyUpdatedFabricsRef entries to avoid accidental removal
          // when backend commit/GET races happen.

          devLog('✅ Final fabrics state:', finalFabrics.length, 'fabrics (filtered deleted)');
          return finalFabrics;
        });
        setLastFetchTime(Date.now());
        setRetryCount(0);

        // NO CACHING - Always fetch fresh data from API

        // Notification is handled by refresh handlers to prevent duplicates
      } else {
        throw new Error(data.message || 'Failed to fetch fabrics');
      }
    } catch (error: any) {
      // Ensure cleanup happens even on error
      cleanup();

      // Check for session/auth errors - redirect to login immediately
      if (error.message?.includes('503') || error.message?.includes('401') || error.message?.includes('403') ||
        error.message?.includes('Session expired') || error.message?.includes('Unauthorized')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }

      if (error.name === 'AbortError') {
        // AbortError means request was intentionally cancelled - ignore it
        // This happens when a new search/filter is triggered and old request is aborted
        devLog('Request aborted (new request initiated)');
        return; // Don't show error or retry for intentional aborts
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showToast('error', 'Network error. Please check your internet connection and try again.', 5000);
      } else {
        showToast('error', `Failed to load fabrics: ${error.message || 'Unknown error'}. Please try again.`, 5000);
      }
    } finally {
      // ⚡ FIX: Check if this is the initial fetch BEFORE decrementing fetchInFlight
      const isInitialFetch = forceRefresh && page === 1 && !hasInitialFetchRef.current;

      // ⚡ FIX: Decrement fetchInFlight
      setFetchInFlight(prev => Math.max(0, prev - 1));

      // ⚡ FIX: For initial fetch, set initialFetchDone to true after fetch completes
      // This ensures loading skeleton shows until fetch completes
      if (isInitialFetch) {
        hasInitialFetchRef.current = true;
        // Set initialFetchDone to true - this will trigger the useEffect to manage loading
        setInitialFetchDone(true);
        setInitialLoading(false);
      }

      // ⚡ FIX: Don't manually set loading here - let the useEffect handle it
      // The useEffect will manage loading based on fetchInFlight and initialFetchDone
    }
  };

  // Enhanced pagination handler with bulletproof error handling and loading states
  const handlePageChange = async (newPage: number) => {
    // Prevent duplicate calls
    if (newPage === currentPage || isChangingPage) {
      return;
    }

    // Validate page number with strict bounds checking
    if (newPage < 1 || newPage > totalPages || totalPages === 0) {
      return;
    }

    // Set loading states immediately for smooth UX
    setIsChangingPage(true);

    try {
      // Update current page state immediately for responsive UI
      setCurrentPage(newPage);

      // Fetch new page data with timeout protection
      await fetchFabrics(false, newPage, itemsPerPage, 0, false);
    } catch (error) {
      devError('❌ Page change failed:', error);
      // Revert page state on error
      setCurrentPage(currentPage);
    } finally {
      // Always clean up loading states
      setIsChangingPage(false);
    }
  };

  const handleItemsPerPageChange = async (newItemsPerPage: number | 'All') => {
    if (newItemsPerPage === itemsPerPage) {
      return;
    }

    if (isChangingPage) {
      // Clear existing timeout if any
      if (itemsPerPageTimeoutRef.current) {
        clearTimeout(itemsPerPageTimeoutRef.current);
      }
      // Don't return, just wait a bit and try again
      itemsPerPageTimeoutRef.current = setTimeout(() => {
        itemsPerPageTimeoutRef.current = null;
        handleItemsPerPageChange(newItemsPerPage);
      }, 100);
      return;
    }

    // Set loading states immediately
    setIsChangingPage(true);

    try {
      // Update state first
      setItemsPerPage(newItemsPerPage);
      // Save to localStorage to persist across page refreshes
      if (typeof window !== 'undefined') {
        localStorage.setItem('fabricsItemsPerPage', newItemsPerPage.toString());
      }
      setCurrentPage(1); // Always reset to first page when changing items per page

      // Fetch first page with new items per page - force refresh to ensure fresh data
      await fetchFabrics(false, 1, newItemsPerPage, 0, false);
    } finally {
      // Always clean up loading states
      setIsChangingPage(false);
    }
  };

  // Fetch quality names for filter
  const fetchQualityNames = async () => {
    let timeoutId: any = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const token = localStorage.getItem('token');
      const response = await fetch('/api/fabrics/quality-names?limit=100', { // Limit for faster loading
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        cache: 'no-store', // NO CACHING - Always fetch fresh data
        signal: controller.signal
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        // Check for session/auth errors - redirect to login immediately
        if (response.status === 401 || response.status === 403 || response.status === 503 || response.status === 500 || response.status === 502) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setQualityNames(data.data);
      }
    } catch (error: any) {
      // Ensure timeout is cleared even on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (error.name === 'AbortError') {
        // Request was aborted, ignore
      } else {
        // Other errors - silently fail for filter dropdowns
      }
    }
  };

  // Fetch weavers for filter
  const fetchWeavers = async () => {
    let timeoutId: any = null;
    try {
      setFiltersLoading(true);
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const params = new URLSearchParams();
      if (filters.qualityName) params.append('qualityName', filters.qualityName);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/fabrics/weavers?${params}&limit=100`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        cache: 'no-store', // NO CACHING - Always fetch fresh data
        signal: controller.signal
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        // Check for session/auth errors - redirect to login immediately
        if (response.status === 401 || response.status === 403 || response.status === 503 || response.status === 500 || response.status === 502) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setWeavers(data.data || []);
      } else {
        setWeavers([]);
      }
    } catch (error: any) {
      // Ensure timeout is cleared even on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (error.name === 'AbortError') {
        devLog('Weavers fetch aborted');
      } else {
        devError('Error fetching weavers:', error);
        setWeavers([]);
      }
    } finally {
      setFiltersLoading(false);
    }
  };

  // Fetch weaver quality names for filter
  const fetchWeaverQualityNames = async () => {
    let timeoutId: any = null;
    try {
      setFiltersLoading(true);
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const params = new URLSearchParams();
      if (filters.weaver) params.append('weaver', filters.weaver);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/fabrics/weaver-quality-names?${params}&limit=100`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        cache: 'no-store', // NO CACHING - Always fetch fresh data
        signal: controller.signal
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        // Check for session/auth errors - redirect to login immediately
        if (response.status === 401 || response.status === 403 || response.status === 503 || response.status === 500 || response.status === 502) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setWeaverQualityNames(data.data || []);
      } else {
        setWeaverQualityNames([]);
      }
    } catch (error: any) {
      // Ensure timeout is cleared even on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (error.name === 'AbortError') {
        devLog('Weaver quality names fetch aborted');
      } else {
        devError('Error fetching weaver quality names:', error);
        setWeaverQualityNames([]);
      }
    } finally {
      setFiltersLoading(false);
    }
  };

  // DISABLED: Automatic refresh - causes data to disappear
  // Optimistic updates already handle UI, no need for auto-refresh
  useEffect(() => {
    // Disabled - no automatic refresh
    return;

    let hasHandledRefresh = false;

    const handleStorageChange = (e: StorageEvent) => {
      // DISABLED - no automatic refresh
      return;

      if (e.key === 'fabricsPageShouldRefresh' && e.newValue === 'true' && !hasHandledRefresh) {
        hasHandledRefresh = true;
        // Immediately refresh when storage changes
        setLoading(true);
        // ⚡ NO TOAST - Only animation
        fetchFabrics(true, currentPage, itemsPerPage, 0, true);
        sessionStorage.removeItem('fabricsPageShouldRefresh');
        sessionStorage.removeItem('fabricsPageRefreshTime');
      }
    };

    // Listen for storage events (works across tabs)
    window.addEventListener('storage', handleStorageChange);

    // DISABLED: Automatic refresh - causes data to disappear
    // Optimistic updates already handle UI, no need for auto-refresh
    const handleCustomRefresh = () => {
      // DISABLED - no automatic refresh
      return;
    };

    // DISABLED: No event listeners for automatic refresh
    // window.addEventListener('fabricsPageRefresh', handleCustomRefresh);

    // DISABLED: No polling for automatic refresh
    // const pollInterval = null; // DISABLED

    return () => {
      // DISABLED: No event listeners to clean up
      // window.removeEventListener('storage', handleStorageChange);
      // window.removeEventListener('fabricsPageRefresh', handleCustomRefresh);
      // if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentPage, itemsPerPage]);

  // ⚡ DISABLED: This useEffect was causing infinite loops on AWS
  // The searchParams dependency was changing frequently, causing constant re-runs
  // Initial load is now handled by the mount effect only
  useEffect(() => {
    // ⚡ FIX: Only handle explicit refresh flags, don't auto-refresh on every searchParams change
    const shouldRefresh = sessionStorage.getItem('fabricsPageShouldRefresh');
    const createdFabricData = sessionStorage.getItem('createdFabricData');
    const editedFabricData = sessionStorage.getItem('editedFabricData');

    // ⚡ FIX: Only proceed if we have explicit refresh flags AND haven't already handled them
    if (!shouldRefresh && !createdFabricData && !editedFabricData) {
      return; // No refresh flags, skip everything
    }

    // ⚡ FIX: Check cooldown to prevent loops
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    if (refreshingRef.current || (timeSinceLastRefresh < 5000 && lastRefreshTimeRef.current > 0)) {
      return; // In cooldown or already refreshing
    }

    // ⚡ FIX: Mark as handled immediately to prevent re-running
    if (shouldRefresh === 'true') {
      sessionStorage.removeItem('fabricsPageShouldRefresh');
    }

    refreshingRef.current = true;
    lastRefreshTimeRef.current = now;

    // Only merge data, don't trigger full refresh
    if (createdFabricData || editedFabricData) {
      // Merge logic here if needed, but don't call fetchFabrics
      devLog('⏸️ Refresh flags found but skipping auto-refresh to prevent loops');
    }

    refreshingRef.current = false;
    return; // Exit early, don't run the rest of the effect

    // OLD CODE BELOW - DISABLED TO PREVENT LOOPS
    /*
    const refreshTime = sessionStorage.getItem('fabricsPageRefreshTime');
    // Use both searchParams (Next.js) and window.location (fallback)
    const forceRefresh = searchParams?.get('refresh') === 'true' || new URLSearchParams(window.location.search).get('refresh') === 'true';
    const created = searchParams?.get('created') === 'true' || new URLSearchParams(window.location.search).get('created') === 'true';
    const updated = searchParams?.get('updated') === 'true' || new URLSearchParams(window.location.search).get('updated') === 'true';
    
    // Determine if we need to refresh
    const needsRefresh = shouldRefresh === 'true' || forceRefresh || created || updated || fabrics.length === 0;
    
    // Always fetch fresh data when navigating back to the page (no cache on initial load)
    const isInitialLoad = fabrics.length === 0 && !loading;
    
    // Create a unique key for this refresh attempt to prevent duplicate handling
    // Use refreshTime if available, otherwise use a combination of flags
    const refreshKey = needsRefresh ? `${forceRefresh}-${created}-${updated}-${shouldRefresh}-${refreshTime || 'new'}` : '';
    
    // Skip if we've already handled this exact refresh AND we have data
    // But always allow refresh if we have refresh flags or query params
    if (refreshKey && refreshHandledRef.current === refreshKey && fabrics.length > 0) {
      // Don't show toast again if already handled
      return;
    }
    
    // ⚡ FIX: Don't show notification yet - wait for data to load first
    // Notification will be shown after fetchFabrics completes successfully
    
    // ⚡ IMMEDIATE UPDATE: Update fabric in state immediately if editedFabricData exists
    // ⚡ FIX: Check sessionStorage flag OR query param (works when navigating back)
    if (editedFabricData && (updated || shouldRefresh === 'true')) {
      try {
        const parsedData = JSON.parse(editedFabricData);
        // ⚡ FIX: Handle both single fabric and array of fabrics
        const updatedFabricsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        devLog('⚡ IMMEDIATE UPDATE: Updating', updatedFabricsArray.length, 'fabric(s) in state');
        
        setFabrics(prevFabrics => {
          // Create a map of existing fabrics by _id for quick lookup
          const fabricMap = new Map(prevFabrics.map(f => [String(f._id), f]));
          
          // Update or add each fabric from the updated data
          updatedFabricsArray.forEach(updatedFabric => {
            if (updatedFabric && updatedFabric._id) {
              const fabricId = String(updatedFabric._id);
              fabricMap.set(fabricId, {
                ...updatedFabric,
                updatedAt: updatedFabric.updatedAt || new Date().toISOString()
              });
            }
          });
          
          // Convert map back to array and sort (newest first)
          const allFabrics = Array.from(fabricMap.values());
          return allFabrics.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime(); // Newest first
          });
        });
      } catch (error) {
        devError('Error parsing editedFabricData:', error);
      }
    }
    
    // ⚡ FIX: Handle created fabrics - add them to state immediately (OPTIMISTIC UPDATE)
    // ⚡ FIX: Check sessionStorage flag OR query param (works when navigating back)
    if (createdFabricData && (created || shouldRefresh === 'true')) {
      try {
        const createdFabrics = JSON.parse(createdFabricData);
        devLog('⚡ IMMEDIATE UPDATE: Adding created fabrics to state:', createdFabrics.length);
        if (Array.isArray(createdFabrics) && createdFabrics.length > 0) {
          // ⚡ FIX: Optimistic update - add immediately to UI
          setFabrics(prevFabrics => {
            // Add new fabrics to the beginning of the list
            const newFabrics = [...createdFabrics, ...prevFabrics];
            
            // Remove duplicates based on _id
            const uniqueFabrics = new Map();
            newFabrics.forEach(fabric => {
              if (fabric._id && !uniqueFabrics.has(fabric._id)) {
                uniqueFabrics.set(fabric._id, fabric);
              }
            });
            
            const uniqueFabricsArray = Array.from(uniqueFabrics.values());
            
            // Sort by createdAt descending (newest first)
            return uniqueFabricsArray.sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });
          });
          
          // ⚡ FIX: Update pagination info immediately
          setPaginationInfo(prev => ({
            ...prev,
            totalCount: prev.totalCount + createdFabrics.length
          }));
          
          devLog('✅ Optimistic update complete - fabrics added to UI immediately');
        }
      } catch (error) {
        devError('Error parsing createdFabricData:', error);
      }
    }
    
    // ⚡ FIX: Force refresh from server when returning from edit page to ensure fresh data
    // Don't rely on local state updates as they can cause inconsistencies
    
    // Create async function to handle refresh
    const handleRefresh = async () => {
      // ⚡ FIX: Prevent infinite refresh loops
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
      
      // If refresh is already in progress, skip
      if (refreshingRef.current) {
        devLog('⏸️ Refresh already in progress, skipping...');
        return;
      }
      
      // If we refreshed too recently, skip (cooldown period)
      if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS && lastRefreshTimeRef.current > 0) {
        devLog(`⏸️ Refresh cooldown active (${timeSinceLastRefresh}ms < ${REFRESH_COOLDOWN_MS}ms), skipping...`);
        return;
      }
      
      // Force refresh from server if we have refresh flags OR if this is a new page load
      // Always fetch fresh data when navigating back to ensure new fabrics are shown
      if (needsRefresh || (fabrics.length === 0 && !loading)) {
        // Mark refresh as in progress
        refreshingRef.current = true;
        lastRefreshTimeRef.current = now;
        
        // Mark this refresh as handled (only if we have a key)
        if (refreshKey) {
          refreshHandledRef.current = refreshKey;
        }
        
        // ⚡ CRITICAL: Clear refresh flags IMMEDIATELY before refresh to prevent loops
        if (shouldRefresh === 'true') {
          sessionStorage.removeItem('fabricsPageShouldRefresh');
        }
        if (refreshTime) {
          sessionStorage.removeItem('fabricsPageRefreshTime');
        }
        
        // ⚡ IMMEDIATE REFRESH: Trigger Next.js router refresh for server-side revalidation
        router.refresh();
        
        // Clear cache to ensure fresh data BEFORE fetching
        // NO CACHING - Always fetch fresh data
        
        // Force immediate refresh with loading indicator (stay on current page)
        // Always fetch from page 1 when coming from update to ensure we see the updated item
        const pageToFetch = (created || updated) ? 1 : currentPage;
        
        setLoading(true);
        
        // Always fetch with forceRefresh=true to bypass all caches
        // Add retry logic to ensure data is fetched
        let retryCount = 0;
        const maxRetries = 3;
        let fetchSuccess = false;
        
        while (retryCount < maxRetries && !fetchSuccess) {
          try {
            await fetchFabrics(true, pageToFetch, itemsPerPage, 0, true);
            fetchSuccess = true;
            devLog('✅ Fabric data fetched successfully on attempt', retryCount + 1);
            
            // ⚡ FIX: Show success notification ONLY AFTER data is loaded and displayed
            if (fetchSuccess) {
              // Wait a tiny bit to ensure UI has updated with the new data
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Now show the success notification
              if (created) {
                // ⚡ NO TOAST - Only animation
              } else if (updated) {
                // ⚡ NO TOAST - Only animation
              }
            }
          } catch (error) {
            retryCount++;
            devError(`❌ Fetch attempt ${retryCount} failed:`, error);
            if (retryCount < maxRetries) {
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
            }
          }
        }
        
        if (!fetchSuccess) {
          devError('❌ Failed to fetch fabric data after', maxRetries, 'attempts');
          showToast('error', 'Failed to refresh data. Please refresh the page manually.', 5000);
        }
        
        // ⚡ CRITICAL: Clean up sessionStorage and URL params AFTER fetch completes successfully
        // Only clean up if fetch was successful to prevent data loss
        if (fetchSuccess) {
          // Wait a bit more to ensure UI has fully updated with the new data
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // ⚡ CRITICAL: Clean up edited/created data after successful fetch
          // The data has been merged into state by fetchFabrics, so it's safe to clean up
          // Use a small delay to ensure state has updated
          setTimeout(() => {
            if (editedFabricData) {
              sessionStorage.removeItem('editedFabricData');
              devLog('✅ Cleaned up editedFabricData after successful fetch');
            }
            
            if (createdFabricData) {
              sessionStorage.removeItem('createdFabricData');
              devLog('✅ Cleaned up createdFabricData after successful fetch');
            }
          }, 300); // Wait for state to fully update
        }
        
        // Clean up URL params
        if (forceRefresh || created || updated) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
        
        // ⚡ CRITICAL: Mark refresh as complete
        refreshingRef.current = false;
    }
    };
    
    */
  }, []); // ⚡ FIX: Empty dependency array - only run once on mount, don't react to searchParams changes

  // Removed duplicate refresh handler - refresh is now handled by storage/event listeners above

  // Initial load - always fetch fresh data when component mounts
  useEffect(() => {
    // ⚡ CRITICAL: Restore deleted fabric IDs from sessionStorage on mount
    // This prevents deleted fabrics from reappearing after page refresh
    try {
      const storedDeletedIds = sessionStorage.getItem('deletedFabricIds');
      if (storedDeletedIds) {
        const deletedIdsArray = JSON.parse(storedDeletedIds);
        if (Array.isArray(deletedIdsArray)) {
          deletedFabricIdsRef.current = new Set(deletedIdsArray);
          devLog('✅ Restored', deletedIdsArray.length, 'deleted fabric ID(s) from sessionStorage');
        }
      }
    } catch (e) {
      devError('Error restoring deleted fabric IDs from sessionStorage:', e);
    }

    // ⚡ FIX: Check for refresh flags on mount - if they exist, force refresh
    const shouldRefresh = sessionStorage.getItem('fabricsPageShouldRefresh');
    const createdFabricData = sessionStorage.getItem('createdFabricData');
    const editedFabricData = sessionStorage.getItem('editedFabricData');

    // ⚡ CRITICAL: Always merge created/edited fabrics immediately on mount if they exist
    // This ensures they show even before the API call completes
    if (createdFabricData) {
      try {
        const createdFabrics = JSON.parse(createdFabricData);
        if (Array.isArray(createdFabrics) && createdFabrics.length > 0) {
          devLog('⚡ MOUNT: Adding', createdFabrics.length, 'created fabric(s) to state');
          setFabrics(prevFabrics => {
            const fabricMap = new Map(prevFabrics.map(f => [String(f._id), f]));
            createdFabrics.forEach((fabric: Fabric) => {
              if (fabric._id) {
                fabricMap.set(String(fabric._id), fabric);
              }
            });
            return Array.from(fabricMap.values()).sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });
          });
        }
      } catch (error) {
        devError('Error parsing createdFabricData on mount:', error);
      }
    }

    if (editedFabricData) {
      try {
        const parsedData = JSON.parse(editedFabricData);
        const updatedFabricsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        if (updatedFabricsArray.length > 0) {
          devLog('⚡ MOUNT: Updating', updatedFabricsArray.length, 'fabric(s) in state');
          setFabrics(prevFabrics => {
            const fabricMap = new Map(prevFabrics.map(f => [String(f._id), f]));
            updatedFabricsArray.forEach((fabric: Fabric) => {
              if (fabric._id) {
                fabricMap.set(String(fabric._id), fabric);
              }
            });
            return Array.from(fabricMap.values()).sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });
          });
        }
      } catch (error) {
        devError('Error parsing editedFabricData on mount:', error);
      }
    }

    // ⚡ FIX: Clean up temporary fabrics on mount/refresh
    setFabrics(prev => {
      const cleaned = prev.filter(f => !isTemporaryFabric(f));
      if (cleaned.length !== prev.length) {
        devLog('🧹 Cleaned up', prev.length - cleaned.length, 'temporary fabric(s) on mount');
      }
      return cleaned;
    });

    // ⚡ RESTORE: Load recently updated fabrics from sessionStorage to survive refresh
    // ⚡ CRITICAL: Do this BEFORE fetchFabrics so data is preserved
    // ⚡ FIX: Filter out temporary fabrics from sessionStorage restore
    try {
      const stored = sessionStorage.getItem('recentlyUpdatedFabrics');
      if (stored) {
        const storedEntries = JSON.parse(stored);
        const restoredMap = new Map<string, Fabric>();
        storedEntries.forEach(([id, fabric]: [string, Fabric]) => {
          if (id && fabric && fabric._id && !isTemporaryFabric(fabric)) {
            restoredMap.set(String(id), fabric);
            updatedFabricIdsRef.current.add(String(id));
          }
        });
        if (restoredMap.size > 0) {
          recentlyUpdatedFabricsRef.current = restoredMap;
          devLog('✅ Restored', restoredMap.size, 'recently updated fabric(s) from sessionStorage');

          // ⚡ CRITICAL: Also restore to state immediately so they show up right away
          setFabrics(prev => {
            const fabricMap = new Map(prev.map(f => [String(f._id), f]));
            restoredMap.forEach((fabric, fabricId) => {
              fabricMap.set(fabricId, fabric);
            });
            return Array.from(fabricMap.values())
              .filter(f => !isTemporaryFabric(f)) // Filter out any temporary fabrics
              .sort((a, b) => {
                const aDate = new Date(a.createdAt || 0);
                const bDate = new Date(b.createdAt || 0);
                return bDate.getTime() - aDate.getTime();
              });
          });
        }
      }
    } catch (e) {
      devError('Error restoring from sessionStorage:', e);
    }

    // ⚡ CRITICAL: Always fetch fresh data on initial mount to ensure new fabrics are shown
    // ALWAYS clear caches and fetch fresh data on mount (don't rely on flags)
    // ⚡ FIX: Check if already mounted to prevent duplicate fetches
    if (isMountedRef.current) {
      devLog('⏸️ Already mounted, skipping initial fetch');
      return;
    }

    devLog('🔄 Initial mount - fetching fresh data...');
    isMountedRef.current = true;
    lastRouteRef.current = pathname || window.location.pathname;
    hasInitialFetchRef.current = false; // Mark as not fetched yet

    // ⚡ CRITICAL: Set loading states immediately to prevent "no data" flash
    // Also clear fabrics array to prevent showing old data during refresh
    setFabrics([]);
    setLoading(true);
    setInitialLoading(true);
    setInitialFetchDone(false);
    setFetchedDataOnce(false); // Reset fetchedDataOnce on refresh to prevent "no data" flash

    // NO CACHING - Always fetch fresh data from API

    // Always fetch from page 1 on mount to ensure we see new items
    fetchFabrics(true, 1, itemsPerPage, 0, true)
      .then(() => {
        hasInitialFetchRef.current = true; // Mark as fetched after completion
        filtersInitializedRef.current = true; // Allow filters effect to run now
        // initialFetchDone is set in fetchFabrics finally block for initial fetch
        // But also set it here as a backup
        setInitialFetchDone(true);
        setInitialLoading(false);
      })
      .catch(() => {
        // Even on error, mark as fetched to allow subsequent operations
        hasInitialFetchRef.current = true;
        filtersInitializedRef.current = true;
        setInitialFetchDone(true);
        setInitialLoading(false);
      });
    // Mark that initial fetch has been started to avoid duplicate triggers
    initialFetchStartedRef.current = true;
  }, []); // Only run on mount

  // ⚡ DISABLED: Auto-refresh on visibility/focus to prevent infinite loops on AWS
  // These handlers were causing infinite refresh loops on production
  // Manual refresh or route-based refresh is sufficient
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     // Disabled to prevent infinite loops
  //   };
  //   const handleFocus = () => {
  //     // Disabled to prevent infinite loops
  //   };
  //   return () => {};
  // }, []);

  // ⚡ FIXED: Route change detection with strict guards to prevent infinite loops
  useEffect(() => {
    const currentPath = pathname || window.location.pathname;

    // ⚡ FIX: Only run if we're actually on the fabrics page
    if (currentPath !== '/fabrics') {
      // Update route ref even if not on fabrics page to track navigation
      if (lastRouteRef.current === '/fabrics') {
        lastRouteRef.current = currentPath;
      }
      return;
    }

    // ⚡ FIX: Only run if route actually changed (not on every render)
    if (lastRouteRef.current === currentPath) {
      return; // Already handled this route, don't run again
    }

    // ⚡ FIX: Strict cooldown check - prevent any refresh if one happened recently
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    const COOLDOWN_EXTENDED = 5000; // 5 seconds cooldown on AWS

    if (refreshingRef.current || (timeSinceLastRefresh < COOLDOWN_EXTENDED && lastRefreshTimeRef.current > 0)) {
      devLog('⏸️ Route change refresh skipped - cooldown or already in progress');
      lastRouteRef.current = currentPath; // Update route ref
      return;
    }

    // DISABLED: No automatic refresh on route change
    // Optimistic updates handle UI, no need for auto-refresh
    // Update route ref immediately to prevent re-running
    lastRouteRef.current = currentPath;
    isMountedRef.current = true;

    // DISABLED - no automatic refresh
    devLog('⏸️ Route change detected, but auto-refresh is disabled');
  }, [pathname]); // ⚡ FIX: Only depend on pathname

  // Only keyboard shortcuts for manual refresh and escape modal closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 or Ctrl+R to refresh
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        fetchFabrics(true, currentPage, itemsPerPage, 0, true);
      } else if (e.key === 'Escape') {
        if (showImageModal) {
          setShowImageModal(null);
        } else if (showStickerPreview) {
          setShowStickerPreview(false);
        } else if (showExportModal) {
          setShowExportModal(false);
        } else if (showDeleteConfirmation) {
          setShowDeleteConfirmation(false);
        } else if (showDetails) {
          setShowDetails(false);
        } else if (showFabricForm) {
          setShowFabricForm(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    currentPage,
    itemsPerPage,
    showImageModal,
    showStickerPreview,
    showExportModal,
    showDeleteConfirmation,
    showDetails,
    showFabricForm,
    fetchFabrics
  ]);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Show button when scrolled more than 300px or near bottom
      const isNearBottom = scrollPosition + windowHeight >= documentHeight - 100;
      setShowScrollToTop(scrollPosition > 300 || isNearBottom);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Lazy load weavers only when needed
  useEffect(() => {
    if (filters.qualityName) {
      // Add small delay to prevent rapid API calls
      const timeoutId = setTimeout(() => {
        fetchWeavers();
      }, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [filters.qualityName]);

  // Re-search when search text, search type, or page size changes
  // Improved pattern matching sampling page with useTransition
  useEffect(() => {
    // Skip the first render because the initial mount fetch already ran
    if (!hasInitializedSearchRef.current) {
      hasInitializedSearchRef.current = true;
      return;
    }

    // Clear existing timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Cancel previous fetch request if still pending
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
      fetchAbortRef.current = null;
    }

    // Debounce search - use TIMEOUTS.SEARCH_DEBOUNCE (500ms) matching sampling page
    // Use startTransition for non-urgent search updates
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => {
        setIsChangingPage(true);

        // Create new AbortController for this search
        const searchController = new AbortController();
        fetchAbortRef.current = searchController;

        // Always reset to first page on a new search to avoid empty pages
        setCurrentPage(1);

        // Fetch with abort controller support
        fetchFabrics(false, 1, itemsPerPage, 0, false)
          .then(() => {
            setIsChangingPage(false);
            // Clear abort controller if this was the current search
            if (fetchAbortRef.current === searchController) {
              fetchAbortRef.current = null;
            }
          })
          .catch((error) => {
            // Ignore abort errors
            if (error instanceof Error && error.name === 'AbortError') {
              return;
            }
            devError('Error searching fabrics:', error);
            setIsChangingPage(false);
            // Clear abort controller if this was the current search
            if (fetchAbortRef.current === searchController) {
              fetchAbortRef.current = null;
            }
          });
      });
    }, TIMEOUTS.SEARCH_DEBOUNCE);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [filters.search, searchType, itemsPerPage]);

  // Re-search when typeFilter changes
  useEffect(() => {
    // Skip on initial mount when typeFilter is empty (no filter selected)
    if (!typeFilterInitializedRef.current) {
      typeFilterInitializedRef.current = true;
      // Only skip if typeFilter is empty (initial state)
      // If user has already selected a type on mount (unlikely but possible), allow the fetch
      if (!typeFilter || typeFilter === '') {
        return;
      }
    }

    // Skip if initial fetch hasn't completed yet
    if (!hasInitialFetchRef.current) {
      return;
    }

    // Reset to first page to avoid empty pages after filtering
    setCurrentPage(1);

    // Set loading state when filtering to prevent "no data" flash
    // Clear old data immediately when filtering starts to prevent showing wrong data
    setFabrics([]);
    setLoading(true);

    // Debounce the fetch to avoid too many API calls
    const timeoutId = setTimeout(() => {
      fetchFabrics(false, 1, itemsPerPage, 0, true); // Set showLoading to true to show loading state
    }, 300);
    return () => clearTimeout(timeoutId);
    // Note: fetchFabrics is intentionally not in deps - it uses typeFilter from closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, itemsPerPage]);

  // Re-search when weaver filter changes
  useEffect(() => {
    if (!weaverFilterInitializedRef.current) {
      weaverFilterInitializedRef.current = true;
      return;
    }

    // Skip if initial fetch hasn't completed yet
    if (!hasInitialFetchRef.current) {
      return;
    }

    setCurrentPage(1);
    // Set loading state when filtering to prevent "no data" flash
    // Clear old data immediately when filtering starts to prevent showing wrong data
    setFabrics([]);
    setLoading(true);

    const timeoutId = setTimeout(() => {
      fetchFabrics(false, 1, itemsPerPage, 0, true); // Set showLoading to true
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters.weaver, itemsPerPage]);

  // Re-search when weaverQualityName filter changes
  useEffect(() => {
    if (!weaverQualityFilterInitializedRef.current) {
      weaverQualityFilterInitializedRef.current = true;
      return;
    }

    // Skip if initial fetch hasn't completed yet
    if (!hasInitialFetchRef.current) {
      return;
    }

    setCurrentPage(1);
    // Set loading state when filtering to prevent "no data" flash
    // Clear old data immediately when filtering starts to prevent showing wrong data
    setFabrics([]);
    setLoading(true);

    const timeoutId = setTimeout(() => {
      fetchFabrics(false, 1, itemsPerPage, 0, true); // Set showLoading to true
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters.weaverQualityName, itemsPerPage]);

  // Lazy load weaver quality names only when needed
  useEffect(() => {
    if (filters.weaver) {
      // Add small delay to prevent rapid API calls
      const timeoutId = setTimeout(() => {
        fetchWeaverQualityNames();
      }, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [filters.weaver]);

  const handleCreate = () => {
    setEditingFabric(null);
    setShowFabricForm(true);
  };

  const handleEdit = (fabric: Fabric) => {
    // ⚡ MULTI-WEAVER EDIT: Check if multiple weavers from same quality code are selected
    const qualityCode = fabric.qualityCode;
    const selectedInSameGroup = fabrics.filter(f =>
      selectedFabrics.has(String(f._id)) && f.qualityCode === qualityCode
    );

    // If 2+ weavers from same group are selected, edit all selected ones
    // Otherwise, edit all weavers with same quality code (default behavior)
    if (selectedInSameGroup.length >= 2) {
      // Store selected fabric IDs in fabric object for form to use
      const fabricWithSelection = {
        ...selectedInSameGroup[0],
        _selectedWeaverIds: selectedInSameGroup.map(f => String(f._id))
      } as Fabric & { _selectedWeaverIds?: string[] };
      setEditingFabric(fabricWithSelection);
      setShowFabricForm(true);
    } else {
      // Single fabric edit - form will load all weavers with same quality code
      setEditingFabric(fabric);
      setShowFabricForm(true);
    }
  };

  const handleFabricFormClose = () => {
    setShowFabricForm(false);
    setEditingFabric(null);
    // ⚡ FIX: Clear any edit parameter from URL when closing form
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('edit')) {
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  const handleFabricSaved = (wasEdit: boolean, fabricData?: Fabric | Fabric[]) => {
    devLog('🔄 handleFabricSaved called:', { wasEdit, fabricDataCount: Array.isArray(fabricData) ? fabricData.length : (fabricData ? 1 : 0) });

    // Close form immediately
    setShowFabricForm(false);
    setEditingFabric(null);

    // ✨ OPTIMISTIC UPDATE: UI first, API already called in background by form
    if (fabricData) {
      // Handle both single fabric and array of fabrics
      const fabricsArray = Array.isArray(fabricData) ? fabricData : [fabricData];
      devLog('✅ Updating UI with', fabricsArray.length, 'fabric(s)');
      const updatedIds = new Set<string>();
      const newFabrics: Fabric[] = [];

      // ⚡ OPTIMISTIC: Extract weavers and weaverQualityNames immediately (works for both optimistic and real fabrics)
      const newWeavers = new Set<string>();
      const newWeaverQualityNames = new Set<string>();
      fabricsArray.forEach(fabric => {
        if (fabric.weaver?.trim()) {
          newWeavers.add(fabric.weaver.trim());
        }
        if (fabric.weaverQualityName?.trim()) {
          newWeaverQualityNames.add(fabric.weaverQualityName.trim());
        }
      });

      // Add new weavers to filter dropdown immediately (before any API calls)
      if (newWeavers.size > 0) {
        setWeavers(prev => {
          const updated = new Set([...prev, ...Array.from(newWeavers)]);
          const sorted = Array.from(updated).sort();
          devLog('⚡ Optimistically added weavers to filter:', Array.from(newWeavers));
          return sorted;
        });
      }

      // Add new weaver quality names to filter dropdown immediately
      if (newWeaverQualityNames.size > 0) {
        setWeaverQualityNames(prev => {
          const updated = new Set([...prev, ...Array.from(newWeaverQualityNames)]);
          const sorted = Array.from(updated).sort();
          devLog('⚡ Optimistically added weaver quality names to filter:', Array.from(newWeaverQualityNames));
          return sorted;
        });
      }

      if (wasEdit) {
        // Update existing fabrics in list immediately
        setFabrics(prev => {
          // ⚡ FIX: Create map by ID and also by weaver+qualityName to prevent duplicates
          const fabricMapById = new Map(prev.map(f => [String(f._id), f]));
          const fabricMapByWeaver = new Map<string, Fabric>();

          // Get qualityCode from updated fabrics to identify which group was edited
          const updatedQualityCode = fabricsArray.length > 0 ? fabricsArray[0]?.qualityCode : null;
          const updatedFabricIds = new Set(fabricsArray.map(f => f._id ? String(f._id) : '').filter(Boolean));

          // ⚡ CRITICAL: Remove all fabrics with same qualityCode that are NOT in the updated response
          // This ensures deleted weavers are removed from UI
          if (updatedQualityCode) {
            prev.forEach(f => {
              if (f.qualityCode === updatedQualityCode) {
                const fabricId = String(f._id);
                // If this fabric has the same qualityCode but is NOT in the updated response, it was deleted
                if (!updatedFabricIds.has(fabricId)) {
                  fabricMapById.delete(fabricId);
                  deletedFabricIdsRef.current.add(fabricId);
                  devLog('🗑️ Removing deleted fabric from UI:', fabricId, 'qualityCode:', updatedQualityCode);

                  // Persist to sessionStorage
                  try {
                    const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
                    sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
                  } catch (e) {
                    devError('Error saving deleted fabric IDs to sessionStorage:', e);
                  }
                }
              }
            });
          } else if (fabricsArray.length === 0 && prev.length > 0) {
            // ⚡ FIX: If empty array passed and we have previous fabrics, it means all weavers were deleted
            // Find qualityCode from recently updated fabrics or from prev fabrics
            // This handles the case where all weavers were deleted for a quality code
            const recentlyUpdatedIds = Array.from(recentlyUpdatedFabricsRef.current.keys());
            const recentlyUpdatedFabric = recentlyUpdatedIds.length > 0
              ? recentlyUpdatedFabricsRef.current.get(recentlyUpdatedIds[0])
              : null;

            const qualityCodeToCheck = recentlyUpdatedFabric?.qualityCode || prev[0]?.qualityCode;

            if (qualityCodeToCheck) {
              // Remove all fabrics with this qualityCode since all were deleted
              prev.forEach(f => {
                if (f.qualityCode === qualityCodeToCheck) {
                  const fabricId = String(f._id);
                  fabricMapById.delete(fabricId);
                  deletedFabricIdsRef.current.add(fabricId);
                  devLog('🗑️ Removing all fabrics with qualityCode (all deleted):', qualityCodeToCheck, 'fabricId:', fabricId);
                }
              });

              // Persist to sessionStorage
              try {
                const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
                sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
              } catch (e) {
                devError('Error saving deleted fabric IDs to sessionStorage:', e);
              }
            }
          }

          // Build map by weaver+qualityName to find duplicates
          Array.from(fabricMapById.values()).forEach(f => {
            const key = `${f.qualityCode || ''}-${f.weaver || ''}-${f.weaverQualityName || ''}`;
            if (key && !fabricMapByWeaver.has(key)) {
              fabricMapByWeaver.set(key, f);
            }
          });

          // Update or add each fabric from the updated data
          fabricsArray.forEach(updatedFabric => {
            if (updatedFabric && updatedFabric._id) {
              const fabricId = String(updatedFabric._id);
              const weaverKey = `${updatedFabric.qualityCode || ''}-${updatedFabric.weaver || ''}-${updatedFabric.weaverQualityName || ''}`;

              // ⚡ CRITICAL: Check if a fabric with same weaver+qualityName already exists (might have temp ID)
              const existingByWeaver = fabricMapByWeaver.get(weaverKey);

              // If we found a fabric with same weaver+qualityName but different ID, remove the old one
              if (existingByWeaver && String(existingByWeaver._id) !== fabricId) {
                const oldId = String(existingByWeaver._id);
                fabricMapById.delete(oldId);
                devLog('🔄 Replacing temp fabric with real ID:', oldId, '->', fabricId);
              }

              // Merge with existing fabric to preserve all fields
              const existingFabric = fabricMapById.get(fabricId);
              const mergedFabric = existingFabric
                ? { ...existingFabric, ...updatedFabric, updatedAt: updatedFabric.updatedAt || new Date().toISOString() }
                : { ...updatedFabric, updatedAt: updatedFabric.updatedAt || new Date().toISOString() };

              fabricMapById.set(fabricId, mergedFabric);
              fabricMapByWeaver.set(weaverKey, mergedFabric);
              updatedIds.add(fabricId);

              // ⚡ CRITICAL: Store in ref to preserve during GET calls
              recentlyUpdatedFabricsRef.current.set(fabricId, mergedFabric);
              updatedFabricIdsRef.current.add(fabricId);
              // ⚡ PERSIST: Also store in sessionStorage to survive page refresh
              try {
                const stored = sessionStorage.getItem('recentlyUpdatedFabrics');
                const storedMap = stored ? new Map(JSON.parse(stored)) : new Map();
                storedMap.set(fabricId, mergedFabric);
                sessionStorage.setItem('recentlyUpdatedFabrics', JSON.stringify(Array.from(storedMap.entries())));
              } catch (e) {
                devError('Error storing to sessionStorage:', e);
              }
            }
          });

          // ⚡ FIX: Remove duplicates by weaver+qualityName (keep the one with real ID, not temp ID)
          const finalFabrics: Fabric[] = [];
          const seenWeavers = new Set<string>();

          Array.from(fabricMapById.values()).forEach(fabric => {
            const weaverKey = `${fabric.qualityCode || ''}-${fabric.weaver || ''}-${fabric.weaverQualityName || ''}`;
            const isTempId = String(fabric._id).startsWith('temp-');

            // If we've seen this weaver+qualityName before, only keep the one with real ID
            if (seenWeavers.has(weaverKey)) {
              const existingIndex = finalFabrics.findIndex(f =>
                `${f.qualityCode || ''}-${f.weaver || ''}-${f.weaverQualityName || ''}` === weaverKey
              );
              if (existingIndex >= 0) {
                const existing = finalFabrics[existingIndex];
                const existingIsTemp = String(existing._id).startsWith('temp-');
                // Replace temp ID with real ID, or keep existing if both are real (shouldn't happen)
                if (isTempId && !existingIsTemp) {
                  // Skip this one (temp), keep existing (real)
                  return;
                } else if (!isTempId && existingIsTemp) {
                  // Replace existing (temp) with this one (real)
                  finalFabrics[existingIndex] = fabric;
                  return;
                }
              }
            } else {
              seenWeavers.add(weaverKey);
              finalFabrics.push(fabric);
            }
          });

          // Sort by createdAt descending (newest first)
          return finalFabrics.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime();
          });
        });

        // ⚡ SMOOTH GLOW: One animation for all updated fabrics (1.5s smooth fade)
        setGlowingIds(prev => new Set([...prev, ...updatedIds]));
        setTimeout(() => {
          setGlowingIds(prev => {
            const next = new Set(prev);
            updatedIds.forEach(id => next.delete(id));
            return next;
          });
        }, 1500);

        // Refresh filters in background to ensure we have all data from server
        setTimeout(() => {
          if (newWeavers.size > 0) fetchWeavers();
          if (newWeaverQualityNames.size > 0) fetchWeaverQualityNames();
        }, 1000);

        // ⚡ NO TOAST - Only animation (glow effect)

        devLog('✅ Optimistic update complete for', updatedIds.size, 'fabric(s)');

        // ⚡ NO GET API CALL - UI already updated with POST response data
        // No need to verify or refresh - data is already in state

      } else {
        // Add new fabrics to list immediately (at top)
        // ⚡ IMMEDIATE UI UPDATE: Show fabrics right away (optimistic or real)
        const newFabricsMap = new Map<string, Fabric>();
        const tempIdToRealIdMap = new Map<string, string>(); // Track temp ID -> real ID mapping

        fabricsArray.forEach(fabric => {
          if (fabric && fabric._id) {
            const fabricId = String(fabric._id);
            const tempId = (fabric as any).clientTempId;

            // If this is a real fabric replacing a temp one, track the mapping
            if (tempId && !isTemporaryId(fabricId)) {
              tempIdToRealIdMap.set(String(tempId), fabricId);
            }

            // ⚡ FIX: Add ALL fabrics (including optimistic ones) to show immediately
            if (!newFabricsMap.has(fabricId)) {
              newFabricsMap.set(fabricId, fabric);
              updatedIds.add(fabricId);

              // Only store real fabrics in refs (not temporary ones)
              if (!isTemporaryFabric(fabric)) {
                recentlyUpdatedFabricsRef.current.set(fabricId, fabric);
                updatedFabricIdsRef.current.add(fabricId);
                // ⚡ PERSIST: Also store in sessionStorage to survive page refresh
                try {
                  const stored = sessionStorage.getItem('recentlyUpdatedFabrics');
                  const storedMap = stored ? new Map(JSON.parse(stored)) : new Map();
                  storedMap.set(fabricId, fabric);
                  sessionStorage.setItem('recentlyUpdatedFabrics', JSON.stringify(Array.from(storedMap.entries())));
                } catch (e) {
                  devError('Error storing to sessionStorage:', e);
                }
              }
            }
          }
        });

        const uniqueNewFabrics = Array.from(newFabricsMap.values());

        setFabrics(prev => {
          // ⚡ IMMEDIATE UPDATE: Add new fabrics at the top, remove old temp ones being replaced
          const existingMap = new Map(prev.map(f => [String(f._id), f]));

          // Remove old temporary fabrics that are being replaced by real ones
          const tempIdsToRemove = new Set<string>();
          tempIdToRealIdMap.forEach((realId, tempId) => {
            tempIdsToRemove.add(tempId);
          });

          // Filter out old temp entries being replaced, but keep other existing fabrics
          const filteredPrev = prev.filter(f => {
            const tempId = (f as any).clientTempId || String(f._id);
            const fabricId = String(f._id);

            // Remove if it's a temp entry being replaced by a real one
            if (tempIdsToRemove.has(String(tempId))) {
              return false;
            }
            // Remove if it's a duplicate (same _id as new fabric)
            if (newFabricsMap.has(fabricId)) {
              return false;
            }
            return true;
          });

          // ⚡ IMMEDIATE: Add ALL new fabrics (including optimistic ones) at the top
          const merged = [...uniqueNewFabrics, ...filteredPrev];

          // Final deduplication by _id (keep the first occurrence)
          const finalMap = new Map<string, Fabric>();
          merged.forEach(f => {
            const id = String(f._id);
            if (!finalMap.has(id)) {
              finalMap.set(id, f);
            }
          });

          // Sort by createdAt descending (newest first)
          return Array.from(finalMap.values()).sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime();
          });
        });

        // ⚡ FIX: Update pagination count for new fabrics (only count real ones, not temporary)
        const realNewFabrics = uniqueNewFabrics.filter(f => !isTemporaryFabric(f));
        if (realNewFabrics.length > 0) {
          setPaginationInfo(prev => ({
            ...prev,
            totalCount: prev.totalCount + realNewFabrics.length
          }));
        }

        // Refresh filters in background to ensure we have all data from server (runs after API completes)
        setTimeout(() => {
          if (newWeavers.size > 0) {
            fetchWeavers();
          }
          if (newWeaverQualityNames.size > 0) {
            fetchWeaverQualityNames();
          }
        }, 1500);

        // ⚡ SMOOTH GLOW: One animation for all new fabrics (1.5s smooth fade) - only once per save
        setGlowingIds(prev => new Set([...prev, ...updatedIds]));
        setTimeout(() => {
          setGlowingIds(prev => {
            const next = new Set(prev);
            updatedIds.forEach(id => next.delete(id));
            return next;
          });
        }, 1500);

        // ⚡ NO TOAST - Only animation (glow effect)

        // Log completion
        devLog('✅ Immediate UI update complete - new fabrics added to UI', {
          newFabricsCount: uniqueNewFabrics.length,
          realFabricsCount: realNewFabrics.length
        });

        // ⚡ NO GET API CALL - UI already updated with POST response data
        // Only refresh filters in background (not fabrics list)
      }
    } else {
      // Fallback: If no fabric data, use refresh handler (shouldn't happen)
      if (wasEdit) {
        sessionStorage.setItem('fabricsPageShouldRefresh', 'true');
        sessionStorage.setItem('fabricsPageRefreshTime', Date.now().toString());
        // ⚡ NO TOAST - Only animation
        fetchFabrics(true, currentPage, itemsPerPage, 0, false);
      } else {
        sessionStorage.setItem('fabricsPageShouldRefresh', 'true');
        sessionStorage.setItem('fabricsPageRefreshTime', Date.now().toString());
        // ⚡ NO TOAST - Only animation
        fetchFabrics(true, 1, itemsPerPage, 0, false);
      }
    }

    // ⚡ NO fetchFabrics call - UI already updated optimistically!
  };

  const handleView = (fabric: Fabric) => {
    // Find all fabrics with the same quality code
    const allFabricsInGroup = fabrics.filter(f => f.qualityCode === fabric.qualityCode);

    // Set the selected fabric and show details
    setSelectedFabric(fabric);
    setShowDetails(true);

    // Store the group for FabricDetails component
    setSelectedFabricGroup(allFabricsInGroup);
  };

  const handleDelete = async (fabric: Fabric) => {
    // ⚡ FIX: Show loading state immediately on button click
    const fabricId = String(fabric._id);
    setDeletingIds(prev => new Set([...prev, fabricId]));

    // Show modal immediately for better UX
    setDeletingFabric(fabric);
    setShowDeleteConfirmation(true);
    setIsLoadingDependencies(true);
    setDeleteDependencies([]);

    // Check dependencies in background (non-blocking)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      const token = localStorage.getItem('token');
      const dependencyResponse = await fetch(`/api/fabrics/${fabric._id}/dependencies`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        signal: controller.signal
      });
      const dependencyData = await dependencyResponse.json();

      clearTimeout(timeoutId);

      if (dependencyData.success) {
        setDeleteDependencies(dependencyData.data.dependencies);
      } else {
        setDeleteDependencies([]);
      }
    } catch (error) {
      setDeleteDependencies([]);
    }
  };

  // Detect mobile device
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768);
  }, []);

  // Handle sticker download - show preview first (or direct download on mobile)
  const handleStickerDownload = async (fabric: Fabric) => {
    try {
      // Prepare fabric data for sticker
      const stickerData = {
        qualityCode: fabric.qualityCode || '-',
        qualityName: fabric.qualityName || '-',
        width: fabric.finishWidth || undefined, // Use finishWidth only
        gsm: fabric.gsm || undefined,
        content: fabric.content || undefined,
        remarks: '', // Empty/blank for remarks
        count: fabric.danier || undefined, // Use danier for count
        rxP: fabric.reed && fabric.pick ? `${fabric.reed}/${fabric.pick}` : undefined,
        moq: '', // Empty/blank for MOQ
        weaver: fabric.weaver || undefined,
        weaverQualityName: fabric.weaverQualityName || undefined
      };

      // On mobile devices, download directly without preview
      if (isMobileDevice) {
        try {
          downloadFabricStickerPDFDirect(stickerData);
          showToast('success', 'Sticker PDF downloading...');
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            devError('Error downloading sticker on mobile:', error);
          }
          showToast('error', 'Failed to download sticker. Please try again.');
        }
        return;
      }

      // Desktop: Show preview first
      setIsLoadingStickerPreview(true);

      // Generate PDF preview
      const pdfDataUrl = generateFabricStickerPDF(stickerData);

      // Convert data URL to blob URL for better CSP compatibility
      try {
        // Convert data URL to blob properly
        const base64Data = pdfDataUrl.split(',')[1] || pdfDataUrl.split('base64,')[1];
        if (base64Data) {
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });

          // Cleanup previous blob URL if exists
          if (stickerBlobUrlRef.current) {
            URL.revokeObjectURL(stickerBlobUrlRef.current);
            stickerBlobUrlRef.current = null;
          }

          const blobUrl = URL.createObjectURL(blob);
          stickerBlobUrlRef.current = blobUrl;

          // Show preview modal with blob URL
          setStickerPreviewUrl(blobUrl);
          setCurrentStickerFabric(fabric);
          setShowStickerPreview(true);

          // Reset loading after a short delay to ensure PDF is ready
          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, 500);
        } else {
          // Fallback to data URL if conversion fails
          setStickerPreviewUrl(pdfDataUrl);
          setCurrentStickerFabric(fabric);
          setShowStickerPreview(true);
          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, 500);
        }
      } catch (error) {
        // Fallback to data URL if blob conversion fails
        if (process.env.NODE_ENV === 'development') {
          devError('Error converting PDF to blob:', error);
        }
        setStickerPreviewUrl(pdfDataUrl);
        setCurrentStickerFabric(fabric);
        setShowStickerPreview(true);
        setTimeout(() => {
          setIsLoadingStickerPreview(false);
        }, 500);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        devError('Error generating sticker preview:', error);
      }
      setIsLoadingStickerPreview(false);
      showToast('error', 'Failed to generate sticker preview. Please try again.');
    }
  };

  // Handle final PDF download from preview (works on all devices)
  const handleFinalStickerDownload = useCallback(() => {
    if (!currentStickerFabric) {
      showToast('error', 'No fabric selected for download');
      return;
    }

    try {
      // Prepare fabric data for sticker
      const stickerData = {
        qualityCode: currentStickerFabric.qualityCode || '-',
        qualityName: currentStickerFabric.qualityName || '-',
        width: currentStickerFabric.finishWidth || undefined, // Use finishWidth only
        gsm: currentStickerFabric.gsm || undefined,
        content: currentStickerFabric.content || undefined,
        remarks: '', // Empty/blank for remarks
        count: currentStickerFabric.danier || undefined, // Use danier for count
        rxP: currentStickerFabric.reed && currentStickerFabric.pick ? `${currentStickerFabric.reed}/${currentStickerFabric.pick}` : undefined,
        moq: '', // Empty/blank for MOQ
        weaver: currentStickerFabric.weaver || undefined,
        weaverQualityName: currentStickerFabric.weaverQualityName || undefined
      };

      // Use direct download method (works on all devices)
      downloadFabricStickerPDFDirect(stickerData);

      // Clean up blob URL if it exists
      if (stickerBlobUrlRef.current) {
        URL.revokeObjectURL(stickerBlobUrlRef.current);
        stickerBlobUrlRef.current = null;
      }
      if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:') && stickerPreviewUrl !== stickerBlobUrlRef.current) {
        URL.revokeObjectURL(stickerPreviewUrl);
      }
      // Close preview
      setShowStickerPreview(false);
      setStickerPreviewUrl(null);
      setCurrentStickerFabric(null);

      showToast('success', 'Sticker PDF downloaded successfully!');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        devError('Error downloading sticker PDF:', error);
      }
      showToast('error', 'Failed to download sticker PDF. Please try again.');
    }
  }, [currentStickerFabric, stickerPreviewUrl, showToast]);

  const confirmDelete = async () => {
    if (!deletingFabric) return;

    const fabricId = String(deletingFabric._id);
    const fabricToDelete = deletingFabric;

    // ⚡ FIX: Check if this is a temporary ID - if so, just remove from UI without API call
    if (isTemporaryId(fabricId) || isTemporaryFabric(deletingFabric)) {
      devLog('⚠️ Attempting to delete temporary fabric, removing from UI only:', fabricId);

      // Close modal first
      setShowDeleteConfirmation(false);
      setDeletingFabric(null);
      setDeleteDependencies([]);
      setIsLoadingDependencies(false);

      // Mark as deleted
      deletedFabricIdsRef.current.add(fabricId);

      // ⚡ RED GLOW + FADE OUT: Start red glow and fade out animation on weaver row
      setRedGlowingIds(prev => new Set([...prev, fabricId]));
      setFadeOutRows(prev => new Set([...prev, fabricId]));
      setDeletingIds(prev => new Set([...prev, fabricId]));

      // Wait for animation to complete (500ms for smooth fade out)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Remove from UI immediately after animation (no API call for temporary fabrics)
      setFabrics(prev => prev.filter(f => String(f._id) !== fabricId));
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(fabricId);
        return next;
      });
      // Clear animation states
      setRedGlowingIds(prev => {
        const next = new Set(prev);
        next.delete(fabricId);
        return next;
      });
      setFadeOutRows(prev => {
        const next = new Set(prev);
        next.delete(fabricId);
        return next;
      });
      setPaginationInfo(prev => ({
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1)
      }));

      // ⚡ NO TOAST - Only animation
      return; // Exit early - no API call for temporary fabrics
    }

    // Close modal first
    setShowDeleteConfirmation(false);
    setDeletingFabric(null);
    setDeleteDependencies([]);
    setIsLoadingDependencies(false);

    // ⚡ OPTIMISTIC DELETE: Immediately mark as deleted (prevent resurrection)
    deletedFabricIdsRef.current.add(fabricId);
    // ⚡ CRITICAL: Persist to sessionStorage so it survives page refresh
    try {
      const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
      sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
    } catch (e) {
      devError('Error saving deleted fabric IDs to sessionStorage:', e);
    }

    // ⚡ RED GLOW + FADE OUT: Start red glow and fade out animation on weaver row
    setRedGlowingIds(prev => new Set([...prev, fabricId]));
    setFadeOutRows(prev => new Set([...prev, fabricId]));
    setDeletingIds(prev => new Set([...prev, fabricId]));

    // 2. Wait for animation to complete (500ms for smooth fade out)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Remove from UI immediately after animation
    setFabrics(prev => prev.filter(f => String(f._id) !== fabricId));
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.delete(fabricId);
      return next;
    });
    // Clear animation states
    setRedGlowingIds(prev => {
      const next = new Set(prev);
      next.delete(fabricId);
      return next;
    });
    setFadeOutRows(prev => {
      const next = new Set(prev);
      next.delete(fabricId);
      return next;
    });
    setPaginationInfo(prev => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - 1)
    }));

    // 4. Clear ALL caches atomically (fix resurrection bug)
    clearAllFabricCaches();

    // 5. ⚡ SMOOTH DELETE: Background API call (no loading state, buttons stay enabled)
    // NO setIsDeleting - buttons stay enabled for smooth UX
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/fabrics/${fabricId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      // Parse response
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { success: false, message: responseText || 'Delete failed' };
      }

      // Handle response (mostly just logging - UI already updated optimistically)
      if (!response.ok && response.status !== 404) {
        // Only rollback on real error (not 404 - that means already deleted)
        if (data.message && !data.message.includes('not found')) {
          // Rollback - restore fabric
          deletedFabricIdsRef.current.delete(fabricId);
          // Update sessionStorage
          try {
            const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
            sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
          } catch (e) {
            devError('Error updating deleted fabric IDs in sessionStorage:', e);
          }
          setFabrics(prev => [...prev, fabricToDelete].sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime();
          }));
          setPaginationInfo(prev => ({ ...prev, totalCount: prev.totalCount + 1 }));
          // ⚡ ERROR POPUP: Show error toast on failure
          showToast('error', data.message || 'Failed to delete fabric. Please try again.', 5000);
        }
      } else if (response.status === 404) {
        // ⚡ FIX: 404 means already deleted - keep it marked as deleted and persist
        devLog('✅ Fabric already deleted (404), keeping it marked as deleted');
        try {
          const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
          sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
        } catch (e) {
          devError('Error saving deleted fabric IDs to sessionStorage:', e);
        }
      }
    } catch (error: any) {
      // Network error - rollback and show error
      deletedFabricIdsRef.current.delete(fabricId);
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
        sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted fabric IDs in sessionStorage:', e);
      }
      setFabrics(prev => [...prev, fabricToDelete].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0);
        const bDate = new Date(b.createdAt || 0);
        return bDate.getTime() - aDate.getTime();
      }));
      setPaginationInfo(prev => ({ ...prev, totalCount: prev.totalCount + 1 }));
      // ⚡ ERROR POPUP: Show error toast on network failure
      showToast('error', `Network error: ${error.message || 'Failed to delete fabric. Please try again.'}`, 5000);
    }

    // ⚡ NO fetchFabrics call - UI already updated optimistically!
    // ⚡ NO TOAST - Only smooth animation!
  };

  const cancelDelete = () => {
    // ⚡ FIX: Clear loading state when canceling delete
    if (deletingFabric) {
      const fabricId = String(deletingFabric._id);
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fabricId);
        return newSet;
      });
      // Remove from deleted set if it was added
      deletedFabricIdsRef.current.delete(fabricId);
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
        sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted fabric IDs in sessionStorage:', e);
      }
    }
    setShowDeleteConfirmation(false);
    setDeletingFabric(null);
    setDeleteDependencies([]);
    setIsDeleting(false);
    setIsLoadingDependencies(false);
  };

  const handleBulkDeleteGroup = (group: { qualityCode: string; qualityName: string; items: Fabric[] }) => {
    setBulkDeleteGroup(group);
    setShowDeleteConfirmation(true);
  };

  // Fast delete entire quality group
  const handleDeleteQualityGroup = (mainFabric: Fabric, allFabricsInGroup: Fabric[]) => {
    const group = {
      qualityCode: mainFabric.qualityCode,
      qualityName: mainFabric.qualityName,
      items: allFabricsInGroup
    };
    setBulkDeleteGroup(group);
    setShowDeleteConfirmation(true);
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteGroup) return;

    const itemsToDelete = bulkDeleteGroup.items;

    // ⚡ FIX: Separate temporary fabrics from real ones
    const temporaryFabrics = itemsToDelete.filter(item => isTemporaryFabric(item));
    const realFabrics = itemsToDelete.filter(item => !isTemporaryFabric(item));

    const deletedIds = new Set(itemsToDelete.map(item => String(item._id)));
    const realDeletedIds = new Set(realFabrics.map(item => String(item._id)));
    const deletedCount = itemsToDelete.length;
    const groupToDelete = bulkDeleteGroup;

    // Close modal first
    setShowDeleteConfirmation(false);
    setBulkDeleteGroup(null);
    setSelectedFabrics(new Set());
    setBulkActions(false);
    setShowSelectionToolbar(false);

    // ⚡ OPTIMISTIC DELETE: Mark all as deleted (prevent resurrection)
    deletedIds.forEach(id => deletedFabricIdsRef.current.add(id));
    // ⚡ CRITICAL: Persist to sessionStorage so it survives page refresh
    try {
      const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
      sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
    } catch (e) {
      devError('Error saving deleted fabric IDs to sessionStorage:', e);
    }

    // ⚡ BULK DELETE: Get quality code for group animation
    const qualityCode = groupToDelete.qualityCode;

    // ⚡ RED GLOW + FADE OUT: Start red glow on quality group border and fade out all items
    // Mark quality group as deleting for border animation
    if (qualityCode && qualityCode !== 'Multiple') {
      setDeletingQualityGroups(prev => new Set([...prev, qualityCode]));
    }

    // Red glow and fade out for all individual items
    deletedIds.forEach(id => {
      setRedGlowingIds(prev => new Set([...prev, id]));
      setFadeOutRows(prev => new Set([...prev, id]));
    });
    setDeletingIds(prev => new Set([...prev, ...deletedIds]));

    // 2. Wait for animation (600ms for smooth fade out of entire group)
    await new Promise(resolve => setTimeout(resolve, 600));

    // 3. Remove all from UI immediately after animation
    setFabrics(prev => prev.filter(fabric => !deletedIds.has(String(fabric._id))));
    setDeletingIds(prev => {
      const newSet = new Set(prev);
      deletedIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    // Clear animation states
    setRedGlowingIds(prev => {
      const newSet = new Set(prev);
      deletedIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    setFadeOutRows(prev => {
      const newSet = new Set(prev);
      deletedIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    // Clear quality group animation
    if (qualityCode && qualityCode !== 'Multiple') {
      setDeletingQualityGroups(prev => {
        const next = new Set(prev);
        next.delete(qualityCode);
        return next;
      });
    }
    setPaginationInfo(prev => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - deletedCount)
    }));

    // 4. Clear ALL caches atomically (fix resurrection bug)
    clearAllFabricCaches();

    // 5. ⚡ SMOOTH DELETE: Background API call (no loading state, buttons stay enabled)

    // ⚡ FIX: Only make API calls for real fabrics, not temporary ones
    if (temporaryFabrics.length > 0) {
      devLog('⚠️ Skipping API delete for', temporaryFabrics.length, 'temporary fabric(s)');
    }

    // 6. Background API call (optimistic - UI already updated) - only for real fabrics
    if (realFabrics.length === 0) {
      // All were temporary, done
      return;
    }

    // NO setIsBulkDeleting - buttons stay enabled for smooth UX
    try {
      let response;
      const token = localStorage.getItem('token');

      // Delete by IDs or by quality code
      // ⚡ FIX: Only use real fabric IDs (filter out temporary ones)
      if (groupToDelete.qualityCode === 'Multiple') {
        const fabricIds = realFabrics.map(fabric => fabric._id).filter(id => id && !isTemporaryId(String(id)));
        if (fabricIds.length === 0) {
          // All were temporary, already handled above
          // ⚡ NO setIsBulkDeleting - buttons stay enabled
          return;
        }
        response = await fetch(`/api/fabrics`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify({ fabricIds }),
        });
      } else {
        response = await fetch(`/api/fabrics?qualityCode=${encodeURIComponent(groupToDelete.qualityCode)}&qualityName=${encodeURIComponent(groupToDelete.qualityName)}`, {
          method: 'DELETE',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
      }

      // Parse response
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { success: false, message: responseText || 'Delete failed' };
      }

      // Handle errors (rollback only on real errors, not 404)
      if (!response.ok && response.status !== 404) {
        if (data.message && !data.message.includes('not found')) {
          // Rollback - restore all fabrics
          deletedIds.forEach(id => deletedFabricIdsRef.current.delete(id));
          // Update sessionStorage
          try {
            const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
            sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
          } catch (e) {
            devError('Error updating deleted fabric IDs in sessionStorage:', e);
          }
          setFabrics(prev => {
            const existingIds = new Set(prev.map(f => String(f._id)));
            const toAdd = itemsToDelete.filter(item => !existingIds.has(String(item._id)));
            return [...prev, ...toAdd].sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime();
            });
          });
          setPaginationInfo(prev => ({ ...prev, totalCount: prev.totalCount + deletedCount }));
          // ⚡ ERROR POPUP: Show error toast on failure
          showToast('error', data.message || 'Failed to delete fabrics. Please try again.', 5000);
        }
      } else if (response.status === 404) {
        // ⚡ FIX: 404 means already deleted - keep them marked as deleted and persist
        devLog('✅ Some fabrics already deleted (404), keeping them marked as deleted');
        try {
          const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
          sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
        } catch (e) {
          devError('Error saving deleted fabric IDs to sessionStorage:', e);
        }
      }
    } catch (error: any) {
      // Network error - rollback and show error
      deletedIds.forEach(id => deletedFabricIdsRef.current.delete(id));
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
        sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted fabric IDs in sessionStorage:', e);
      }
      setFabrics(prev => {
        const existingIds = new Set(prev.map(f => String(f._id)));
        const toAdd = itemsToDelete.filter(item => !existingIds.has(String(item._id)));
        return [...prev, ...toAdd].sort((a, b) => {
          const aDate = new Date(a.createdAt || 0);
          const bDate = new Date(b.createdAt || 0);
          return bDate.getTime() - aDate.getTime();
        });
      });
      setPaginationInfo(prev => ({ ...prev, totalCount: prev.totalCount + deletedCount }));
      // ⚡ ERROR POPUP: Show error toast on network failure
      showToast('error', `Network error: ${error.message || 'Failed to delete fabrics. Please try again.'}`, 5000);
    }
    // ⚡ NO setIsBulkDeleting - buttons stay enabled

    // ⚡ NO fetchFabrics call - UI already updated optimistically!
    // ⚡ NO TOAST - Only smooth animation!
  };

  const cancelBulkDelete = () => {
    // ⚡ FIX: Clear loading state when canceling bulk delete
    if (bulkDeleteGroup) {
      const deletedIds = new Set(bulkDeleteGroup.items.map(item => String(item._id)));
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        deletedIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      // Remove from deleted set if they were added
      deletedIds.forEach(id => deletedFabricIdsRef.current.delete(id));
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedFabricIdsRef.current);
        sessionStorage.setItem('deletedFabricIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted fabric IDs in sessionStorage:', e);
      }
    }
    setShowDeleteConfirmation(false);
    setBulkDeleteGroup(null);
    setIsBulkDeleting(false);
  };

  // Enhanced image handling functions
  const handleImageClick = (fabric: Fabric, imageIndex: number) => {
    setShowImageModal({ fabric, imageIndex });
    setSelectedImageIndex(imageIndex);
    setZoomLevel(1);
  };

  const handleDownloadImage = async (imageUrl: string) => {
    try {
      if (imageUrl.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = 'local-preview.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = imageUrl.split('/').pop() || 'download.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(imageUrl, '_blank');
    }
  };

  const handleWhatsAppShare = (imageUrl: string) => {
    const absoluteUrl = imageUrl.startsWith('http')
      ? imageUrl
      : imageUrl.startsWith('/')
        ? `${window.location.origin}${imageUrl}`
        : `${window.location.origin}/${imageUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(absoluteUrl)}`, '_blank');
  };

  const toggleCardExpansion = (qualityCode: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(qualityCode)) {
        newSet.delete(qualityCode);
      } else {
        newSet.add(qualityCode);
      }
      return newSet;
    });
  };

  const handleImageLoad = (fabricId: string) => {
    setIsImageLoading(prev => ({ ...prev, [fabricId]: false }));
  };

  const handleImageError = (fabricId: string) => {
    setIsImageLoading(prev => ({ ...prev, [fabricId]: false }));
    setImageErrors(prev => ({ ...prev, [fabricId]: true }));
  };

  // Initialize image loading state for all fabrics
  useEffect(() => {
    const newImageLoading: { [key: string]: boolean } = {};
    const newImageErrors: { [key: string]: boolean } = {};

    fabrics.forEach(fabric => {
      if (fabric.images && fabric.images.length > 0) {
        fabric.images.forEach((_, imgIndex) => {
          const key = `${fabric._id}-${imgIndex}`;
          newImageLoading[key] = true;
          newImageErrors[key] = false;
        });
      }
    });

    setIsImageLoading(newImageLoading);
    setImageErrors(newImageErrors);
  }, [fabrics]);

  const nextImage = () => {
    if (showImageModal && showImageModal.fabric.images) {
      const nextIndex = (selectedImageIndex + 1) % showImageModal.fabric.images.length;
      setSelectedImageIndex(nextIndex);
      setZoomLevel(1);
    }
  };

  const prevImage = () => {
    if (showImageModal && showImageModal.fabric.images) {
      const prevIndex = selectedImageIndex === 0
        ? showImageModal.fabric.images.length - 1
        : selectedImageIndex - 1;
      setSelectedImageIndex(prevIndex);
      setZoomLevel(1);
    }
  };

  // Enhanced selection functions
  const handleFabricSelection = (fabricId: string, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedFabric) {
      // Range selection
      const fabricIds = filteredAndSortedFabrics.map(f => f._id);
      const startIndex = fabricIds.indexOf(lastSelectedFabric);
      const endIndex = fabricIds.indexOf(fabricId);
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      const newSelected = new Set(selectedFabrics);
      for (let i = start; i <= end; i++) {
        newSelected.add(fabricIds[i]);
      }
      setSelectedFabrics(newSelected);
    } else if (event.ctrlKey || event.metaKey) {
      // Multi-selection
      const newSelected = new Set(selectedFabrics);
      if (newSelected.has(fabricId)) {
        newSelected.delete(fabricId);
      } else {
        newSelected.add(fabricId);
      }
      setSelectedFabrics(newSelected);
    } else {
      // Single selection
      setSelectedFabrics(new Set([fabricId]));
    }

    setLastSelectedFabric(fabricId);
    setBulkActions(selectedFabrics.size > 0);
    setShowSelectionToolbar(selectedFabrics.size > 0);
  };

  const selectAllVisible = () => {
    const allVisibleIds = new Set(filteredAndSortedFabrics.map(f => f._id));
    setSelectedFabrics(allVisibleIds);
    setBulkActions(true);
    setShowSelectionToolbar(true);
  };

  const clearAllSelection = () => {
    setSelectedFabrics(new Set());
    setBulkActions(false);
    setShowSelectionToolbar(false);
    setLastSelectedFabric(null);
  };

  const invertSelection = () => {
    const allVisibleIds = new Set(filteredAndSortedFabrics.map(f => f._id));
    const newSelected = new Set<string>();

    allVisibleIds.forEach(id => {
      if (!selectedFabrics.has(id)) {
        newSelected.add(id);
      }
    });

    setSelectedFabrics(newSelected);
    setBulkActions(newSelected.size > 0);
    setShowSelectionToolbar(newSelected.size > 0);
  };

  // Export functions
  const exportSelectedFabrics = async () => {
    if (selectedFabrics.size === 0) return;

    setIsExporting(true);
    try {
      const selectedFabricData = filteredAndSortedFabrics.filter(f => selectedFabrics.has(f._id));

      if (exportFormat === 'csv') {
        exportToCSV(selectedFabricData);
      } else if (exportFormat === 'excel') {
        exportToExcel(selectedFabricData);
      } else if (exportFormat === 'pdf') {
        exportToPDF(selectedFabricData);
      }

      setShowExportModal(false);
    } catch (error) {
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = (fabrics: Fabric[]) => {
    const headers = ['Quality Code', 'Quality Name', 'Weaver', 'Weaver Quality', 'GSM', 'Content', 'Danier', 'Weight', 'Rate', 'Width'];
    const csvContent = [
      headers.join(','),
      ...fabrics.map(f => [
        f.qualityCode,
        f.qualityName,
        f.weaver,
        f.weaverQualityName,
        f.gsm,
        f.content || '',
        f.danier || '',
        f.weight,
        f.greighRate,
        f.finishWidth
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabrics-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToExcel = (fabrics: Fabric[]) => {
    // Simple Excel-like export using CSV with .xlsx extension
    const headers = ['Quality Code', 'Quality Name', 'Weaver', 'Weaver Quality', 'Rack', 'GSM', 'Content', 'Danier', 'Weight', 'Rate', 'Width'];
    const csvContent = [
      headers.join('\t'),
      ...fabrics.map(f => [
        f.qualityCode,
        f.qualityName,
        f.weaver,
        f.weaverQualityName,
        f.rack || '',
        f.gsm,
        f.content || '',
        f.danier || '',
        f.weight,
        f.greighRate,
        f.finishWidth
      ].join('\t'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabrics-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = (fabrics: Fabric[]) => {
    // Enhanced PDF-like export with better formatting
    const content = [
      'FABRIC INVENTORY REPORT',
      `Generated on: ${new Date().toLocaleDateString()}`,
      `Total Fabrics: ${fabrics.length}`,
      '',
      'DETAILED LISTING:',
      '================',
      '',
      ...fabrics.map((f, index) => [
        `${index + 1}. Quality Code: ${f.qualityCode}`,
        `   Quality Name: ${f.qualityName}`,
        `   Weaver: ${f.weaver}`,
        `   Weaver Quality: ${f.weaverQualityName}`,
        `   Rack: ${f.rack || 'N/A'}`,
        `   GSM: ${f.gsm || 'N/A'}`,
        `   Content: ${f.content || 'N/A'}`,
        `   Weight: ${f.weight || 'N/A'} KG`,
        `   Width: ${f.finishWidth || 'N/A'}`,
        `   Rate: ₹${f.greighRate || 'N/A'}`,
        `   Danier: ${f.danier || 'N/A'}`,
        `   Reed: ${f.reed || 'N/A'}`,
        `   Pick: ${f.pick || 'N/A'}`,
        ''
      ].join('\n'))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabric-inventory-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Bulk operations
  const handleBulkDeleteSelected = async () => {
    if (selectedFabrics.size === 0) return;

    const selectedFabricData = filteredAndSortedFabrics.filter(f => selectedFabrics.has(f._id));
    setBulkDeleteGroup({
      qualityCode: 'Multiple',
      qualityName: 'Selected Fabrics',
      items: selectedFabricData
    });
    setShowDeleteConfirmation(true);
  };

  const handleBulkEdit = () => {
    if (selectedFabrics.size === 0) return;

    const selectedFabricData = filteredAndSortedFabrics.filter(f => selectedFabrics.has(f._id));

    // Show bulk edit modal
    alert(`Bulk edit for ${selectedFabrics.size} fabric(s):\n${selectedFabricData.map(f => `${f.qualityCode} - ${f.qualityName}`).join('\n')}`);
  };

  // Use server-side filtered data directly (no client-side filtering)
  const filteredAndSortedFabrics = useMemo(() => {
    return [...fabrics]; // Server already sends filtered and sorted data
  }, [fabrics]);

  // Pagination calculations - now using server-side quality code pagination
  const totalQualityGroups = useMemo(() => {
    // Since we're using server-side quality code pagination, 
    // the total count comes from paginationInfo.totalCount
    return paginationInfo.totalCount || 0;
  }, [paginationInfo.totalCount]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 'All') return 1;
    const pages = paginationInfo.totalPages || 1;
    return pages;
  }, [paginationInfo.totalPages, itemsPerPage, paginationInfo.totalCount]);

  // Use server-side paginated data directly (no client-side pagination)
  const paginatedFabrics = useMemo(() => {
    return filteredAndSortedFabrics; // Server already sends paginated data
  }, [filteredAndSortedFabrics, currentPage, itemsPerPage]);

  // Reset to page 1 and fetch new data when filters change
  useEffect(() => {
    // Skip on initial mount - mount effect handles initial fetch
    if (!filtersInitializedRef.current) {
      return;
    }

    // Skip if initial fetch hasn't completed yet
    if (!hasInitialFetchRef.current) {
      return;
    }

    // Debounce filter changes to prevent rapid API calls
    // Set loading state when filtering to prevent "no data" flash
    // Clear old data immediately when filtering starts to prevent showing wrong data
    setFabrics([]);
    setLoading(true);

    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchFabrics(false, 1, itemsPerPage, 0, true); // Set showLoading to true
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters, itemsPerPage]);

  // Auto-correct current page if it exceeds total pages
  useEffect(() => {
    // Skip if initial fetch hasn't completed yet
    if (!hasInitialFetchRef.current) {
      return;
    }

    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
      fetchFabrics(false, totalPages, itemsPerPage, 0, false);
    }
  }, [totalPages, currentPage, itemsPerPage]);

  // Group fabrics by Quality Code and Quality Name (using paginated data)
  const groupedFabrics = paginatedFabrics.reduce((groups, fabric) => {
    const key = `${fabric.qualityCode}-${fabric.qualityName}`;
    if (!groups[key]) {
      groups[key] = {
        qualityCode: fabric.qualityCode,
        qualityName: fabric.qualityName,
        items: []
      };
    }
    groups[key].items.push(fabric);
    return groups;
  }, {} as Record<string, { qualityCode: string; qualityName: string; items: Fabric[] }>);

  const clearFilters = () => {
    setFilters({
      qualityCode: '',
      qualityName: '',
      type: '',
      weaver: '',
      weaverQualityName: '',
      search: '',
      minGsm: '',
      maxGsm: '',
      minWeight: '',
      maxWeight: '',
      minRate: '',
      maxRate: '',
      minWidth: '',
      maxWidth: '',
      hasImages: false,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setSearchType('all');
    setTypeFilter('');
    setSelectedFabrics(new Set());
    setBulkActions(false);
  };

  const toggleFabricSelection = (fabricId: string) => {
    const newSelected = new Set(selectedFabrics);
    if (newSelected.has(fabricId)) {
      newSelected.delete(fabricId);
    } else {
      newSelected.add(fabricId);
    }
    setSelectedFabrics(newSelected);
    setBulkActions(newSelected.size > 0);
  };

  const selectAllFabrics = () => {
    const allIds = new Set(filteredAndSortedFabrics.map(f => f._id));
    setSelectedFabrics(allIds);
    setBulkActions(true);
  };

  const clearSelection = () => {
    setSelectedFabrics(new Set());
    setBulkActions(false);
  };


  if (!mounted) return null;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Toast Notifications - Right Side Popup */}
      <ToastNotification toasts={toasts} onRemove={removeToast} />

      {/* Search and Controls Bar */}
      <div className={`mb-4 p-2 sm:p-3 rounded-lg border transition-all duration-150 animate-in fade-in-0 slide-in-from-top-2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } shadow-sm`}>
        <div className="flex flex-col gap-4">
          {/* First Row - Search and Filters in Parallel */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unified Search Bar with Dropdown */}
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              {/* Search Type Dropdown */}
              <div className="relative">
                <select
                  value={searchType}
                  onChange={(e) => {
                    const newSearchType = e.target.value as typeof searchType;
                    setSearchType(newSearchType);
                    // Clear search when changing search type for better UX
                    setFilters(prev => ({ ...prev, search: '' }));
                  }}
                  className={`px-3 py-2.5 rounded-lg border transition-all duration-150 hover:scale-[1.02] focus:scale-[1.02] text-sm appearance-none cursor-pointer input-focus ${isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 hover:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 hover:border-blue-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-8`}
                >
                  <option value="all">All</option>
                  <option value="qualityCode">Quality Code</option>
                  <option value="qualityName">Quality Name</option>
                  <option value="type">Type</option>
                  <option value="weaver">Weaver Name</option>
                  <option value="weaverQualityName">Weaver Quality</option>
                </select>
                <ChevronDownIcon className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
              </div>

              {/* Search Input - Enhanced */}
              <div className="flex-1 relative">
                {/* Search Icon - Animated when searching */}
                {fetchInFlight > 0 && filters.search ? (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                ) : (
                  <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${filters.search
                      ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                )}
                <input
                  type="text"
                  placeholder={
                    searchType === 'all'
                      ? 'Search all fields...'
                      : searchType === 'qualityCode'
                        ? 'Search by Quality Code...'
                        : searchType === 'qualityName'
                          ? 'Search by Quality Name...'
                          : searchType === 'type'
                            ? 'Search by Type...'
                            : searchType === 'weaver'
                              ? 'Search by Weaver Name...'
                              : 'Search by Weaver Quality...'
                  }
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Clear any pending debounce
                      if (searchDebounceRef.current) {
                        clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = null;
                      }
                      // Cancel in-flight fetch
                      if (fetchAbortRef.current) {
                        fetchAbortRef.current.abort();
                        fetchAbortRef.current = null;
                      }
                      // Trigger immediate search
                      setCurrentPage(1);
                      setIsChangingPage(true);
                      fetchFabrics(false, 1, itemsPerPage, 0, true)
                        .then(() => {
                          setIsChangingPage(false);
                        })
                        .catch((error) => {
                          // Ignore abort errors
                          if (error instanceof Error && error.name === 'AbortError') {
                            return;
                          }
                          setIsChangingPage(false);
                          devError('Error searching on Enter:', error);
                        });
                    }
                  }}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border transition-all duration-200 hover:scale-[1.01] focus:scale-[1.01] text-sm input-focus ${filters.search
                      ? isDarkMode
                        ? 'bg-gray-700 border-blue-500 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'
                        : 'bg-white border-blue-500 text-gray-900 placeholder-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 hover:border-blue-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 hover:border-blue-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                />
                {/* Clear button - Enhanced */}
                {filters.search && (
                  <button
                    onClick={() => {
                      setFilters(prev => ({ ...prev, search: '' }));
                      // Clear any pending debounce
                      if (searchDebounceRef.current) {
                        clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = null;
                      }
                      // Cancel in-flight fetch
                      if (fetchAbortRef.current) {
                        fetchAbortRef.current.abort();
                        fetchAbortRef.current = null;
                      }
                      // Reset to page 1 and fetch
                      setCurrentPage(1);
                      setIsChangingPage(true);
                      fetchFabrics(false, 1, itemsPerPage, 0, false)
                        .then(() => {
                          setIsChangingPage(false);
                        })
                        .catch((error) => {
                          // Ignore abort errors
                          if (error instanceof Error && error.name === 'AbortError') {
                            return;
                          }
                          setIsChangingPage(false);
                          devError('Error clearing search:', error);
                        });
                    }}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${isDarkMode
                        ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    title="Clear search"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Type Filter Dropdown */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`px-3 py-2.5 rounded-lg border transition-all duration-150 hover:scale-[1.02] focus:scale-[1.02] text-sm appearance-none cursor-pointer min-w-[140px] input-focus ${isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 hover:border-blue-400'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 hover:border-blue-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-8`}
              >
                <option value="">All Types</option>
                <option value="Polyester">Polyester</option>
                <option value="Blend">Blend</option>
                <option value="Viscose">Viscose</option>
                <option value="Cotton">Cotton</option>
                <option value="Rayon">Rayon</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDownIcon className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
              {typeFilter && (
                <button
                  onClick={() => setTypeFilter('')}
                  className={`absolute right-8 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Clear All Filters Button */}
            {(filters.search || typeFilter || filters.weaver || filters.weaverQualityName) && (
              <button
                onClick={clearFilters}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95 hover-lift ${isDarkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white border border-red-500'
                    : 'bg-red-500 hover:bg-red-600 text-white border border-red-400'
                  } shadow-sm hover:shadow-md flex items-center gap-2`}
                title="Clear All Filters"
              >
                <XMarkIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
          </div>

          {/* Second Row - Sort, View, and Action Buttons - All on Same Line on Desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Left Side - Sort and View Controls */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>Sort:</span>
                <div className="flex rounded-lg border overflow-hidden shadow-sm">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, sortBy: 'createdAt', sortOrder: 'desc' }))}
                    className={`px-3 py-2 text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95 ${(filters.sortBy === 'createdAt' && filters.sortOrder === 'desc') || (filters.sortBy === 'createdAt' && !filters.sortOrder)
                        ? isDarkMode
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-blue-500 text-white shadow-md'
                        : isDarkMode
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-r border-slate-600'
                          : 'bg-white text-slate-700 hover:bg-blue-50 border-r border-slate-200'
                      }`}
                    title="Latest First"
                  >
                    Latest
                  </button>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, sortBy: 'createdAt', sortOrder: 'asc' }))}
                    className={`px-3 py-2 text-sm font-medium transition-all duration-150 ${filters.sortBy === 'createdAt' && filters.sortOrder === 'asc'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-blue-500 text-white shadow-md'
                        : isDarkMode
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-white text-slate-700 hover:bg-blue-50'
                      }`}
                    title="Oldest First"
                  >
                    Oldest
                  </button>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>View:</span>
                <div className="flex rounded-lg border overflow-hidden shadow-sm">
                  <button
                    onClick={() => handleViewModeChange('table')}
                    className={`px-2 sm:px-3 py-2 text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1 sm:space-x-2 ${viewMode === 'table'
                        ? isDarkMode
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-emerald-500 text-white shadow-md'
                        : isDarkMode
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-r border-slate-600'
                          : 'bg-white text-slate-700 hover:bg-emerald-50 border-r border-slate-200'
                      }`}
                    title="Table View"
                  >
                    <ListBulletIcon className="h-4 w-4" />
                    <span className="hidden lg:inline">Table</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('cards')}
                    className={`px-2 sm:px-3 py-2 text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95 flex items-center justify-center space-x-1 sm:space-x-2 ${viewMode === 'cards'
                        ? isDarkMode
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-emerald-500 text-white shadow-md'
                        : isDarkMode
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-white text-slate-700 hover:bg-emerald-50'
                      }`}
                    title="Card View"
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex items-center space-x-2">
              {/* Add Fabric Button - Improved UI matching sampling page */}
              <button
                onClick={handleCreate}
                className={`px-4 py-2.5 rounded-lg font-semibold transition-all duration-150 hover:scale-105 active:scale-95 hover-lift text-sm shadow-md hover:shadow-lg whitespace-nowrap flex items-center space-x-2 ${isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500'
                    : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-400'
                  }`}
                title="Add New Fabric"
                aria-label="Add new fabric"
              >
                <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm">Add Fabric</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => fetchFabrics(true, currentPage, itemsPerPage, 0, true)}
                disabled={loading}
                className={`group px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 hover-lift whitespace-nowrap ${loading ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isDarkMode
                    ? 'bg-slate-600 hover:bg-slate-700 text-white border border-slate-500'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                title="Refresh Data"
              >
                <ArrowPathIcon className={`h-4 w-4 inline mr-2 transition-transform duration-300 ${loading ? 'animate-spin' : 'hover-rotate-icon'}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkActions && (
          <div className="mt- border-t border-gray-200 dark:border-gray-700 animate-in fade-in-0 slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircleIcon className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                  {selectedFabrics.size} fabric{selectedFabrics.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={selectAllVisible}
                  className={`px-3 py-1.5 rounded text-sm transition-all duration-150 hover:scale-105 active:scale-95 hover-lift ${isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  Select All
                </button>
                <button
                  onClick={invertSelection}
                  className={`px-3 py-1.5 rounded text-sm transition-all duration-150 hover:scale-105 active:scale-95 hover-lift ${isDarkMode
                      ? 'bg-gray-600 hover:bg-gray-700 text-white'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                    }`}
                >
                  Invert
                </button>
                <button
                  onClick={clearSelection}
                  className={`px-3 py-1.5 rounded text-sm transition-all duration-150 hover:scale-105 active:scale-95 hover-lift ${isDarkMode
                      ? 'bg-gray-600 hover:bg-gray-700 text-white'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                    }`}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Fabrics Display */}
      <div className={`${viewMode === 'table' ? 'rounded-none border-0 shadow-none' : 'rounded-xl border shadow-lg'} overflow-hidden transition-all duration-150 animate-in fade-in-0 slide-in-from-top-4 delay-100 ${isDarkMode ? (viewMode === 'table' ? 'bg-transparent' : 'bg-gray-800 border-gray-700') : (viewMode === 'table' ? 'bg-white' : 'bg-white border-gray-200')
        }`}>
        {/* ⚡ CRITICAL: Show loading skeleton until initial fetch completes AND no fetches in flight */}
        {/* Also show skeleton if we haven't fetched data yet (prevents "no data" flash during refresh) */}
        {(loading || !initialFetchDone || fetchInFlight > 0 || initialLoading || !hasInitialFetchRef.current ||
          (fabrics.length === 0 && !fetchedDataOnce)) ? (
          <FabricsPageSkeleton viewMode={viewMode} />
        ) : (
          <div className={viewMode === 'table' ? '' : 'animate-in fade-in-0 slide-in-from-top-4 duration-500'}>
            {/* ⚡ FIX: Only show "no data" when loading is complete AND we have no fabrics AND we've fetched data at least once */}
            {filteredAndSortedFabrics.length === 0 && fetchedDataOnce && hasInitialFetchRef.current && initialFetchDone && fetchInFlight === 0 ? (
              <div className={`${viewMode === 'table' ? 'p-4' : 'p-8 sm:p-12'} text-center ${viewMode === 'table' ? '' : 'animate-in fade-in-0 slide-in-from-top-4 duration-500'}`}>
                {/* Icon with better styling */}
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                  <MagnifyingGlassIcon className={`h-10 w-10 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                </div>

                {/* Main message */}
                <h3 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                  {typeFilter
                    ? `No fabrics found with type "${typeFilter}"`
                    : filters.search
                      ? `No results found for "${filters.search}"`
                      : filters.weaver
                        ? `No fabrics found for weaver "${filters.weaver}"`
                        : filters.weaverQualityName
                          ? `No fabrics found for weaver quality "${filters.weaverQualityName}"`
                          : 'No fabrics found'
                  }
                </h3>

                {/* Helpful message */}
                <p className={`text-base mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  {typeFilter
                    ? `We couldn't find any fabrics with the type "${typeFilter}". Try selecting a different type or clear the filter to see all fabrics.`
                    : filters.weaver
                      ? `We couldn't find any fabrics for weaver "${filters.weaver}". Try selecting a different weaver or clear the filter.`
                      : filters.weaverQualityName
                        ? `We couldn't find any fabrics for weaver quality "${filters.weaverQualityName}". Try selecting a different quality or clear the filter.`
                        : filters.search
                          ? `We couldn't find any fabrics matching your search in ${searchType === 'all' ? 'any field' : searchType === 'qualityCode' ? 'Quality Code' : searchType === 'qualityName' ? 'Quality Name' : searchType === 'type' ? 'Type' : searchType === 'weaver' ? 'Weaver Name' : 'Weaver Quality'}.`
                          : 'Get started by adding your first fabric'
                  }
                </p>

                {/* Suggestions */}
                {(filters.search || typeFilter || filters.weaver || filters.weaverQualityName) && (
                  <div className={`mt-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-blue-50 border border-blue-200'
                    }`}>
                    <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      💡 Filter Tips:
                    </p>
                    <ul className={`text-sm text-left space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                      {typeFilter && (
                        <li>• Try selecting a different type from the dropdown</li>
                      )}
                      {filters.search && (
                        <>
                          <li>• Check for typos in your search term</li>
                          <li>• Try a different search type from the dropdown</li>
                          <li>• Use partial matches (e.g., "ABC" will find "ABC123")</li>
                        </>
                      )}
                      <li>• Clear all filters to see all fabrics</li>
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {filters.search || typeFilter || filters.weaver || filters.weaverQualityName ? (
                    <>
                      <button
                        onClick={clearFilters}
                        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-md ${isDarkMode
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/50'
                            : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-blue-500/50'
                          }`}
                      >
                        Clear All Filters
                      </button>
                      {filters.search && (
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, search: '' }));
                            // Clear any pending debounce
                            if (searchDebounceRef.current) {
                              clearTimeout(searchDebounceRef.current);
                              searchDebounceRef.current = null;
                            }
                            // Cancel in-flight fetch
                            if (fetchAbortRef.current) {
                              fetchAbortRef.current.abort();
                              fetchAbortRef.current = null;
                            }
                            setCurrentPage(1);
                            setIsChangingPage(true);
                            fetchFabrics(false, 1, itemsPerPage, 0, false)
                              .then(() => {
                                setIsChangingPage(false);
                              })
                              .catch((error) => {
                                // Ignore abort errors
                                if (error instanceof Error && error.name === 'AbortError') {
                                  return;
                                }
                                setIsChangingPage(false);
                                devError('Error clearing search:', error);
                              });
                          }}
                          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 border-2 ${isDarkMode
                              ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                              : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                          Clear Search Only
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={handleCreate}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-md flex items-center space-x-2 ${isDarkMode
                          ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/50'
                          : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-blue-500/50'
                        }`}
                    >
                      <PlusIcon className="h-5 w-5" />
                      <span>Add Your First Fabric</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {/* Top Pagination and Results Info */}
                <div className={`px-3 sm:px-4 py-2 sm:py-3 border-b flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:justify-between transition-all duration-150 animate-in fade-in-0 slide-in-from-top-2 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  }`}>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:space-x-3 lg:space-x-4">
                    {/* Search result indicator */}
                    {filters.search && (
                      <div className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${isDarkMode
                          ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                        <span className="flex items-center gap-1.5">
                          <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                          Searching: <span className="font-semibold">"{filters.search}"</span>
                          {paginationInfo.totalCount > 0 && (
                            <span className="ml-1">({paginationInfo.totalCount} {paginationInfo.totalCount === 1 ? 'result' : 'results'})</span>
                          )}
                        </span>
                      </div>
                    )}
                    {paginationInfo.totalCount > 0 && (
                      <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <span className="hidden sm:inline">
                          Showing {(currentPage - 1) * (itemsPerPage === 'All' ? paginationInfo.totalCount : itemsPerPage) + 1} to{' '}
                          {Math.min(currentPage * (itemsPerPage === 'All' ? paginationInfo.totalCount : itemsPerPage), paginationInfo.totalCount)} of{' '}
                          {paginationInfo.totalCount} {paginationInfo.totalCount === 1 ? 'fabric' : 'fabrics'}
                        </span>
                        <span className="sm:hidden">
                          {(currentPage - 1) * (itemsPerPage === 'All' ? paginationInfo.totalCount : itemsPerPage) + 1}-
                          {Math.min(currentPage * (itemsPerPage === 'All' ? paginationInfo.totalCount : itemsPerPage), paginationInfo.totalCount)} of {paginationInfo.totalCount} {paginationInfo.totalCount === 1 ? 'fabric' : 'fabrics'}
                        </span>
                      </span>
                    )}

                    {/* Items per page dropdown (matches sampling behavior, persists in localStorage) */}
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          const value = e.target.value === 'All' ? 'All' : parseInt(e.target.value);
                          handleItemsPerPageChange(value);
                        }}
                        disabled={loading}
                        className={`px-2 sm:px-3 py-1 rounded-lg border text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 hover:scale-[1.02] focus:scale-[1.02] input-focus ${isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white hover:border-blue-400'
                            : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {itemsPerPageOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Top Page Navigation */}
                  {itemsPerPage !== 'All' && totalPages > 1 && (
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1 || isChangingPage || loading}
                        className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all duration-150 hover:scale-105 active:scale-95 hover-lift shadow-sm hover:shadow-md ${currentPage === 1 || isChangingPage || loading
                            ? isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                          }`}
                      >
                        {isChangingPage ? (
                          <span className="flex items-center space-x-2">
                            <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-slate-400' : 'border-slate-600'
                              }`}></div>
                            <span className="hidden sm:inline">Loading...</span>
                            <span className="sm:hidden">...</span>
                          </span>
                        ) : (
                          <>
                            <span className="hidden sm:inline">Previous</span>
                            <span className="sm:hidden">Prev</span>
                          </>
                        )}
                      </button>

                      {/* Smart Page numbers */}
                      <div className="flex items-center space-x-1">
                        {(() => {
                          const pages = [];

                          if (totalPages <= 7) {
                            // Show all pages if 7 or fewer
                            for (let i = 1; i <= totalPages; i++) {
                              pages.push(
                                <button
                                  key={i}
                                  onClick={() => handlePageChange(i)}
                                  disabled={isChangingPage || loading}
                                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all duration-150 hover:scale-105 ${currentPage === i
                                      ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                      : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                                    } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {i}
                                </button>
                              );
                            }
                          } else {
                            // Smart pagination for more than 7 pages

                            // Always show first page
                            pages.push(
                              <button
                                key={1}
                                onClick={() => handlePageChange(1)}
                                disabled={isChangingPage || loading}
                                className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-colors ${currentPage === 1
                                    ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                    : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                                  } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                1
                              </button>
                            );

                            if (currentPage <= 4) {
                              // Show: 1, 2, 3, 4, 5, ..., last
                              for (let i = 2; i <= 5; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => handlePageChange(i)}
                                    disabled={isChangingPage || loading}
                                    className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all duration-150 hover:scale-110 active:scale-95 hover-lift ${currentPage === i
                                        ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                        : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                                      } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {i}
                                  </button>
                                );
                              }
                              pages.push(
                                <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ...
                                </span>
                              );
                            } else if (currentPage >= totalPages - 3) {
                              // Show: 1, ..., last-4, last-3, last-2, last-1, last
                              pages.push(
                                <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ...
                                </span>
                              );
                              for (let i = totalPages - 4; i <= totalPages; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => handlePageChange(i)}
                                    disabled={isChangingPage || loading}
                                    className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all duration-150 hover:scale-110 active:scale-95 hover-lift ${currentPage === i
                                        ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                        : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                                      } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {i}
                                  </button>
                                );
                              }
                            } else {
                              // Show: 1, ..., current-1, current, current+1, ..., last
                              pages.push(
                                <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ...
                                </span>
                              );
                              for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => handlePageChange(i)}
                                    disabled={isChangingPage || loading}
                                    className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all duration-150 hover:scale-110 active:scale-95 hover-lift ${currentPage === i
                                        ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                        : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                                      } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {i}
                                  </button>
                                );
                              }
                              pages.push(
                                <span key="ellipsis2" className={`px-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ...
                                </span>
                              );
                            }

                            // Always show last page (if not already shown)
                            if (currentPage < totalPages - 3) {
                              pages.push(
                                <button
                                  key={totalPages}
                                  onClick={() => handlePageChange(totalPages)}
                                  disabled={isChangingPage || loading}
                                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-colors ${currentPage === totalPages
                                      ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                      : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
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
                        className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-all duration-150 shadow-sm hover:shadow-md ${currentPage === totalPages || isChangingPage || loading
                            ? isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                          }`}
                      >
                        {isChangingPage ? (
                          <span className="flex items-center space-x-2">
                            <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-slate-400' : 'border-slate-600'
                              }`}></div>
                            <span>Loading...</span>
                          </span>
                        ) : (
                          'Next'
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className={`${viewMode === 'cards' ? 'p-4' : 'p-0'} animate-in fade-in-0 slide-in-from-top-4 duration-700`}>
                  {viewMode === 'cards' ? (
                    // Card View with smooth animations
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                      {(() => {
                        // Group fabrics by qualityCode for card view while preserving sort order
                        const groupedFabrics = new Map<string, Fabric[]>();
                        const groupOrder: string[] = [];

                        paginatedFabrics.forEach(fabric => {
                          const key = fabric.qualityCode;
                          if (!groupedFabrics.has(key)) {
                            groupedFabrics.set(key, []);
                            groupOrder.push(key);
                          }
                          groupedFabrics.get(key)!.push(fabric);
                        });

                        // Sort groups by fabric creation time (not weaver update time)
                        // Use the earliest createdAt in the group (when the fabric was first created)
                        // This ensures fabrics are sorted by when they were created, not by weaver updates
                        groupOrder.sort((a, b) => {
                          const fabricsA = groupedFabrics.get(a)!;
                          const fabricsB = groupedFabrics.get(b)!;

                          // Find the earliest creation time in each group (when fabric was first created)
                          const minDateA = Math.min(...fabricsA.map(f => new Date(f.createdAt || 0).getTime()));
                          const minDateB = Math.min(...fabricsB.map(f => new Date(f.createdAt || 0).getTime()));

                          // Sort by creation time (newest first if desc, oldest first if asc)
                          // Check if sortOrder is desc or asc (default: desc for latest first)
                          const sortOrder = filters.sortOrder || 'desc';
                          return sortOrder === 'desc' ? minDateB - minDateA : minDateA - minDateB;
                        });

                        return groupOrder.map(qualityCode => {
                          const fabrics = groupedFabrics.get(qualityCode)!;
                          // Sort weavers within group by creation time (when weaver was added)
                          // This maintains the order of weavers as they were added to the fabric
                          fabrics.sort((a, b) => {
                            const aDate = new Date(a.createdAt || 0).getTime();
                            const bDate = new Date(b.createdAt || 0).getTime();
                            return aDate - bDate; // Oldest first (maintain original order)
                          });
                          const mainFabric = fabrics[0];
                          const isExpanded = expandedCards.has(qualityCode);
                          const itemsToShow = isExpanded ? fabrics : fabrics.slice(0, 1);

                          return (
                            <div key={qualityCode} className={`rounded-lg sm:rounded-xl border transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-[1.02] animate-in fade-in-0 slide-in-from-bottom-2 ${deletingQualityGroups.has(qualityCode)
                                ? isDarkMode
                                  ? 'bg-red-900/30 border-red-500 animate-red-glow-delete'
                                  : 'bg-red-50 border-red-400 animate-red-glow-delete'
                                : isDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-blue-50 border-blue-300'
                              } ${fabrics.some(f => glowingIds.has(f._id)) ? 'animate-weaver-green-glow' : ''} ${deletingQualityGroups.has(qualityCode) ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
                              }`} style={{
                                animationDelay: `${groupOrder.indexOf(qualityCode) * 0.1}s`,
                                transition: deletingQualityGroups.has(qualityCode) ? 'all 0.6s ease-in-out' : 'all 0.15s ease-in-out'
                              }}>
                              {/* Image Section - Responsive with Touch Support */}
                              <div className="relative h-40 sm:h-48 md:h-56 lg:h-64 xl:h-72 overflow-hidden rounded-t-lg sm:rounded-t-xl group">
                                {mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '').length > 0 ? (
                                  <div
                                    className="relative w-full h-full"
                                    onTouchStart={(e) => {
                                      const touch = e.touches[0];
                                      const target = e.currentTarget as HTMLElement;
                                      target.dataset.touchStartX = touch.clientX.toString();
                                    }}
                                    onTouchEnd={(e) => {
                                      const target = e.currentTarget as HTMLElement;
                                      const startX = parseInt(target.dataset.touchStartX || '0');
                                      const endX = e.changedTouches[0].clientX;
                                      const distance = startX - endX;

                                      if (Math.abs(distance) > 50) { // Minimum swipe distance
                                        const validImages = mainFabric.images.filter(img => img && img.trim() !== '');
                                        if (distance > 0 && validImages.length > 1) {
                                          // Swipe left - next image
                                          handleCardImageNavigation(qualityCode, 'next');
                                        } else if (distance < 0 && validImages.length > 1) {
                                          // Swipe right - previous image
                                          handleCardImageNavigation(qualityCode, 'prev');
                                        }
                                      }
                                    }}
                                  >
                                    <img
                                      src={getCurrentCardImage(mainFabric, qualityCode) || (mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '')[0])}
                                      alt="Fabric"
                                      className="w-full h-full object-cover cursor-pointer transition-transform duration-200 hover:scale-105 select-none"
                                      onClick={() => handleImageClick(mainFabric, cardImageIndices[qualityCode] || 0)}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                        if (fallback) {
                                          fallback.style.display = 'flex';
                                        }
                                      }}
                                    />
                                    <div className={`hidden fallback-icon w-full h-full items-center justify-center ${isDarkMode ? 'bg-gray-600' : 'bg-gray-100'
                                      }`} style={{ display: 'none' }}>
                                      <PhotoIcon className={`h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                        }`} />
                                    </div>

                                    {/* Touch hint for mobile */}
                                    {mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '').length > 1 && (
                                      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                          ? 'bg-gray-800/80 text-gray-300 border border-gray-600'
                                          : 'bg-white/90 text-gray-600 border border-gray-200'
                                        } shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                                        ← Swipe →
                                      </div>
                                    )}

                                    {/* Navigation buttons for multiple images */}
                                    {mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '').length > 1 && (
                                      <>
                                        {/* Left arrow */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCardImageNavigation(qualityCode, 'prev');
                                          }}
                                          className={`absolute left-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full transition-all duration-150 ${isDarkMode
                                              ? 'bg-gray-800/80 hover:bg-gray-700/90 text-white'
                                              : 'bg-white/90 hover:bg-white text-gray-700'
                                            } shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110`}
                                        >
                                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                          </svg>
                                        </button>

                                        {/* Right arrow */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCardImageNavigation(qualityCode, 'next');
                                          }}
                                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full transition-all duration-150 ${isDarkMode
                                              ? 'bg-gray-800/80 hover:bg-gray-700/90 text-white'
                                              : 'bg-white/90 hover:bg-white text-gray-700'
                                            } shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110`}
                                        >
                                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className={`w-full h-full flex flex-col items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                                    }`}>
                                    <PhotoIcon className={`h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                      }`} />
                                    <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                      No image added
                                    </span>
                                  </div>
                                )}

                                {/* Image count badge - Responsive */}
                                {mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '').length > 1 && (
                                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                                    <span className={`text-xs sm:text-sm px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full font-medium shadow-lg ${isDarkMode
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                      }`}>
                                      <span className="hidden sm:inline">{mainFabric.images.filter(img => img && img.trim() !== '').length} photos</span>
                                      <span className="sm:hidden">+{mainFabric.images.filter(img => img && img.trim() !== '').length - 1}</span>
                                    </span>
                                  </div>
                                )}

                                {/* Items count badge - Responsive */}
                                <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                                  <span className={`text-xs sm:text-sm px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full font-medium shadow-lg ${isDarkMode
                                      ? 'bg-green-600 text-white'
                                      : 'bg-green-100 text-green-800 border border-green-200'
                                    }`}>
                                    <span className="hidden sm:inline">{fabrics.length} weaver{fabrics.length !== 1 ? 's' : ''}</span>
                                    <span className="sm:hidden">{fabrics.length}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Content Section - Responsive */}
                              <div className="p-1.5 sm:p-2 lg:p-3 xl:p-4">
                                {/* Quality Information */}
                                <div className="mb-1.5 sm:mb-2">
                                  <div className={`text-xs sm:text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    <span className="font-medium">Quality Code:</span>
                                    <span className={`ml-1 font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                      }`}>
                                      {mainFabric.qualityCode}
                                    </span>
                                  </div>
                                  <div className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    <span className="font-medium">Quality Name:</span>
                                    <span className="ml-1">{mainFabric.qualityName}</span>
                                  </div>
                                  <div className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    <span className="font-medium">Type:</span>
                                    <span className={`ml-1 font-semibold ${mainFabric.type
                                        ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                                        : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                      }`}>
                                      {mainFabric.type || '-'}
                                    </span>
                                  </div>
                                </div>

                                {/* All Items in One Compact Section */}
                                <div className="mb-1.5 sm:mb-2">
                                  <div className={`p-2 sm:p-2.5 rounded-lg border ${isDarkMode
                                      ? 'bg-gray-700/30 border-gray-500'
                                      : 'bg-gray-50 border-gray-300'
                                    }`}>
                                    <h4 className={`text-xs sm:text-sm font-semibold mb-1 sm:mb-1.5 flex items-center justify-between ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                      }`}>
                                      <span>Weavers ({fabrics.length})</span>
                                    </h4>

                                    {/* Show items based on expansion state */}
                                    <div className="space-y-2">
                                      {itemsToShow.map((fabric, index) => (
                                        <div key={fabric._id} className={`p-2 sm:p-2.5 lg:p-3 rounded-lg border transition-all duration-300 ease-in-out relative overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 ${redGlowingIds.has(String(fabric._id)) ? 'animate-red-glow-delete' : ''
                                          } ${fadeOutRows.has(fabric._id)
                                            ? 'opacity-0 scale-95 -translate-y-2 blur-sm'
                                            : 'opacity-100 scale-100 translate-y-0 blur-0'
                                          } ${fadeOutRows.has(fabric._id)
                                            ? isDarkMode
                                              ? 'bg-red-900/30 border-red-500/50'
                                              : 'bg-red-50 border-red-300'
                                            : isDarkMode
                                              ? 'bg-gray-800/40 border-gray-600/40 hover:bg-gray-700/70'
                                              : 'bg-white border-gray-200 hover:bg-gray-50'
                                          } ${glowingIds.has(fabric._id) ? 'animate-weaver-green-glow' : ''}`} style={{
                                            transition: fadeOutRows.has(fabric._id) ? 'all 0.5s ease-in-out' : 'all 0.15s ease-in-out'
                                          }}>
                                          {/* ⚡ NO LOADING OVERLAY - Smooth fade animation only */}
                                          {/* Item Header */}
                                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                              <span className={`text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md ${isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                #{index + 1}
                                              </span>
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                <span className="text-sm sm:text-base">Rate:</span>
                                                <span className={`ml-1 font-bold text-sm sm:text-base ${fabric.greighRate > 0
                                                    ? isDarkMode
                                                      ? 'text-green-400'
                                                      : 'text-green-600'
                                                    : isDarkMode
                                                      ? 'text-red-400'
                                                      : 'text-red-600'
                                                  }`}>
                                                  {fabric.greighRate > 0 ? `₹${fabric.greighRate}` : '-'}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 sm:gap-2">
                                              {/* Download Sticker Button */}
                                              <button
                                                onClick={() => handleStickerDownload(fabric)}
                                                className={`p-1 sm:p-1.5 rounded-md transition-all duration-150 hover:scale-110 active:scale-95 hover-lift ${isDarkMode
                                                    ? 'text-blue-400 border border-blue-500/30 hover:bg-blue-500/20'
                                                    : 'text-blue-600 border border-blue-300 hover:bg-blue-50'
                                                  }`}
                                                title={`Download Sticker for Weaver ${index + 1}`}
                                              >
                                                <ArrowDownTrayIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                              </button>

                                              {/* Delete Button */}
                                              {isMaster && (
                                                <button
                                                  onClick={() => handleDelete(fabric)}
                                                  disabled={false}
                                                  className={`p-1 sm:p-1.5 rounded-md transition-all duration-150 hover:scale-110 active:scale-95 hover-lift disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                                                      ? 'text-red-400 hover:bg-red-900/20'
                                                      : 'text-red-600 hover:bg-red-50'
                                                    }`}
                                                  title={`Delete Weaver ${index + 1}`}
                                                >
                                                  <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Item Details Grid */}
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm sm:text-base">
                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Weaver Name:
                                              </div>
                                              <div className={`font-bold break-words max-w-full ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                                                {fabric.weaver}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Weaver Quality Name:
                                              </div>
                                              <div className={`font-bold break-words max-w-full ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                                                {fabric.weaverQualityName || '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Rack:
                                              </div>
                                              <div className={`font-bold break-words max-w-full ${isDarkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>
                                                {fabric.rack || '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Greigh Width:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                                                {fabric.greighWidth > 0 ? fabric.greighWidth : '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Finish:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-teal-300' : 'text-teal-600'}`}>
                                                {fabric.finishWidth > 0 ? fabric.finishWidth : '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Weight:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                                                {fabric.weight > 0 ? `${fabric.weight} KG` : '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                GSM:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-pink-300' : 'text-pink-600'}`}>
                                                {fabric.gsm > 0 ? fabric.gsm : '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Content:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                                                {fabric.content || '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Danier:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                                                {fabric.danier || '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Reed:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>
                                                {fabric.reed > 0 ? fabric.reed : '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Pick:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-rose-300' : 'text-rose-600'}`}>
                                                {fabric.pick > 0 ? fabric.pick : '-'}
                                              </div>
                                            </div>

                                          </div>
                                        </div>
                                      ))}

                                      {/* View More/Less button or placeholder for consistent spacing */}
                                      {fabrics.length > 1 ? (
                                        <button
                                          onClick={() => toggleCardExpansion(qualityCode)}
                                          className={`w-full py-1 sm:py-1.5 lg:py-2 text-xs sm:text-sm font-medium rounded border-2 border-dashed transition-all duration-150 hover:scale-[1.02] active:scale-95 ${isDarkMode
                                              ? 'border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400'
                                              : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                            }`}
                                        >
                                          <span className="hidden lg:inline">
                                            {isExpanded
                                              ? 'Show Less'
                                              : fabrics.length === 2
                                                ? 'View 1 more weaver'
                                                : `View ${fabrics.length - 1} more weavers`
                                            }
                                          </span>
                                          <span className="hidden sm:inline lg:hidden">
                                            {isExpanded
                                              ? 'Show Less'
                                              : fabrics.length === 2
                                                ? 'View 1 more'
                                                : `View ${fabrics.length - 1} more`
                                            }
                                          </span>
                                          <span className="sm:hidden">
                                            {isExpanded
                                              ? 'Less'
                                              : `+${fabrics.length - 1}`
                                            }
                                          </span>
                                        </button>
                                      ) : (
                                        <div className={`w-full py-1 sm:py-1.5 lg:py-2 text-xs sm:text-sm text-center rounded border border-dashed ${isDarkMode
                                            ? 'border-gray-700 text-gray-500'
                                            : 'border-gray-200 text-gray-400'
                                          }`}>
                                          <span className="hidden lg:inline">Only 1 weaver</span>
                                          <span className="hidden sm:inline lg:hidden">Only 1 weaver</span>
                                          <span className="sm:hidden">1</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Actions at Bottom - Responsive */}
                              <div className={`p-1.5 sm:p-2 lg:p-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'
                                }`}>
                                <div className="flex flex-col space-y-1.5 sm:flex-row sm:space-y-0 sm:space-x-1 lg:space-x-1.5 xl:space-x-2">
                                  <button
                                    onClick={() => handleView(mainFabric)}
                                    className={`flex-1 px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 hover-lift text-xs sm:text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-1 bg-transparent ${isDarkMode
                                        ? 'text-blue-400 border border-blue-400 hover:bg-blue-400/10'
                                        : 'text-blue-600 border border-blue-600 hover:bg-blue-600/10'
                                      }`}
                                    title="View Quality Details"
                                  >
                                    <EyeIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                                    <span className="hidden lg:inline">View</span>
                                    <span className="hidden sm:inline lg:hidden">View</span>
                                    <span className="sm:hidden">View</span>
                                  </button>

                                  <button
                                    onClick={() => handleEdit(mainFabric)}
                                    className={`flex-1 px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-lg transition-all duration-150 hover:scale-105 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-1 bg-transparent ${isDarkMode
                                        ? 'text-emerald-400 border border-emerald-400 hover:bg-emerald-400/10'
                                        : 'text-emerald-600 border border-emerald-600 hover:bg-emerald-600/10'
                                      }`}
                                    title="Edit Quality"
                                  >
                                    <PencilIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                                    <span className="hidden lg:inline">Edit</span>
                                    <span className="hidden sm:inline lg:hidden">Edit</span>
                                    <span className="sm:hidden">Edit</span>
                                  </button>

                                  {isMaster && (false ? (
                                    <button
                                      disabled
                                      className={`flex-1 px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-lg transition-all duration-150 text-xs sm:text-sm font-medium shadow-sm flex items-center justify-center space-x-1 bg-transparent opacity-50 cursor-not-allowed ${isDarkMode
                                          ? 'text-blue-400 border border-blue-400'
                                          : 'text-blue-600 border border-blue-600'
                                        }`}
                                      title="Delete All"
                                    >
                                      <ArrowPathIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 animate-spin" />
                                      <span className="hidden lg:inline">Delete All</span>
                                      <span className="hidden sm:inline lg:hidden">Delete All</span>
                                      <span className="sm:hidden">...</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleDeleteQualityGroup(mainFabric, fabrics)}
                                      disabled={false}
                                      className={`flex-1 px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-lg transition-all duration-150 hover:scale-105 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-1 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                                          ? 'text-red-400 border border-red-400 hover:bg-red-400/10'
                                          : 'text-red-600 border border-red-600 hover:bg-red-600/10'
                                        }`}
                                      title={`Delete Quality Group (${fabrics.length} items)`}
                                    >
                                      <TrashIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                                      <span className="hidden lg:inline">Delete</span>
                                      <span className="hidden sm:inline lg:hidden">Delete</span>
                                      <span className="sm:hidden">Del</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    // Table View with smooth animations - Super Responsive
                    <div className="overflow-x-auto w-full p-0 m-0" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
                      <table className={`w-full min-w-[1100px] sm:min-w-[1300px] md:min-w-full text-[9px] xs:text-[10px] sm:text-xs md:text-sm border-2 border-collapse ${isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'
                        }`}>
                        <thead className={`${isDarkMode ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b border-slate-600' : 'bg-white border-b border-gray-300'
                          }`}>
                          <tr>
                            <th className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[100px] sm:min-w-[120px] md:min-w-[140px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              <span className="hidden sm:inline">Quality Info</span>
                              <span className="sm:hidden">Quality</span>
                            </th>
                            <th className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[70px] sm:min-w-[90px] md:min-w-[120px] lg:min-w-[150px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              <span className="hidden xs:inline">Images</span>
                              <span className="xs:hidden">Img</span>
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              W No.
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              W Name
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              W Quality
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Greigh
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Finish
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Weight
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              GSM
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Content
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Denier
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Reed
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Pick
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] md:min-w-[80px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Price
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[80px] md:min-w-[100px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Rack
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Action
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'
                          }`}>
                          {(() => {
                            // ⚡ CRITICAL: Don't show "no data" while loading or initial fetch not done
                            if (loading || !initialFetchDone || fetchInFlight > 0 || initialLoading || !hasInitialFetchRef.current) {
                              return (
                                <tr>
                                  <td colSpan={16} className={`px-6 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                    <div className="flex flex-col items-center justify-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                                      <p className="text-sm">Loading fabrics...</p>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            // Check if there's data to display (only after loading completes)
                            if (!paginatedFabrics || paginatedFabrics.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={16} className={`px-6 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium">
                                      {typeFilter
                                        ? `No fabrics found with type "${typeFilter}"`
                                        : filters.weaver
                                          ? `No fabrics found for weaver "${filters.weaver}"`
                                          : filters.weaverQualityName
                                            ? `No fabrics found for weaver quality "${filters.weaverQualityName}"`
                                            : filters.search
                                              ? `No results found for "${filters.search}"`
                                              : 'No fabrics to display'
                                      }
                                    </p>
                                    <p className="text-sm mt-1">
                                      {typeFilter
                                        ? `We couldn't find any fabrics with the type "${typeFilter}". Try selecting a different type or clear the filter.`
                                        : filters.weaver
                                          ? `We couldn't find any fabrics for weaver "${filters.weaver}". Try selecting a different weaver or clear the filter.`
                                          : filters.weaverQualityName
                                            ? `We couldn't find any fabrics for weaver quality "${filters.weaverQualityName}". Try selecting a different quality or clear the filter.`
                                            : filters.search
                                              ? 'Try adjusting your search terms or clear the search'
                                              : 'Get started by adding your first fabric'
                                      }
                                    </p>
                                  </td>
                                </tr>
                              );
                            }

                            // Group fabrics by qualityCode while preserving sort order (same as card view)
                            const groupedFabrics = new Map<string, Fabric[]>();
                            const groupOrder: string[] = [];

                            paginatedFabrics.forEach(fabric => {
                              const key = fabric.qualityCode;
                              if (!groupedFabrics.has(key)) {
                                groupedFabrics.set(key, []);
                                groupOrder.push(key);
                              }
                              groupedFabrics.get(key)!.push(fabric);
                            });

                            // Sort groups by fabric creation time (not weaver update time)
                            // Use the earliest createdAt in the group (when the fabric was first created)
                            // This ensures fabrics are sorted by when they were created, not by weaver updates
                            groupOrder.sort((a, b) => {
                              const fabricsA = groupedFabrics.get(a)!;
                              const fabricsB = groupedFabrics.get(b)!;

                              // Find the earliest creation time in each group (when fabric was first created)
                              const minDateA = Math.min(...fabricsA.map(f => new Date(f.createdAt || 0).getTime()));
                              const minDateB = Math.min(...fabricsB.map(f => new Date(f.createdAt || 0).getTime()));

                              // Sort by creation time (newest first if desc, oldest first if asc)
                              // Check if sortOrder is desc or asc (default: asc for oldest first)
                              const sortOrder = filters.sortOrder || 'asc';
                              return sortOrder === 'desc' ? minDateB - minDateA : minDateA - minDateB;
                            });

                            // ⚡ CRITICAL: Don't show "no groups" while loading or initial fetch not done
                            if (loading || !initialFetchDone || fetchInFlight > 0 || initialLoading || !hasInitialFetchRef.current) {
                              return (
                                <tr>
                                  <td colSpan={16} className={`px-6 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                    <div className="flex flex-col items-center justify-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                                      <p className="text-sm">Loading fabrics...</p>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            // Check if grouping resulted in any groups (only after loading completes)
                            if (groupOrder.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={16} className={`px-6 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium">No fabric groups found</p>
                                    <p className="text-sm mt-1">Unable to group fabrics by quality code</p>
                                  </td>
                                </tr>
                              );
                            }

                            return groupOrder.map(qualityCode => {
                              const fabrics = groupedFabrics.get(qualityCode)!;
                              // Sort weavers within group by creation time (when weaver was added)
                              // Always sort weavers oldest first (W1, W2, W3...) regardless of main sort order
                              fabrics.sort((a, b) => {
                                const aDate = new Date(a.createdAt || 0).getTime();
                                const bDate = new Date(b.createdAt || 0).getTime();
                                return aDate - bDate; // Oldest first (maintain original order)
                              });
                              const mainFabric = fabrics[0]; // Use first fabric for quality info

                              return fabrics.map((fabric, weaverIndex) => (
                                <tr key={`${qualityCode}-${fabric._id}`} className={`relative transition-all duration-300 hover:bg-opacity-50 animate-in fade-in-0 slide-in-from-left-2 ${weaverIndex === 0 ? '' : 'border-t-2'} ${weaverIndex === fabrics.length - 1 ? 'border-b-4' : ''} ${isDarkMode ? 'border-gray-500' : 'border-gray-300'
                                  } ${redGlowingIds.has(String(fabric._id)) ? 'animate-red-glow-delete' : ''
                                  } ${fadeOutRows.has(String(fabric._id))
                                    ? 'opacity-0 scale-95 -translate-y-2 blur-sm'
                                    : 'opacity-100 scale-100 translate-y-0 blur-0'
                                  } ${fadeOutRows.has(String(fabric._id))
                                    ? isDarkMode
                                      ? 'bg-red-900/20 border-red-500/50'
                                      : 'bg-red-50 border-red-300'
                                    : ''
                                  } ${deletingIds.has(String(fabric._id)) ? 'opacity-60' : ''} ${glowingIds.has(fabric._id) ? 'animate-weaver-green-glow' : ''}`} style={{
                                    animationDelay: `${weaverIndex * 0.05}s`,
                                    transition: fadeOutRows.has(String(fabric._id)) ? 'all 0.5s ease-in-out' : 'all 0.15s ease-in-out'
                                  }}>
                                  {/* ⚡ NO LOADING OVERLAY - Smooth fade animation only */}
                                  {/* Quality Information - Only show on first row with rowspan */}
                                  {weaverIndex === 0 && (
                                    <td rowSpan={fabrics.length} className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-top border-r border-b-4 ${isDarkMode ? 'text-gray-300 border-gray-600 border-b-gray-500' : 'text-gray-900 border-gray-300 border-b-gray-300'
                                      }`}>
                                      <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Code:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[10px] xs:text-xs sm:text-sm md:text-base lg:text-lg ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                            }`}>
                                            {mainFabric.qualityCode}
                                          </span>
                                        </div>
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Name:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm truncate max-w-[100px] sm:max-w-[120px] md:max-w-none ${isDarkMode ? 'text-purple-300' : 'text-purple-600'
                                            }`} title={mainFabric.qualityName}>
                                            {mainFabric.qualityName}
                                          </span>
                                        </div>
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Type:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${mainFabric.type
                                              ? (isDarkMode ? 'text-orange-300' : 'text-orange-600')
                                              : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                            }`} title={mainFabric.type || '-'}>
                                            {mainFabric.type || '-'}
                                          </span>
                                        </div>
                                        <div className="pt-1 sm:pt-1.5 md:pt-2 border-t-2 border-gray-400/30">
                                          <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                            <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                              }`}>Created:</span>
                                            <span className={`ml-1 sm:ml-1.5 font-semibold text-[9px] xs:text-[10px] sm:text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                              }`}>
                                              {new Date(mainFabric.createdAt).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Weavers:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[10px] xs:text-xs sm:text-sm md:text-base lg:text-lg ${isDarkMode ? 'text-green-400' : 'text-green-600'
                                            }`}>
                                            {fabrics.length}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  )}

                                  {/* Images - Only show on first row with rowspan */}
                                  {weaverIndex === 0 && (
                                    <td rowSpan={fabrics.length} className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-middle border-r border-b-4 ${isDarkMode ? 'border-gray-600 border-b-gray-500' : 'border-gray-300 border-b-gray-300'
                                      }`}>
                                      <div className="flex justify-center items-center">
                                        {mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '').length > 0 ? (
                                          <div className="flex flex-col items-center space-y-0.5 sm:space-y-1">
                                            <div className="relative">
                                              <img
                                                src={mainFabric.images.filter(img => img && img.trim() !== '')[0]}
                                                alt="Fabric"
                                                className="w-16 h-12 xs:w-20 xs:h-14 sm:w-24 sm:h-20 md:w-32 md:h-24 lg:w-40 lg:h-28 xl:w-48 xl:h-36 object-contain bg-slate-950 rounded-lg border-2 cursor-pointer shadow-md hover:shadow-lg transition-all duration-150 hover:scale-105"
                                                onClick={() => handleImageClick(mainFabric, 0)}
                                                onError={(e) => {
                                                  const target = e.target as HTMLImageElement;
                                                  target.style.display = 'none';
                                                  const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                                  if (fallback) {
                                                    fallback.style.display = 'flex';
                                                  }
                                                }}
                                              />
                                              <div className={`hidden fallback-icon w-16 h-12 xs:w-20 xs:h-14 sm:w-24 sm:h-20 md:w-32 md:h-24 lg:w-40 lg:h-28 xl:w-48 xl:h-36 rounded-lg items-center justify-center border-2 ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-gray-100 border-gray-200'
                                                }`} style={{ display: 'none' }}>
                                                <PhotoIcon className={`h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-10 lg:w-10 xl:h-12 xl:w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                                  }`} />
                                              </div>
                                            </div>
                                            {mainFabric.images && mainFabric.images.filter(img => img && img.trim() !== '').length > 1 && (
                                              <span className={`text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs px-1.5 xs:px-2 py-0.5 rounded-full font-medium ${isDarkMode
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                +{mainFabric.images.filter(img => img && img.trim() !== '').length - 1}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <div className={`w-16 h-12 xs:w-20 xs:h-14 sm:w-24 sm:h-20 md:w-32 md:h-24 lg:w-40 lg:h-28 xl:w-48 xl:h-36 rounded-lg flex flex-col items-center justify-center border-2 ${isDarkMode
                                              ? 'bg-gray-700 border-gray-600'
                                              : 'bg-gray-50 border-gray-200'
                                            }`}>
                                            <PhotoIcon className={`h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-10 lg:w-10 xl:h-12 xl:w-12 mb-0.5 sm:mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                              }`} />
                                            <span className={`text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                              }`}>
                                              No img
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  {/* W No. Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <div className={`text-[10px] xs:text-xs sm:text-sm md:text-base font-bold text-center ${isDarkMode ? 'text-blue-300' : 'text-blue-600'
                                      }`}>
                                      W{weaverIndex + 1}
                                    </div>
                                  </td>

                                  {/* W Name Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm break-words block w-full ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                                      {fabric.weaver}
                                    </span>
                                  </td>

                                  {/* W Quality Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm break-words block w-full ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                                      {fabric.weaverQualityName || '-'}
                                    </span>
                                  </td>

                                  {/* Greigh Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                                      {fabric.greighWidth > 0 ? fabric.greighWidth : '-'}
                                    </span>
                                  </td>

                                  {/* Finish Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-teal-300' : 'text-teal-600'}`}>
                                      {fabric.finishWidth > 0 ? fabric.finishWidth : '-'}
                                    </span>
                                  </td>

                                  {/* Weight Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                                      {fabric.weight > 0 ? `${fabric.weight}` : '-'}
                                    </span>
                                  </td>

                                  {/* GSM Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-pink-300' : 'text-pink-600'}`}>
                                      {fabric.gsm > 0 ? fabric.gsm : '-'}
                                    </span>
                                  </td>

                                  {/* Content Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm truncate block ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`} title={fabric.content || '-'}>
                                      {fabric.content || '-'}
                                    </span>
                                  </td>

                                  {/* Danier Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm truncate block ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`} title={fabric.danier || '-'}>
                                      {fabric.danier || '-'}
                                    </span>
                                  </td>

                                  {/* Reed Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>
                                      {fabric.reed > 0 ? fabric.reed : '-'}
                                    </span>
                                  </td>

                                  {/* Pick Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-rose-300' : 'text-rose-600'}`}>
                                      {fabric.pick > 0 ? fabric.pick : '-'}
                                    </span>
                                  </td>

                                  {/* Price Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className="hidden xs:inline text-[8px] xs:text-[9px] sm:text-[10px]">₹</span>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm lg:text-base ${fabric.greighRate > 0
                                        ? isDarkMode
                                          ? 'text-green-400'
                                          : 'text-green-600'
                                        : isDarkMode
                                          ? 'text-red-400'
                                          : 'text-red-600'
                                      }`}>
                                      {fabric.greighRate > 0 ? `${fabric.greighRate}` : '-'}
                                    </span>
                                  </td>

                                  {/* Rack Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>
                                      {fabric.rack || '-'}
                                    </span>
                                  </td>

                                  {/* Action Column - Download and Delete buttons for weaver */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                      {/* Download Sticker Button - First Row */}
                                      <button
                                        onClick={() => handleStickerDownload(fabric)}
                                        className={`p-1 xs:p-1.5 sm:p-2 rounded transition-all duration-150 hover:scale-110 active:scale-95 hover-lift ${isDarkMode
                                            ? 'text-blue-400 border border-blue-500/30 hover:bg-blue-500/20'
                                            : 'text-blue-600 border border-blue-300 hover:bg-blue-50'
                                          }`}
                                        title="Download Sticker"
                                      >
                                        <ArrowDownTrayIcon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                                      </button>

                                      {/* Delete Button - Second Row */}
                                      {isMaster && (
                                        <button
                                          onClick={() => handleDelete(fabric)}
                                          disabled={false}
                                          className={`p-1 xs:p-1.5 sm:p-2 rounded transition-all duration-150 hover:scale-110 active:scale-95 hover-lift disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                                              ? 'text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                              : 'text-red-600 border border-red-300 hover:bg-red-50'
                                            }`}
                                          title={`Delete Weaver ${weaverIndex + 1}`}
                                        >
                                          <TrashIcon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  {/* Actions - Only show on first row with rowspan */}
                                  {weaverIndex === 0 && (
                                    <td rowSpan={fabrics.length} className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-1.5 sm:py-2 md:py-3 align-middle border-b-4 ${isDarkMode ? 'border-gray-600 border-b-gray-500' : 'border-gray-300 border-b-gray-300'
                                      }`}>
                                      <div className="flex flex-col justify-center space-y-1 sm:space-y-1.5 md:space-y-2">
                                        <button
                                          onClick={() => handleView(mainFabric)}
                                          className={`w-full px-1.5 xs:px-2 sm:px-2.5 md:px-3 py-1 xs:py-1.5 sm:py-2 rounded-lg text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium flex items-center justify-center space-x-1 transition-all duration-150 hover:scale-105 active:scale-95 hover-lift ${isDarkMode
                                              ? 'text-blue-400 border border-blue-400 hover:bg-blue-500/20'
                                              : 'text-blue-600 border border-blue-600 hover:bg-blue-50'
                                            }`}
                                          title="View Details"
                                        >
                                          <EyeIcon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                                          <span className="hidden sm:inline">View</span>
                                        </button>

                                        <button
                                          onClick={() => handleEdit(mainFabric)}
                                          className={`w-full px-1.5 xs:px-2 sm:px-2.5 md:px-3 py-1 xs:py-1.5 sm:py-2 rounded-lg text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium flex items-center justify-center space-x-1 transition-colors ${isDarkMode
                                              ? 'text-emerald-400 border border-emerald-400 hover:bg-emerald-500/20'
                                              : 'text-emerald-600 border border-emerald-600 hover:bg-emerald-50'
                                            }`}
                                          title="Edit"
                                        >
                                          <PencilIcon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                                          <span className="hidden sm:inline">Edit</span>
                                        </button>

                                        {isMaster && (false ? (
                                          <button
                                            disabled
                                            className={`w-full px-1.5 xs:px-2 sm:px-2.5 md:px-3 py-1 xs:py-1.5 sm:py-2 rounded-lg text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium flex items-center justify-center space-x-1 transition-colors opacity-50 cursor-not-allowed ${isDarkMode
                                                ? 'text-blue-400 border border-blue-400'
                                                : 'text-blue-600 border border-blue-600'
                                              }`}
                                            title="Delete All"
                                          >
                                            <ArrowPathIcon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                            <span className="hidden sm:inline">Delete All</span>
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleDeleteQualityGroup(mainFabric, fabrics)}
                                            disabled={false}
                                            className={`w-full px-1.5 xs:px-2 sm:px-2.5 md:px-3 py-1 xs:py-1.5 sm:py-2 rounded-lg text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium flex items-center justify-center space-x-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                                                ? 'text-red-400 border border-red-400 hover:bg-red-500/20'
                                                : 'text-red-600 border border-red-600 hover:bg-red-50'
                                              }`}
                                            title={`Delete Quality Group (${fabrics.length} items)`}
                                          >
                                            <TrashIcon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                                            <span className="hidden sm:inline">Delete</span>
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ));
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bottom Pagination Controls - removed, using top pagination only */}
                {false && (
                  <div className={`px-3 sm:px-4 py-2 sm:py-3 border-t flex justify-center items-center ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                    }`}>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1 || isChangingPage || loading}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 shadow-sm hover:shadow-md ${currentPage === 1 || isChangingPage || loading
                            ? isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                          }`}
                      >
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </button>

                      {/* Page numbers */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              disabled={isChangingPage || loading}
                              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all duration-150 shadow-sm hover:shadow-md ${currentPage === pageNum
                                  ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                  : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages || isChangingPage || loading}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 shadow-sm hover:shadow-md ${currentPage === totalPages || isChangingPage || loading
                            ? isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                          }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showDetails && selectedFabric && (
        <FabricDetails
          fabric={selectedFabric}
          allFabricsInGroup={selectedFabricGroup}
          onClose={() => setShowDetails(false)}
          onEdit={() => {
            setShowDetails(false);
            handleEdit(selectedFabric);
          }}
          onDelete={(fabric) => {
            setShowDetails(false);
            handleDelete(fabric);
          }}
          onBulkDelete={(fabrics) => {
            setShowDetails(false);
            const group = {
              qualityCode: selectedFabric?.qualityCode || '',
              qualityName: selectedFabric?.qualityName || '',
              items: fabrics
            };
            setBulkDeleteGroup(group);
            setShowDeleteConfirmation(true);
          }}
        />
      )}

      {showDeleteConfirmation && (
        deletingFabric ? (
          <DeleteConfirmation
            mode="single"
            fabric={deletingFabric}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
            isDeleting={isDeleting}
            dependencies={deleteDependencies}
            isLoadingDependencies={isLoadingDependencies}
          />
        ) : bulkDeleteGroup ? (
          <DeleteConfirmation
            mode="bulk"
            fabrics={bulkDeleteGroup.items}
            qualityCode={bulkDeleteGroup.qualityCode}
            qualityName={bulkDeleteGroup.qualityName}
            onConfirm={confirmBulkDelete}
            onCancel={cancelBulkDelete}
            isDeleting={isBulkDeleting}
          />
        ) : null
      )}

      {/* Sticker PDF Preview Modal - Matching Sampling Page Design */}
      {showStickerPreview && currentStickerFabric && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              // Clean up blob URL if it exists
              if (stickerBlobUrlRef.current) {
                URL.revokeObjectURL(stickerBlobUrlRef.current);
                stickerBlobUrlRef.current = null;
              }
              if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(stickerPreviewUrl);
              }
              setShowStickerPreview(false);
              setStickerPreviewUrl(null);
              setCurrentStickerFabric(null);
            }
          }}
        >
          <div
            className={`relative w-full max-w-4xl h-[90vh] rounded-xl overflow-hidden shadow-2xl animate-scale-in ${isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
              }`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                Sticker Preview
              </h3>
              <div className="flex items-center space-x-2">
                {stickerPreviewUrl && !isLoadingStickerPreview && (
                  <button
                    onClick={handleFinalStickerDownload}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center space-x-2 ${isDarkMode
                        ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                        : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                      }`}
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    <span>Download</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    // Clean up blob URL if it exists
                    if (stickerBlobUrlRef.current) {
                      URL.revokeObjectURL(stickerBlobUrlRef.current);
                      stickerBlobUrlRef.current = null;
                    }
                    if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
                      URL.revokeObjectURL(stickerPreviewUrl);
                    }
                    setShowStickerPreview(false);
                    setStickerPreviewUrl(null);
                    setCurrentStickerFabric(null);
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 ${isDarkMode
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-auto">
              {isLoadingStickerPreview ? (
                <div className="flex items-center justify-center h-full">
                  <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'
                    }`}></div>
                </div>
              ) : stickerPreviewUrl ? (
                <iframe
                  src={stickerPreviewUrl}
                  className="w-full h-full"
                  title="Sticker Preview"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/80 flex items-center justify-center p-4 z-[9999]"
          onClick={() => setShowImageModal(null)}
        >
          <div 
            className="relative max-w-4xl w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl p-2 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Container with natural scrolling when zoomed */}
            <div className="overflow-auto max-w-full max-h-[70vh] min-h-[300px] flex items-center justify-center bg-slate-950 p-2 rounded-lg">
              <img
                src={showImageModal.fabric.images?.[selectedImageIndex]}
                alt="Fabric"
                className="max-w-full max-h-[65vh] object-contain rounded-lg transition-transform duration-200 ease-out"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Slider Navigation Arrows */}
            {showImageModal.fabric.images && showImageModal.fabric.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 sm:p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md z-30 border border-white/10"
                  title="Previous Image"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 sm:p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md z-30 border border-white/10"
                  title="Next Image"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Action Buttons */}
            <div className="absolute top-4 right-4 flex items-center space-x-2 z-50">
              {/* Zoom Out */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoomLevel(z => Math.max(0.5, z - 0.25)); }}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Zoom Out"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>

              {/* Zoom Reset */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoomLevel(1); }}
                className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10 text-xs font-bold"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoomLevel(z => Math.min(4, z + 0.25)); }}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Zoom In"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>

              {/* Open in New Tab */}
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const imgUrl = showImageModal.fabric.images?.[selectedImageIndex];
                  if (imgUrl) window.open(imgUrl, '_blank'); 
                }}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Open in New Tab"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              {/* WhatsApp Share */}
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const imgUrl = showImageModal.fabric.images?.[selectedImageIndex];
                  if (imgUrl) handleWhatsAppShare(imgUrl); 
                }}
                className="p-2 bg-black/60 hover:bg-green-600 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Share on WhatsApp"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.855.002-2.63-1.023-5.105-2.887-6.97C16.585 1.865 14.11 .84 11.49.842c-5.441 0-9.863 4.42-9.866 9.858-.002 2.073.547 4.103 1.588 5.912L2.17 20.89l4.477-1.736zM17.13 15.3c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-1.2-.6-2.09-1.05-2.9-2.45-.21-.36.21-.34.6-.12.35.2.45.33.65.03.2-.3.45-.63.68-.85.23-.23.3-.38.45-.68.15-.3.08-.55-.04-.7-.12-.15-.68-1.63-.95-2.28-.26-.62-.52-.53-.68-.54-.15-.01-.33-.01-.51-.01-.18 0-.48.07-.73.35-.25.27-.95.93-.95 2.28 0 1.35.98 2.65 1.12 2.83.14.18 1.92 2.94 4.66 4.13.65.28 1.16.45 1.56.57.66.21 1.25.18 1.72.11.53-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.12-.27-.2-.58-.35z" />
                </svg>
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const imgUrl = showImageModal.fabric.images?.[selectedImageIndex];
                  if (imgUrl) handleDownloadImage(imgUrl); 
                }}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Download Image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setShowImageModal(null)}
                className="p-2 bg-black/60 hover:bg-red-650 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Image Info */}
            <div className="absolute bottom-4 left-4 bg-black/65 px-3 py-1.5 rounded-lg text-xs text-white backdrop-blur-md max-w-xs truncate border border-white/10 shadow-lg z-30">
              <span className="font-semibold block text-[10px] uppercase text-gray-400 mb-0.5">
                Image {selectedImageIndex + 1} of {showImageModal.fabric.images?.length || 0}
              </span>
              <span className="opacity-90 text-[10px] block truncate">
                {showImageModal.fabric.images?.[selectedImageIndex]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-40 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 hover:scale-110 active:scale-95 scroll-to-top-btn ${isDarkMode
              ? 'bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-sm border border-blue-500/30'
              : 'bg-blue-500/90 hover:bg-blue-600 text-white backdrop-blur-sm border border-blue-400/30'
            }`}
          aria-label="Scroll to top"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      )}

      {/* Fabric Form Modal */}
      {showFabricForm && (
        <Suspense fallback={
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            style={{ zIndex: Z_INDEX.MODAL }}
          >
            <div className={`animate-spin rounded-full h-12 w-12 border-2 border-t-transparent ${isDarkMode ? 'border-blue-500' : 'border-blue-600'
              }`}></div>
          </div>
        }>
          <FabricForm
            fabric={editingFabric}
            onClose={handleFabricFormClose}
            onSave={handleFabricSaved}
            isDarkMode={isDarkMode}
          />
        </Suspense>
      )}
    </div>
  );
}