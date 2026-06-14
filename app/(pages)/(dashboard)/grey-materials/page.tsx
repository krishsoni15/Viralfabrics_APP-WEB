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
import { GreyMaterial, GreyMaterialFilters } from '@/types/greyMaterial';

// Development-only logging utility
const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args: any[]): void => { if (isDev) console.log(...args); };
const devError = (...args: any[]): void => { if (isDev) console.error(...args); };

// Helper function to check if an ID is a temporary ID
const isTemporaryId = (id: string | undefined | null): boolean => {
  if (!id) return false;
  const idStr = String(id);
  return idStr.startsWith('temp-') || idStr.includes('temp-') || idStr.startsWith('temp_') || idStr.includes('temp_');
};

// Helper function to check if a greyMaterial is temporary/optimistic
const isTemporaryGreyMaterial = (greyMaterial: GreyMaterial | any): boolean => {
  if (!greyMaterial) return false;
  const id = String(greyMaterial._id || '');
  return isTemporaryId(id) ||
    (greyMaterial as any)._isOptimistic === true ||
    (greyMaterial as any).clientTempId !== undefined;
};

import GreyMaterialDetails from './components/GreyMaterialDetails';
import DeleteConfirmation from './components/DeleteConfirmation';
import { Z_INDEX } from './constants';
import ToastNotification, { useToast } from '../components/ToastNotification';
import { generateGreyMaterialStickerPDF, downloadGreyMaterialStickerPDFDirect } from '@/lib/pdfGenerator';
import GreyMaterialsPageSkeleton from './components/GreyMaterialsPageSkeleton';
import { lazy, Suspense } from 'react';

// Lazy load GreyMaterialForm for better performance
const GreyMaterialForm = lazy(() => import('./components/GreyMaterialForm'));
import { TIMEOUTS, PAGINATION } from './constants';

export default function GreyMaterialsPage() {
  const { isDarkMode, mounted } = useDarkMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isUser, isMaster, user } = useSession();

  // useTransition for non-urgent updates (search, filters) - matches sampling page pattern
  const [isPending, startTransition] = useTransition();

  const [greyMaterials, setGreyMaterials] = useState<GreyMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedGreyMaterial, setSelectedGreyMaterial] = useState<GreyMaterial | null>(null);
  const [selectedGreyMaterialGroup, setSelectedGreyMaterialGroup] = useState<GreyMaterial[]>([]);
  const [deletingGreyMaterial, setDeletingGreyMaterial] = useState<GreyMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDependencies, setDeleteDependencies] = useState<string[]>([]);
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [bulkDeleteGroup, setBulkDeleteGroup] = useState<{ qualityCode: string; qualityName: string; items: GreyMaterial[] } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [fadeOutRows, setFadeOutRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<GreyMaterialFilters>({
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
      const savedItemsPerPage = localStorage.getItem('greyMaterialsItemsPerPage');
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
      const savedViewMode = localStorage.getItem('greyMaterialsViewMode');
      return savedViewMode === 'table' ? 'table' : 'cards';
    }
    return 'cards';
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [selectedGreyMaterials, setSelectedGreyMaterials] = useState<Set<string>>(new Set());
  const [bulkActions, setBulkActions] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'popular' | 'trending'>('all');
  const [showIndividualGreyMaterials, setShowIndividualGreyMaterials] = useState(false);

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
  // ⚡ FIX: Track updated greyMaterial IDs to prevent them from being overwritten
  const updatedGreyMaterialIdsRef = useRef<Set<string>>(new Set());
  // Track recently updated/created greyMaterials to preserve them during GET calls
  const recentlyUpdatedGreyMaterialsRef = useRef<Map<string, GreyMaterial>>(new Map());
  // ⚡ FIX: Track if page is mounted to prevent unnecessary refreshes
  const isMountedRef = useRef<boolean>(false);
  // ⚡ FIX: Track last route to detect navigation changes
  const lastRouteRef = useRef<string>('');
  // ⚡ FIX: Track permanently deleted greyMaterial IDs to prevent them from reappearing
  const deletedGreyMaterialIdsRef = useRef<Set<string>>(new Set());
  // Debounce search input to avoid rapid network calls
  const searchDebounceRef = useRef<any>(null);
  // Skip first render for search effect (initial fetch already runs)
  const hasInitializedSearchRef = useRef<boolean>(false);
  // Track active greyMaterials fetch to cancel stale requests
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
      sessionStorage.removeItem('createdGreyMaterialData');
      sessionStorage.removeItem('editedGreyMaterialData');
      sessionStorage.removeItem('greyMaterialsPageShouldRefresh');
      sessionStorage.removeItem('greyMaterialsPageRefreshTime');
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

  // Redirect users (non-superadmin) away from greyMaterials page
  useEffect(() => {
    if (isUser) {
      router.push('/access-denied');
    }
  }, [isUser, router]);

  // Auto-switch view mode based on screen size (only if no saved preference exists)
  useEffect(() => {
    const handleResize = () => {
      // Check if user has a saved preference - if yes, respect it and don't auto-switch
      const savedViewMode = localStorage.getItem('greyMaterialsViewMode');
      if (savedViewMode === 'table' || savedViewMode === 'cards') {
        // User has a saved preference, don't auto-switch
        return;
      }

      // Only auto-switch if no saved preference exists
      if (window.innerWidth < 800 && viewMode === 'table') {
        setViewMode('cards');
        localStorage.setItem('greyMaterialsViewMode', 'cards');
      } else if (window.innerWidth >= 800 && viewMode === 'cards') {
        setViewMode('table');
        localStorage.setItem('greyMaterialsViewMode', 'table');
      }
    };

    // Only run auto-switch on mount if no saved preference exists
    const savedViewMode = localStorage.getItem('greyMaterialsViewMode');
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
    localStorage.setItem('greyMaterialsViewMode', newMode);
    // Store timestamp of manual change
    localStorage.setItem('lastViewModeChange', Date.now().toString());
  };

  // Handle image navigation in cards
  const handleCardImageNavigation = (qualityCode: string, direction: 'prev' | 'next') => {
    setCardImageIndices(prev => {
      const currentIndex = prev[qualityCode] || 0;
      const greyMaterial = greyMaterials.find(f => f.qualityCode === qualityCode);
      if (!greyMaterial || !greyMaterial.images || greyMaterial.images.length === 0) return prev;

      let newIndex;
      if (direction === 'prev') {
        newIndex = currentIndex === 0 ? greyMaterial.images.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex === greyMaterial.images.length - 1 ? 0 : currentIndex + 1;
      }

      return { ...prev, [qualityCode]: newIndex };
    });
  };

  const getCurrentCardImage = (greyMaterial: GreyMaterial, qualityCode: string) => {
    if (!greyMaterial.images) return null;
    const validImages = greyMaterial.images.filter(img => img && img.trim() !== '');
    if (validImages.length === 0) return null;
    const currentIndex = cardImageIndices[qualityCode] || 0;
    return validImages[currentIndex % validImages.length] || validImages[0];
  };

  // Enhanced image and selection states
  const [showImageModal, setShowImageModal] = useState<{ greyMaterial: GreyMaterial; imageIndex: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isImageLoading, setIsImageLoading] = useState<{ [key: string]: boolean }>({});
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [lastSelectedGreyMaterial, setLastSelectedGreyMaterial] = useState<string | null>(null);
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(null);
  const [currentStickerGreyMaterial, setCurrentStickerGreyMaterial] = useState<GreyMaterial | null>(null);
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
  const [showGreyMaterialForm, setShowGreyMaterialForm] = useState(false);
  const [editingGreyMaterial, setEditingGreyMaterial] = useState<GreyMaterial | null>(null);
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

  // Helper function to sort greyMaterials based on sort criteria
  const sortGreyMaterials = (greyMaterials: GreyMaterial[], sortBy: string, sortOrder: string) => {
    return [...greyMaterials].sort((a, b) => {
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
        case 'piece':
          aValue = a.piece || 0;
          bValue = b.piece || 0;
          break;
        case 'meter':
          aValue = a.meter || 0;
          bValue = b.meter || 0;
          break;
        case 'challanNumber':
          aValue = a.challanNumber || '';
          bValue = b.challanNumber || '';
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
  const clearAllGreyMaterialCaches = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Clear sessionStorage flags only
    sessionStorage.removeItem('greyMaterialsPageShouldRefresh');
    sessionStorage.removeItem('greyMaterialsPageRefreshTime');
    sessionStorage.removeItem('createdGreyMaterialData');
    sessionStorage.removeItem('editedGreyMaterialData');

    devLog('✅ Session storage flags cleared');
  }, []);

  // Fetch greyMaterials with proper cache handling
  const fetchGreyMaterials = async (forceRefresh = false, page = currentPage, limit = itemsPerPage, retryCount = 0, showLoading = true) => {
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
      // Abort any in-flight greyMaterials request before starting a new one
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
      const response = await fetch(`/api/grey-materials?${params}`, {
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

        // Update greyMaterials state immediately
        let greyMaterialsToSet = data.data;

        // ⚡ FIX: Filter out temporary/optimistic greyMaterials from API response
        // These should never come from the API, but filter just in case
        if (Array.isArray(greyMaterialsToSet)) {
          greyMaterialsToSet = greyMaterialsToSet.filter((f: GreyMaterial | any) => !isTemporaryGreyMaterial(f));
        }

        // Track that we received data (even if empty, we've fetched)
        // This prevents "no data" message from showing during refresh
        if (Array.isArray(greyMaterialsToSet)) {
          setFetchedDataOnce(true);
        }

        // ⚡ FIX: Merge with created greyMaterials from sessionStorage if they exist
        // This ensures newly created greyMaterials are included even if they're not in the API response yet
        const createdGreyMaterialData = sessionStorage.getItem('createdGreyMaterialData');
        if (createdGreyMaterialData && page === 1) {
          try {
            const createdGreyMaterials = JSON.parse(createdGreyMaterialData);
            if (Array.isArray(createdGreyMaterials) && createdGreyMaterials.length > 0) {
              devLog('🔄 Merging', createdGreyMaterials.length, 'created greyMaterials with fetched data...');
              // Create a map of fetched greyMaterials by _id
              const greyMaterialMap = new Map(data.data.map((f: GreyMaterial) => [String(f._id), f]));

              // Add created greyMaterials that aren't already in the fetched data
              createdGreyMaterials.forEach((createdGreyMaterial: GreyMaterial) => {
                if (createdGreyMaterial._id && !greyMaterialMap.has(String(createdGreyMaterial._id))) {
                  greyMaterialMap.set(String(createdGreyMaterial._id), createdGreyMaterial);
                }
              });

              // Convert back to array and sort
              greyMaterialsToSet = Array.from(greyMaterialMap.values() as Iterable<GreyMaterial>).sort((a, b) => {
                const aDate = new Date(a.createdAt || 0);
                const bDate = new Date(b.createdAt || 0);
                return aDate.getTime() - bDate.getTime();
              });

              devLog('✅ Merged created greyMaterials:', greyMaterialsToSet.length, 'total');
            }
          } catch (error) {
            devError('Error merging created greyMaterials:', error);
          }
        }

        // ⚡ FIX: Also merge edited greyMaterials from sessionStorage
        // Always check sessionStorage again here in case it was set after fetch started
        const currentEditedGreyMaterialData = sessionStorage.getItem('editedGreyMaterialData');
        if (currentEditedGreyMaterialData) {
          try {
            const parsedData = JSON.parse(currentEditedGreyMaterialData);
            const updatedGreyMaterialsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
            if (updatedGreyMaterialsArray.length > 0) {
              devLog('🔄 Merging', updatedGreyMaterialsArray.length, 'edited greyMaterial(s) with fetched data...');
              // Create a map of fetched greyMaterials by _id
              const greyMaterialMap = new Map(greyMaterialsToSet.map((f: GreyMaterial) => [String(f._id), f]));

              // Update or add each edited greyMaterial
              updatedGreyMaterialsArray.forEach(updatedGreyMaterial => {
                if (updatedGreyMaterial && updatedGreyMaterial._id) {
                  const greyMaterialId = String(updatedGreyMaterial._id);
                  // Track this greyMaterial ID as updated
                  updatedGreyMaterialIdsRef.current.add(greyMaterialId);
                  // Always use the edited greyMaterial data (it's more recent)
                  greyMaterialMap.set(greyMaterialId, {
                    ...updatedGreyMaterial,
                    updatedAt: updatedGreyMaterial.updatedAt || new Date().toISOString()
                  });
                  devLog('✅ Updated greyMaterial in map:', greyMaterialId);
                }
              });

              // Convert back to array and sort
              greyMaterialsToSet = Array.from(greyMaterialMap.values() as Iterable<GreyMaterial>).sort((a, b) => {
                const aDate = new Date(a.createdAt || 0);
                const bDate = new Date(b.createdAt || 0);
                return aDate.getTime() - bDate.getTime();
              });

              devLog('✅ Merged edited greyMaterials:', greyMaterialsToSet.length, 'total');
            }
          } catch (error) {
            devError('Error merging edited greyMaterials:', error);
          }
        }

        // ⚡ CRITICAL: Use setGreyMaterials with a function to ensure updated/created greyMaterials are preserved
        // This ensures newly created/updated greyMaterials are always shown, even if API hasn't indexed them yet
        // ⚡ FIX: Check if filters are active - if yes, show empty state when no results (don't preserve old data)
        setGreyMaterials(prevGreyMaterials => {
          // Check if any filters are active
          const hasActiveFilters = typeFilter || filters.search || filters.weaver || filters.weaverQualityName ||
            filters.qualityCode || filters.qualityName;

          // If API returned empty data and we have existing greyMaterials:
          // - If filters are active: show empty state (don't preserve old data - user is filtering)
          // - If no filters and not forceRefresh: preserve existing data (might be temporary API issue)
          if ((!greyMaterialsToSet || greyMaterialsToSet.length === 0) && prevGreyMaterials.length > 0 && !forceRefresh && !hasActiveFilters) {
            devLog('⚠️ API returned empty data, preserving existing greyMaterials (no active filters):', prevGreyMaterials.length);
            return prevGreyMaterials; // Don't overwrite with empty data only if no filters are active
          }

          // If filters are active and API returns empty, show empty state (clear old data)
          if (hasActiveFilters && (!greyMaterialsToSet || greyMaterialsToSet.length === 0)) {
            devLog('⚠️ Filter active but no results - showing empty state');
            return []; // Clear data to show "no results" message
          }

          // Check sessionStorage again to ensure we have the latest edited/created data
          const latestEditedData = sessionStorage.getItem('editedGreyMaterialData');
          const latestCreatedData = sessionStorage.getItem('createdGreyMaterialData');

          // Create a map starting with fetched data (or existing if API was empty)
          const greyMaterialMap = new Map((greyMaterialsToSet && greyMaterialsToSet.length > 0 ? greyMaterialsToSet : prevGreyMaterials).map((f: GreyMaterial) => [String(f._id), f]));

          // ⚡ CRITICAL: Merge edited greyMaterials (these take precedence over fetched data)
          if (latestEditedData) {
            try {
              const parsedData = JSON.parse(latestEditedData);
              const updatedGreyMaterialsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
              if (updatedGreyMaterialsArray.length > 0) {
                updatedGreyMaterialsArray.forEach(updatedGreyMaterial => {
                  if (updatedGreyMaterial && updatedGreyMaterial._id) {
                    const greyMaterialId = String(updatedGreyMaterial._id);
                    updatedGreyMaterialIdsRef.current.add(greyMaterialId);
                    // Always use the edited greyMaterial data (it's more recent and accurate)
                    greyMaterialMap.set(greyMaterialId, {
                      ...updatedGreyMaterial,
                      updatedAt: updatedGreyMaterial.updatedAt || new Date().toISOString()
                    });
                    devLog('✅ Merged edited greyMaterial into final state:', greyMaterialId);
                  }
                });
              }
            } catch (error) {
              devError('Error parsing latestEditedData in final merge:', error);
            }
          }

          // ⚡ CRITICAL: Merge created greyMaterials (add them if not already in fetched data)
          if (latestCreatedData && page === 1) {
            try {
              const createdGreyMaterials = JSON.parse(latestCreatedData);
              if (Array.isArray(createdGreyMaterials) && createdGreyMaterials.length > 0) {
                createdGreyMaterials.forEach((createdGreyMaterial: GreyMaterial) => {
                  if (createdGreyMaterial && createdGreyMaterial._id) {
                    const greyMaterialId = String(createdGreyMaterial._id);
                    // Only add if not already in the map (from API or edited data)
                    if (!greyMaterialMap.has(greyMaterialId)) {
                      greyMaterialMap.set(greyMaterialId, createdGreyMaterial);
                      devLog('✅ Merged created greyMaterial into final state:', greyMaterialId);
                    }
                  }
                });
              }
            } catch (error) {
              devError('Error parsing latestCreatedData in final merge:', error);
            }
          }

          // ⚡ FIX: Helper function to check if greyMaterial matches current search/filter criteria
          const greyMaterialMatchesSearch = (greyMaterial: GreyMaterial): boolean => {
            // If no search is active, include all greyMaterials
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
                    greyMaterial.qualityCode || '',
                    greyMaterial.qualityName || '',
                    greyMaterial.type || '',
                    greyMaterial.weaver || '',
                    greyMaterial.weaverQualityName || ''
                  ].join(' ').toLowerCase();
                  if (!allFields.includes(searchLower)) return false;
                  break;
                case 'qualityCode':
                  if (!(greyMaterial.qualityCode || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'qualityName':
                  if (!(greyMaterial.qualityName || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'type':
                  if (!(greyMaterial.type || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'weaver':
                  if (!(greyMaterial.weaver || '').toLowerCase().includes(searchLower)) return false;
                  break;
                case 'weaverQualityName':
                  if (!(greyMaterial.weaverQualityName || '').toLowerCase().includes(searchLower)) return false;
                  break;
              }
            }

            // Check type filter
            if (typeFilter && greyMaterial.type !== typeFilter) {
              return false;
            }

            // Check weaver filter
            if (filters.weaver && searchType !== 'weaver' && greyMaterial.weaver !== filters.weaver) {
              return false;
            }

            // Check weaverQualityName filter
            if (filters.weaverQualityName && searchType !== 'weaverQualityName' && greyMaterial.weaverQualityName !== filters.weaverQualityName) {
              return false;
            }

            return true;
          };

          // ⚡ CRITICAL: Preserve recently updated/created greyMaterials from previous state
          // BUT ONLY if they match the current search/filter criteria
          // This ensures they don't disappear when GET runs before database commit completes
          prevGreyMaterials.forEach((f: GreyMaterial) => {
            const greyMaterialId = String(f._id);
            // If greyMaterial was recently updated/created, preserve it even if not in API response
            // BUT ONLY if it matches current search criteria
            if (updatedGreyMaterialIdsRef.current.has(greyMaterialId) || recentlyUpdatedGreyMaterialsRef.current.has(greyMaterialId)) {
              if (!greyMaterialMap.has(greyMaterialId)) {
                // Use the recently updated version if available, otherwise use previous state
                const recentGreyMaterial = recentlyUpdatedGreyMaterialsRef.current.get(greyMaterialId) || f;
                // ⚡ FIX: Only preserve if it matches current search criteria
                if (greyMaterialMatchesSearch(recentGreyMaterial)) {
                  greyMaterialMap.set(greyMaterialId, recentGreyMaterial);
                  devLog('✅ Preserved recently updated greyMaterial (matches search):', greyMaterialId);
                } else {
                  devLog('⚠️ Skipped recently updated greyMaterial (does not match search):', greyMaterialId);
                }
              } else {
                // If in API response, use the recent version if it's newer
                const recentGreyMaterial = recentlyUpdatedGreyMaterialsRef.current.get(greyMaterialId);
                if (recentGreyMaterial) {
                  const apiGreyMaterial = greyMaterialMap.get(greyMaterialId) as GreyMaterial | undefined;
                  const recentDate = new Date(
                    (recentGreyMaterial as GreyMaterial)?.updatedAt || (recentGreyMaterial as GreyMaterial)?.createdAt || 0
                  );
                  const apiDate = new Date(apiGreyMaterial?.updatedAt || apiGreyMaterial?.createdAt || 0);
                  if (recentDate > apiDate) {
                    greyMaterialMap.set(greyMaterialId, recentGreyMaterial);
                    devLog('✅ Using recent version (newer):', greyMaterialId);
                  }
                }
              }
            }
          });

          // Also add any recently updated greyMaterials that might not be in prevGreyMaterials
          // BUT ONLY if they match current search criteria
          recentlyUpdatedGreyMaterialsRef.current.forEach((greyMaterial, greyMaterialId) => {
            if (!greyMaterialMap.has(greyMaterialId)) {
              // ⚡ FIX: Only add if it matches current search criteria
              if (greyMaterialMatchesSearch(greyMaterial)) {
                greyMaterialMap.set(greyMaterialId, greyMaterial);
                devLog('✅ Added recently updated greyMaterial from ref (matches search):', greyMaterialId);
              } else {
                devLog('⚠️ Skipped recently updated greyMaterial from ref (does not match search):', greyMaterialId);
              }
            }
          });

          // ⚡ FIX: Filter out deleted greyMaterial IDs and temporary greyMaterials to prevent them from reappearing
          const finalGreyMaterials = Array.from(greyMaterialMap.values() as Iterable<GreyMaterial>)
            .filter(f => {
              const id = String(f._id);
              // Remove deleted greyMaterials
              if (deletedGreyMaterialIdsRef.current.has(id)) return false;
              // Remove temporary/optimistic greyMaterials (they should be replaced by real ones)
              if (isTemporaryGreyMaterial(f)) return false;
              return true;
            })
            .sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });

          // NO CLEANUP: Keep recentlyUpdatedGreyMaterialsRef entries to avoid accidental removal
          // when backend commit/GET races happen.

          devLog('✅ Final greyMaterials state:', finalGreyMaterials.length, 'greyMaterials (filtered deleted)');
          return finalGreyMaterials;
        });
        setLastFetchTime(Date.now());
        setRetryCount(0);

        // NO CACHING - Always fetch fresh data from API

        // Notification is handled by refresh handlers to prevent duplicates
      } else {
        throw new Error(data.message || 'Failed to fetch greyMaterials');
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
        showToast('error', `Failed to load greyMaterials: ${error.message || 'Unknown error'}. Please try again.`, 5000);
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
      await fetchGreyMaterials(false, newPage, itemsPerPage, 0, false);
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
        localStorage.setItem('greyMaterialsItemsPerPage', newItemsPerPage.toString());
      }
      setCurrentPage(1); // Always reset to first page when changing items per page

      // Fetch first page with new items per page - force refresh to ensure fresh data
      await fetchGreyMaterials(false, 1, newItemsPerPage, 0, false);
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
      const response = await fetch('/api/grey-materials/quality-names?limit=100', { // Limit for faster loading
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
      const response = await fetch(`/api/grey-materials/weavers?${params}&limit=100`, {
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
      const response = await fetch(`/api/grey-materials/weaver-quality-names?${params}&limit=100`, {
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

      if (e.key === 'greyMaterialsPageShouldRefresh' && e.newValue === 'true' && !hasHandledRefresh) {
        hasHandledRefresh = true;
        // Immediately refresh when storage changes
        setLoading(true);
        // ⚡ NO TOAST - Only animation
        fetchGreyMaterials(true, currentPage, itemsPerPage, 0, true);
        sessionStorage.removeItem('greyMaterialsPageShouldRefresh');
        sessionStorage.removeItem('greyMaterialsPageRefreshTime');
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
    // window.addEventListener('greyMaterialsPageRefresh', handleCustomRefresh);

    // DISABLED: No polling for automatic refresh
    // const pollInterval = null; // DISABLED

    return () => {
      // DISABLED: No event listeners to clean up
      // window.removeEventListener('storage', handleStorageChange);
      // window.removeEventListener('greyMaterialsPageRefresh', handleCustomRefresh);
      // if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentPage, itemsPerPage]);

  // ⚡ DISABLED: This useEffect was causing infinite loops on AWS
  // The searchParams dependency was changing frequently, causing constant re-runs
  // Initial load is now handled by the mount effect only
  useEffect(() => {
    // ⚡ FIX: Only handle explicit refresh flags, don't auto-refresh on every searchParams change
    const shouldRefresh = sessionStorage.getItem('greyMaterialsPageShouldRefresh');
    const createdGreyMaterialData = sessionStorage.getItem('createdGreyMaterialData');
    const editedGreyMaterialData = sessionStorage.getItem('editedGreyMaterialData');

    // ⚡ FIX: Only proceed if we have explicit refresh flags AND haven't already handled them
    if (!shouldRefresh && !createdGreyMaterialData && !editedGreyMaterialData) {
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
      sessionStorage.removeItem('greyMaterialsPageShouldRefresh');
    }

    refreshingRef.current = true;
    lastRefreshTimeRef.current = now;

    // Only merge data, don't trigger full refresh
    if (createdGreyMaterialData || editedGreyMaterialData) {
      // Merge logic here if needed, but don't call fetchGreyMaterials
      devLog('⏸️ Refresh flags found but skipping auto-refresh to prevent loops');
    }

    refreshingRef.current = false;
    return; // Exit early, don't run the rest of the effect

    // OLD CODE BELOW - DISABLED TO PREVENT LOOPS
    /*
    const refreshTime = sessionStorage.getItem('greyMaterialsPageRefreshTime');
    // Use both searchParams (Next.js) and window.location (fallback)
    const forceRefresh = searchParams?.get('refresh') === 'true' || new URLSearchParams(window.location.search).get('refresh') === 'true';
    const created = searchParams?.get('created') === 'true' || new URLSearchParams(window.location.search).get('created') === 'true';
    const updated = searchParams?.get('updated') === 'true' || new URLSearchParams(window.location.search).get('updated') === 'true';
    
    // Determine if we need to refresh
    const needsRefresh = shouldRefresh === 'true' || forceRefresh || created || updated || greyMaterials.length === 0;
    
    // Always fetch fresh data when navigating back to the page (no cache on initial load)
    const isInitialLoad = greyMaterials.length === 0 && !loading;
    
    // Create a unique key for this refresh attempt to prevent duplicate handling
    // Use refreshTime if available, otherwise use a combination of flags
    const refreshKey = needsRefresh ? `${forceRefresh}-${created}-${updated}-${shouldRefresh}-${refreshTime || 'new'}` : '';
    
    // Skip if we've already handled this exact refresh AND we have data
    // But always allow refresh if we have refresh flags or query params
    if (refreshKey && refreshHandledRef.current === refreshKey && greyMaterials.length > 0) {
      // Don't show toast again if already handled
      return;
    }
    
    // ⚡ FIX: Don't show notification yet - wait for data to load first
    // Notification will be shown after fetchGreyMaterials completes successfully
    
    // ⚡ IMMEDIATE UPDATE: Update greyMaterial in state immediately if editedGreyMaterialData exists
    // ⚡ FIX: Check sessionStorage flag OR query param (works when navigating back)
    if (editedGreyMaterialData && (updated || shouldRefresh === 'true')) {
      try {
        const parsedData = JSON.parse(editedGreyMaterialData);
        // ⚡ FIX: Handle both single greyMaterial and array of greyMaterials
        const updatedGreyMaterialsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        devLog('⚡ IMMEDIATE UPDATE: Updating', updatedGreyMaterialsArray.length, 'greyMaterial(s) in state');
        
        setGreyMaterials(prevGreyMaterials => {
          // Create a map of existing greyMaterials by _id for quick lookup
          const greyMaterialMap = new Map(prevGreyMaterials.map(f => [String(f._id), f]));
          
          // Update or add each greyMaterial from the updated data
          updatedGreyMaterialsArray.forEach(updatedGreyMaterial => {
            if (updatedGreyMaterial && updatedGreyMaterial._id) {
              const greyMaterialId = String(updatedGreyMaterial._id);
              greyMaterialMap.set(greyMaterialId, {
                ...updatedGreyMaterial,
                updatedAt: updatedGreyMaterial.updatedAt || new Date().toISOString()
              });
            }
          });
          
          // Convert map back to array and sort (newest first)
          const allGreyMaterials = Array.from(greyMaterialMap.values());
          return allGreyMaterials.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime(); // Newest first
          });
        });
      } catch (error) {
        devError('Error parsing editedGreyMaterialData:', error);
      }
    }
    
    // ⚡ FIX: Handle created greyMaterials - add them to state immediately (OPTIMISTIC UPDATE)
    // ⚡ FIX: Check sessionStorage flag OR query param (works when navigating back)
    if (createdGreyMaterialData && (created || shouldRefresh === 'true')) {
      try {
        const createdGreyMaterials = JSON.parse(createdGreyMaterialData);
        devLog('⚡ IMMEDIATE UPDATE: Adding created greyMaterials to state:', createdGreyMaterials.length);
        if (Array.isArray(createdGreyMaterials) && createdGreyMaterials.length > 0) {
          // ⚡ FIX: Optimistic update - add immediately to UI
          setGreyMaterials(prevGreyMaterials => {
            // Add new greyMaterials to the beginning of the list
            const newGreyMaterials = [...createdGreyMaterials, ...prevGreyMaterials];
            
            // Remove duplicates based on _id
            const uniqueGreyMaterials = new Map();
            newGreyMaterials.forEach(greyMaterial => {
              if (greyMaterial._id && !uniqueGreyMaterials.has(greyMaterial._id)) {
                uniqueGreyMaterials.set(greyMaterial._id, greyMaterial);
              }
            });
            
            const uniqueGreyMaterialsArray = Array.from(uniqueGreyMaterials.values());
            
            // Sort by createdAt descending (newest first)
            return uniqueGreyMaterialsArray.sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });
          });
          
          // ⚡ FIX: Update pagination info immediately
          setPaginationInfo(prev => ({
            ...prev,
            totalCount: prev.totalCount + createdGreyMaterials.length
          }));
          
          devLog('✅ Optimistic update complete - greyMaterials added to UI immediately');
        }
      } catch (error) {
        devError('Error parsing createdGreyMaterialData:', error);
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
      // Always fetch fresh data when navigating back to ensure new greyMaterials are shown
      if (needsRefresh || (greyMaterials.length === 0 && !loading)) {
        // Mark refresh as in progress
        refreshingRef.current = true;
        lastRefreshTimeRef.current = now;
        
        // Mark this refresh as handled (only if we have a key)
        if (refreshKey) {
          refreshHandledRef.current = refreshKey;
        }
        
        // ⚡ CRITICAL: Clear refresh flags IMMEDIATELY before refresh to prevent loops
        if (shouldRefresh === 'true') {
          sessionStorage.removeItem('greyMaterialsPageShouldRefresh');
        }
        if (refreshTime) {
          sessionStorage.removeItem('greyMaterialsPageRefreshTime');
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
            await fetchGreyMaterials(true, pageToFetch, itemsPerPage, 0, true);
            fetchSuccess = true;
            devLog('✅ GreyMaterial data fetched successfully on attempt', retryCount + 1);
            
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
          devError('❌ Failed to fetch greyMaterial data after', maxRetries, 'attempts');
          showToast('error', 'Failed to refresh data. Please refresh the page manually.', 5000);
        }
        
        // ⚡ CRITICAL: Clean up sessionStorage and URL params AFTER fetch completes successfully
        // Only clean up if fetch was successful to prevent data loss
        if (fetchSuccess) {
          // Wait a bit more to ensure UI has fully updated with the new data
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // ⚡ CRITICAL: Clean up edited/created data after successful fetch
          // The data has been merged into state by fetchGreyMaterials, so it's safe to clean up
          // Use a small delay to ensure state has updated
          setTimeout(() => {
            if (editedGreyMaterialData) {
              sessionStorage.removeItem('editedGreyMaterialData');
              devLog('✅ Cleaned up editedGreyMaterialData after successful fetch');
            }
            
            if (createdGreyMaterialData) {
              sessionStorage.removeItem('createdGreyMaterialData');
              devLog('✅ Cleaned up createdGreyMaterialData after successful fetch');
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
    // ⚡ CRITICAL: Restore deleted greyMaterial IDs from sessionStorage on mount
    // This prevents deleted greyMaterials from reappearing after page refresh
    try {
      const storedDeletedIds = sessionStorage.getItem('deletedGreyMaterialIds');
      if (storedDeletedIds) {
        const deletedIdsArray = JSON.parse(storedDeletedIds);
        if (Array.isArray(deletedIdsArray)) {
          deletedGreyMaterialIdsRef.current = new Set(deletedIdsArray);
          devLog('✅ Restored', deletedIdsArray.length, 'deleted greyMaterial ID(s) from sessionStorage');
        }
      }
    } catch (e) {
      devError('Error restoring deleted greyMaterial IDs from sessionStorage:', e);
    }

    // ⚡ FIX: Check for refresh flags on mount - if they exist, force refresh
    const shouldRefresh = sessionStorage.getItem('greyMaterialsPageShouldRefresh');
    const createdGreyMaterialData = sessionStorage.getItem('createdGreyMaterialData');
    const editedGreyMaterialData = sessionStorage.getItem('editedGreyMaterialData');

    // ⚡ CRITICAL: Always merge created/edited greyMaterials immediately on mount if they exist
    // This ensures they show even before the API call completes
    if (createdGreyMaterialData) {
      try {
        const createdGreyMaterials = JSON.parse(createdGreyMaterialData);
        if (Array.isArray(createdGreyMaterials) && createdGreyMaterials.length > 0) {
          devLog('⚡ MOUNT: Adding', createdGreyMaterials.length, 'created greyMaterial(s) to state');
          setGreyMaterials(prevGreyMaterials => {
            const greyMaterialMap = new Map(prevGreyMaterials.map(f => [String(f._id), f]));
            createdGreyMaterials.forEach((greyMaterial: GreyMaterial) => {
              if (greyMaterial._id) {
                greyMaterialMap.set(String(greyMaterial._id), greyMaterial);
              }
            });
            return Array.from(greyMaterialMap.values()).sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });
          });
        }
      } catch (error) {
        devError('Error parsing createdGreyMaterialData on mount:', error);
      }
    }

    if (editedGreyMaterialData) {
      try {
        const parsedData = JSON.parse(editedGreyMaterialData);
        const updatedGreyMaterialsArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        if (updatedGreyMaterialsArray.length > 0) {
          devLog('⚡ MOUNT: Updating', updatedGreyMaterialsArray.length, 'greyMaterial(s) in state');
          setGreyMaterials(prevGreyMaterials => {
            const greyMaterialMap = new Map(prevGreyMaterials.map(f => [String(f._id), f]));
            updatedGreyMaterialsArray.forEach((greyMaterial: GreyMaterial) => {
              if (greyMaterial._id) {
                greyMaterialMap.set(String(greyMaterial._id), greyMaterial);
              }
            });
            return Array.from(greyMaterialMap.values()).sort((a, b) => {
              const aDate = new Date(a.createdAt || 0);
              const bDate = new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime(); // Newest first
            });
          });
        }
      } catch (error) {
        devError('Error parsing editedGreyMaterialData on mount:', error);
      }
    }

    // ⚡ FIX: Clean up temporary greyMaterials on mount/refresh
    setGreyMaterials(prev => {
      const cleaned = prev.filter(f => !isTemporaryGreyMaterial(f));
      if (cleaned.length !== prev.length) {
        devLog('🧹 Cleaned up', prev.length - cleaned.length, 'temporary greyMaterial(s) on mount');
      }
      return cleaned;
    });

    // ⚡ RESTORE: Load recently updated greyMaterials from sessionStorage to survive refresh
    // ⚡ CRITICAL: Do this BEFORE fetchGreyMaterials so data is preserved
    // ⚡ FIX: Filter out temporary greyMaterials from sessionStorage restore
    try {
      const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
      if (stored) {
        const storedEntries = JSON.parse(stored);
        const restoredMap = new Map<string, GreyMaterial>();
        storedEntries.forEach(([id, greyMaterial]: [string, GreyMaterial]) => {
          if (id && greyMaterial && greyMaterial._id && !isTemporaryGreyMaterial(greyMaterial)) {
            restoredMap.set(String(id), greyMaterial);
            updatedGreyMaterialIdsRef.current.add(String(id));
          }
        });
        if (restoredMap.size > 0) {
          recentlyUpdatedGreyMaterialsRef.current = restoredMap;
          devLog('✅ Restored', restoredMap.size, 'recently updated greyMaterial(s) from sessionStorage');

          // ⚡ CRITICAL: Also restore to state immediately so they show up right away
          setGreyMaterials(prev => {
            const greyMaterialMap = new Map(prev.map(f => [String(f._id), f]));
            restoredMap.forEach((greyMaterial, greyMaterialId) => {
              greyMaterialMap.set(greyMaterialId, greyMaterial);
            });
            return Array.from(greyMaterialMap.values())
              .filter(f => !isTemporaryGreyMaterial(f)) // Filter out any temporary greyMaterials
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

    // ⚡ CRITICAL: Always fetch fresh data on initial mount to ensure new greyMaterials are shown
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
    // Also clear greyMaterials array to prevent showing old data during refresh
    setGreyMaterials([]);
    setLoading(true);
    setInitialLoading(true);
    setInitialFetchDone(false);
    setFetchedDataOnce(false); // Reset fetchedDataOnce on refresh to prevent "no data" flash

    // NO CACHING - Always fetch fresh data from API

    // Always fetch from page 1 on mount to ensure we see new items
    fetchGreyMaterials(true, 1, itemsPerPage, 0, true)
      .then(() => {
        hasInitialFetchRef.current = true; // Mark as fetched after completion
        filtersInitializedRef.current = true; // Allow filters effect to run now
        // initialFetchDone is set in fetchGreyMaterials finally block for initial fetch
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

    // ⚡ FIX: Only run if we're actually on the greyMaterials page
    if (currentPath !== '/greyMaterials') {
      // Update route ref even if not on greyMaterials page to track navigation
      if (lastRouteRef.current === '/greyMaterials') {
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
        fetchGreyMaterials(true, currentPage, itemsPerPage, 0, true);
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
        } else if (showGreyMaterialForm) {
          setShowGreyMaterialForm(false);
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
    showGreyMaterialForm,
    fetchGreyMaterials
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
        fetchGreyMaterials(false, 1, itemsPerPage, 0, false)
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
            devError('Error searching greyMaterials:', error);
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
    setGreyMaterials([]);
    setLoading(true);

    // Debounce the fetch to avoid too many API calls
    const timeoutId = setTimeout(() => {
      fetchGreyMaterials(false, 1, itemsPerPage, 0, true); // Set showLoading to true to show loading state
    }, 300);
    return () => clearTimeout(timeoutId);
    // Note: fetchGreyMaterials is intentionally not in deps - it uses typeFilter from closure
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
    setGreyMaterials([]);
    setLoading(true);

    const timeoutId = setTimeout(() => {
      fetchGreyMaterials(false, 1, itemsPerPage, 0, true); // Set showLoading to true
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
    setGreyMaterials([]);
    setLoading(true);

    const timeoutId = setTimeout(() => {
      fetchGreyMaterials(false, 1, itemsPerPage, 0, true); // Set showLoading to true
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
    setEditingGreyMaterial(null);
    setShowGreyMaterialForm(true);
  };

  const handleEdit = (greyMaterial: GreyMaterial) => {
    // ⚡ MULTI-WEAVER EDIT: Check if multiple weavers from same quality code are selected
    const qualityCode = greyMaterial.qualityCode;
    const selectedInSameGroup = greyMaterials.filter(f =>
      selectedGreyMaterials.has(String(f._id)) && f.qualityCode === qualityCode
    );

    // If 2+ weavers from same group are selected, edit all selected ones
    // Otherwise, edit all weavers with same quality code (default behavior)
    if (selectedInSameGroup.length >= 2) {
      // Store selected greyMaterial IDs in greyMaterial object for form to use
      const greyMaterialWithSelection = {
        ...selectedInSameGroup[0],
        weaversList: selectedInSameGroup,
        _selectedWeaverIds: selectedInSameGroup.map(f => String(f._id))
      } as GreyMaterial & { weaversList?: GreyMaterial[]; _selectedWeaverIds?: string[] };
      setEditingGreyMaterial(greyMaterialWithSelection);
      setShowGreyMaterialForm(true);
    } else {
      // Single greyMaterial edit - find all weavers with same quality code in currently loaded list
      const allWeaversInGroup = greyMaterials.filter(f => f.qualityCode === qualityCode);
      const greyMaterialWithWeaversList = {
        ...greyMaterial,
        weaversList: allWeaversInGroup
      } as GreyMaterial & { weaversList?: GreyMaterial[] };
      setEditingGreyMaterial(greyMaterialWithWeaversList);
      setShowGreyMaterialForm(true);
    }
  };

  const handleGreyMaterialFormClose = () => {
    setShowGreyMaterialForm(false);
    setEditingGreyMaterial(null);
    // ⚡ FIX: Clear any edit parameter from URL when closing form
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('edit')) {
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  const handleGreyMaterialSaved = (wasEdit: boolean, greyMaterialData?: GreyMaterial | GreyMaterial[]) => {
    devLog('🔄 handleGreyMaterialSaved called:', { wasEdit, greyMaterialDataCount: Array.isArray(greyMaterialData) ? greyMaterialData.length : (greyMaterialData ? 1 : 0) });

    // Grab original quality code before resetting editingGreyMaterial
    const originalQualityCode = editingGreyMaterial?.qualityCode;

    // Close form immediately
    setShowGreyMaterialForm(false);
    setEditingGreyMaterial(null);

    // ✨ OPTIMISTIC UPDATE: UI first, API already called in background by form
    if (greyMaterialData) {
      // Handle both single greyMaterial and array of greyMaterials
      const greyMaterialsArray = Array.isArray(greyMaterialData) ? greyMaterialData : [greyMaterialData];
      devLog('✅ Updating UI with', greyMaterialsArray.length, 'greyMaterial(s)');
      const updatedIds = new Set<string>();
      const newGreyMaterials: GreyMaterial[] = [];

      // ⚡ OPTIMISTIC: Extract weavers and weaverQualityNames immediately (works for both optimistic and real greyMaterials)
      const newWeavers = new Set<string>();
      const newWeaverQualityNames = new Set<string>();
      greyMaterialsArray.forEach(greyMaterial => {
        if (greyMaterial.weaver?.trim()) {
          newWeavers.add(greyMaterial.weaver.trim());
        }
        if (greyMaterial.weaverQualityName?.trim()) {
          newWeaverQualityNames.add(greyMaterial.weaverQualityName.trim());
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
        // Update existing greyMaterials in list immediately
        setGreyMaterials(prev => {
          // ⚡ FIX: Create map by ID and also by weaver+qualityName to prevent duplicates
          const greyMaterialMapById = new Map(prev.map(f => [String(f._id), f]));
          const greyMaterialMapByWeaver = new Map<string, GreyMaterial>();

          // Get qualityCode from updated greyMaterials to identify which group was edited
          const updatedQualityCode = greyMaterialsArray.length > 0 ? greyMaterialsArray[0]?.qualityCode : null;
          const updatedGreyMaterialIds = new Set(greyMaterialsArray.map(f => f._id ? String(f._id) : '').filter(Boolean));

          const qualityCodesToCheck = new Set<string>();
          if (updatedQualityCode) qualityCodesToCheck.add(updatedQualityCode);
          if (originalQualityCode) qualityCodesToCheck.add(originalQualityCode);

          // ⚡ CRITICAL: Remove all greyMaterials with same qualityCode that are NOT in the updated response
          // This ensures deleted weavers are removed from UI and all caches
          if (qualityCodesToCheck.size > 0) {
            prev.forEach(f => {
              if (qualityCodesToCheck.has(f.qualityCode)) {
                const greyMaterialId = String(f._id);
                // If this greyMaterial has the same qualityCode but is NOT in the updated response, it was deleted
                if (!updatedGreyMaterialIds.has(greyMaterialId)) {
                  greyMaterialMapById.delete(greyMaterialId);
                  deletedGreyMaterialIdsRef.current.add(greyMaterialId);

                  // Clean up from recently updated cache to prevent resurrection
                  recentlyUpdatedGreyMaterialsRef.current.delete(greyMaterialId);
                  try {
                    const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
                    if (stored) {
                      const storedMap = new Map(JSON.parse(stored));
                      storedMap.delete(greyMaterialId);
                      sessionStorage.setItem('recentlyUpdatedGreyMaterials', JSON.stringify(Array.from(storedMap.entries())));
                    }
                  } catch (e) {
                    devError('Error updating recentlyUpdatedGreyMaterials in sessionStorage:', e);
                  }

                  devLog('🗑️ Removing deleted greyMaterial from UI and caches:', greyMaterialId, 'qualityCode:', f.qualityCode);
                }
              }
            });

            // Persist deleted IDs to sessionStorage
            try {
              const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
              sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
            } catch (e) {
              devError('Error saving deleted greyMaterial IDs to sessionStorage:', e);
            }
          } else if (greyMaterialsArray.length === 0 && prev.length > 0) {
            // ⚡ FIX: If empty array passed and we have previous greyMaterials, it means all weavers were deleted
            // Find qualityCode from recently updated greyMaterials or from prev greyMaterials
            // This handles the case where all weavers were deleted for a quality code
            const recentlyUpdatedIds = Array.from(recentlyUpdatedGreyMaterialsRef.current.keys());
            const recentlyUpdatedGreyMaterial = recentlyUpdatedIds.length > 0
              ? recentlyUpdatedGreyMaterialsRef.current.get(recentlyUpdatedIds[0])
              : null;

            const qualityCodeToCheck = recentlyUpdatedGreyMaterial?.qualityCode || prev[0]?.qualityCode;

            if (qualityCodeToCheck) {
              // Remove all greyMaterials with this qualityCode since all were deleted
              prev.forEach(f => {
                if (f.qualityCode === qualityCodeToCheck) {
                  const greyMaterialId = String(f._id);
                  greyMaterialMapById.delete(greyMaterialId);
                  deletedGreyMaterialIdsRef.current.add(greyMaterialId);

                  // Clean up from recently updated cache to prevent resurrection
                  recentlyUpdatedGreyMaterialsRef.current.delete(greyMaterialId);
                  try {
                    const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
                    if (stored) {
                      const storedMap = new Map(JSON.parse(stored));
                      storedMap.delete(greyMaterialId);
                      sessionStorage.setItem('recentlyUpdatedGreyMaterials', JSON.stringify(Array.from(storedMap.entries())));
                    }
                  } catch (e) {
                    devError('Error updating recentlyUpdatedGreyMaterials in sessionStorage:', e);
                  }

                  devLog('🗑️ Removing all greyMaterials with qualityCode (all deleted):', qualityCodeToCheck, 'greyMaterialId:', greyMaterialId);
                }
              });

              // Persist to sessionStorage
              try {
                const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
                sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
              } catch (e) {
                devError('Error saving deleted greyMaterial IDs to sessionStorage:', e);
              }
            }
          }

          // Build map by weaver+qualityName to find duplicates
          Array.from(greyMaterialMapById.values()).forEach(f => {
            const key = `${f.qualityCode || ''}-${f.weaver || ''}-${f.weaverQualityName || ''}`;
            if (key && !greyMaterialMapByWeaver.has(key)) {
              greyMaterialMapByWeaver.set(key, f);
            }
          });

          // Update or add each greyMaterial from the updated data
          greyMaterialsArray.forEach(updatedGreyMaterial => {
            if (updatedGreyMaterial && updatedGreyMaterial._id) {
              const greyMaterialId = String(updatedGreyMaterial._id);
              const weaverKey = `${updatedGreyMaterial.qualityCode || ''}-${updatedGreyMaterial.weaver || ''}-${updatedGreyMaterial.weaverQualityName || ''}`;

              // ⚡ CRITICAL: Check if a greyMaterial with same weaver+qualityName already exists (might have temp ID)
              const existingByWeaver = greyMaterialMapByWeaver.get(weaverKey);

              // If we found a greyMaterial with same weaver+qualityName but different ID, remove the old one
              if (existingByWeaver && String(existingByWeaver._id) !== greyMaterialId) {
                const oldId = String(existingByWeaver._id);
                greyMaterialMapById.delete(oldId);
                devLog('🔄 Replacing temp greyMaterial with real ID:', oldId, '->', greyMaterialId);
              }

              // Merge with existing greyMaterial to preserve all fields
              const existingGreyMaterial = greyMaterialMapById.get(greyMaterialId);
              const mergedGreyMaterial = existingGreyMaterial
                ? { ...existingGreyMaterial, ...updatedGreyMaterial, updatedAt: updatedGreyMaterial.updatedAt || new Date().toISOString() }
                : { ...updatedGreyMaterial, updatedAt: updatedGreyMaterial.updatedAt || new Date().toISOString() };

              greyMaterialMapById.set(greyMaterialId, mergedGreyMaterial);
              greyMaterialMapByWeaver.set(weaverKey, mergedGreyMaterial);
              updatedIds.add(greyMaterialId);

              // ⚡ CRITICAL: Store in ref to preserve during GET calls
              recentlyUpdatedGreyMaterialsRef.current.set(greyMaterialId, mergedGreyMaterial);
              updatedGreyMaterialIdsRef.current.add(greyMaterialId);
              // ⚡ PERSIST: Also store in sessionStorage to survive page refresh
              try {
                const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
                const storedMap = stored ? new Map(JSON.parse(stored)) : new Map();
                storedMap.set(greyMaterialId, mergedGreyMaterial);
                sessionStorage.setItem('recentlyUpdatedGreyMaterials', JSON.stringify(Array.from(storedMap.entries())));
              } catch (e) {
                devError('Error storing to sessionStorage:', e);
              }
            }
          });

          // ⚡ FIX: Remove duplicates by weaver+qualityName (keep the one with real ID, not temp ID)
          const finalGreyMaterials: GreyMaterial[] = [];
          const seenWeavers = new Set<string>();

          Array.from(greyMaterialMapById.values()).forEach(greyMaterial => {
            const weaverKey = `${greyMaterial.qualityCode || ''}-${greyMaterial.weaver || ''}-${greyMaterial.weaverQualityName || ''}`;
            const isTempId = isTemporaryId(String(greyMaterial._id));

            // If we've seen this weaver+qualityName before, only keep the one with real ID
            if (seenWeavers.has(weaverKey)) {
              const existingIndex = finalGreyMaterials.findIndex(f =>
                `${f.qualityCode || ''}-${f.weaver || ''}-${f.weaverQualityName || ''}` === weaverKey
              );
              if (existingIndex >= 0) {
                const existing = finalGreyMaterials[existingIndex];
                const existingIsTemp = isTemporaryId(String(existing._id));
                // Replace temp ID with real ID, or keep existing if both are real (shouldn't happen)
                if (isTempId && !existingIsTemp) {
                  // Skip this one (temp), keep existing (real)
                  return;
                } else if (!isTempId && existingIsTemp) {
                  // Replace existing (temp) with this one (real)
                  finalGreyMaterials[existingIndex] = greyMaterial;
                  return;
                }
              }
            } else {
              seenWeavers.add(weaverKey);
              finalGreyMaterials.push(greyMaterial);
            }
          });

          // Sort by createdAt descending (newest first)
          return finalGreyMaterials.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime();
          });
        });

        // ⚡ SMOOTH GLOW: One animation for all updated greyMaterials (1.5s smooth fade)
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

        devLog('✅ Optimistic update complete for', updatedIds.size, 'greyMaterial(s)');

        // ⚡ NO GET API CALL - UI already updated with POST response data
        // No need to verify or refresh - data is already in state

      } else {
        // Add new greyMaterials to list immediately (at top)
        // ⚡ IMMEDIATE UI UPDATE: Show greyMaterials right away (optimistic or real)
        const newGreyMaterialsMap = new Map<string, GreyMaterial>();
        const tempIdToRealIdMap = new Map<string, string>(); // Track temp ID -> real ID mapping

        greyMaterialsArray.forEach(greyMaterial => {
          if (greyMaterial && greyMaterial._id) {
            const greyMaterialId = String(greyMaterial._id);
            const tempId = (greyMaterial as any).clientTempId;

            // If this is a real greyMaterial replacing a temp one, track the mapping
            if (tempId && !isTemporaryId(greyMaterialId)) {
              tempIdToRealIdMap.set(String(tempId), greyMaterialId);
            }

            // ⚡ FIX: Add ALL greyMaterials (including optimistic ones) to show immediately
            if (!newGreyMaterialsMap.has(greyMaterialId)) {
              newGreyMaterialsMap.set(greyMaterialId, greyMaterial);
              updatedIds.add(greyMaterialId);

              // Only store real greyMaterials in refs (not temporary ones)
              if (!isTemporaryGreyMaterial(greyMaterial)) {
                recentlyUpdatedGreyMaterialsRef.current.set(greyMaterialId, greyMaterial);
                updatedGreyMaterialIdsRef.current.add(greyMaterialId);
                // ⚡ PERSIST: Also store in sessionStorage to survive page refresh
                try {
                  const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
                  const storedMap = stored ? new Map(JSON.parse(stored)) : new Map();
                  storedMap.set(greyMaterialId, greyMaterial);
                  sessionStorage.setItem('recentlyUpdatedGreyMaterials', JSON.stringify(Array.from(storedMap.entries())));
                } catch (e) {
                  devError('Error storing to sessionStorage:', e);
                }
              }
            }
          }
        });

        const uniqueNewGreyMaterials = Array.from(newGreyMaterialsMap.values());

        setGreyMaterials(prev => {
          // ⚡ IMMEDIATE UPDATE: Add new greyMaterials at the top, remove old temp ones being replaced
          const existingMap = new Map(prev.map(f => [String(f._id), f]));

          // Remove old temporary greyMaterials that are being replaced by real ones
          const tempIdsToRemove = new Set<string>();
          tempIdToRealIdMap.forEach((realId, tempId) => {
            tempIdsToRemove.add(tempId);
          });

          // Filter out old temp entries being replaced, but keep other existing greyMaterials
          const filteredPrev = prev.filter(f => {
            const tempId = (f as any).clientTempId || String(f._id);
            const greyMaterialId = String(f._id);

            // Remove if it's a temp entry being replaced by a real one
            if (tempIdsToRemove.has(String(tempId))) {
              return false;
            }
            // Remove if it's a duplicate (same _id as new greyMaterial)
            if (newGreyMaterialsMap.has(greyMaterialId)) {
              return false;
            }
            return true;
          });

          // ⚡ IMMEDIATE: Add ALL new greyMaterials (including optimistic ones) at the top
          const merged = [...uniqueNewGreyMaterials, ...filteredPrev];

          // Final deduplication by _id (keep the first occurrence)
          const finalMap = new Map<string, GreyMaterial>();
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

        // ⚡ FIX: Update pagination count for new greyMaterials (only count real ones, not temporary)
        const realNewGreyMaterials = uniqueNewGreyMaterials.filter(f => !isTemporaryGreyMaterial(f));
        if (realNewGreyMaterials.length > 0) {
          setPaginationInfo(prev => ({
            ...prev,
            totalCount: prev.totalCount + realNewGreyMaterials.length
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

        // ⚡ SMOOTH GLOW: One animation for all new greyMaterials (1.5s smooth fade) - only once per save
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
        devLog('✅ Immediate UI update complete - new greyMaterials added to UI', {
          newGreyMaterialsCount: uniqueNewGreyMaterials.length,
          realGreyMaterialsCount: realNewGreyMaterials.length
        });

        // ⚡ NO GET API CALL - UI already updated with POST response data
        // Only refresh filters in background (not greyMaterials list)
      }
    } else {
      // Fallback: If no greyMaterial data, use refresh handler (shouldn't happen)
      if (wasEdit) {
        sessionStorage.setItem('greyMaterialsPageShouldRefresh', 'true');
        sessionStorage.setItem('greyMaterialsPageRefreshTime', Date.now().toString());
        // ⚡ NO TOAST - Only animation
        fetchGreyMaterials(true, currentPage, itemsPerPage, 0, false);
      } else {
        sessionStorage.setItem('greyMaterialsPageShouldRefresh', 'true');
        sessionStorage.setItem('greyMaterialsPageRefreshTime', Date.now().toString());
        // ⚡ NO TOAST - Only animation
        fetchGreyMaterials(true, 1, itemsPerPage, 0, false);
      }
    }

    // ⚡ NO fetchGreyMaterials call - UI already updated optimistically!
  };

  const handleView = async (greyMaterial: GreyMaterial) => {
    // Set the selected greyMaterial and show details
    setSelectedGreyMaterial(greyMaterial);
    setShowDetails(true);

    // Set local group first (optimistic/immediate)
    const allGreyMaterialsInGroup = greyMaterials.filter(f => f.qualityCode === greyMaterial.qualityCode);
    setSelectedGreyMaterialGroup(allGreyMaterialsInGroup);

    // Fetch complete group from database in background to ensure all weavers are displayed
    try {
      const response = await fetch(`/api/grey-materials/${greyMaterial._id}`);
      const result = await response.json();
      if (result.success && result.data) {
        const allItems = Array.isArray(result.data) ? result.data : [result.data];
        setSelectedGreyMaterialGroup(allItems);
      }
    } catch (err) {
      console.error('Error fetching complete group for view:', err);
    }
  };

  const handleDelete = async (greyMaterial: GreyMaterial) => {
    // ⚡ FIX: Show loading state immediately on button click
    const greyMaterialId = String(greyMaterial._id);
    setDeletingIds(prev => new Set([...prev, greyMaterialId]));

    // Show modal immediately for better UX
    setDeletingGreyMaterial(greyMaterial);
    setShowDeleteConfirmation(true);
    setIsLoadingDependencies(true);
    setDeleteDependencies([]);

    // Check dependencies in background (non-blocking)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      const token = localStorage.getItem('token');
      const dependencyResponse = await fetch(`/api/grey-materials/${greyMaterial._id}/dependencies`, {
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
  const handleStickerDownload = async (greyMaterial: GreyMaterial) => {
    try {
      // Prepare greyMaterial data for sticker
      const stickerData = {
        qualityCode: greyMaterial.qualityCode || '-',
        qualityName: greyMaterial.qualityName || '-',
        piece: (greyMaterial.piece !== undefined && greyMaterial.piece !== '') ? Number(greyMaterial.piece) : undefined,
        meter: (greyMaterial.meter !== undefined && greyMaterial.meter !== '') ? Number(greyMaterial.meter) : undefined,
        challanNumber: greyMaterial.challanNumber || undefined,
        weaver: greyMaterial.weaver || undefined
      };

      // On mobile devices, download directly without preview
      if (isMobileDevice) {
        try {
          downloadGreyMaterialStickerPDFDirect(stickerData);
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
      const pdfDataUrl = generateGreyMaterialStickerPDF(stickerData);

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
          setCurrentStickerGreyMaterial(greyMaterial);
          setShowStickerPreview(true);

          // Reset loading after a short delay to ensure PDF is ready
          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, 500);
        } else {
          // Fallback to data URL if conversion fails
          setStickerPreviewUrl(pdfDataUrl);
          setCurrentStickerGreyMaterial(greyMaterial);
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
        setCurrentStickerGreyMaterial(greyMaterial);
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
    if (!currentStickerGreyMaterial) {
      showToast('error', 'No greyMaterial selected for download');
      return;
    }

    try {
      // Prepare greyMaterial data for sticker
      const stickerData = {
        qualityCode: currentStickerGreyMaterial.qualityCode || '-',
        qualityName: currentStickerGreyMaterial.qualityName || '-',
        piece: (currentStickerGreyMaterial.piece !== undefined && currentStickerGreyMaterial.piece !== '') ? Number(currentStickerGreyMaterial.piece) : undefined,
        meter: (currentStickerGreyMaterial.meter !== undefined && currentStickerGreyMaterial.meter !== '') ? Number(currentStickerGreyMaterial.meter) : undefined,
        challanNumber: currentStickerGreyMaterial.challanNumber || undefined,
        weaver: currentStickerGreyMaterial.weaver || undefined
      };

      // Use direct download method (works on all devices)
      downloadGreyMaterialStickerPDFDirect(stickerData);

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
      setCurrentStickerGreyMaterial(null);

      showToast('success', 'Sticker PDF downloaded successfully!');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        devError('Error downloading sticker PDF:', error);
      }
      showToast('error', 'Failed to download sticker PDF. Please try again.');
    }
  }, [currentStickerGreyMaterial, stickerPreviewUrl, showToast]);

  const confirmDelete = async () => {
    if (!deletingGreyMaterial) return;

    const greyMaterialId = String(deletingGreyMaterial._id);
    const greyMaterialToDelete = deletingGreyMaterial;

    // ⚡ FIX: Check if this is a temporary ID - if so, just remove from UI without API call
    if (isTemporaryId(greyMaterialId) || isTemporaryGreyMaterial(deletingGreyMaterial)) {
      devLog('⚠️ Attempting to delete temporary greyMaterial, removing from UI only:', greyMaterialId);

      // Close modal first
      setShowDeleteConfirmation(false);
      setDeletingGreyMaterial(null);
      setDeleteDependencies([]);
      setIsLoadingDependencies(false);

      // Mark as deleted
      deletedGreyMaterialIdsRef.current.add(greyMaterialId);

      // ⚡ RED GLOW + FADE OUT: Start red glow and fade out animation on weaver row
      setRedGlowingIds(prev => new Set([...prev, greyMaterialId]));
      setFadeOutRows(prev => new Set([...prev, greyMaterialId]));
      setDeletingIds(prev => new Set([...prev, greyMaterialId]));

      // Wait for animation to complete (500ms for smooth fade out)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Remove from UI immediately after animation (no API call for temporary greyMaterials)
      setGreyMaterials(prev => prev.filter(f => String(f._id) !== greyMaterialId));
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(greyMaterialId);
        return next;
      });
      // Clear animation states
      setRedGlowingIds(prev => {
        const next = new Set(prev);
        next.delete(greyMaterialId);
        return next;
      });
      setFadeOutRows(prev => {
        const next = new Set(prev);
        next.delete(greyMaterialId);
        return next;
      });
      setPaginationInfo(prev => ({
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1)
      }));

      // ⚡ NO TOAST - Only animation
      return; // Exit early - no API call for temporary greyMaterials
    }

    // Close modal first
    setShowDeleteConfirmation(false);
    setDeletingGreyMaterial(null);
    setDeleteDependencies([]);
    setIsLoadingDependencies(false);

    // ⚡ OPTIMISTIC DELETE: Immediately mark as deleted (prevent resurrection)
    deletedGreyMaterialIdsRef.current.add(greyMaterialId);
    // ⚡ CRITICAL: Persist to sessionStorage so it survives page refresh
    try {
      const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
      sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
    } catch (e) {
      devError('Error saving deleted greyMaterial IDs to sessionStorage:', e);
    }

    // ⚡ RED GLOW + FADE OUT: Start red glow and fade out animation on weaver row
    setRedGlowingIds(prev => new Set([...prev, greyMaterialId]));
    setFadeOutRows(prev => new Set([...prev, greyMaterialId]));
    setDeletingIds(prev => new Set([...prev, greyMaterialId]));

    // 2. Wait for animation to complete (500ms for smooth fade out)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Remove from UI immediately after animation
    setGreyMaterials(prev => prev.filter(f => String(f._id) !== greyMaterialId));
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.delete(greyMaterialId);
      return next;
    });
    // Clear animation states
    setRedGlowingIds(prev => {
      const next = new Set(prev);
      next.delete(greyMaterialId);
      return next;
    });
    setFadeOutRows(prev => {
      const next = new Set(prev);
      next.delete(greyMaterialId);
      return next;
    });
    setPaginationInfo(prev => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - 1)
    }));

    // 4. Clear ALL caches atomically (fix resurrection bug)
    clearAllGreyMaterialCaches();

    // 5. ⚡ SMOOTH DELETE: Background API call (no loading state, buttons stay enabled)
    // NO setIsDeleting - buttons stay enabled for smooth UX
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/grey-materials/${greyMaterialId}`, {
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
      if (response.ok || response.status === 404) {
        recentlyUpdatedGreyMaterialsRef.current.delete(greyMaterialId);
        try {
          const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
          if (stored) {
            const storedMap = new Map(JSON.parse(stored));
            storedMap.delete(greyMaterialId);
            sessionStorage.setItem('recentlyUpdatedGreyMaterials', JSON.stringify(Array.from(storedMap.entries())));
          }
        } catch (e) {
          devError('Error updating recentlyUpdatedGreyMaterials in sessionStorage:', e);
        }
      }

      if (!response.ok && response.status !== 404) {
        // Only rollback on real error (not 404 - that means already deleted)
        if (data.message && !data.message.includes('not found')) {
          // Rollback - restore greyMaterial
          deletedGreyMaterialIdsRef.current.delete(greyMaterialId);
          // Update sessionStorage
          try {
            const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
            sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
          } catch (e) {
            devError('Error updating deleted greyMaterial IDs in sessionStorage:', e);
          }
          setGreyMaterials(prev => [...prev, greyMaterialToDelete].sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime();
          }));
          setPaginationInfo(prev => ({ ...prev, totalCount: prev.totalCount + 1 }));
          // ⚡ ERROR POPUP: Show error toast on failure
          showToast('error', data.message || 'Failed to delete greyMaterial. Please try again.', 5000);
        }
      } else if (response.status === 404) {
        // ⚡ FIX: 404 means already deleted - keep it marked as deleted and persist
        devLog('✅ GreyMaterial already deleted (404), keeping it marked as deleted');
        try {
          const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
          sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
        } catch (e) {
          devError('Error saving deleted greyMaterial IDs to sessionStorage:', e);
        }
      }
    } catch (error: any) {
      // Network error - rollback and show error
      deletedGreyMaterialIdsRef.current.delete(greyMaterialId);
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
        sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted greyMaterial IDs in sessionStorage:', e);
      }
      setGreyMaterials(prev => [...prev, greyMaterialToDelete].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0);
        const bDate = new Date(b.createdAt || 0);
        return bDate.getTime() - aDate.getTime();
      }));
      setPaginationInfo(prev => ({ ...prev, totalCount: prev.totalCount + 1 }));
      // ⚡ ERROR POPUP: Show error toast on network failure
      showToast('error', `Network error: ${error.message || 'Failed to delete greyMaterial. Please try again.'}`, 5000);
    }

    // ⚡ NO fetchGreyMaterials call - UI already updated optimistically!
    // ⚡ NO TOAST - Only smooth animation!
  };

  const cancelDelete = () => {
    // ⚡ FIX: Clear loading state when canceling delete
    if (deletingGreyMaterial) {
      const greyMaterialId = String(deletingGreyMaterial._id);
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(greyMaterialId);
        return newSet;
      });
      // Remove from deleted set if it was added
      deletedGreyMaterialIdsRef.current.delete(greyMaterialId);
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
        sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted greyMaterial IDs in sessionStorage:', e);
      }
    }
    setShowDeleteConfirmation(false);
    setDeletingGreyMaterial(null);
    setDeleteDependencies([]);
    setIsDeleting(false);
    setIsLoadingDependencies(false);
  };

  const handleBulkDeleteGroup = (group: { qualityCode: string; qualityName: string; items: GreyMaterial[] }) => {
    setBulkDeleteGroup(group);
    setShowDeleteConfirmation(true);
  };

  // Fast delete entire quality group
  const handleDeleteQualityGroup = (mainGreyMaterial: GreyMaterial, allGreyMaterialsInGroup: GreyMaterial[]) => {
    const group = {
      qualityCode: mainGreyMaterial.qualityCode,
      qualityName: mainGreyMaterial.qualityName,
      items: allGreyMaterialsInGroup
    };
    setBulkDeleteGroup(group);
    setShowDeleteConfirmation(true);
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteGroup) return;

    const itemsToDelete = bulkDeleteGroup.items;

    // ⚡ FIX: Separate temporary greyMaterials from real ones
    const temporaryGreyMaterials = itemsToDelete.filter(item => isTemporaryGreyMaterial(item));
    const realGreyMaterials = itemsToDelete.filter(item => !isTemporaryGreyMaterial(item));

    const deletedIds = new Set(itemsToDelete.map(item => String(item._id)));
    const realDeletedIds = new Set(realGreyMaterials.map(item => String(item._id)));
    const deletedCount = itemsToDelete.length;
    const groupToDelete = bulkDeleteGroup;

    // Close modal first
    setShowDeleteConfirmation(false);
    setBulkDeleteGroup(null);
    setSelectedGreyMaterials(new Set());
    setBulkActions(false);
    setShowSelectionToolbar(false);

    // ⚡ OPTIMISTIC DELETE: Mark all as deleted (prevent resurrection)
    deletedIds.forEach(id => deletedGreyMaterialIdsRef.current.add(id));
    // ⚡ CRITICAL: Persist to sessionStorage so it survives page refresh
    try {
      const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
      sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
    } catch (e) {
      devError('Error saving deleted greyMaterial IDs to sessionStorage:', e);
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
    setGreyMaterials(prev => prev.filter(greyMaterial => !deletedIds.has(String(greyMaterial._id))));
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
    clearAllGreyMaterialCaches();

    // 5. ⚡ SMOOTH DELETE: Background API call (no loading state, buttons stay enabled)

    // ⚡ FIX: Only make API calls for real greyMaterials, not temporary ones
    if (temporaryGreyMaterials.length > 0) {
      devLog('⚠️ Skipping API delete for', temporaryGreyMaterials.length, 'temporary greyMaterial(s)');
    }

    // 6. Background API call (optimistic - UI already updated) - only for real greyMaterials
    if (realGreyMaterials.length === 0) {
      // All were temporary, done
      return;
    }

    // NO setIsBulkDeleting - buttons stay enabled for smooth UX
    try {
      let response;
      const token = localStorage.getItem('token');

      // Delete by IDs or by quality code
      // ⚡ FIX: Only use real greyMaterial IDs (filter out temporary ones)
      if (groupToDelete.qualityCode === 'Multiple') {
        const ids = realGreyMaterials.map(greyMaterial => greyMaterial._id).filter(id => id && !isTemporaryId(String(id)));
        if (ids.length === 0) {
          // All were temporary, already handled above
          // ⚡ NO setIsBulkDeleting - buttons stay enabled
          return;
        }
        response = await fetch(`/api/grey-materials`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify({ ids }),
        });
      } else {
        response = await fetch(`/api/grey-materials?qualityCode=${encodeURIComponent(groupToDelete.qualityCode)}&qualityName=${encodeURIComponent(groupToDelete.qualityName)}`, {
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

      if (response.ok || response.status === 404) {
        deletedIds.forEach(id => recentlyUpdatedGreyMaterialsRef.current.delete(id));
        try {
          const stored = sessionStorage.getItem('recentlyUpdatedGreyMaterials');
          if (stored) {
            const storedMap = new Map(JSON.parse(stored));
            deletedIds.forEach(id => storedMap.delete(id));
            sessionStorage.setItem('recentlyUpdatedGreyMaterials', JSON.stringify(Array.from(storedMap.entries())));
          }
        } catch (e) {
          devError('Error updating recentlyUpdatedGreyMaterials in sessionStorage:', e);
        }
      }

      // Handle errors (rollback only on real errors, not 404)
      if (!response.ok && response.status !== 404) {
        if (data.message && !data.message.includes('not found')) {
          // Rollback - restore all greyMaterials
          deletedIds.forEach(id => deletedGreyMaterialIdsRef.current.delete(id));
          // Update sessionStorage
          try {
            const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
            sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
          } catch (e) {
            devError('Error updating deleted greyMaterial IDs in sessionStorage:', e);
          }
          setGreyMaterials(prev => {
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
          showToast('error', data.message || 'Failed to delete greyMaterials. Please try again.', 5000);
        }
      } else if (response.status === 404) {
        // ⚡ FIX: 404 means already deleted - keep them marked as deleted and persist
        devLog('✅ Some greyMaterials already deleted (404), keeping them marked as deleted');
        try {
          const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
          sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
        } catch (e) {
          devError('Error saving deleted greyMaterial IDs to sessionStorage:', e);
        }
      }
    } catch (error: any) {
      // Network error - rollback and show error
      deletedIds.forEach(id => deletedGreyMaterialIdsRef.current.delete(id));
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
        sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted greyMaterial IDs in sessionStorage:', e);
      }
      setGreyMaterials(prev => {
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
      showToast('error', `Network error: ${error.message || 'Failed to delete greyMaterials. Please try again.'}`, 5000);
    }
    // ⚡ NO setIsBulkDeleting - buttons stay enabled

    // ⚡ NO fetchGreyMaterials call - UI already updated optimistically!
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
      deletedIds.forEach(id => deletedGreyMaterialIdsRef.current.delete(id));
      // Update sessionStorage
      try {
        const deletedIdsArray = Array.from(deletedGreyMaterialIdsRef.current);
        sessionStorage.setItem('deletedGreyMaterialIds', JSON.stringify(deletedIdsArray));
      } catch (e) {
        devError('Error updating deleted greyMaterial IDs in sessionStorage:', e);
      }
    }
    setShowDeleteConfirmation(false);
    setBulkDeleteGroup(null);
    setIsBulkDeleting(false);
  };

  // Enhanced image handling functions
  const handleImageClick = (greyMaterial: GreyMaterial, imageIndex: number) => {
    setShowImageModal({ greyMaterial, imageIndex });
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
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(imageUrl)}`, '_blank');
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

  const handleImageLoad = (greyMaterialId: string) => {
    setIsImageLoading(prev => ({ ...prev, [greyMaterialId]: false }));
  };

  const handleImageError = (greyMaterialId: string) => {
    setIsImageLoading(prev => ({ ...prev, [greyMaterialId]: false }));
    setImageErrors(prev => ({ ...prev, [greyMaterialId]: true }));
  };

  // Initialize image loading state for all greyMaterials
  useEffect(() => {
    const newImageLoading: { [key: string]: boolean } = {};
    const newImageErrors: { [key: string]: boolean } = {};

    greyMaterials.forEach(greyMaterial => {
      if (greyMaterial.images && greyMaterial.images.length > 0) {
        greyMaterial.images.forEach((_, imgIndex) => {
          const key = `${greyMaterial._id}-${imgIndex}`;
          newImageLoading[key] = true;
          newImageErrors[key] = false;
        });
      }
    });

    setIsImageLoading(newImageLoading);
    setImageErrors(newImageErrors);
  }, [greyMaterials]);

  const nextImage = () => {
    if (showImageModal && showImageModal.greyMaterial.images) {
      const nextIndex = (selectedImageIndex + 1) % showImageModal.greyMaterial.images.length;
      setSelectedImageIndex(nextIndex);
      setZoomLevel(1);
    }
  };

  const prevImage = () => {
    if (showImageModal && showImageModal.greyMaterial.images) {
      const prevIndex = selectedImageIndex === 0
        ? showImageModal.greyMaterial.images.length - 1
        : selectedImageIndex - 1;
      setSelectedImageIndex(prevIndex);
      setZoomLevel(1);
    }
  };

  // Enhanced selection functions
  const handleGreyMaterialSelection = (greyMaterialId: string, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedGreyMaterial) {
      // Range selection
      const greyMaterialIds = filteredAndSortedGreyMaterials.map(f => f._id || '');
      const startIndex = greyMaterialIds.indexOf(lastSelectedGreyMaterial);
      const endIndex = greyMaterialIds.indexOf(greyMaterialId);
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      const newSelected = new Set(selectedGreyMaterials);
      for (let i = start; i <= end; i++) {
        newSelected.add(greyMaterialIds[i]);
      }
      setSelectedGreyMaterials(newSelected);
    } else if (event.ctrlKey || event.metaKey) {
      // Multi-selection
      const newSelected = new Set(selectedGreyMaterials);
      if (newSelected.has(greyMaterialId)) {
        newSelected.delete(greyMaterialId);
      } else {
        newSelected.add(greyMaterialId);
      }
      setSelectedGreyMaterials(newSelected);
    } else {
      // Single selection
      setSelectedGreyMaterials(new Set([greyMaterialId]));
    }

    setLastSelectedGreyMaterial(greyMaterialId);
    setBulkActions(selectedGreyMaterials.size > 0);
    setShowSelectionToolbar(selectedGreyMaterials.size > 0);
  };

  const selectAllVisible = () => {
    const allVisibleIds = new Set(filteredAndSortedGreyMaterials.map(f => f._id || ''));
    setSelectedGreyMaterials(allVisibleIds);
    setBulkActions(true);
    setShowSelectionToolbar(true);
  };

  const clearAllSelection = () => {
    setSelectedGreyMaterials(new Set());
    setBulkActions(false);
    setShowSelectionToolbar(false);
    setLastSelectedGreyMaterial(null);
  };

  const invertSelection = () => {
    const allVisibleIds = new Set(filteredAndSortedGreyMaterials.map(f => f._id || ''));
    const newSelected = new Set<string>();

    allVisibleIds.forEach(id => {
      if (!selectedGreyMaterials.has(id)) {
        newSelected.add(id);
      }
    });

    setSelectedGreyMaterials(newSelected);
    setBulkActions(newSelected.size > 0);
    setShowSelectionToolbar(newSelected.size > 0);
  };

  // Export functions
  const exportSelectedGreyMaterials = async () => {
    if (selectedGreyMaterials.size === 0) return;

    setIsExporting(true);
    try {
      const selectedGreyMaterialData = filteredAndSortedGreyMaterials.filter(f => f._id && selectedGreyMaterials.has(f._id));

      if (exportFormat === 'csv') {
        exportToCSV(selectedGreyMaterialData);
      } else if (exportFormat === 'excel') {
        exportToExcel(selectedGreyMaterialData);
      } else if (exportFormat === 'pdf') {
        exportToPDF(selectedGreyMaterialData);
      }

      setShowExportModal(false);
    } catch (error) {
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = (greyMaterials: GreyMaterial[]) => {
    const headers = ['Quality Code', 'Quality Name', 'Weaver', 'Challan Number', 'Piece', 'Meter'];
    const csvContent = [
      headers.join(','),
      ...greyMaterials.map(f => [
        f.qualityCode,
        f.qualityName,
        f.weaver,
        f.challanNumber || '',
        f.piece || '',
        f.meter || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greyMaterials-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToExcel = (greyMaterials: GreyMaterial[]) => {
    // Simple Excel-like export using CSV with .xlsx extension
    const headers = ['Quality Code', 'Quality Name', 'Weaver', 'Challan Number', 'Piece', 'Meter', 'Rack', 'GSM', 'Content', 'Danier', 'Weight', 'Rate', 'Width'];
    const csvContent = [
      headers.join('\t'),
      ...greyMaterials.map(f => [
        f.qualityCode,
        f.qualityName,
        f.weaver,
        f.challanNumber || '',
        f.piece || '',
        f.meter || ''
      ].join('\t'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greyMaterials-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = (greyMaterials: GreyMaterial[]) => {
    // Enhanced PDF-like export with better formatting
    const content = [
      'GREY_MATERIAL INVENTORY REPORT',
      `Generated on: ${new Date().toLocaleDateString()}`,
      `Total GreyMaterials: ${greyMaterials.length}`,
      '',
      'DETAILED LISTING:',
      '================',
      '',
      ...greyMaterials.map((f, index) => [
        `${index + 1}. Quality Code: ${f.qualityCode}`,
        `   Quality Name: ${f.qualityName}`,
        `   Weaver: ${f.weaver}`,
        `   Challan Number: ${f.challanNumber || 'N/A'}`,
        `   Piece: ${f.piece || 'N/A'}`,
        `   Meter: ${f.meter || 'N/A'}`,
        ''
      ].join('\n'))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greyMaterial-inventory-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Bulk operations
  const handleBulkDeleteSelected = async () => {
    if (selectedGreyMaterials.size === 0) return;

    const selectedGreyMaterialData = filteredAndSortedGreyMaterials.filter(f => f._id && selectedGreyMaterials.has(f._id));
    setBulkDeleteGroup({
      qualityCode: 'Multiple',
      qualityName: 'Selected GreyMaterials',
      items: selectedGreyMaterialData
    });
    setShowDeleteConfirmation(true);
  };

  const handleBulkEdit = () => {
    if (selectedGreyMaterials.size === 0) return;

    const selectedGreyMaterialData = filteredAndSortedGreyMaterials.filter(f => f._id && selectedGreyMaterials.has(f._id));

    // Show bulk edit modal
    alert(`Bulk edit for ${selectedGreyMaterials.size} greyMaterial(s):\n${selectedGreyMaterialData.map(f => `${f.qualityCode} - ${f.qualityName}`).join('\n')}`);
  };

  // Use server-side filtered data directly (no client-side filtering)
  const filteredAndSortedGreyMaterials = useMemo(() => {
    return [...greyMaterials]; // Server already sends filtered and sorted data
  }, [greyMaterials]);

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
  const paginatedGreyMaterials = useMemo(() => {
    return filteredAndSortedGreyMaterials; // Server already sends paginated data
  }, [filteredAndSortedGreyMaterials, currentPage, itemsPerPage]);

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
    setGreyMaterials([]);
    setLoading(true);

    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchGreyMaterials(false, 1, itemsPerPage, 0, true); // Set showLoading to true
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
      fetchGreyMaterials(false, totalPages, itemsPerPage, 0, false);
    }
  }, [totalPages, currentPage, itemsPerPage]);

  // Group greyMaterials by Quality Code and Quality Name (using paginated data)
  const groupedGreyMaterials = paginatedGreyMaterials.reduce((groups, greyMaterial) => {
    const key = `${greyMaterial.qualityCode}-${greyMaterial.qualityName}`;
    if (!groups[key]) {
      groups[key] = {
        qualityCode: greyMaterial.qualityCode,
        qualityName: greyMaterial.qualityName,
        items: []
      };
    }
    groups[key].items.push(greyMaterial);
    return groups;
  }, {} as Record<string, { qualityCode: string; qualityName: string; items: GreyMaterial[] }>);

  const clearFilters = () => {
    setFilters({
      qualityCode: '',
      qualityName: '',
      type: '',
      weaver: '',
      weaverQualityName: '',
      search: '',
      minPiece: '',
      maxPiece: '',
      minMeter: '',
      maxMeter: '',
      minChallan: '',
      maxChallan: '',
      hasImages: false,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setSearchType('all');
    setTypeFilter('');
    setSelectedGreyMaterials(new Set());
    setBulkActions(false);
  };

  const toggleGreyMaterialSelection = (greyMaterialId: string) => {
    const newSelected = new Set(selectedGreyMaterials);
    if (newSelected.has(greyMaterialId)) {
      newSelected.delete(greyMaterialId);
    } else {
      newSelected.add(greyMaterialId);
    }
    setSelectedGreyMaterials(newSelected);
    setBulkActions(newSelected.size > 0);
  };

  const selectAllGreyMaterials = () => {
    const allIds = new Set(filteredAndSortedGreyMaterials.map(f => f._id || ''));
    setSelectedGreyMaterials(allIds);
    setBulkActions(true);
  };

  const clearSelection = () => {
    setSelectedGreyMaterials(new Set());
    setBulkActions(false);
  };


  if (!mounted) return null;

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
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
                      fetchGreyMaterials(false, 1, itemsPerPage, 0, true)
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
                      fetchGreyMaterials(false, 1, itemsPerPage, 0, false)
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
              {/* Add GreyMaterial Button - Improved UI matching sampling page */}
              <button
                onClick={handleCreate}
                className={`px-4 py-2.5 rounded-lg font-semibold transition-all duration-150 hover:scale-105 active:scale-95 hover-lift text-sm shadow-md hover:shadow-lg whitespace-nowrap flex items-center space-x-2 ${isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500'
                    : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-400'
                  }`}
                title="Add New GreyMaterial"
                aria-label="Add new greyMaterial"
              >
                <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm">Add GreyMaterial</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => fetchGreyMaterials(true, currentPage, itemsPerPage, 0, true)}
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
                  {selectedGreyMaterials.size} greyMaterial{selectedGreyMaterials.size !== 1 ? 's' : ''} selected
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

      {/* Enhanced GreyMaterials Display */}
      <div className="overflow-hidden transition-all duration-150 animate-in fade-in-0 slide-in-from-top-4 delay-100 bg-transparent border-0 shadow-none">
        {/* ⚡ CRITICAL: Show loading skeleton until initial fetch completes AND no fetches in flight */}
        {/* Also show skeleton if we haven't fetched data yet (prevents "no data" flash during refresh) */}
        {(loading || !initialFetchDone || fetchInFlight > 0 || initialLoading || !hasInitialFetchRef.current ||
          (greyMaterials.length === 0 && !fetchedDataOnce)) ? (
          <GreyMaterialsPageSkeleton viewMode={viewMode} />
        ) : (
          <div className={viewMode === 'table' ? '' : 'animate-in fade-in-0 slide-in-from-top-4 duration-500'}>
            {/* ⚡ FIX: Only show "no data" when loading is complete AND we have no greyMaterials AND we've fetched data at least once */}
            {filteredAndSortedGreyMaterials.length === 0 && fetchedDataOnce && hasInitialFetchRef.current && initialFetchDone && fetchInFlight === 0 ? (
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
                    ? `No greyMaterials found with type "${typeFilter}"`
                    : filters.search
                      ? `No results found for "${filters.search}"`
                      : filters.weaver
                        ? `No greyMaterials found for weaver "${filters.weaver}"`
                        : filters.weaverQualityName
                          ? `No greyMaterials found for weaver quality "${filters.weaverQualityName}"`
                          : 'No greyMaterials found'
                  }
                </h3>

                {/* Helpful message */}
                <p className={`text-base mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  {typeFilter
                    ? `We couldn't find any greyMaterials with the type "${typeFilter}". Try selecting a different type or clear the filter to see all greyMaterials.`
                    : filters.weaver
                      ? `We couldn't find any greyMaterials for weaver "${filters.weaver}". Try selecting a different weaver or clear the filter.`
                      : filters.weaverQualityName
                        ? `We couldn't find any greyMaterials for weaver quality "${filters.weaverQualityName}". Try selecting a different quality or clear the filter.`
                        : filters.search
                          ? `We couldn't find any greyMaterials matching your search in ${searchType === 'all' ? 'any field' : searchType === 'qualityCode' ? 'Quality Code' : searchType === 'qualityName' ? 'Quality Name' : searchType === 'type' ? 'Type' : searchType === 'weaver' ? 'Weaver Name' : 'Weaver Quality'}.`
                          : 'Get started by adding your first greyMaterial'
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
                      <li>• Clear all filters to see all greyMaterials</li>
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
                            fetchGreyMaterials(false, 1, itemsPerPage, 0, false)
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
                      <span>Add Your First GreyMaterial</span>
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
                          {paginationInfo.totalCount} {paginationInfo.totalCount === 1 ? 'greyMaterial' : 'greyMaterials'}
                        </span>
                        <span className="sm:hidden">
                          {(currentPage - 1) * (itemsPerPage === 'All' ? paginationInfo.totalCount : itemsPerPage) + 1}-
                          {Math.min(currentPage * (itemsPerPage === 'All' ? paginationInfo.totalCount : itemsPerPage), paginationInfo.totalCount)} of {paginationInfo.totalCount} {paginationInfo.totalCount === 1 ? 'greyMaterial' : 'greyMaterials'}
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

                <div className="p-0 py-4 sm:py-6 animate-in fade-in-0 slide-in-from-top-4 duration-700">
                  {viewMode === 'cards' ? (
                    // Card View with smooth animations
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                      {(() => {
                        // Group greyMaterials by qualityCode for card view while preserving sort order
                        const groupedGreyMaterials = new Map<string, GreyMaterial[]>();
                        const groupOrder: string[] = [];

                        paginatedGreyMaterials.forEach(greyMaterial => {
                          const key = greyMaterial.qualityCode;
                          if (!groupedGreyMaterials.has(key)) {
                            groupedGreyMaterials.set(key, []);
                            groupOrder.push(key);
                          }
                          groupedGreyMaterials.get(key)!.push(greyMaterial);
                        });

                        // Sort groups by greyMaterial creation time (not weaver update time)
                        // Use the earliest createdAt in the group (when the greyMaterial was first created)
                        // This ensures greyMaterials are sorted by when they were created, not by weaver updates
                        groupOrder.sort((a, b) => {
                          const greyMaterialsA = groupedGreyMaterials.get(a)!;
                          const greyMaterialsB = groupedGreyMaterials.get(b)!;

                          // Find the earliest creation time in each group (when greyMaterial was first created)
                          const minDateA = Math.min(...greyMaterialsA.map(f => new Date(f.createdAt || 0).getTime()));
                          const minDateB = Math.min(...greyMaterialsB.map(f => new Date(f.createdAt || 0).getTime()));

                          // Sort by creation time (newest first if desc, oldest first if asc)
                          // Check if sortOrder is desc or asc (default: desc for latest first)
                          const sortOrder = filters.sortOrder || 'desc';
                          return sortOrder === 'desc' ? minDateB - minDateA : minDateA - minDateB;
                        });

                        return groupOrder.map(qualityCode => {
                          const greyMaterials = groupedGreyMaterials.get(qualityCode)!;
                          // Sort weavers within group by creation time (when weaver was added)
                          // This maintains the order of weavers as they were added to the greyMaterial
                          greyMaterials.sort((a, b) => {
                            const aDate = new Date(a.createdAt || 0).getTime();
                            const bDate = new Date(b.createdAt || 0).getTime();
                            return aDate - bDate; // Oldest first (maintain original order)
                          });
                          const mainGreyMaterial = greyMaterials[0];
                          const isExpanded = expandedCards.has(qualityCode);
                          const itemsToShow = isExpanded ? greyMaterials : greyMaterials.slice(0, 1);

                          return (
                            <div key={qualityCode} className={`rounded-2xl border transition-all duration-300 ease-in-out hover:shadow-xl hover:translate-y-[-4px] animate-in fade-in-0 slide-in-from-bottom-2 ${deletingQualityGroups.has(qualityCode)
                                ? isDarkMode
                                  ? 'bg-red-950/30 border-red-500/50 animate-red-glow-delete text-white'
                                  : 'bg-red-50 border-red-300 animate-red-glow-delete text-red-900'
                                : isDarkMode
                                  ? 'bg-slate-800 border-slate-700/60 hover:bg-slate-800/80 hover:border-gray-500'
                                  : 'bg-white border-slate-200 hover:bg-slate-50/50 hover:border-gray-400'
                              } ${greyMaterials.some(f => f._id && glowingIds.has(f._id)) ? 'animate-weaver-green-glow' : ''} ${deletingQualityGroups.has(qualityCode) ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
                              }`} style={{
                                animationDelay: `${groupOrder.indexOf(qualityCode) * 0.1}s`,
                                transition: deletingQualityGroups.has(qualityCode) ? 'all 0.6s ease-in-out' : 'all 0.15s ease-in-out'
                              }}>
                              {/* Image Section - Responsive with Touch Support */}
                              <div className="relative h-40 sm:h-48 md:h-56 lg:h-64 xl:h-72 overflow-hidden rounded-t-2xl group">
                                {mainGreyMaterial.images && mainGreyMaterial.images.filter(img => img && img.trim() !== '').length > 0 ? (
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
                                        const validImages = (mainGreyMaterial.images || []).filter(img => img && img.trim() !== '');
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
                                      src={getCurrentCardImage(mainGreyMaterial, qualityCode) || (mainGreyMaterial.images && mainGreyMaterial.images.filter(img => img && img.trim() !== '')[0])}
                                      alt="GreyMaterial"
                                      className="w-full h-full object-cover cursor-pointer transition-transform duration-200 hover:scale-105 select-none"
                                      onClick={() => handleImageClick(mainGreyMaterial, cardImageIndices[qualityCode] || 0)}
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
                                    {mainGreyMaterial.images && mainGreyMaterial.images.filter(img => img && img.trim() !== '').length > 1 && (
                                      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                          ? 'bg-gray-800/80 text-gray-300 border border-gray-600'
                                          : 'bg-white/90 text-gray-600 border border-gray-200'
                                        } shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                                        ← Swipe →
                                      </div>
                                    )}

                                    {/* Navigation buttons for multiple images */}
                                    {mainGreyMaterial.images && mainGreyMaterial.images.filter(img => img && img.trim() !== '').length > 1 && (
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
                                {mainGreyMaterial.images && (mainGreyMaterial.images || []).filter(img => img && img.trim() !== '').length > 1 && (
                                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                                    <span className={`text-xs sm:text-sm px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full font-medium shadow-lg ${isDarkMode
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                      }`}>
                                      <span className="hidden sm:inline">{(mainGreyMaterial.images || []).filter(img => img && img.trim() !== '').length} photos</span>
                                      <span className="sm:hidden">+{(mainGreyMaterial.images || []).filter(img => img && img.trim() !== '').length - 1}</span>
                                    </span>
                                  </div>
                                )}

                                {/* Items count badge - Responsive */}
                                <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                                  <span className={`text-xs sm:text-sm px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full font-medium shadow-lg ${isDarkMode
                                      ? 'bg-green-600 text-white'
                                      : 'bg-green-100 text-green-800 border border-green-200'
                                    }`}>
                                    <span className="hidden sm:inline">{greyMaterials.length} weaver{greyMaterials.length !== 1 ? 's' : ''}</span>
                                    <span className="sm:hidden">{greyMaterials.length}</span>
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
                                      {mainGreyMaterial.qualityCode}
                                    </span>
                                  </div>
                                  <div className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    <span className="font-medium">Quality Name:</span>
                                    <span className="ml-1">{mainGreyMaterial.qualityName}</span>
                                  </div>
                                  <div className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    <span className="font-medium">Type:</span>
                                    <span className={`ml-1 font-semibold ${mainGreyMaterial.type
                                        ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                                        : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                      }`}>
                                      {mainGreyMaterial.type || '-'}
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
                                      <span>Weavers ({greyMaterials.length})</span>
                                    </h4>

                                    {/* Show items based on expansion state */}
                                    <div className="space-y-2">
                                      {itemsToShow.map((greyMaterial, index) => (
                                        <div key={greyMaterial._id} className={`p-2 sm:p-2.5 lg:p-3 rounded-lg border transition-all duration-300 ease-in-out relative overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 ${redGlowingIds.has(String(greyMaterial._id)) ? 'animate-red-glow-delete' : ''
                                          } ${fadeOutRows.has(String(greyMaterial._id))
                                            ? 'opacity-0 scale-95 -translate-y-2 blur-sm'
                                            : 'opacity-100 scale-100 translate-y-0 blur-0'
                                          } ${fadeOutRows.has(String(greyMaterial._id))
                                            ? isDarkMode
                                              ? 'bg-red-900/30 border-red-500/50'
                                              : 'bg-red-50 border-red-300'
                                            : isDarkMode
                                              ? 'bg-gray-800/40 border-gray-600/40 hover:bg-gray-700/70'
                                              : 'bg-white border-gray-200 hover:bg-gray-50'
                                          } ${greyMaterial._id && glowingIds.has(greyMaterial._id) ? 'animate-weaver-green-glow' : ''}`} style={{
                                            transition: fadeOutRows.has(String(greyMaterial._id)) ? 'all 0.5s ease-in-out' : 'all 0.15s ease-in-out'
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
                                                <span className="text-sm sm:text-base">Challan:</span>
                                                <span className={`ml-1 font-bold text-sm sm:text-base ${greyMaterial.challanNumber
                                                    ? isDarkMode
                                                      ? 'text-green-400'
                                                      : 'text-green-600'
                                                    : isDarkMode
                                                      ? 'text-red-400'
                                                      : 'text-red-600'
                                                  }`}>
                                                  {greyMaterial.challanNumber ? `${greyMaterial.challanNumber}` : '-'}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 sm:gap-2">
                                              {/* Delete Button */}
                                              {isMaster && (
                                                <button
                                                  onClick={() => handleDelete(greyMaterial)}
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
                                                {greyMaterial.weaver}
                                              </div>
                                            </div>



                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Piece:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                                                {greyMaterial.piece && Number(greyMaterial.piece) > 0 ? greyMaterial.piece : '-'}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                Meter:
                                              </div>
                                              <div className={`font-bold ${isDarkMode ? 'text-teal-300' : 'text-teal-600'}`}>
                                                {greyMaterial.meter && Number(greyMaterial.meter) > 0 ? greyMaterial.meter : '-'}
                                              </div>
                                            </div>

                                          </div>
                                        </div>
                                      ))}

                                      {/* View More/Less button or placeholder for consistent spacing */}
                                      {greyMaterials.length > 1 ? (
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
                                              : greyMaterials.length === 2
                                                ? 'View 1 more weaver'
                                                : `View ${greyMaterials.length - 1} more weavers`
                                            }
                                          </span>
                                          <span className="hidden sm:inline lg:hidden">
                                            {isExpanded
                                              ? 'Show Less'
                                              : greyMaterials.length === 2
                                                ? 'View 1 more'
                                                : `View ${greyMaterials.length - 1} more`
                                            }
                                          </span>
                                          <span className="sm:hidden">
                                            {isExpanded
                                              ? 'Less'
                                              : `+${greyMaterials.length - 1}`
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
                                    onClick={() => handleView(mainGreyMaterial)}
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
                                    onClick={() => handleEdit(mainGreyMaterial)}
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
                                      onClick={() => handleDeleteQualityGroup(mainGreyMaterial, greyMaterials)}
                                      disabled={false}
                                      className={`flex-1 px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 rounded-lg transition-all duration-150 hover:scale-105 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-1 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                                          ? 'text-red-400 border border-red-400 hover:bg-red-400/10'
                                          : 'text-red-600 border border-red-600 hover:bg-red-600/10'
                                        }`}
                                      title={`Delete Quality Group (${greyMaterials.length} items)`}
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
                              Challan No
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Piece
                            </th>
                            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                              }`}>
                              Meter
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
                                      <p className="text-sm">Loading greyMaterials...</p>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            // Check if there's data to display (only after loading completes)
                            if (!paginatedGreyMaterials || paginatedGreyMaterials.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={16} className={`px-6 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium">
                                      {typeFilter
                                        ? `No greyMaterials found with type "${typeFilter}"`
                                        : filters.weaver
                                          ? `No greyMaterials found for weaver "${filters.weaver}"`
                                          : filters.weaverQualityName
                                            ? `No greyMaterials found for weaver quality "${filters.weaverQualityName}"`
                                            : filters.search
                                              ? `No results found for "${filters.search}"`
                                              : 'No greyMaterials to display'
                                      }
                                    </p>
                                    <p className="text-sm mt-1">
                                      {typeFilter
                                        ? `We couldn't find any greyMaterials with the type "${typeFilter}". Try selecting a different type or clear the filter.`
                                        : filters.weaver
                                          ? `We couldn't find any greyMaterials for weaver "${filters.weaver}". Try selecting a different weaver or clear the filter.`
                                          : filters.weaverQualityName
                                            ? `We couldn't find any greyMaterials for weaver quality "${filters.weaverQualityName}". Try selecting a different quality or clear the filter.`
                                            : filters.search
                                              ? 'Try adjusting your search terms or clear the search'
                                              : 'Get started by adding your first greyMaterial'
                                      }
                                    </p>
                                  </td>
                                </tr>
                              );
                            }

                            // Group greyMaterials by qualityCode while preserving sort order (same as card view)
                            const groupedGreyMaterials = new Map<string, GreyMaterial[]>();
                            const groupOrder: string[] = [];

                            paginatedGreyMaterials.forEach(greyMaterial => {
                              const key = greyMaterial.qualityCode;
                              if (!groupedGreyMaterials.has(key)) {
                                groupedGreyMaterials.set(key, []);
                                groupOrder.push(key);
                              }
                              groupedGreyMaterials.get(key)!.push(greyMaterial);
                            });

                            // Sort groups by greyMaterial creation time (not weaver update time)
                            // Use the earliest createdAt in the group (when the greyMaterial was first created)
                            // This ensures greyMaterials are sorted by when they were created, not by weaver updates
                            groupOrder.sort((a, b) => {
                              const greyMaterialsA = groupedGreyMaterials.get(a)!;
                              const greyMaterialsB = groupedGreyMaterials.get(b)!;

                              // Find the earliest creation time in each group (when greyMaterial was first created)
                              const minDateA = Math.min(...greyMaterialsA.map(f => new Date(f.createdAt || 0).getTime()));
                              const minDateB = Math.min(...greyMaterialsB.map(f => new Date(f.createdAt || 0).getTime()));

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
                                      <p className="text-sm">Loading greyMaterials...</p>
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
                                    <p className="text-lg font-medium">No greyMaterial groups found</p>
                                    <p className="text-sm mt-1">Unable to group greyMaterials by quality code</p>
                                  </td>
                                </tr>
                              );
                            }

                            return groupOrder.map(qualityCode => {
                              const greyMaterials = groupedGreyMaterials.get(qualityCode)!;
                              // Sort weavers within group by creation time (when weaver was added)
                              // Always sort weavers oldest first (W1, W2, W3...) regardless of main sort order
                              greyMaterials.sort((a, b) => {
                                const aDate = new Date(a.createdAt || 0).getTime();
                                const bDate = new Date(b.createdAt || 0).getTime();
                                return aDate - bDate; // Oldest first (maintain original order)
                              });
                              const mainGreyMaterial = greyMaterials[0]; // Use first greyMaterial for quality info

                              return greyMaterials.map((greyMaterial, weaverIndex) => (
                                <tr key={`${qualityCode}-${greyMaterial._id}`} className={`relative transition-all duration-300 hover:bg-opacity-50 animate-in fade-in-0 slide-in-from-left-2 ${weaverIndex === 0 ? '' : 'border-t-2'} ${weaverIndex === greyMaterials.length - 1 ? 'border-b-4' : ''} ${isDarkMode ? 'border-gray-500' : 'border-gray-300'
                                  } ${redGlowingIds.has(String(greyMaterial._id)) ? 'animate-red-glow-delete' : ''
                                  } ${fadeOutRows.has(String(greyMaterial._id))
                                    ? 'opacity-0 scale-95 -translate-y-2 blur-sm'
                                    : 'opacity-100 scale-100 translate-y-0 blur-0'
                                  } ${fadeOutRows.has(String(greyMaterial._id))
                                    ? isDarkMode
                                      ? 'bg-red-900/20 border-red-500/50'
                                      : 'bg-red-50 border-red-300'
                                    : ''
                                  } ${deletingIds.has(String(greyMaterial._id)) ? 'opacity-60' : ''} ${greyMaterial._id && glowingIds.has(greyMaterial._id) ? 'animate-weaver-green-glow' : ''}`} style={{
                                    animationDelay: `${weaverIndex * 0.05}s`,
                                    transition: fadeOutRows.has(String(greyMaterial._id)) ? 'all 0.5s ease-in-out' : 'all 0.15s ease-in-out'
                                  }}>
                                  {/* ⚡ NO LOADING OVERLAY - Smooth fade animation only */}
                                  {/* Quality Information - Only show on first row with rowspan */}
                                  {weaverIndex === 0 && (
                                    <td rowSpan={greyMaterials.length} className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-top border-r border-b-4 ${isDarkMode ? 'text-gray-300 border-gray-600 border-b-gray-500' : 'text-gray-900 border-gray-300 border-b-gray-300'
                                      }`}>
                                      <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Code:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[10px] xs:text-xs sm:text-sm md:text-base lg:text-lg ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                            }`}>
                                            {mainGreyMaterial.qualityCode}
                                          </span>
                                        </div>
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Name:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm truncate max-w-[100px] sm:max-w-[120px] md:max-w-none ${isDarkMode ? 'text-purple-300' : 'text-purple-600'
                                            }`} title={mainGreyMaterial.qualityName}>
                                            {mainGreyMaterial.qualityName}
                                          </span>
                                        </div>
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Type:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${mainGreyMaterial.type
                                              ? (isDarkMode ? 'text-orange-300' : 'text-orange-600')
                                              : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                            }`} title={mainGreyMaterial.type || '-'}>
                                            {mainGreyMaterial.type || '-'}
                                          </span>
                                        </div>
                                        <div className="pt-1 sm:pt-1.5 md:pt-2 border-t-2 border-gray-400/30">
                                          <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                            <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                              }`}>Created:</span>
                                            <span className={`ml-1 sm:ml-1.5 font-semibold text-[9px] xs:text-[10px] sm:text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                              }`}>
                                              {mainGreyMaterial.createdAt ? new Date(mainGreyMaterial.createdAt).toLocaleDateString() : '-'}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                            }`}>Weavers:</span>
                                          <span className={`ml-1 sm:ml-1.5 md:ml-2 font-bold text-[10px] xs:text-xs sm:text-sm md:text-base lg:text-lg ${isDarkMode ? 'text-green-400' : 'text-green-600'
                                            }`}>
                                            {greyMaterials.length}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  )}

                                  {/* Images - Only show on first row with rowspan */}
                                  {weaverIndex === 0 && (
                                    <td rowSpan={greyMaterials.length} className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-middle border-r border-b-4 ${isDarkMode ? 'border-gray-600 border-b-gray-500' : 'border-gray-300 border-b-gray-300'
                                      }`}>
                                      <div className="flex justify-center items-center">
                                        {mainGreyMaterial.images && (mainGreyMaterial.images || []).filter(img => img && img.trim() !== '').length > 0 ? (
                                          <div className="flex flex-col items-center space-y-0.5 sm:space-y-1">
                                            <div className="relative">
                                              <img
                                                src={(mainGreyMaterial.images || []).filter(img => img && img.trim() !== '')[0]}
                                                alt="GreyMaterial"
                                                className="w-16 h-12 xs:w-20 xs:h-14 sm:w-24 sm:h-20 md:w-32 md:h-24 lg:w-40 lg:h-28 xl:w-48 xl:h-36 object-contain bg-slate-950 rounded-lg border-2 cursor-pointer shadow-md hover:shadow-lg transition-all duration-150 hover:scale-105"
                                                onClick={() => handleImageClick(mainGreyMaterial, 0)}
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
                                            {mainGreyMaterial.images && mainGreyMaterial.images.filter(img => img && img.trim() !== '').length > 1 && (
                                              <span className={`text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs px-1.5 xs:px-2 py-0.5 rounded-full font-medium ${isDarkMode
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                +{(mainGreyMaterial.images || []).filter(img => img && img.trim() !== '').length - 1}
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
                                      {greyMaterial.weaver}
                                    </span>
                                  </td>

                                  {/* Challan No Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                                      {greyMaterial.challanNumber || '-'}
                                    </span>
                                  </td>

                                  {/* Piece Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                                      {greyMaterial.piece && Number(greyMaterial.piece) > 0 ? greyMaterial.piece : '-'}
                                    </span>
                                  </td>

                                  {/* Meter Column */}
                                  <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center ${isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                                    }`}>
                                    <span className={`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm ${isDarkMode ? 'text-teal-300' : 'text-teal-600'}`}>
                                      {greyMaterial.meter && Number(greyMaterial.meter) > 0 ? greyMaterial.meter : '-'}
                                    </span>
                                  </td>



                                  {/* Actions - Only show on first row with rowspan */}
                                  {weaverIndex === 0 && (
                                    <td rowSpan={greyMaterials.length} className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-middle border-b-4 ${isDarkMode ? 'border-gray-600 border-b-gray-500' : 'border-gray-300 border-b-gray-300'
                                      }`}>
                                      <div className="flex flex-col justify-center space-y-1 sm:space-y-1.5 md:space-y-2">
                                        <button
                                          onClick={() => handleView(mainGreyMaterial)}
                                          className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1 transition-all duration-150 hover:scale-105 active:scale-95 hover-lift ${isDarkMode
                                              ? 'text-blue-400 border border-blue-400 hover:bg-blue-500/20'
                                              : 'text-blue-600 border border-blue-600 hover:bg-blue-50'
                                            }`}
                                          title="View Details"
                                        >
                                          <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          <span className="hidden sm:inline">View</span>
                                        </button>

                                        <button
                                          onClick={() => handleEdit(mainGreyMaterial)}
                                          className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1 transition-colors ${isDarkMode
                                              ? 'text-emerald-400 border border-emerald-400 hover:bg-emerald-500/20'
                                              : 'text-emerald-600 border border-emerald-600 hover:bg-emerald-50'
                                            }`}
                                          title="Edit"
                                        >
                                          <PencilIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          <span className="hidden sm:inline">Edit</span>
                                        </button>

                                        {isMaster && (false ? (
                                          <button
                                            disabled
                                            className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1 transition-colors opacity-50 cursor-not-allowed ${isDarkMode
                                                ? 'text-blue-400 border border-blue-400'
                                                : 'text-blue-600 border border-blue-600'
                                              }`}
                                            title="Delete All"
                                          >
                                            <ArrowPathIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                            <span className="hidden sm:inline">Delete All</span>
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleDeleteQualityGroup(mainGreyMaterial, greyMaterials)}
                                            disabled={false}
                                            className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center space-x-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                                                ? 'text-red-400 border border-red-400 hover:bg-red-500/20'
                                                : 'text-red-600 border border-red-600 hover:bg-red-50'
                                              }`}
                                            title={`Delete Quality Group (${greyMaterials.length} items)`}
                                          >
                                            <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
      {showDetails && selectedGreyMaterial && (
        <GreyMaterialDetails
          greyMaterial={selectedGreyMaterial}
          allGreyMaterialsInGroup={selectedGreyMaterialGroup}
          onClose={() => setShowDetails(false)}
          onEdit={() => {
            setShowDetails(false);
            handleEdit(selectedGreyMaterial);
          }}
          onDelete={(greyMaterial) => {
            setShowDetails(false);
            handleDelete(greyMaterial);
          }}
          onBulkDelete={(greyMaterials) => {
            setShowDetails(false);
            const group = {
              qualityCode: selectedGreyMaterial?.qualityCode || '',
              qualityName: selectedGreyMaterial?.qualityName || '',
              items: greyMaterials
            };
            setBulkDeleteGroup(group);
            setShowDeleteConfirmation(true);
          }}
        />
      )}

      {showDeleteConfirmation && (
        deletingGreyMaterial ? (
          <DeleteConfirmation
            mode="single"
            greyMaterial={deletingGreyMaterial}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
            isDeleting={isDeleting}
            dependencies={deleteDependencies}
            isLoadingDependencies={isLoadingDependencies}
          />
        ) : bulkDeleteGroup ? (
          <DeleteConfirmation
            mode="bulk"
            greyMaterials={bulkDeleteGroup.items}
            qualityCode={bulkDeleteGroup.qualityCode}
            qualityName={bulkDeleteGroup.qualityName}
            onConfirm={confirmBulkDelete}
            onCancel={cancelBulkDelete}
            isDeleting={isBulkDeleting}
          />
        ) : null
      )}

      {/* Sticker PDF Preview Modal - Matching Sampling Page Design */}
      {showStickerPreview && currentStickerGreyMaterial && (
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
              setCurrentStickerGreyMaterial(null);
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
                    setCurrentStickerGreyMaterial(null);
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
                src={showImageModal.greyMaterial.images?.[selectedImageIndex]}
                alt="GreyMaterial"
                className="max-w-full max-h-[65vh] object-contain rounded-lg transition-transform duration-200 ease-out"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Slider Navigation Arrows */}
            {showImageModal.greyMaterial.images && showImageModal.greyMaterial.images.length > 1 && (
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
                  const imgUrl = showImageModal.greyMaterial.images?.[selectedImageIndex];
                  if (imgUrl) window.open(imgUrl, '_blank'); 
                }}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-md border border-white/10"
                title="Open in New Tab"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const imgUrl = showImageModal.greyMaterial.images?.[selectedImageIndex];
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
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Info */}
            <div className="absolute bottom-4 left-4 bg-black/65 px-3 py-1.5 rounded-lg text-xs text-white backdrop-blur-md max-w-xs truncate border border-white/10 shadow-lg z-30">
              <span className="font-semibold block text-[10px] uppercase text-gray-400 mb-0.5">
                Image {selectedImageIndex + 1} of {showImageModal.greyMaterial.images?.length || 0}
              </span>
              <span className="opacity-90 text-[10px] block truncate">
                {showImageModal.greyMaterial.images?.[selectedImageIndex]}
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

      {/* GreyMaterial Form Modal */}
      {showGreyMaterialForm && (
        <Suspense fallback={
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            style={{ zIndex: Z_INDEX.MODAL }}
          >
            <div className={`animate-spin rounded-full h-12 w-12 border-2 border-t-transparent ${isDarkMode ? 'border-blue-500' : 'border-blue-600'
              }`}></div>
          </div>
        }>
          <GreyMaterialForm
            item={editingGreyMaterial}
            onClose={handleGreyMaterialFormClose}
            onSave={handleGreyMaterialSaved}
            isDarkMode={isDarkMode}
          />
        </Suspense>
      )}
    </div>
  );
}