'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { debounce } from 'lodash';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CalendarIcon,
  ClockIcon,
  BoltIcon,
  ExclamationTriangleIcon as WarningIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  BeakerIcon,
  PhotoIcon,
  DocumentTextIcon,
  TruckIcon,
  CubeIcon,
  Squares2X2Icon,
  ListBulletIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ArrowUpIcon,
  WifiIcon,
  SignalSlashIcon
} from '@heroicons/react/24/outline';
import OrderForm from './components/OrderForm';

import PartyModal from './components/PartyModal';
import QualityModal from './components/QualityModal';
import MillModal from './components/MillModal';
import LabAddModal from './components/LabDataModal';
import { generateOrderPDF } from '@/lib/pdfGenerator';
import OrderLogsModal from './components/OrderLogsModal';
import LabDataModal from './components/LabDataModal';
import MillInputForm from './components/MillInputForm';
import MillOutputForm from './components/MillOutputForm';
import DispatchForm from './components/DispatchForm';
import GreyInformationModal from './components/GreyInformationModal';
import OrdersTableSkeleton from './components/OrdersTableSkeleton';
import { Order, Party, Quality, Mill, MillOutput } from '@/types';
import { useDarkMode } from '../hooks/useDarkMode';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDisplayOrderId } from '@/utils/orders';
import { useSession } from '../hooks/useSession';

// Enhanced message interface
interface ValidationMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
  timestamp: number;
  autoDismiss?: boolean;
  dismissTime?: number;
}



// Helper: extract FY code from orderId, returns null for legacy orders
const getOrderFY = (orderId: string): string | null => {
  const match = orderId?.match(/^FY(\d{4})-/);
  return match ? match[1] : null;
};

// Helper function to get highest priority process from mill input data
const getHighestPriorityProcess = (processData: any, qualityName?: string) => {
  if (!processData) return null;

  const allProcesses = [
    processData.mainProcess,
    ...processData.additionalProcesses
  ].filter(process => process && process.trim() !== '');

  if (allProcesses.length === 0) return null;

  // Define process priority order (higher number = higher priority)
  const processPriority = [
    'Lot No Greigh',    // 1
    'Charkha',          // 2
    'Drum',             // 3
    'Soflina WR',       // 4
    'long jet',         // 5
    'setting',          // 6
    'In Dyeing',        // 7
    'jigar',            // 8
    'in printing',      // 9
    'loop',             // 10
    'washing',          // 11
    'Finish',           // 12
    'folding',          // 13
    'ready to dispatch', // 14
    'In House'          // 15 - Highest priority, shows first
  ];

  // Sort by priority (highest number first) and return the first one
  const sortedProcesses = allProcesses.sort((a, b) => {
    const aIndex = processPriority.indexOf(a);
    const bIndex = processPriority.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return bIndex - aIndex; // Higher index = higher priority
  });

  return sortedProcesses[0]; // Return highest priority process
};

interface OrdersClientProps {
  initialOrders?: Order[];
  initialParties?: Party[];
  initialQualities?: Quality[];
  initialMills?: Mill[];
}

export default function OrdersClient({
  initialOrders = [],
  initialParties = [],
  initialQualities = [],
  initialMills = []
}: OrdersClientProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUser, isSuperAdmin } = useSession();

  // Initialize with server data if available, otherwise start empty
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [qualities, setQualities] = useState<Quality[]>(initialQualities);
  const [mills, setMills] = useState<Mill[]>(initialMills);

  // Helper function to safely set orders (always ensure it's an array)
  const setOrdersSafe = useCallback((ordersData: any) => {
    // ⚡ FIX: Filter out deleted orders before setting state
    const filterDeletedOrders = (ordersList: Order[]) => {
      return ordersList.filter(order => {
        const orderId = order._id || '';
        const orderIdStr = order.orderId || '';
        return !deletedOrderIdsRef.current.has(String(orderId)) &&
          !deletedOrderIdsRef.current.has(String(orderIdStr));
      });
    };

    // If it's a function (updater function), pass it directly to setOrders
    if (typeof ordersData === 'function') {
      setOrders((prevOrders: Order[]) => {
        const result = ordersData(prevOrders);
        const safeOrders = Array.isArray(result) ? result : [];
        const filtered = filterDeletedOrders(safeOrders);
        console.log('🔍 setOrdersSafe (updater) result:', {
          resultLength: safeOrders.length,
          filteredLength: filtered.length,
          firstOrder: filtered[0]
        });
        return filtered;
      });
      return;
    }

    // Otherwise, ensure it's an array and filter deleted orders
    const safeOrders = Array.isArray(ordersData) ? ordersData : [];
    const filtered = filterDeletedOrders(safeOrders);
    console.log('🔍 setOrdersSafe called with:', {
      originalData: ordersData,
      isArray: Array.isArray(ordersData),
      safeOrdersLength: safeOrders.length,
      filteredLength: filtered.length,
      firstOrder: filtered[0]
    });
    setOrders(filtered);
    console.log('🔍 setOrders called, orders state should update');
  }, []);
  // If we have initial data from server, we're already loaded
  const [loading, setLoading] = useState(initialOrders.length === 0);
  const [ordersLoaded, setOrdersLoaded] = useState(initialOrders.length > 0);
  const [initialLoadTime, setInitialLoadTime] = useState<number | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'critical' | 'secondary' | 'complete'>('critical');

  // Debug orders state changes
  useEffect(() => {
    console.log('🔍 Orders state changed:', {
      ordersLength: orders.length,
      firstOrder: orders[0],
      ordersLoaded
    });
  }, [orders, ordersLoaded]);

  // Set initial load time when component mounts
  useEffect(() => {
    if (!initialLoadTime) {
      setInitialLoadTime(Date.now());
    }
  }, [initialLoadTime]);
  const [tableLoading, setTableLoading] = useState(initialOrders.length === 0);
  const [progressiveLoading, setProgressiveLoading] = useState(false);
  const [orderCreating, setOrderCreating] = useState(false);
  // ⚡ INSTANT: Initialize state from localStorage cache synchronously (for instant button text)
  const [orderMillInputs, setOrderMillInputs] = useState<{ [key: string]: any[] }>(() => {
    try {
      const cache = localStorage.getItem('process-data-cache');
      if (cache) {
        const cached = JSON.parse(cache);
        if (Date.now() - cached.timestamp < 300000) {
          return cached.millInputs || {};
        }
      }
    } catch (e) { }
    return {};
  });

  const [orderGreyInfo, setOrderGreyInfo] = useState<{ [key: string]: any[] }>(() => {
    try {
      const cache = localStorage.getItem('process-data-cache');
      if (cache) {
        const cached = JSON.parse(cache);
        if (Date.now() - cached.timestamp < 300000) {
          console.log('⚡ INSTANT: Grey info initialized from cache on mount:', cached.greyInfo);
          return cached.greyInfo || {};
        }
      }
    } catch (e) { }
    return {};
  });

  // ⚡ FAST CHECK: Track if grey info exists (for instant edit/add button display)
  const [greyInfoExists, setGreyInfoExists] = useState<{ [key: string]: boolean }>({});

  // ⚡ STATE: Mill Outputs (like mill inputs and grey info)
  const [orderMillOutputs, setOrderMillOutputs] = useState<{ [key: string]: any[] }>(() => {
    try {
      const cache = localStorage.getItem('process-data-cache');
      if (cache) {
        const cached = JSON.parse(cache);
        if (Date.now() - cached.timestamp < 300000) {
          return cached.millOutputs || {};
        }
      }
    } catch (e) { }
    return {};
  });

  // ⚡ STATE: Dispatches (like mill inputs and grey info)
  const [orderDispatches, setOrderDispatches] = useState<{ [key: string]: any[] }>(() => {
    try {
      const cache = localStorage.getItem('process-data-cache');
      if (cache) {
        const cached = JSON.parse(cache);
        if (Date.now() - cached.timestamp < 300000) {
          return cached.dispatches || {};
        }
      }
    } catch (e) { }
    return {};
  });

  const [processDataByQuality, setProcessDataByQuality] = useState<{ [key: string]: string[] }>(() => {
    try {
      const cache = localStorage.getItem('process-data-cache');
      if (cache) {
        const cached = JSON.parse(cache);
        if (Date.now() - cached.timestamp < 300000) {
          return cached.processData || {};
        }
      }
    } catch (e) { }
    return {};
  });
  const [processDataLoading, setProcessDataLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchType, setSearchType] = useState('all'); // all, orderId, poNumber, styleNo, party, quality, mill
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  // Mill filter search state
  const [millSearchTerm, setMillSearchTerm] = useState('');
  const [showMillDropdown, setShowMillDropdown] = useState(false);

  // Load search state from localStorage on mount
  useEffect(() => {
    const savedSearchTerm = localStorage.getItem('ordersSearchTerm');
    const savedSearchType = localStorage.getItem('ordersSearchType');

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
    if (savedSearchType) {
      setSearchType(savedSearchType);
    }
  }, []);

  // Save search state to localStorage
  useEffect(() => {
    localStorage.setItem('ordersSearchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('ordersSearchType', searchType);
  }, [searchType]);

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
      behavior: 'auto' // Normal instant scroll - no smooth animation
    });
  }, []);

  // Offline detection with improved connectivity checks
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Use improved offline detection
    import('@/lib/offlineDetection').then(({ initOfflineDetection }) => {
      cleanup = initOfflineDetection(
        () => setIsOffline(false),
        () => setIsOffline(true)
      );
    }).catch(() => {
      // Fallback to basic detection if import fails
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      cleanup = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const [sortLoading, setSortLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formParties, setFormParties] = useState<any[]>([]);
  const [formQualities, setFormQualities] = useState<any[]>([]);
  const [recentlyAddedPartyId, setRecentlyAddedPartyId] = useState<string | null>(null);
  const [recentlyAddedQualityId, setRecentlyAddedQualityId] = useState<string | null>(null);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showMillModal, setShowMillModal] = useState(false);
  const [showLabAddModal, setShowLabAddModal] = useState(false);
  const [selectedOrderForLab, setSelectedOrderForLab] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<ValidationMessage[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleteModalClosing, setIsDeleteModalClosing] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Track which order is currently being deleted (by order ID) to show loading state
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // Item deletion confirmation state
  const [showItemDeleteModal, setShowItemDeleteModal] = useState(false);
  const [isItemDeleteModalClosing, setIsItemDeleteModalClosing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ orderId: string, itemId: string | number, itemName: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // ⚡ FIX: Track deleted order IDs to prevent them from reappearing
  const deletedOrderIdsRef = useRef<Set<string>>(new Set());

  // Status change confirmation state
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [isStatusModalClosing, setIsStatusModalClosing] = useState(false);
  const [statusChangeData, setStatusChangeData] = useState<{ orderId: string, newStatus: "pending" | "delivered", orderIdDisplay: string } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [screenSize, setScreenSize] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  // Cookie helper functions
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
      const savedItemsPerPage = getCookie('ordersItemsPerPage');
      if (savedItemsPerPage) {
        const parsed = parseInt(savedItemsPerPage, 10);
        // Validate it's one of the allowed options
        if ([10, 25, 50, 100].includes(parsed)) {
          return parsed;
        }
      }
    }
    return 10; // Default to 10 orders per page
  });
  const [paginationInfo, setPaginationInfo] = useState({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [isChangingPage, setIsChangingPage] = useState(false);

  const [showQuickActions, setShowQuickActions] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [resettingCounter, setResettingCounter] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleteAllModalClosing, setIsDeleteAllModalClosing] = useState(false);
  const [showResetIdModal, setShowResetIdModal] = useState(false);
  const [isResetIdModalClosing, setIsResetIdModalClosing] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [imageSlideDirection, setImageSlideDirection] = useState<'left' | 'right' | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedOrderForLogs, setSelectedOrderForLogs] = useState<Order | null>(null);
  const [showLabDataModal, setShowLabDataModal] = useState(false);
  const [selectedOrderForLabData, setSelectedOrderForLabData] = useState<Order | null>(null);

  // Scroll to top button state
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Offline detection state
  const [isOffline, setIsOffline] = useState(false);

  const [showMillInputForm, setShowMillInputForm] = useState(false);
  const [selectedOrderForMillInputForm, setSelectedOrderForMillInputForm] = useState<Order | null>(null);
  const [existingMillInputs, setExistingMillInputs] = useState<any[]>([]);
  const [isEditingMillInput, setIsEditingMillInput] = useState(false);
  const [showMillOutputForm, setShowMillOutputForm] = useState(false);
  const [selectedOrderForMillOutput, setSelectedOrderForMillOutput] = useState<Order | null>(null);
  const [existingMillOutputs, setExistingMillOutputs] = useState<any[]>([]);
  const [isEditingMillOutput, setIsEditingMillOutput] = useState(false);
  // orderMillOutputs state is declared above with cache initialization
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [existingDispatches, setExistingDispatches] = useState<any[]>([]);
  const [isEditingDispatch, setIsEditingDispatch] = useState(false);
  // orderDispatches state is declared above with cache initialization
  // mills state already initialized above with initialMills
  const [millsLoading, setMillsLoading] = useState<boolean>(false);
  // Grey Information modal state
  const [showGreyInfoModal, setShowGreyInfoModal] = useState(false);
  const [selectedOrderForGreyInfo, setSelectedOrderForGreyInfo] = useState<Order | null>(null);
  const [loadingGreyInfo, setLoadingGreyInfo] = useState<string | null>(null); // Track which order is loading
  const [loadingMillInput, setLoadingMillInput] = useState<string | null>(null); // Track which order is loading
  const [loadingMillOutput, setLoadingMillOutput] = useState<string | null>(null); // Track which order is loading
  const [loadingDispatch, setLoadingDispatch] = useState<string | null>(null); // Track which order is loading

  // Force re-render state for button updates
  const [forceRender, setForceRender] = useState(0);

  // Performance optimization - single cache system
  // Ref to store fetchOrders function for use in handleClearFilters
  const fetchOrdersRef = useRef<((retryCount?: number, page?: number, limit?: number, forceRefresh?: boolean, currentFilters?: any, searchQuery?: string) => Promise<void>) | null>(null);

  // ⚡ FIX: Track last visibility change time to prevent rapid refreshes
  const lastVisibilityChangeRef = useRef<number>(0);

  const dataCache = useRef<{
    orders: { data: any, timestamp: number } | null;
    mills: { data: any, timestamp: number } | null;
    parties: { data: any, timestamp: number } | null;
    qualities: { data: any, timestamp: number } | null;
    timestamp: number;
    ttl: number;
  }>({
    orders: null,
    mills: null,
    parties: null,
    qualities: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000 // 5 minutes
  });

  const itemsPerPageOptions = [10, 25, 50, 100] as const;
  const [isInitialized, setIsInitialized] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [isValidating, setIsValidating] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('ordersViewMode');
      return savedViewMode === 'cards' ? 'cards' : 'table';
    }
    return 'table';
  });

  // Professional helper functions for button states - declared early to maintain hooks order
  const hasMillInputs = useCallback((order: Order) => {
    // Check both order.millInputs property and orderMillInputs state
    const orderMillInputsProperty = (order as any).millInputs;
    const orderMillInputsState = orderMillInputs[order.orderId];

    const hasPropertyData = Array.isArray(orderMillInputsProperty) && orderMillInputsProperty.length > 0;
    const hasStateData = Array.isArray(orderMillInputsState) && orderMillInputsState.length > 0;

    console.log('🔍 hasMillInputs check:', {
      orderId: order.orderId,
      hasPropertyData,
      hasStateData,
      propertyLength: orderMillInputsProperty?.length || 0,
      stateLength: orderMillInputsState?.length || 0
    });

    return hasPropertyData || hasStateData;
  }, [forceRender, orderMillInputs]);

  // ⚡ FIXED: Check mill outputs (like hasMillInputs - check state first)
  const hasMillOutputs = useCallback((order: Order) => {
    if (!order) return false;

    // ⚡ FIRST: Check state (most reliable - already loaded)
    const orderMillOutputsState = orderMillOutputs[order.orderId] || orderMillOutputs[String(order._id)];
    const hasStateData = Array.isArray(orderMillOutputsState) && orderMillOutputsState.length > 0;

    if (hasStateData) {
      return true;
    }

    // ⚡ SECOND: Check order property (in case API includes it)
    const orderMillOutputsProperty = (order as any).millOutputs;
    const hasPropertyData = Array.isArray(orderMillOutputsProperty) && orderMillOutputsProperty.length > 0;
    if (hasPropertyData) {
      return true;
    }

    // ⚡ THIRD: Check process-data-cache synchronously
    if (order.orderId) {
      try {
        const processDataCache = localStorage.getItem('process-data-cache');
        if (processDataCache) {
          const processCacheData = JSON.parse(processDataCache);
          if (processCacheData.millOutputs) {
            const cachedMillOutputs = processCacheData.millOutputs[order.orderId] || processCacheData.millOutputs[String(order._id)];
            if (Array.isArray(cachedMillOutputs) && cachedMillOutputs.length > 0) {
              setOrderMillOutputs(prev => ({
                ...prev,
                [order.orderId]: cachedMillOutputs,
                [String(order._id)]: cachedMillOutputs
              }));
              setForceRender(prev => prev + 1);
              return true;
            }
          }
        }
      } catch (e) { }
    }

    return false;
  }, [forceRender, orderMillOutputs]);

  // ⚡ FIXED: Check dispatches (like hasMillInputs - check state first)
  const hasDispatches = useCallback((order: Order) => {
    if (!order) return false;

    // ⚡ FIRST: Check state (most reliable - already loaded)
    const orderDispatchesState = orderDispatches[order.orderId] || orderDispatches[String(order._id)];
    const hasStateData = Array.isArray(orderDispatchesState) && orderDispatchesState.length > 0;

    if (hasStateData) {
      return true;
    }

    // ⚡ SECOND: Check order property (in case API includes it)
    const orderDispatchesProperty = (order as any).dispatches;
    const hasPropertyData = Array.isArray(orderDispatchesProperty) && orderDispatchesProperty.length > 0;
    if (hasPropertyData) {
      return true;
    }

    // ⚡ THIRD: Check process-data-cache synchronously
    if (order.orderId) {
      try {
        const processDataCache = localStorage.getItem('process-data-cache');
        if (processDataCache) {
          const processCacheData = JSON.parse(processDataCache);
          if (processCacheData.dispatches) {
            const cachedDispatches = processCacheData.dispatches[order.orderId] || processCacheData.dispatches[String(order._id)];
            if (Array.isArray(cachedDispatches) && cachedDispatches.length > 0) {
              setOrderDispatches(prev => ({
                ...prev,
                [order.orderId]: cachedDispatches,
                [String(order._id)]: cachedDispatches
              }));
              setForceRender(prev => prev + 1);
              return true;
            }
          }
        }
      } catch (e) { }
    }

    return false;
  }, [forceRender, orderDispatches]);

  const hasLabData = useCallback((order: Order) => {
    // Check if order has labData array with items
    if (order.labData && Array.isArray(order.labData) && order.labData.length > 0) {
      console.log('🔍 hasLabData: order.labData exists, length:', order.labData.length, 'orderId:', order.orderId, 'forceRender:', forceRender);
      return true;
    }

    // Check if any item has lab data (check for labSendDate as it's the primary field)
    if (order.items && Array.isArray(order.items)) {
      const hasItemLabData = order.items.some(item =>
        item.labData && (
          item.labData.labSendDate ||
          item.labData.sampleNumber ||
          item.labData.approvalDate
        )
      );
      console.log('🔍 hasLabData: checking items, hasItemLabData:', hasItemLabData, 'orderId:', order.orderId, 'forceRender:', forceRender);
      return hasItemLabData;
    }

    console.log('🔍 hasLabData: no lab data found, orderId:', order.orderId, 'forceRender:', forceRender);
    return false;
  }, [forceRender]);

  const handleViewModeChange = useCallback((newMode: 'table' | 'cards') => {
    setViewMode(newMode);
    localStorage.setItem('ordersViewMode', newMode);
  }, []);

  // Financial Year filter state
  const [fyOptions, setFyOptions] = useState<{ value: string; label: string; isCurrent: boolean }[]>([]);
  const [showFYDropdown, setShowFYDropdown] = useState(false);
  const [fyAlertDismissed, setFyAlertDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fyAlertDismissed_2026_27') === 'true';
    }
    return false;
  });

  // Check if we're in the first 14 days of April (new FY alert period)
  const isNewFYPeriod = useMemo(() => {
    const now = new Date();
    // Month is 0-indexed (3 = April). Show alert from April 1 to April 14
    return now.getMonth() === 3 && now.getDate() >= 1 && now.getDate() <= 14;
  }, []);

  // Filters
  const [filters, setFilters] = useState({
    orderFilter: 'latest_first', // latest_first, oldest_first - default to latest first (by creation date)
    typeFilter: 'all', // all, Dying, Printing
    statusFilter: 'pending', // all, pending, delivered - default to pending
    fyFilter: '', // Financial year filter (e.g. "2526", "legacy", or "" for all)
    orderType: '', // For API compatibility
    status: 'pending', // For API compatibility - default to pending
    startDate: '', // For API compatibility
    endDate: '', // For API compatibility
    millId: '' // Mill filter
  });


  // Track screen size
  useEffect(() => {
    const handleResize = () => {
      setScreenSize(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLargeScreen = screenSize > 1200;
  const isMediumScreen = screenSize > 768;
  const isSmallScreen = screenSize > 640;

  // Enhanced message system with better UX
  const showMessage = useCallback((type: 'success' | 'error' | 'warning' | 'info', text: string, options?: { autoDismiss?: boolean; dismissTime?: number }) => {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: ValidationMessage = {
      id: messageId,
      type,
      text,
      timestamp: Date.now(),
      autoDismiss: options?.autoDismiss ?? true,
      dismissTime: options?.dismissTime ?? 5000
    };

    setMessages(prev => [...prev, newMessage]);

    // Auto dismiss if enabled
    if (newMessage.autoDismiss) {
      setTimeout(() => {
        dismissMessage(messageId);
      }, newMessage.dismissTime);
    }
  }, []);

  // Dismiss specific message
  const dismissMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Dismiss all messages
  const dismissAllMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const validateFilters = useCallback((currentFilters: any) => {
    const errors: { [key: string]: string } = {};

    if (!currentFilters.orderFilter || !['latest_first', 'oldest_first'].includes(currentFilters.orderFilter)) {
      errors.orderFilter = 'Invalid order filter';
    }

    if (!currentFilters.typeFilter || !['all', 'Dying', 'Printing'].includes(currentFilters.typeFilter)) {
      errors.typeFilter = 'Invalid type filter';
    }

    return errors;
  }, []);

  // Debounce timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced server-side search handler with debounce and search type
  const handleSearchChange = useCallback(async (value: string) => {
    const trimmedValue = value.trim();
    setSearchTerm(trimmedValue);
    setCurrentPage(1); // Reset to page 1 when searching

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If empty search, fetch all orders immediately
    if (!trimmedValue) {
      setSearchLoading(true);
      try {
        // Use fetchOrdersRef to avoid dependency on fetchOrders declaration order
        if (fetchOrdersRef.current) {
          await fetchOrdersRef.current(0, 1, itemsPerPage, true, filters, '');
        }
      } finally {
        setSearchLoading(false);
      }
      return;
    }

    // Smart search: normalize the search term
    // Remove extra spaces, handle special characters
    const normalizedValue = trimmedValue
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);

      // Create enhanced search query with type prefix
      // When searchType is 'all', search across all fields without prefix
      let searchQuery = normalizedValue;
      if (normalizedValue && searchType !== 'all') {
        searchQuery = `${searchType}:${normalizedValue}`;
      }

      try {
        // Force refresh to ensure fresh results
        // Use fetchOrdersRef to avoid dependency on fetchOrders declaration order
        if (fetchOrdersRef.current) {
          await fetchOrdersRef.current(0, 1, itemsPerPage, true, filters, searchQuery);
        } else {
          // Fallback: direct API call if ref not available yet
          const token = localStorage.getItem('token');
          if (token) {
            const url = new URL('/api/orders', window.location.origin);
            url.searchParams.append('limit', itemsPerPage.toString());
            url.searchParams.append('page', '1');
            if (searchQuery) {
              url.searchParams.append('search', searchQuery);
            }
            if (filters.orderType) {
              url.searchParams.append('orderType', filters.orderType);
            }
            if (filters.status) {
              url.searchParams.append('status', filters.status);
            }
            url.searchParams.append('t', Date.now().toString());

            const response = await fetch(url.toString(), {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
              }
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                setOrdersSafe(Array.isArray(data.data) ? data.data : []);
                setOrdersLoaded(true);
                if (data.pagination) {
                  setPaginationInfo({
                    totalCount: data.pagination.total || 0,
                    totalPages: data.pagination.pages || 1,
                    currentPage: data.pagination.page || 1,
                    hasNextPage: (data.pagination.page || 1) < (data.pagination.pages || 1),
                    hasPrevPage: (data.pagination.page || 1) > 1
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Search error:', error);
        // Retry once on error with exponential backoff
        try {
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before retry
          if (fetchOrdersRef.current) {
            await fetchOrdersRef.current(0, 1, itemsPerPage, true, filters, searchQuery);
          }
        } catch (retryError) {
          console.error('Search retry error:', retryError);
          showMessage('error', 'Search failed. Please try again.', { autoDismiss: true, dismissTime: 3000 });
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300); // 300ms debounce for optimal balance between responsiveness and performance
  }, [itemsPerPage, filters, searchType, showMessage, setOrdersSafe]);

  // Server-side filter handlers - Optimized - ALL FILTERS WORK SIMULTANEOUSLY
  const handleFilterChange = useCallback(async (filterType: string, value: string) => {
    console.log('🔧 Filter change:', filterType, '=', value);
    console.log('🔧 Current filters before change:', filters);

    // Set appropriate loading state
    if (filterType === 'orderFilter') {
      setSortLoading(true);
    } else {
      setFilterLoading(true);
    }
    setTableLoading(true); // Show table skeleton during filtering

    try {
      // Start with current filters to preserve all existing filter values
      const newFilters = { ...filters };

      // Update the specific filter that changed (using explicit property assignment to avoid TypeScript error)
      switch (filterType) {
        case 'orderFilter':
          newFilters.orderFilter = value;
          break;
        case 'typeFilter':
          newFilters.typeFilter = value;
          newFilters.orderType = value === 'all' ? '' : value;
          console.log('🔧 Mapped typeFilter to orderType:', newFilters.orderType);
          break;
        case 'statusFilter':
          newFilters.statusFilter = value;
          newFilters.status = value === 'all' ? '' : value;
          console.log('🔧 Mapped statusFilter to status:', newFilters.status, 'from value:', value);
          break;
        case 'fyFilter':
          (newFilters as any).fyFilter = value || '';
          console.log('🔧 FY filter set to:', value);
          break;
        case 'millId':
          newFilters.millId = value || '';
          console.log('🔧 Mill filter set to:', newFilters.millId);
          if (!value) {
            setMillSearchTerm('');
          }
          break;
        case 'startDate':
          newFilters.startDate = value;
          break;
        case 'endDate':
          newFilters.endDate = value;
          break;
        default:
          console.warn('Unknown filter type:', filterType);
      }

      // Ensure all filter mappings are preserved (in case they weren't set yet)
      if (!newFilters.hasOwnProperty('orderType')) {
        newFilters.orderType = newFilters.typeFilter === 'all' ? '' : (newFilters.typeFilter || '');
      }
      if (!newFilters.hasOwnProperty('status')) {
        newFilters.status = newFilters.statusFilter === 'all' ? '' : (newFilters.statusFilter || 'pending');
      }

      console.log('🔧 New filters object (ALL FILTERS PRESERVED):', newFilters);
      console.log('🔧 Filters being sent to API:', {
        orderType: newFilters.orderType,
        status: newFilters.status,
        millId: newFilters.millId,
        sort: newFilters.orderFilter,
        search: searchTerm
      });

      setFilters(newFilters);
      setCurrentPage(1); // Reset to page 1 when filtering

      // Force refresh to get filtered results from server with ALL filters
      console.log('🔧 Fetching orders with ALL filters simultaneously...');
      await fetchOrders(0, 1, itemsPerPage, true, newFilters, searchTerm);
      console.log('✅ Filter applied successfully with all filters working together');
    } catch (error) {
      console.error('❌ Error applying filter:', error);
      showMessage('error', 'Failed to apply filter', { autoDismiss: true, dismissTime: 3000 });
    } finally {
      // Clear loading states
      if (filterType === 'orderFilter') {
        setSortLoading(false);
      } else {
        setFilterLoading(false);
      }
      setTableLoading(false); // Hide table skeleton
    }
  }, [filters, itemsPerPage, searchTerm, showMessage]);

  const handleClearFilters = useCallback(async () => {
    console.log('🧹 Clearing all filters...');

    // Reset all filter states
    setSearchTerm('');
    setSearchType('all');
    setMillSearchTerm('');
    setShowMillDropdown(false);
    setFilterLoading(true);
    setTableLoading(true);

    // Reset filters to default values (status defaults to 'pending')
    const defaultFilters = {
      orderFilter: 'latest_first',
      typeFilter: 'all',
      statusFilter: 'pending', // Default to pending status
      fyFilter: '', // Reset FY filter (show all)
      orderType: '',
      status: 'pending', // Default to pending for API
      startDate: '',
      endDate: '',
      millId: ''
    };

    setFilters(defaultFilters);
    setCurrentPage(1);

    try {
      // Fetch all orders from server with default filters
      console.log('🧹 Fetching all orders after clearing filters...');
      // Use ref if available, otherwise call directly (will be available after first render)
      if (fetchOrdersRef.current) {
        await fetchOrdersRef.current(0, 1, itemsPerPage, true, defaultFilters, '');
      } else {
        // Fallback: direct fetch call
        const token = localStorage.getItem('token');
        if (token) {
          const url = new URL('/api/orders', window.location.origin);
          url.searchParams.append('limit', itemsPerPage.toString());
          url.searchParams.append('page', '1');
          url.searchParams.append('sort', 'latest_first');
          url.searchParams.append('status', 'pending'); // Default status
          url.searchParams.append('t', Date.now().toString());

          const response = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setOrdersSafe(Array.isArray(data.data) ? data.data : []);
              setOrdersLoaded(true);
              if (data.pagination) {
                setPaginationInfo({
                  totalCount: data.pagination.total || 0,
                  totalPages: data.pagination.pages || 1,
                  currentPage: data.pagination.page || 1,
                  hasNextPage: (data.pagination.page || 1) < (data.pagination.pages || 1),
                  hasPrevPage: (data.pagination.page || 1) > 1
                });
              }
            }
          }
        }
      }
      console.log('✅ Filters cleared successfully');
      showMessage('success', 'All filters cleared', { autoDismiss: true, dismissTime: 2000 });
    } catch (error) {
      console.error('❌ Error clearing filters:', error);
      showMessage('error', 'Failed to clear filters', { autoDismiss: true, dismissTime: 3000 });
    } finally {
      setFilterLoading(false);
      setTableLoading(false);
    }
  }, [itemsPerPage, showMessage, setOrdersSafe]);

  // Mill filter handlers - Optimized
  const handleMillSearchChange = useCallback((value: string) => {
    setMillSearchTerm(value);
    // Auto-open dropdown when typing
    if (value && !showMillDropdown) {
      setShowMillDropdown(true);
    }
  }, [showMillDropdown]);

  const handleMillSelect = useCallback(async (mill: Mill) => {
    console.log('🔧 Mill selected:', mill.name, mill._id);
    setMillSearchTerm(mill.name);
    setShowMillDropdown(false);
    // Ensure mill._id is a string (it should always be, but handle edge cases)
    const millIdString = String(mill._id || '');
    await handleFilterChange('millId', millIdString);
  }, [handleFilterChange]);

  const handleMillDropdownToggle = useCallback(async () => {
    if (showMillDropdown) {
      setShowMillDropdown(false);
    } else {
      // ⚡ FIX: Clear ALL mill-related caches aggressively when opening dropdown
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('mills_cache');
          // Clear all mill-related caches
          Object.keys(localStorage).forEach(key => {
            if (key.includes('mill') || key.includes('mills')) {
              localStorage.removeItem(key);
            }
          });
          // Also clear process-data-cache if it exists
          try {
            const processCache = localStorage.getItem('process-data-cache');
            if (processCache) {
              const cacheData = JSON.parse(processCache);
              cacheData.millsTimestamp = 0;
              localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
            }
          } catch (e) { }
          console.log('🗑️ Cleared ALL mill caches before opening filter dropdown');
        } catch (e) {
          console.error('Error clearing caches:', e);
        }
      }

      // ⚡ FIX: Fetch fresh mills directly to ensure latest data
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const millsResponse = await fetch(`/api/mills?t=${Date.now()}&limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          });

          if (millsResponse.ok) {
            const millsData = await millsResponse.json();
            if (millsData.success && Array.isArray(millsData.data)) {
              // Update mills state immediately with fresh data
              setMills(millsData.data);
              console.log('✅ Updated mills state with fresh data:', millsData.data.length, 'mills');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching fresh mills:', error);
      }

      // Direct fetch above is sufficient for immediate UI update

      setShowMillDropdown(true);
    }
  }, [showMillDropdown]);

  const handleClearMillFilter = useCallback(async () => {
    console.log('🧹 Clearing mill filter - showing all orders...');
    setMillSearchTerm('');
    setShowMillDropdown(false);

    // Clear mill filter to show all orders (keep other filters as is)
    const newFilters = { ...filters, millId: '' };
    setFilters(newFilters);

    // Fetch orders without mill filter
    if (fetchOrdersRef.current) {
      await fetchOrdersRef.current(0, 1, itemsPerPage, true, newFilters, searchTerm);
    } else {
      // Fallback: direct fetch
      const token = localStorage.getItem('token');
      if (token) {
        const url = new URL('/api/orders', window.location.origin);
        url.searchParams.append('limit', itemsPerPage.toString());
        url.searchParams.append('page', '1');
        if (filters.orderFilter && filters.orderFilter !== 'latest_first') {
          url.searchParams.append('sort', filters.orderFilter);
        }
        if (filters.status) {
          url.searchParams.append('status', filters.status);
        }
        if (filters.orderType) {
          url.searchParams.append('orderType', filters.orderType);
        }
        url.searchParams.append('t', Date.now().toString());

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setOrdersSafe(Array.isArray(data.data) ? data.data : []);
            setOrdersLoaded(true);
            if (data.pagination) {
              setPaginationInfo({
                totalCount: data.pagination.total || 0,
                totalPages: data.pagination.pages || 1,
                currentPage: data.pagination.page || 1,
                hasNextPage: (data.pagination.page || 1) < (data.pagination.pages || 1),
                hasPrevPage: (data.pagination.page || 1) > 1
              });
            }
          }
        }
      }
    }
  }, [filters, itemsPerPage, searchTerm, setOrdersSafe]);

  // Filter mills based on search term
  const filteredMills = useMemo(() => {
    if (!millSearchTerm.trim()) {
      return mills;
    }
    const searchLower = millSearchTerm.toLowerCase();
    return mills.filter(mill =>
      mill.name?.toLowerCase().includes(searchLower)
    );
  }, [mills, millSearchTerm]);

  // Get selected mill name for display - Optimized
  const selectedMill = useMemo(() => {
    if (!filters.millId) return null;
    // Handle both string and ObjectId comparison
    return mills.find(m => {
      const millId = String(m._id || '');
      const filterId = String(filters.millId || '');
      return millId === filterId;
    });
  }, [mills, filters.millId]);

  // Update mill search term when mill filter changes externally - Optimized
  useEffect(() => {
    if (filters.millId && selectedMill) {
      // Only update if different to avoid unnecessary re-renders
      if (millSearchTerm !== selectedMill.name) {
        setMillSearchTerm(selectedMill.name);
      }
    } else if (!filters.millId && millSearchTerm) {
      // Only clear if there's something to clear
      setMillSearchTerm('');
    }
  }, [filters.millId, selectedMill]); // Removed millSearchTerm from deps to avoid loops

  // Close mill dropdown when clicking outside
  const millDropdownRef = useRef<HTMLDivElement>(null);
  const hasFetchedOrderDataRef = useRef<boolean>(false);
  const hasFetchedMillsRef = useRef<boolean>(false);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (millDropdownRef.current && !millDropdownRef.current.contains(event.target as Node)) {
        setShowMillDropdown(false);
      }
    };

    if (showMillDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMillDropdown]);

  // ⚡ FIX: Listen for millAdded and millsRefreshed events to immediately update mills in filter dropdown
  useEffect(() => {
    const handleMillAdded = (event: any) => {
      const newMill = event.detail?.mill;
      if (newMill) {
        console.log('🎉 OrdersClient: Received millAdded event for filter dropdown:', newMill.name);

        // ⚡ FIX: Clear ALL mill-related caches aggressively
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('mills_cache');
            // Clear all mill-related caches
            Object.keys(localStorage).forEach(key => {
              if (key.includes('mill') || key.includes('mills')) {
                localStorage.removeItem(key);
              }
            });
            // Also clear process-data-cache if it exists
            try {
              const processCache = localStorage.getItem('process-data-cache');
              if (processCache) {
                const cacheData = JSON.parse(processCache);
                cacheData.millsTimestamp = 0;
                localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
              }
            } catch (e) { }
            console.log('🗑️ Cleared ALL mill caches after millAdded event in OrdersClient');
          } catch (e) {
            console.error('Error clearing caches:', e);
          }
        }

        // Update mills state immediately
        setMills(prev => {
          const millId = newMill._id || (newMill as any).id;
          if (!millId) return prev;

          // Check if already exists
          const exists = prev.some(m => {
            const mId = m._id || (m as any).id;
            return String(mId) === String(millId);
          });

          if (!exists) {
            console.log('✅ Adding new mill to OrdersClient mills state:', newMill.name);
            return [newMill, ...prev];
          } else {
            // Update existing mill with latest data
            return prev.map(m => {
              const mId = m._id || (m as any).id;
              return String(mId) === String(millId) ? newMill : m;
            });
          }
        });
      }
    };

    // Listen for millsRefreshed event to fetch fresh data
    const handleMillsRefreshed = async () => {
      console.log('🔄 OrdersClient: Received millsRefreshed event, fetching fresh mills for filter dropdown...');

      // ⚡ FIX: Clear ALL mill-related caches aggressively
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('mills_cache');
          // Clear all mill-related caches
          Object.keys(localStorage).forEach(key => {
            if (key.includes('mill') || key.includes('mills')) {
              localStorage.removeItem(key);
            }
          });
          // Also clear process-data-cache if it exists
          try {
            const processCache = localStorage.getItem('process-data-cache');
            if (processCache) {
              const cacheData = JSON.parse(processCache);
              cacheData.millsTimestamp = 0;
              localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
            }
          } catch (e) { }
          console.log('🗑️ Cleared ALL mill caches after millsRefreshed event in OrdersClient');
        } catch (e) {
          console.error('Error clearing caches:', e);
        }
      }

      // Fetch fresh mills
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const millsResponse = await fetch(`/api/mills?t=${Date.now()}&limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          });

          if (millsResponse.ok) {
            const millsData = await millsResponse.json();
            if (millsData.success && Array.isArray(millsData.data)) {
              setMills(millsData.data);
              console.log('✅ OrdersClient: Refreshed mills from server for filter dropdown:', millsData.data.length, 'mills');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching fresh mills in OrdersClient:', error);
      }

      // Direct fetch above is sufficient for immediate UI update
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('millAdded', handleMillAdded);
      window.addEventListener('millsRefreshed', handleMillsRefreshed);
      return () => {
        window.removeEventListener('millAdded', handleMillAdded);
        window.removeEventListener('millsRefreshed', handleMillsRefreshed);
      };
    }
  }, []);

  // Function to process mill input data and group by order and quality
  const processMillInputDataByQuality = useCallback((millInputs: any[]) => {
    console.log('🔄 Processing mill input data by quality:', millInputs);
    const processMap: { [key: string]: Set<string> } = {};

    if (!Array.isArray(millInputs)) {
      console.log('🔄 No mill inputs array provided');
      return {};
    }

    console.log('🔄 Total mill inputs to process:', millInputs.length);

    millInputs.forEach((millInput, index) => {
      console.log(`🔄 Processing mill input ${index + 1}:`, {
        orderId: millInput.orderId,
        quality: millInput.quality,
        processName: millInput.processName,
        additionalMeters: millInput.additionalMeters,
        hasProcessName: !!millInput.processName,
        processNameLength: millInput.processName?.length || 0
      });

      // Process main input
      if (millInput.quality && millInput.processName && millInput.orderId) {
        const qualityId = typeof millInput.quality === 'object' ? millInput.quality._id : millInput.quality;
        const qualityName = typeof millInput.quality === 'object' ? millInput.quality.name : millInput.quality;
        // Include orderId in the key to make it order-specific
        const key = `${millInput.orderId}_${qualityId}_${qualityName}`;

        console.log('🔄 Adding main process:', { key, processName: millInput.processName });

        if (!processMap[key]) {
          processMap[key] = new Set();
        }
        // Only add non-empty process names
        if (millInput.processName && millInput.processName.trim() !== '') {
          processMap[key].add(millInput.processName.trim());
        }
      }

      // Process additional meters
      if (millInput.additionalMeters && Array.isArray(millInput.additionalMeters)) {
        millInput.additionalMeters.forEach((additional: any) => {
          if (additional.quality && additional.processName && millInput.orderId) {
            const qualityId = typeof additional.quality === 'object' ? additional.quality._id : additional.quality;
            const qualityName = typeof additional.quality === 'object' ? additional.quality.name : additional.quality;
            // Include orderId in the key to make it order-specific
            const key = `${millInput.orderId}_${qualityId}_${qualityName}`;

            console.log('🔄 Adding additional process:', { key, processName: additional.processName });

            if (!processMap[key]) {
              processMap[key] = new Set();
            }
            // Only add non-empty process names
            if (additional.processName && additional.processName.trim() !== '') {
              processMap[key].add(additional.processName.trim());
            }
          }
        });
      }
    });

    // Convert Set to Array and sort by priority
    const processPriority = [
      // Ordered by user-provided sequence (higher index = higher priority)
      'Lot No Greigh',      // 1
      'Charkha',            // 2
      'Drum',               // 3
      'Soflina WR',         // 4
      'long jet',           // 5
      'setting',            // 6
      'In Dyeing',          // 7
      'jigar',              // 8
      'in printing',        // 9
      'loop',               // 10
      'washing',            // 11
      'Finish',             // 12
      'folding',            // 13
      'ready to dispatch',  // 14
      'In House',           // 15
      'FOB Send'            // 16 (highest)
    ];

    const result: { [key: string]: string[] } = {};
    Object.keys(processMap).forEach(key => {
      const processes = Array.from(processMap[key]);
      console.log(`🔄 Processing key: ${key}, processes:`, processes);
      // Sort by priority, with unknown processes at the end
      result[key] = processes.sort((a, b) => {
        const aIndex = processPriority.indexOf(a);
        const bIndex = processPriority.indexOf(b);
        const aPriority = aIndex === -1 ? -1 : aIndex; // unknown lowest
        const bPriority = bIndex === -1 ? -1 : bIndex;
        if (aPriority === bPriority) return a.localeCompare(b);
        // Higher index means higher priority per requested numbering
        return bPriority - aPriority;
      });
      console.log(`🔄 Sorted processes for ${key}:`, result[key]);
    });

    console.log('🔄 Final processed data result:', result);
    console.log('🔄 Process map keys:', Object.keys(processMap));
    console.log('🔄 Result keys:', Object.keys(result));
    return result;
  }, []);

  // Function to get process data for a specific quality and order
  const getProcessDataForQuality = useCallback((quality: any, orderId?: string) => {
    if (!quality || !orderId) {
      return [];
    }

    const qualityId = typeof quality === 'object' ? quality._id : quality;
    const qualityName = typeof quality === 'object' ? quality.name : quality;

    // ⚡ CRITICAL: Try multiple key formats to ensure we find the data
    // Format 1: orderId_qualityId_qualityName (standard format)
    const key1 = `${orderId}_${qualityId}_${qualityName}`;
    // Format 2: orderId_qualityId (fallback if qualityName is missing)
    const key2 = `${orderId}_${qualityId}`;
    // Format 3: Try with String() conversion for IDs
    const key3 = `${String(orderId)}_${String(qualityId)}_${String(qualityName)}`;

    // Try all key formats
    const result = processDataByQuality[key1] || processDataByQuality[key2] || processDataByQuality[key3] || [];

    // If still no result, try partial matches (for debugging)
    if (result.length === 0) {
      const allKeys = Object.keys(processDataByQuality);
      const matchingKeys = allKeys.filter(k => k.includes(String(orderId)) && k.includes(String(qualityId)));
      if (matchingKeys.length > 0) {
        console.log('🔍 getProcessDataForQuality: Found partial match keys:', matchingKeys);
        // Use the first matching key
        const partialResult = processDataByQuality[matchingKeys[0]] || [];
        if (partialResult.length > 0) {
          return partialResult;
        }
      }
    }

    return result;
  }, [processDataByQuality, forceRender]); // Add forceRender to dependencies to trigger re-evaluation

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showSearchDropdown && !target.closest('.search-dropdown-container')) {
        setShowSearchDropdown(false);
      }
      if (showSortDropdown && !target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchDropdown, showSortDropdown]);

  // Debug filter state
  useEffect(() => {
    console.log('🔧 Current filters state:', filters);
  }, [filters]);

  // ULTRA FAST fetch functions - 50ms target
  const fetchOrders = useCallback(async (retryCount = 0, page = currentPage, limit = itemsPerPage, forceRefresh = false, currentFilters = filters, searchQuery = searchTerm) => {
    const maxRetries = 3; // Three retries for better reliability
    const baseTimeout = 5000; // 5 second timeout for better reliability
    const timeoutIncrement = 2000; // Add 2 seconds per retry

    try {
      const controller = new AbortController();
      const timeout = baseTimeout + (retryCount * timeoutIncrement);
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const token = localStorage.getItem('token');
      console.log('🔍 fetchOrders token check:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenStart: token?.substring(0, 20) + '...'
      });
      if (!token) {
        console.log('❌ No token found, showing login message');
        showMessage('error', 'Please login to view orders', { autoDismiss: true, dismissTime: 3000 });
        return;
      }

      // Build URL with pagination and filter parameters
      const url = new URL('/api/orders', window.location.origin);
      const limitValue = Math.max(limit, 10); // Use server-side pagination
      url.searchParams.append('limit', limitValue.toString());
      url.searchParams.append('page', page.toString());

      // Add search and filter parameters for server-side filtering
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }
      if (currentFilters.orderType) {
        url.searchParams.append('orderType', currentFilters.orderType);
        console.log('🔧 Adding orderType param:', currentFilters.orderType);
      }
      // Always add status if it exists (even if empty string, but not if undefined)
      if (currentFilters.status !== undefined && currentFilters.status !== null && currentFilters.status !== '') {
        url.searchParams.append('status', currentFilters.status);
        console.log('🔧 Adding status param:', currentFilters.status);
      }
      if (currentFilters.startDate) {
        url.searchParams.append('startDate', currentFilters.startDate);
      }
      if (currentFilters.endDate) {
        url.searchParams.append('endDate', currentFilters.endDate);
      }
      if (currentFilters.millId) {
        // Ensure millId is properly formatted as string
        const millIdValue = typeof currentFilters.millId === 'string'
          ? currentFilters.millId
          : String(currentFilters.millId);
        url.searchParams.append('millId', millIdValue);
        console.log('🔧 Adding millId param:', millIdValue);
      }
      if (currentFilters.orderFilter && currentFilters.orderFilter !== 'latest_first') {
        url.searchParams.append('sort', currentFilters.orderFilter);
        console.log('🔧 Adding sort param:', currentFilters.orderFilter);
      }
      if ((currentFilters as any).fyFilter) {
        url.searchParams.append('fy', (currentFilters as any).fyFilter);
        console.log('🔧 Adding fy param:', (currentFilters as any).fyFilter);
      }

      console.log('🔧 Final URL:', url.toString());

      // ⚡ FIX: Always use timestamp for cache busting when forceRefresh is true
      if (forceRefresh) {
        url.searchParams.append('t', Date.now().toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          // ⚡ FIX: Always send no-cache headers to prevent browser caching
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        // ⚡ FIX: Use cache: 'no-store' when forceRefresh to ensure fresh data
        cache: forceRefresh ? 'no-store' : 'default',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check for session/auth errors - redirect to login immediately (no error message)
        if (response.status === 401 || response.status === 403 || response.status === 503 || response.status === 500 || response.status === 502) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log('🔍 fetchOrders API response:', {
        success: data.success,
        hasData: !!data.data,
        dataLength: data.data?.length,
        pagination: data.pagination,
        message: data.message,
        responseStatus: response.status
      });

      if (data.success) {
        const ordersData = data.data || [];
        console.log('📊 Orders fetched:', ordersData.length, 'orders');
        console.log('📊 First order sample:', ordersData[0]);
        console.log('📊 Pagination data:', data.pagination);

        // Update pagination info FIRST to ensure UI consistency
        if (data.pagination) {
          const serverPage = data.pagination.page || page;
          const paginationData = {
            totalCount: data.pagination.total || 0,
            totalPages: data.pagination.pages || 1,
            currentPage: serverPage,
            hasNextPage: serverPage < (data.pagination.pages || 1),
            hasPrevPage: serverPage > 1
          };
          console.log('📊 Setting pagination info:', paginationData);
          setPaginationInfo(paginationData);

          // Ensure currentPage state matches server response
          if (serverPage !== currentPage) {
            console.log('📊 Syncing currentPage state:', currentPage, '->', serverPage);
            setCurrentPage(serverPage);
          }
        } else {
          // Fallback pagination info based on orders length
          const ordersLength = ordersData.length;
          const calculatedPages = Math.ceil(ordersLength / (limitValue as number));

          // If we have orders but no pagination data, use orders length
          // If we have no orders, check if there's a totalCount in the response
          const totalCount = ordersLength > 0 ? ordersLength : (data.totalCount || 0);

          const fallbackPagination = {
            totalCount: totalCount,
            totalPages: Math.max(1, Math.ceil(totalCount / limitValue)),
            currentPage: page,
            hasNextPage: page < Math.ceil(totalCount / limitValue),
            hasPrevPage: page > 1
          };
          console.log('📊 Setting fallback pagination info:', fallbackPagination);
          setPaginationInfo(fallbackPagination);
        }

        // Set orders data after pagination info is updated
        // For search/filter operations, replace orders. For normal refresh, merge to preserve newly created orders
        console.log('📊 About to set orders data:', ordersData.length, 'orders');
        const isSearchOrFilter = searchQuery || currentFilters.status || currentFilters.orderType || currentFilters.millId || currentFilters.startDate || currentFilters.endDate;

        setOrdersSafe((prevOrders: Order[]) => {
          // If we have no fetched data
          if ((!ordersData || ordersData.length === 0)) {
            // For search/filter, return empty array (no results)
            if (isSearchOrFilter) {
              console.log('📊 Search/filter returned no results');
              return [];
            }
            // For normal refresh, keep existing orders if we have them
            if (prevOrders && prevOrders.length > 0) {
              console.log('📊 No fetched data, keeping existing orders:', prevOrders.length);
              return prevOrders;
            }
            return [];
          }

          // For search/filter operations, replace orders completely
          if (isSearchOrFilter) {
            console.log('📊 Search/filter results - replacing orders:', ordersData.length);
            return ordersData as Order[];
          }

          // For normal refresh, merge to preserve newly created orders
          const fetchedOrdersMap = new Map(ordersData.map((o: any) => [String(o._id), o]));

          // Merge with existing orders to keep newly created ones visible
          if (prevOrders && Array.isArray(prevOrders) && prevOrders.length > 0) {
            prevOrders.forEach(existingOrder => {
              const orderId = String(existingOrder._id);
              if (!fetchedOrdersMap.has(orderId)) {
                // This is a newly created order that's not in backend yet, keep it
                fetchedOrdersMap.set(orderId, existingOrder);
              } else {
                // Update existing order with fetched data (in case it was updated)
                fetchedOrdersMap.set(orderId, fetchedOrdersMap.get(orderId)!);
              }
            });
          }

          // Convert map back to array and sort by createdAt (newest first)
          const mergedOrders = Array.from(fetchedOrdersMap.values()).sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA; // Newest first
          });

          console.log('📊 Merged orders:', {
            existingCount: prevOrders?.length || 0,
            fetchedCount: ordersData.length,
            mergedCount: mergedOrders.length
          });

          return mergedOrders as Order[];
        });
        setOrdersLoaded(true); // Mark as loaded to show data
        setLastRefreshTime(new Date());

        // ⚡ FIX: Update cache timestamp when data is successfully fetched
        // This ensures navigation detection works correctly
        if (page === 1 && !forceRefresh) {
          const cacheTimestamp = Date.now();
          sessionStorage.setItem('orders-cache-timestamp', cacheTimestamp.toString());
        }

        // ⚡ FIX: Save merged orders to localStorage for persistence
        // We'll save after state is updated via useEffect

        console.log('📊 Orders data set, checking state in next render...');
      } else {
        console.log('❌ API returned success: false:', data.message);
        throw new Error(data.message || 'Failed to fetch orders');
      }
    } catch (error: any) {
      // Check for session/auth errors - redirect to login immediately
      if (error.message?.includes('503') || error.message?.includes('401') || error.message?.includes('403') ||
        error.message?.includes('Session expired') || error.message?.includes('Unauthorized') ||
        error.message?.includes('500') || error.message?.includes('502')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }

      console.log('🔍 fetchOrders error:', {
        error: error.message,
        name: error.name,
        retryCount,
        maxRetries
      });

      if (error.name === 'AbortError') {
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying fetchOrders (attempt ${retryCount + 1}/${maxRetries})`);
          // Exponential backoff with jitter
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchOrders(retryCount + 1, page, limit, forceRefresh, currentFilters, searchQuery);
        } else {
          console.log('❌ Max retries reached, giving up');
          setLoading(false);
          setOrdersLoaded(true); // Mark as loaded to show empty state
          return;
        }
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        if (retryCount < maxRetries) {
          console.log(`🔄 Network error, retrying (attempt ${retryCount + 1}/${maxRetries})`);
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchOrders(retryCount + 1, page, limit, forceRefresh, currentFilters, searchQuery);
        } else {
          setLoading(false);
          setOrdersLoaded(true);
          showMessage('error', 'Network error. Please check your connection.', { autoDismiss: true, dismissTime: 4000 });
          return;
        }
      } else {
        setLoading(false);
        setOrdersLoaded(true);
        showMessage('error', error.message || 'Failed to fetch orders', { autoDismiss: true, dismissTime: 4000 });
        return;
      }
    }
  }, [showMessage, currentPage, itemsPerPage, filters, searchTerm, setOrdersSafe]);

  // Store fetchOrders in ref for use in other callbacks
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);


  // Helper function for robust data refresh after operations
  const refreshOrdersWithRetry = useCallback(async (retries = 2, goToPage1 = false, customFilters?: any) => {
    // ⚡ FIX: Clear all caches before refresh
    if (typeof window !== 'undefined') {
      // Clear localStorage caches
      localStorage.removeItem('dashboard-cache');
      localStorage.removeItem('orders_cache');
      localStorage.removeItem('process-data-cache');

      // Clear all grey-info caches
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('grey-info-')) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      sessionStorage.removeItem('last-orders-path');
      sessionStorage.removeItem('orders-cache-timestamp');

      // Clear dataCache ref
      dataCache.current = {
        orders: null,
        mills: null,
        parties: null,
        qualities: null,
        timestamp: 0,
        ttl: 0
      };
    }

    // ⚡ FIX: Always go to page 1 after create/update to see new/updated orders
    const pageToFetch = goToPage1 ? 1 : currentPage;

    // ⚡ FIX: Use custom filters if provided, otherwise use current filters
    const filtersToUse = customFilters || filters;

    for (let i = 0; i < retries; i++) {
      try {
        // ⚡ FIX: Always force refresh and use filters (custom or current)
        // Force refresh includes timestamp cache-busting parameter
        await fetchOrders(0, pageToFetch, itemsPerPage, true, filtersToUse, searchTerm);
        console.log('✅ Orders refreshed successfully on page', pageToFetch);

        // Update currentPage state if we went to page 1
        if (goToPage1 && pageToFetch !== currentPage) {
          setCurrentPage(1);
        }
        return;
      } catch (error) {
        console.error(`❌ Refresh attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          // ⚡ FIX: Exponential backoff for retries (only on actual failures)
          const delay = Math.pow(2, i) * 200; // Reduced: 200ms, 400ms
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    console.error('❌ All refresh attempts failed');
  }, [fetchOrders, currentPage, itemsPerPage, filters, searchTerm]);

  // Handle URL parameters for navigation from dashboard
  useEffect(() => {
    const statusParam = searchParams.get('status');
    console.log('🔧 Orders page - checking URL parameters:', {
      statusParam,
      allParams: Object.fromEntries(searchParams.entries())
    });
    if (statusParam) {
      console.log('🔧 URL status parameter found:', statusParam);
      setFilters(prevFilters => {
        const newFilters = {
          ...prevFilters,
          statusFilter: statusParam,
          status: statusParam
        };
        console.log('🔧 Setting filters from URL:', newFilters);
        return newFilters;
      });

      // Trigger data refresh with new filter after a short delay to ensure state is updated
      setTimeout(() => {
        console.log('🔧 Triggering data refresh with URL filter');
        fetchOrders(0, 1, itemsPerPage, true, {
          orderFilter: 'latest_first',
          typeFilter: 'all',
          statusFilter: statusParam,
          fyFilter: '',
          orderType: '',
          status: statusParam,
          startDate: '',
          endDate: '',
          millId: ''
        });
      }, 100);
    }
  }, [searchParams, fetchOrders, itemsPerPage]);

  // Handle sessionStorage flag for filtering to delivered orders (without URL parameters)
  useEffect(() => {
    const filterToDelivered = sessionStorage.getItem('ordersPageFilterToDelivered');
    const filterStatus = sessionStorage.getItem('ordersPageFilterStatus');
    const filterType = sessionStorage.getItem('ordersPageFilterType');
    const filterTime = sessionStorage.getItem('ordersPageFilterTime');

    // Handle old delivered filter (for backward compatibility)
    if (filterToDelivered === 'true' && filterTime && !filterStatus) {
      const timeDiff = Date.now() - parseInt(filterTime);
      // Only apply filter if it's recent (within last 5 seconds)
      if (timeDiff < 5000 && timeDiff > 0) {
        console.log('🔧 Setting filter to delivered from dashboard click');
        setFilters(prevFilters => {
          const newFilters = {
            ...prevFilters,
            statusFilter: 'delivered',
            status: 'delivered'
          };
          console.log('🔧 Setting filters to delivered:', newFilters);
          return newFilters;
        });

        // Trigger data refresh with delivered filter
        setTimeout(() => {
          console.log('🔧 Triggering data refresh with delivered filter');
          fetchOrders(0, 1, itemsPerPage, true, {
            orderFilter: 'latest_first',
            typeFilter: 'all',
            statusFilter: 'delivered',
            fyFilter: '',
            orderType: '',
            status: 'delivered',
            startDate: '',
            endDate: '',
            millId: ''
          });
        }, 100);

        // Clean up sessionStorage after applying filter
        sessionStorage.removeItem('ordersPageFilterToDelivered');
        sessionStorage.removeItem('ordersPageFilterTime');
      }
    }

    // Handle new pie chart segment click filters (status + type)
    if (filterStatus && filterTime) {
      const timeDiff = Date.now() - parseInt(filterTime);
      // Only apply filter if it's recent (within last 5 seconds)
      if (timeDiff < 5000 && timeDiff > 0) {
        const typeFilterValue = filterType && ['Dying', 'Printing'].includes(filterType) ? filterType : 'all';
        const statusFilterValue = filterStatus === 'pending' ? 'pending' : filterStatus === 'delivered' ? 'delivered' : 'all';

        console.log('🔧 Setting filters from pie chart click:', {
          statusFilterValue,
          typeFilterValue,
          source: 'pie-chart',
          chartType: filterStatus,
          segment: filterType || 'card-click'
        });

        setFilters(prevFilters => {
          const newFilters = {
            ...prevFilters,
            statusFilter: statusFilterValue,
            status: statusFilterValue,
            typeFilter: typeFilterValue,
            orderType: typeFilterValue === 'all' ? '' : typeFilterValue
          };
          console.log('✅ Filters updated from pie chart:', {
            statusFilter: newFilters.statusFilter,
            typeFilter: newFilters.typeFilter,
            status: newFilters.status,
            orderType: newFilters.orderType
          });
          return newFilters;
        });

        // Trigger data refresh with filters - use a slightly longer delay to ensure state is updated
        setTimeout(() => {
          console.log('🔄 Triggering data refresh with pie chart filters:', {
            typeFilter: typeFilterValue,
            statusFilter: statusFilterValue,
            orderType: typeFilterValue === 'all' ? '' : typeFilterValue,
            status: statusFilterValue
          });
          fetchOrders(0, 1, itemsPerPage, true, {
            orderFilter: 'latest_first',
            typeFilter: typeFilterValue,
            statusFilter: statusFilterValue,
            fyFilter: '',
            orderType: typeFilterValue === 'all' ? '' : typeFilterValue,
            status: statusFilterValue,
            startDate: '',
            endDate: '',
            millId: ''
          });
        }, 150);

        // Clean up sessionStorage after applying filter
        setTimeout(() => {
          sessionStorage.removeItem('ordersPageFilterStatus');
          sessionStorage.removeItem('ordersPageFilterType');
          sessionStorage.removeItem('ordersPageFilterTime');
        }, 1000);
      } else {
        console.warn('⚠️ Pie chart filter expired or invalid:', { timeDiff, filterStatus, filterType });
      }
    }

    // Handle order search from Delivered Soon table click
    const searchOrderId = sessionStorage.getItem('ordersPageSearchOrder');
    const searchTime = sessionStorage.getItem('ordersPageSearchTime');

    if (searchOrderId && searchTime) {
      const timeDiff = Date.now() - parseInt(searchTime);
      // Only apply search if it's recent (within last 5 seconds)
      if (timeDiff < 5000 && timeDiff > 0) {
        console.log('🔍 Setting order search from Delivered Soon table:', searchOrderId);
        setSearchTerm(searchOrderId);
        setSearchType('orderId'); // Set search type to orderId

        // Trigger search after a short delay to ensure state is updated
        setTimeout(() => {
          console.log('🔍 Triggering search for order:', searchOrderId);
          const searchQuery = `orderId:${searchOrderId}`;
          fetchOrders(0, 1, itemsPerPage, true, filters, searchQuery);
        }, 200);

        // Clean up sessionStorage after applying search
        setTimeout(() => {
          sessionStorage.removeItem('ordersPageSearchOrder');
          sessionStorage.removeItem('ordersPageSearchTime');
        }, 1000);
      } else {
        console.warn('⚠️ Order search expired or invalid:', { timeDiff, searchOrderId });
      }
    }
  }, [fetchOrders, itemsPerPage, filters]);

  // Use server-side pagination info
  const totalPages = useMemo(() => {
    return paginationInfo.totalPages || 1;
  }, [paginationInfo.totalPages]);

  // Enhanced pagination handler with bulletproof error handling and loading states
  const handlePageChange = useCallback(async (newPage: number) => {
    // Prevent duplicate calls
    if (newPage === currentPage || isChangingPage) {
      console.log('🚫 Page change blocked - duplicate call or already changing');
      return;
    }

    // Validate page number with strict bounds checking
    if (newPage < 1 || newPage > totalPages || totalPages === 0) {
      console.log('🚫 Page change blocked - invalid page number:', newPage, 'totalPages:', totalPages);
      return;
    }

    console.log('🔄 Changing page from', currentPage, 'to', newPage);

    // Set loading states immediately for smooth UX
    setIsChangingPage(true);
    setTableLoading(true);

    try {
      // Update current page state immediately for responsive UI
      setCurrentPage(newPage);

      // Fetch new page data with timeout protection
      await fetchOrders(0, newPage, itemsPerPage, true, filters, searchTerm);

      console.log('✅ Page change completed successfully');
    } catch (error) {
      console.error('❌ Page change failed:', error);

      // Revert page state on error
      setCurrentPage(currentPage);

      // Professional error handling
      if (error instanceof Error && error.name === 'AbortError') {
        showMessage('error', 'Request timed out. Please try again.', { autoDismiss: true, dismissTime: 3000 });
      } else {
        showMessage('error', 'Failed to load page. Please try again.', { autoDismiss: true, dismissTime: 3000 });
      }
    } finally {
      // Always clean up loading states
      setIsChangingPage(false);
      setTableLoading(false);
    }
  }, [currentPage, isChangingPage, totalPages, fetchOrders, itemsPerPage, filters, searchTerm, showMessage]);

  // Enhanced items per page handler with better loading states
  const handleItemsPerPageChange = useCallback(async (newItemsPerPage: number) => {
    if (newItemsPerPage === itemsPerPage) {
      console.log('🚫 Items per page change blocked - same value');
      return;
    }

    if (isChangingPage) {
      console.log('🚫 Items per page change blocked - already changing, will retry');
      // Don't return, just wait a bit and try again
      setTimeout(() => handleItemsPerPageChange(newItemsPerPage), 100);
      return;
    }

    console.log('🔄 Changing items per page from', itemsPerPage, 'to', newItemsPerPage);

    // Set loading states immediately
    setIsChangingPage(true);
    setTableLoading(true);
    setOrdersLoaded(false); // Reset loaded state to show skeleton

    try {
      // Update state immediately for responsive UI
      setItemsPerPage(newItemsPerPage);
      // Save to cookie to persist across page refreshes
      if (typeof window !== 'undefined') {
        setCookie('ordersItemsPerPage', newItemsPerPage.toString(), 365);
      }
      setCurrentPage(1);

      // Fetch first page with new items per page - force refresh to ensure fresh data
      await fetchOrders(0, 1, newItemsPerPage, true, filters, searchTerm);

      console.log('✅ Items per page change completed successfully');
    } catch (error) {
      console.error('❌ Items per page change failed:', error);

      // Revert state on error
      setItemsPerPage(itemsPerPage);
      setCurrentPage(currentPage);

      // Professional error handling
      if (error instanceof Error && error.name === 'AbortError') {
        showMessage('error', 'Request timed out. Please try again.', { autoDismiss: true, dismissTime: 3000 });
      } else {
        showMessage('error', 'Failed to change page size. Please try again.', { autoDismiss: true, dismissTime: 3000 });
      }
    } finally {
      // Always clean up loading states
      setIsChangingPage(false);
      setTableLoading(false);
    }
  }, [itemsPerPage, isChangingPage, fetchOrders, filters, searchTerm, showMessage, currentPage]);

  // Debounced version to prevent rapid clicking
  const debouncedHandleItemsPerPageChange = useCallback(
    debounce((newItemsPerPage: number) => {
      handleItemsPerPageChange(newItemsPerPage);
    }, 150),
    [handleItemsPerPageChange]
  );

  // Use server-side pagination display info with proper state synchronization
  const paginationDisplayInfo = useMemo(() => {
    const total = paginationInfo.totalCount || 0;
    const currentPageNum = Number(paginationInfo.currentPage) || currentPage || 1;
    const itemsPerPageValue = itemsPerPage;

    console.log('🔍 paginationDisplayInfo calc:', {
      total,
      currentPageNum,
      itemsPerPageValue,
      ordersLength: orders.length,
      paginationInfo
    });

    // Always calculate based on pagination info, even if orders array is temporarily empty
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
      showing: orders.length,
      total: total,
      start: start,
      end: end
    };
  }, [paginationInfo, itemsPerPage, orders.length, currentPage]);

  // Function to fetch existing mill inputs for an order
  const fetchExistingMillInputs = useCallback(async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/mill-inputs?orderId=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setExistingMillInputs(data.millInputs);
        return data.millInputs;
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  }, []);

  // Handle search params for edit mill input
  useEffect(() => {
    const editMillInput = searchParams?.get('editMillInput');
    const addMillInput = searchParams?.get('addMillInput');

    if (editMillInput) {
      // Find the order by ID
      const order = orders.find(o => o._id === editMillInput);
      if (order) {
        setSelectedOrderForMillInputForm(order);
        setIsEditingMillInput(true);
        setShowMillInputForm(true);
        // Clear the URL parameter
        router.replace('/orders', { scroll: false });
      }
    } else if (addMillInput) {
      // Find the order by ID
      const order = orders.find(o => o._id === addMillInput);
      if (order) {
        setSelectedOrderForMillInputForm(order);
        setIsEditingMillInput(false);
        setShowMillInputForm(true);
        // Clear the URL parameter
        router.replace('/orders', { scroll: false });
      }
    }
  }, [searchParams, orders, router]);

  // Optimized function to fetch all order-related data in parallel
  // ⚡ OPTIMIZED: Function to fetch all order-related data with localStorage cache
  const fetchAllOrderData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // ⚡ INSTANT: Load from localStorage cache first!
      const processDataCache = localStorage.getItem('process-data-cache');
      if (processDataCache) {
        try {
          const cached = JSON.parse(processDataCache);
          if (Date.now() - cached.timestamp < 300000) { // 5 minutes
            console.log('⚡ INSTANT: Process data loaded from localStorage!');
            console.log('⚡ INSTANT: Grey info from cache:', cached.greyInfo);
            console.log('⚡ INSTANT: Process data from cache keys:', Object.keys(cached.processData || {}));
            console.log('⚡ INSTANT: Process data from cache sample:', Object.entries(cached.processData || {}).slice(0, 3));
            setOrderMillInputs(cached.millInputs || {});
            setOrderMillOutputs(cached.millOutputs || {});
            setOrderDispatches(cached.dispatches || {});
            // ⚡ CRITICAL: Set grey info state immediately from cache
            setOrderGreyInfo(cached.greyInfo || {});
            // ⚡ CRITICAL: Set process data from cache and force re-render
            setProcessDataByQuality(cached.processData || {});
            setProcessDataLoading(false);
            // ⚡ IMMEDIATE: Trigger button re-render when cache loads (multiple times to ensure update)
            setForceRender(prev => prev + 1);
            setTimeout(() => setForceRender(prev => prev + 1), 100); // Double trigger for safety
            setTimeout(() => setForceRender(prev => prev + 1), 300); // Triple trigger for process data display
            // Continue to fetch fresh data in background
          }
        } catch (e) {
          console.log('Cache parse error:', e);
        }
      }

      // Set loading state for process data
      setProcessDataLoading(true);

      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout for reliability

      // Fetch all four endpoints in parallel for better performance
      const [millInputsResponse, millOutputsResponse, dispatchesResponse, greyInfoResponse] = await Promise.all([
        fetch('/api/mill-inputs', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }),
        fetch('/api/mill-outputs', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }),
        fetch('/api/dispatch', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }),
        fetch('/api/grey-info', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }).catch(() => ({ ok: false, json: () => Promise.resolve({ success: false, data: { greyInfo: [] } }) }))
      ]);

      clearTimeout(timeoutId);

      // Process mill inputs
      const millInputsData = await millInputsResponse.json();
      console.log('🔄 Mill inputs API response:', millInputsData);

      // Declare groupedInputs outside the if block so it's accessible later
      let groupedInputs: { [key: string]: any[] } = {};

      // Mill inputs API response processed
      if (millInputsData.success && millInputsData.data?.millInputs) {
        console.log('🔄 Mill inputs data found:', millInputsData.data.millInputs);

        // Debug: Log each mill input to see process data
        millInputsData.data.millInputs.forEach((input: any, index: number) => {
          console.log(`🔄 Mill Input ${index + 1}:`, {
            orderId: input.orderId,
            processName: input.processName,
            quality: input.quality,
            additionalMeters: input.additionalMeters
          });
        });

        millInputsData.data.millInputs.forEach((input: any) => {
          if (!groupedInputs[input.orderId]) {
            groupedInputs[input.orderId] = [];
          }
          groupedInputs[input.orderId].push(input);
        });

        // Process mill input data by quality
        const processedData = processMillInputDataByQuality(millInputsData.data.millInputs);
        console.log('🔄 Setting process data by quality:', processedData);
        console.log('🔄 Process data keys:', Object.keys(processedData));
        console.log('🔄 Process data sample:', Object.entries(processedData).slice(0, 3));

        setOrderMillInputs(groupedInputs);
        // ⚡ CRITICAL: Merge process data instead of replacing (preserve existing data)
        setProcessDataByQuality(prev => {
          const merged = { ...prev, ...processedData };
          console.log('🔄 Merged process data keys:', Object.keys(merged));
          console.log('🔄 Merged process data sample:', Object.entries(merged).slice(0, 3));
          // ⚡ FORCE RE-RENDER to update UI
          setForceRender(prev => prev + 1);
          return merged;
        });
        setProcessDataLoading(false);
      } else {
        console.log('🔄 No mill inputs data found');
        // No mill inputs data found - but don't clear existing process data
        setOrderMillInputs({});
        // ⚡ CRITICAL: Don't clear process data - keep existing data
        // setProcessDataByQuality({}); // REMOVED - preserve existing data
        setProcessDataLoading(false);
      }

      // Process mill outputs - ⚡ IMMEDIATE UPDATE for button text
      const millOutputsData = await millOutputsResponse.json();
      let groupedOutputs: { [key: string]: any[] } = {};
      if (millOutputsData.success && millOutputsData.data && Array.isArray(millOutputsData.data)) {
        millOutputsData.data.forEach((output: any) => {
          // Use orderId as primary key, also store with MongoDB _id
          const orderId = output.orderId || (output.order?._id ? String(output.order._id) : null);
          const orderMongoId = output.order?._id ? String(output.order._id) : null;

          if (orderId) {
            if (!groupedOutputs[orderId]) {
              groupedOutputs[orderId] = [];
            }
            groupedOutputs[orderId].push(output);

            // Also store with MongoDB _id as key (if different from orderId)
            if (orderMongoId && orderMongoId !== orderId) {
              if (!groupedOutputs[orderMongoId]) {
                groupedOutputs[orderMongoId] = [];
              }
              groupedOutputs[orderMongoId].push(output);
            }
          }
        });
        // ⚡ IMMEDIATE: Update state and trigger re-render for button text
        setOrderMillOutputs(groupedOutputs);
        setForceRender(prev => prev + 1); // Force button re-render
      } else {
        setOrderMillOutputs({});
        setForceRender(prev => prev + 1); // Force button re-render even if no data
      }

      // Process dispatches - ⚡ IMMEDIATE UPDATE for button text
      const dispatchesData = await dispatchesResponse.json();
      let groupedDispatches: { [key: string]: any[] } = {};
      if (dispatchesData.success && dispatchesData.data && Array.isArray(dispatchesData.data)) {
        dispatchesData.data.forEach((dispatch: any) => {
          // Use orderId as primary key, also store with MongoDB _id
          const orderId = dispatch.orderId || (dispatch.order?._id ? String(dispatch.order._id) : null);
          const orderMongoId = dispatch.order?._id ? String(dispatch.order._id) : null;

          if (orderId) {
            if (!groupedDispatches[orderId]) {
              groupedDispatches[orderId] = [];
            }
            groupedDispatches[orderId].push(dispatch);

            // Also store with MongoDB _id as key (if different from orderId)
            if (orderMongoId && orderMongoId !== orderId) {
              if (!groupedDispatches[orderMongoId]) {
                groupedDispatches[orderMongoId] = [];
              }
              groupedDispatches[orderMongoId].push(dispatch);
            }
          }
        });
        // ⚡ IMMEDIATE: Update state and trigger re-render for button text
        setOrderDispatches(groupedDispatches);
        setForceRender(prev => prev + 1); // Force button re-render
      } else {
        setOrderDispatches({});
        setForceRender(prev => prev + 1); // Force button re-render even if no data
      }

      // Process grey info - ⚡ IMMEDIATE UPDATE for button text
      const greyInfoData = await greyInfoResponse.json();
      let groupedGreyInfo: { [key: string]: any[] } = {};
      if (greyInfoData.success && greyInfoData.data?.greyInfo && Array.isArray(greyInfoData.data.greyInfo)) {
        greyInfoData.data.greyInfo.forEach((info: any) => {
          // Get order MongoDB _id (convert to string to ensure consistent key format)
          const orderMongoId = info.order?._id ? String(info.order._id) : null;
          const orderIdString = info.orderId ? String(info.orderId) : null;

          // Use orderId as primary key, fallback to MongoDB _id
          const primaryKey = orderIdString || orderMongoId;

          if (primaryKey) {
            if (!groupedGreyInfo[primaryKey]) {
              groupedGreyInfo[primaryKey] = [];
            }
            groupedGreyInfo[primaryKey].push(info);

            // ⚡ CRITICAL: Also store with MongoDB _id as key (if different from orderId)
            if (orderMongoId && orderMongoId !== primaryKey) {
              if (!groupedGreyInfo[orderMongoId]) {
                groupedGreyInfo[orderMongoId] = [];
              }
              groupedGreyInfo[orderMongoId].push(info);
            }

            // Also store with orderId string (if different from primary key)
            if (orderIdString && orderIdString !== primaryKey) {
              if (!groupedGreyInfo[orderIdString]) {
                groupedGreyInfo[orderIdString] = [];
              }
              groupedGreyInfo[orderIdString].push(info);
            }
          }
        });
        // ⚡ IMMEDIATE: Update state and trigger re-render for button text
        setOrderGreyInfo(groupedGreyInfo);
        setForceRender(prev => prev + 1); // Force button re-render
      } else {
        setOrderGreyInfo({});
        setForceRender(prev => prev + 1); // Force button re-render even if no data
      }

      // ⚡ Save to localStorage for instant next load
      // ⚡ CRITICAL: Merge process data with existing to preserve all data
      const freshProcessData = processMillInputDataByQuality(millInputsData.success && millInputsData.data?.millInputs ? millInputsData.data.millInputs : []);
      // Get current state value for merging (use functional update result)
      setProcessDataByQuality(currentState => {
        const mergedProcessData = { ...currentState, ...freshProcessData };
        console.log('🔄 Saving to localStorage - merged process data keys:', Object.keys(mergedProcessData));
        console.log('🔄 Saving to localStorage - merged process data sample:', Object.entries(mergedProcessData).slice(0, 3));

        localStorage.setItem('process-data-cache', JSON.stringify({
          millInputs: groupedInputs,
          millOutputs: groupedOutputs,
          dispatches: groupedDispatches,
          greyInfo: groupedGreyInfo,
          processData: mergedProcessData, // Use merged data to preserve all process data
          timestamp: Date.now()
        }));

        return mergedProcessData;
      });
    } catch (error: any) {
      // Set empty objects on error - but preserve existing process data
      setOrderMillInputs({});
      setOrderMillOutputs({});
      setOrderDispatches({});
      setOrderGreyInfo({});
      // ⚡ CRITICAL: Don't clear process data on error - preserve existing data
      // setProcessDataByQuality({}); // REMOVED - preserve existing data
      setProcessDataLoading(false);

      // Handle timeout gracefully - don't show error for non-critical data
      if (error.name === 'AbortError') {
        // Silent timeout for order data - not critical for main functionality
      }
    }
  }, []);

  // Legacy functions for backward compatibility (now just call the optimized version)
  const fetchAllOrderMillInputs = useCallback(() => fetchAllOrderData(), [fetchAllOrderData]);
  const fetchAllOrderMillOutputs = useCallback(() => fetchAllOrderData(), [fetchAllOrderData]);
  const fetchAllOrderDispatches = useCallback(() => fetchAllOrderData(), [fetchAllOrderData]);


  // Function to immediately refresh mill output state for a specific order
  const refreshOrderMillOutputState = useCallback(async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/mill-outputs?orderId=${orderId}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.millOutputs) {
          setOrderMillOutputs(prev => ({
            ...prev,
            [orderId]: data.data.millOutputs
          }));
        } else {
          // If no data, set empty array to update button state
          setOrderMillOutputs(prev => ({
            ...prev,
            [orderId]: []
          }));
        }
      }
    } catch (error) {
      console.error('Error refreshing mill output state:', error);
    }
  }, []);


  // Function to fetch mill inputs for a specific order
  const fetchMillInputsForOrder = useCallback(async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/mill-inputs?orderId=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && data.data && data.data.millInputs) {
        // Update the specific order's mill inputs
        setOrderMillInputs(prev => ({
          ...prev,
          [orderId]: data.data.millInputs || []
        }));

        // ⚡ FIX: Force re-render immediately to update button text
        setForceRender(prev => prev + 1);

        // Process mill input data by quality for this order
        const processedData = processMillInputDataByQuality(data.data.millInputs);
        console.log('🔄 Updating process data for order:', orderId, processedData);
        console.log('🔄 Process data keys:', Object.keys(processedData));
        setProcessDataByQuality(prev => {
          const merged = { ...prev, ...processedData };
          // ⚡ FORCE RE-RENDER to update UI
          setForceRender(prev => prev + 1);
          // Update localStorage cache
          try {
            const cache = localStorage.getItem('process-data-cache');
            if (cache) {
              const cached = JSON.parse(cache);
              cached.processData = merged;
              cached.timestamp = Date.now();
              localStorage.setItem('process-data-cache', JSON.stringify(cached));
            }
          } catch (e) { }
          return merged;
        });
      } else if (data.success && data.data && Array.isArray(data.data)) {
        // Handle case where data.data is directly the array
        setOrderMillInputs(prev => ({
          ...prev,
          [orderId]: data.data || []
        }));

        // Process mill input data by quality for this order
        const processedData = processMillInputDataByQuality(data.data);
        console.log('🔄 Updating process data for order:', orderId, processedData);
        console.log('🔄 Process data keys:', Object.keys(processedData));
        setProcessDataByQuality(prev => {
          const merged = { ...prev, ...processedData };
          // ⚡ FORCE RE-RENDER to update UI
          setForceRender(prev => prev + 1);
          // Update localStorage cache
          try {
            const cache = localStorage.getItem('process-data-cache');
            if (cache) {
              const cached = JSON.parse(cache);
              cached.processData = merged;
              cached.timestamp = Date.now();
              localStorage.setItem('process-data-cache', JSON.stringify(cached));
            }
          } catch (e) { }
          return merged;
        });
      }
    } catch (error) {
      console.error('Error fetching mill inputs for order:', orderId, error);
    }
  }, [processMillInputDataByQuality]);

  const fetchParties = useCallback(async (forceRefresh = false, updateFormState = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for better reliability

      const token = localStorage.getItem('token');

      // ⚡ FIX: Ensure token exists before making request
      if (!token) {
        console.warn('No token found, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }

      // ⚡ FIX: Add cache-busting parameter when forceRefresh is true
      const url = forceRefresh
        ? `/api/parties?limit=100&page=1&_t=${Date.now()}`
        : '/api/parties?limit=100&page=1';

      // ⚡ OPTIMIZED: Use ISR caching (works on server-side, API will cache)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(forceRefresh ? { 'Cache-Control': 'no-cache' } : {})
        },
        signal: controller.signal,
        ...(forceRefresh ? { cache: 'no-store' } : {})
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) return; // Skip on auth error
        if (response.status === 404) {
          // Handle 404 gracefully - parties API might not be available
          console.warn('Parties API not available (404)');
          return;
        }
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
      console.log('🔄 fetchParties response:', data);

      if (data.success && data.data) {
        // API returns { success: true, data: [...], pagination: {...} }
        const partiesData = Array.isArray(data.data) ? data.data : [];
        console.log('📊 Parties data received:', partiesData.length, 'parties');

        // ⚡ FIX: Always update parties state, even if empty (to remove deleted items)
        setParties(partiesData);
        // Also update form parties if form is open OR if updateFormState is true
        if (showForm || updateFormState) {
          console.log('📊 Updating formParties with', partiesData.length, 'parties');
          setFormParties(partiesData);
        }

        // ⚡ FIX: Only update cache if we have data and it's not a force refresh
        if (partiesData.length > 0 && !forceRefresh) {
          localStorage.setItem('parties_cache', JSON.stringify({ data: partiesData, timestamp: Date.now() }));
          dataCache.current.parties = { data: partiesData, timestamp: Date.now() };
        } else if (forceRefresh) {
          // For force refresh, always update cache with fresh data
          localStorage.setItem('parties_cache', JSON.stringify({ data: partiesData, timestamp: Date.now() }));
          dataCache.current.parties = { data: partiesData, timestamp: Date.now() };
          console.log('🔄 Updated parties cache after force refresh');
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Silent timeout for parties - not critical for main functionality
      } else if (!error.message?.includes('401') && !error.message?.includes('404')) {
        // Silent error for parties - not critical for main functionality
        console.warn('Parties fetch failed:', error.message);
      }
    }
  }, [showForm]);

  const fetchQualities = useCallback(async (forceRefresh = false, updateFormState = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout for better stability

      const token = localStorage.getItem('token');

      // ⚡ FIX: Ensure token exists before making request
      if (!token) {
        console.warn('No token found, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }

      // ⚡ FIX: Add cache-busting parameter when forceRefresh is true
      const url = forceRefresh
        ? `/api/qualities?limit=100&page=1&_t=${Date.now()}`
        : '/api/qualities?limit=100&page=1';

      // ⚡ OPTIMIZED: Use ISR caching (works on server-side, API will cache)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(forceRefresh ? { 'Cache-Control': 'no-cache' } : {})
        },
        signal: controller.signal,
        ...(forceRefresh ? { cache: 'no-store' } : {})
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) return; // Skip on auth error
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
      console.log('🔄 fetchQualities response:', data);

      if (data.success && data.data) {
        // API returns { success: true, data: [...], pagination: {...} }
        const qualitiesData = Array.isArray(data.data) ? data.data : [];
        console.log('📊 Qualities data received:', qualitiesData.length, 'qualities');

        // ⚡ FIX: Always update qualities state, even if empty (to remove deleted items)
        setQualities(qualitiesData);

        // ⚡ CRITICAL: Always update formQualities when form is open OR when forceRefresh is true
        // This ensures dropdowns always have fresh data
        if (showForm || updateFormState || forceRefresh) {
          console.log('📊 Updating formQualities with', qualitiesData.length, 'qualities (showForm:', showForm, ', updateFormState:', updateFormState, ', forceRefresh:', forceRefresh, ')');
          setFormQualities(qualitiesData);
        }

        // ⚡ FIX: Only update cache if we have data and it's not a force refresh
        if (qualitiesData.length > 0 && !forceRefresh) {
          localStorage.setItem('qualities_cache', JSON.stringify({ data: qualitiesData, timestamp: Date.now() }));
          dataCache.current.qualities = { data: qualitiesData, timestamp: Date.now() };
        } else if (forceRefresh) {
          // For force refresh, always update cache with fresh data
          localStorage.setItem('qualities_cache', JSON.stringify({ data: qualitiesData, timestamp: Date.now() }));
          dataCache.current.qualities = { data: qualitiesData, timestamp: Date.now() };
          console.log('🔄 Updated qualities cache after force refresh');
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Silent timeout for qualities - not critical for main functionality
      } else if (!error.message?.includes('401')) {
        // Silent error for qualities - not critical for main functionality
      }
    }
  }, [showForm]);

  // Mills fetching function for MillInputForm
  const fetchMills = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token available for mills fetch');
        setMillsLoading(false);
        return;
      }

      setMillsLoading(true);
      console.log('Fetching mills from parent component...');
      // ⚡ OPTIMIZED: Use pagination (100 items per page)
      const response = await fetch('/api/mills?limit=100&page=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // API returns { success: true, data: { mills: [...], pagination: {...} } }
          const millsArray = Array.isArray(data.data.mills)
            ? data.data.mills
            : (Array.isArray(data.data) ? data.data : []);
          if (millsArray.length > 0) {
            console.log('✅ Parent fetched mills:', millsArray.length, 'mills');
            // Update mills state to pass to MillInputForm
            setMills(millsArray);
          } else {
            console.log('❌ No mills in parent response');
            setMills([]);
          }
        } else {
          console.log('❌ No mills in parent response');
          setMills([]);
        }
      } else {
        console.log('❌ Parent mills fetch failed:', response.status);
        setMills([]);
      }
    } catch (error) {
      console.error('Error fetching mills in parent:', error);
      setMills([]);
    } finally {
      setMillsLoading(false);
    }
  }, []);

  // Ensure mills are loaded on mount for filter dropdown
  useEffect(() => {
    if (!isInitialized) return;
    // Only fetch once if mills array is empty and not currently loading
    if (mills.length === 0 && !millsLoading && !hasFetchedMillsRef.current) {
      hasFetchedMillsRef.current = true;
      fetchMills().finally(() => {
        // Reset ref after fetch completes so it can retry if needed
        // But only if we got an error, not if we successfully got empty array
      });
    }
  }, [isInitialized, mills.length, millsLoading, fetchMills]);

  // Mills are now loaded in parallel with other APIs - no separate useEffect needed

  // AGGRESSIVE prefetching for EXTREME speed
  useEffect(() => {
    // Prefetch all critical routes and APIs immediately
    const prefetchAll = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      // No prefetch - load only when needed for super fast initial load
    };

    prefetchAll();
  }, []);

  // ⚡ CRITICAL: COMPLETELY DISABLED auto-refresh on tab switch to prevent data loss
  // This is essential for production with 10,000+ users
  // Users can manually refresh if they need fresh data
  // DO NOT re-enable this - it causes data loss when users switch tabs while filling forms
  useEffect(() => {
    const handleVisibilityChange = () => {
      // ⚡ CRITICAL: Completely disable auto-refresh on visibility change
      // This prevents ANY refresh when switching tabs, which was causing data loss
      // The page will only refresh when:
      // 1. User manually clicks refresh button
      // 2. User navigates to a different route and comes back
      // 3. Explicit refresh is triggered by form submission or other user actions

      if (document.visibilityState === 'hidden') {
        // Just log that page is hidden - don't do anything
        console.log('⏸️ Page hidden - auto-refresh disabled to prevent data loss');
      } else if (document.visibilityState === 'visible') {
        // Page became visible - DO NOT auto-refresh
        // This completely prevents refresh when switching tabs
        console.log('⏸️ Page visible - auto-refresh disabled to prevent data loss on tab switch');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // Empty deps - this handler never needs to change and should never trigger refreshes

  // PRIORITIZED LOADING - Load critical data first, then secondary data in background
  useEffect(() => {
    if (isInitialized) return;

    const initializeAllData = async () => {
      setLoading(true);
      setTableLoading(true);

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          showMessage('error', 'Please login to view orders', { autoDismiss: true, dismissTime: 3000 });
          setLoading(false);
          setTableLoading(false);
          return;
        }

        const startTime = Date.now();
        console.log('🚀 PRIORITIZED LOADING: Loading critical data first...');

        // Check cache first (5 minute cache validity)
        const cacheValidity = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();

        // PHASE 1: Load critical data first (Orders + Mills) - Show page immediately
        console.log('📋 Phase 1: Loading critical data (Orders + Mills)...');
        setLoadingPhase('critical');
        const criticalStartTime = Date.now();

        // ⚡ FIX: Use fetchOrders function to ensure proper filter handling and state management
        console.log('📋 Loading orders FIRST (highest priority) - FORCE REFRESH...');
        console.log('📋 Loading orders with filters:', filters);

        // Use fetchOrders with current filters (defaults to pending status)
        // Try to use fetchOrdersRef if available, otherwise use direct fetch
        let ordersLoadedSuccessfully = false;

        if (fetchOrdersRef.current) {
          try {
            await fetchOrdersRef.current(0, 1, itemsPerPage, true, filters, searchTerm);
            ordersLoadedSuccessfully = true;
            console.log('✅ Orders loaded via fetchOrdersRef');
          } catch (error) {
            console.error('❌ Error loading orders via fetchOrdersRef:', error);
          }
        }

        // Fallback: Direct fetch if fetchOrdersRef not available or failed
        if (!ordersLoadedSuccessfully) {
          console.log('📋 Using direct fetch as fallback...');
          // Build URL with proper filters
          const url = new URL('/api/orders', window.location.origin);
          url.searchParams.append('limit', itemsPerPage.toString());
          url.searchParams.append('page', '1');

          // Add filter parameters
          if (filters.status && filters.status !== '') {
            url.searchParams.append('status', filters.status);
          }
          if (filters.orderType) {
            url.searchParams.append('orderType', filters.orderType);
          }
          if (filters.millId) {
            url.searchParams.append('millId', filters.millId);
          }
          if (filters.startDate) {
            url.searchParams.append('startDate', filters.startDate);
          }
          if (filters.endDate) {
            url.searchParams.append('endDate', filters.endDate);
          }
          if (filters.orderFilter && filters.orderFilter !== 'latest_first') {
            url.searchParams.append('sort', filters.orderFilter);
          }
          if (searchTerm) {
            url.searchParams.append('search', searchTerm);
          }
          url.searchParams.append('t', Date.now().toString());

          const ordersResponse = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          });

          if (ordersResponse.ok) {
            const ordersData = await ordersResponse.json();
            console.log('✅ Orders API loaded successfully:', ordersData.data?.length || 0, 'orders');

            if (ordersData.success && ordersData.data) {
              const ordersArray = Array.isArray(ordersData.data) ? ordersData.data : [];
              setOrdersSafe(ordersArray);
              setOrdersLoaded(true);
              setLoading(false);
              setTableLoading(false);

              // Set pagination info
              if (ordersData.pagination) {
                setPaginationInfo({
                  totalCount: ordersData.pagination.total || 0,
                  totalPages: ordersData.pagination.pages || 1,
                  currentPage: ordersData.pagination.page || 1,
                  hasNextPage: (ordersData.pagination.page || 1) < (ordersData.pagination.pages || 1),
                  hasPrevPage: (ordersData.pagination.page || 1) > 1
                });
              }

              console.log('🎯 Page is now functional with orders!');
              ordersLoadedSuccessfully = true;
            }
          } else {
            console.error('❌ Orders API failed:', ordersResponse.status);
            showMessage('error', 'Failed to load orders. Please refresh the page.');
            setLoading(false);
            setTableLoading(false);
            setOrdersLoaded(true); // Mark as loaded to show empty state
            return;
          }
        }

        // Only mark as initialized if orders loaded successfully
        if (ordersLoadedSuccessfully) {
          setIsInitialized(true);
        }

        const criticalEndTime = Date.now();
        console.log(`⚡ Orders loaded in ${criticalEndTime - criticalStartTime}ms`);

        // PHASE 2: Load other APIs in background (non-blocking)
        console.log('📋 Phase 2: Loading other APIs in background...');
        setLoadingPhase('secondary');

        // ⚡ Load mills from localStorage FIRST (instant!)
        const millsLocalCache = localStorage.getItem('mills_cache');
        if (millsLocalCache) {
          try {
            const cached = JSON.parse(millsLocalCache);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hour
              console.log('⚡ INSTANT: Mills loaded from localStorage!');
              setMills(cached.data || []);
            }
          } catch (e) { }
        }

        // Load mills in background
        setTimeout(async () => {
          try {
            console.log('🏭 Loading mills in background...');
            // ⚡ REMOVED force=true - Use cache!
            // ⚡ OPTIMIZED: Use pagination (100 items per page)
            const millsResponse = await fetch('/api/mills?limit=100&page=1', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });

            if (millsResponse.ok) {
              const millsData = await millsResponse.json();
              if (millsData.success && millsData.data) {
                // API returns { success: true, data: { mills: [...], pagination: {...} } }
                const millsArray = Array.isArray(millsData.data.mills)
                  ? millsData.data.mills
                  : (Array.isArray(millsData.data) ? millsData.data : []);
                setMills(millsArray);
                localStorage.setItem('mills_cache', JSON.stringify({ data: millsArray, timestamp: Date.now() }));
                dataCache.current.mills = { data: millsArray, timestamp: Date.now() };
                console.log('✅ Mills loaded in background:', millsArray.length, 'mills');
              }

            }
          } catch (error) {
            console.error('❌ Failed to load mills in background:', error);
          }
        }, 100);

        // ⚡ Load parties from localStorage FIRST (instant!)
        const partiesLocalCache = localStorage.getItem('parties_cache');
        if (partiesLocalCache) {
          try {
            const cached = JSON.parse(partiesLocalCache);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hour
              console.log('⚡ INSTANT: Parties loaded from localStorage!');
              const partiesData = Array.isArray(cached.data) ? cached.data : [];
              setParties(partiesData);
              setFormParties(partiesData);
            }
          } catch (e) { }
        }

        // Load parties immediately (non-blocking)
        (async () => {
          try {
            console.log('👥 Loading parties...');
            // ⚡ OPTIMIZED: Use pagination (100 items per page)
            const partiesResponse = await fetch('/api/parties?limit=100&page=1', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });

            if (partiesResponse.ok) {
              const partiesData = await partiesResponse.json();
              if (partiesData.success && partiesData.data) {
                // API returns { success: true, data: [...], pagination: {...} }
                const partiesArray = Array.isArray(partiesData.data) ? partiesData.data : [];

                if (partiesArray.length > 0) {
                  setParties(partiesArray);
                  setFormParties(partiesArray);
                  localStorage.setItem('parties_cache', JSON.stringify({ data: partiesArray, timestamp: Date.now() }));
                  dataCache.current.parties = { data: partiesArray, timestamp: Date.now() };
                  console.log('✅ Parties loaded:', partiesArray.length, 'parties');
                } else {
                  console.warn('⚠️ Parties API returned empty array');
                }
              } else {
                console.error('❌ Parties API response invalid:', partiesData);
              }
            } else {
              console.error('❌ Parties API failed with status:', partiesResponse.status);
            }
          } catch (error) {
            console.error('❌ Failed to load parties:', error);
          }
        })();

        // ⚡ Load qualities from localStorage FIRST (instant!)
        const qualitiesLocalCache = localStorage.getItem('qualities_cache');
        if (qualitiesLocalCache) {
          try {
            const cached = JSON.parse(qualitiesLocalCache);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hour
              console.log('⚡ INSTANT: Qualities loaded from localStorage!');
              const qualitiesData = Array.isArray(cached.data) ? cached.data : [];
              setQualities(qualitiesData);
              setFormQualities(qualitiesData);
            }
          } catch (e) { }
        }

        // Load qualities immediately (non-blocking)
        (async () => {
          try {
            console.log('🏷️ Loading qualities...');
            // ⚡ OPTIMIZED: Use pagination (100 items per page)
            const qualitiesResponse = await fetch('/api/qualities?limit=100&page=1', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });

            if (qualitiesResponse.ok) {
              const qualitiesData = await qualitiesResponse.json();
              if (qualitiesData.success && qualitiesData.data) {
                // API returns { success: true, data: [...], pagination: {...} }
                const qualitiesArray = Array.isArray(qualitiesData.data) ? qualitiesData.data : [];

                if (qualitiesArray.length > 0) {
                  setQualities(qualitiesArray);
                  setFormQualities(qualitiesArray);
                  localStorage.setItem('qualities_cache', JSON.stringify({ data: qualitiesArray, timestamp: Date.now() }));
                  dataCache.current.qualities = { data: qualitiesArray, timestamp: Date.now() };
                  console.log('✅ Qualities loaded:', qualitiesArray.length, 'qualities');
                } else {
                  console.warn('⚠️ Qualities API returned empty array');
                }
              } else {
                console.error('❌ Qualities API response invalid:', qualitiesData);
              }
            } else {
              console.error('❌ Qualities API failed with status:', qualitiesResponse.status);
            }
          } catch (error) {
            console.error('❌ Failed to load qualities:', error);
          }
        })();

        // Background loading completed
        setLoadingPhase('complete');
        const totalEndTime = Date.now();
        console.log(`🚀 PROGRESSIVE LOADING COMPLETED - Orders loaded in ${criticalEndTime - criticalStartTime}ms`);
        console.log('🎯 Page is fully functional! Other data loading in background...');

        // Remove old Promise.allSettled code - replaced with background loading above
        /*
        const [partiesResult, qualitiesResult] = await Promise.allSettled([
          // Parties API - Secondary priority
          // ⚡ REMOVED force=true
          fetch('/api/parties?limit=100', {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Accept': 'application/json'
            },
            cache: 'no-store'
          }).then(async response => {
            if (response.ok) {
              const data = await response.json();
              console.log('✅ Parties API loaded successfully:', data.data?.length || 0, 'parties');
              return { type: 'parties', data, success: true };
            } else {
              console.error('❌ Parties API failed:', response.status);
              return { type: 'parties', data: null, success: false };
            }
          }),
          
          // Qualities API - Secondary priority
          // ⚡ REMOVED force=true
          fetch('/api/qualities?limit=100', {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Accept': 'application/json'
            },
            cache: 'no-store'
          }).then(async response => {
            if (response.ok) {
              const data = await response.json();
              console.log('✅ Qualities API loaded successfully:', data.data?.length || 0, 'qualities');
              return { type: 'qualities', data, success: true };
            } else {
              console.error('❌ Qualities API failed:', response.status);
              return { type: 'qualities', data: null, success: false };
            }
          })
        ]);
        
        const secondaryEndTime = Date.now();
        console.log(`⚡ Phase 2 completed in ${secondaryEndTime - secondaryStartTime}ms`);
        
        // Process secondary results
        if (partiesResult.status === 'fulfilled' && partiesResult.value.success && partiesResult.value.data?.success && partiesResult.value.data?.data) {
          const partiesData = Array.isArray(partiesResult.value.data.data) ? partiesResult.value.data.data : [];
          setParties(partiesData);
          
          // Cache the parties data
          dataCache.current.parties = { data: partiesData, timestamp: now };
          
          console.log('👥 Parties loaded - Form functionality enhanced!');
        }
        
        if (qualitiesResult.status === 'fulfilled' && qualitiesResult.value.success && qualitiesResult.value.data?.success && qualitiesResult.value.data?.data) {
          const qualitiesData = Array.isArray(qualitiesResult.value.data.data) ? qualitiesResult.value.data.data : [];
          setQualities(qualitiesData);
          
          // Cache the qualities data
          dataCache.current.qualities = { data: qualitiesData, timestamp: now };
          
          console.log('🏷️ Qualities loaded - Form functionality complete!');
        }
        
        const totalEndTime = Date.now();
        console.log(`🚀 PRIORITIZED LOADING COMPLETED - Total: ${totalEndTime - startTime}ms, Critical: ${criticalEndTime - criticalStartTime}ms`);
        console.log('🎯 Page is fully functional with all data loaded!');
        */

      } catch (error) {
        console.error('Error during prioritized API loading:', error);
        setOrdersSafe([]);
        setLoading(false);
        setOrdersLoaded(true); // Mark as loaded even on error to show "No orders yet"

        // Only show error message for network errors, not for aborted requests
        if (error instanceof Error && error.name !== 'AbortError') {
          console.log('Non-abort error during initialization:', error.message);
          showMessage('error', 'Failed to load orders. Please try again.', { autoDismiss: true, dismissTime: 3000 });

          // Auto-retry after 5 seconds
          setTimeout(() => {
            console.log('Auto-retrying orders load...');
            if (!isInitialized) { // Only retry if not already initialized
              initializeAllData();
            }
          }, 5000);
        }
      } finally {
        // Only set loading to false if not already set
        setLoading(false);
        setTableLoading(false);
        // Don't set isInitialized here - it should only be set after successful data load
        // If we reach here without success, isInitialized will be set by timeout
      }
    };

    // Initialize immediately - fetchOrders will be available via ref or we'll use fallback
    initializeAllData();

    // ONE TIME timeout - 10 seconds max for critical data loading
    const timeoutId = setTimeout(() => {
      if (!isInitialized) {
        console.warn('Orders initialization timed out after 10 seconds');
        setOrdersSafe([]);
        setLoading(false);
        setTableLoading(false);
        setOrdersLoaded(true); // Mark as loaded even on timeout
        setIsInitialized(true);
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [isInitialized, setOrdersSafe, showMessage, setMills, setParties, setQualities]);

  // ⚡ FIX: Always fetch fresh data when component mounts or when navigating to orders page
  // This ensures data is always up-to-date when user returns to the page
  useEffect(() => {
    // Track the current pathname
    const currentPath = window.location.pathname;
    const lastPath = sessionStorage.getItem('last-orders-path');

    // If path changed or this is first load, ensure we fetch fresh data
    // But preserve existing orders in state to prevent clearing newly created orders
    if (currentPath.includes('/orders')) {
      if (lastPath !== currentPath) {
        console.log('🔄 Navigating to orders page, preserving existing orders and merging with fresh data');
        // Don't clear cache immediately - let fetchOrders merge with existing orders
        // This preserves newly created orders that might not be in backend yet
        sessionStorage.setItem('last-orders-path', currentPath);
        sessionStorage.setItem('orders-cache-timestamp', Date.now().toString());

        // Only fetch if we don't have orders or if it's not initialized
        // The merge logic in fetchOrders will preserve existing orders
        if (orders.length === 0 || !isInitialized) {
          setIsInitialized(false); // Reset to trigger fresh fetch
        }
        // Don't automatically fetch if we have orders - this prevents clearing orders when navigating back
      }
    }
  }, [router, orders.length, isInitialized, currentPage, itemsPerPage, filters, searchTerm, fetchOrders]);

  // Removed automatic refresh on visibility/focus to prevent clearing newly created orders

  // Save orders to localStorage when they change (but not during fetch)
  useEffect(() => {
    if (orders.length > 0 && ordersLoaded && !loading) {
      try {
        localStorage.setItem('orders_cache', JSON.stringify({
          data: orders,
          pagination: paginationInfo,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }, [orders, ordersLoaded, loading, paginationInfo]);

  // Auto-refresh button states when orders are loaded
  useEffect(() => {
    if (orders.length > 0 && ordersLoaded) {
      // Update button states from orders data (no API calls needed)
      orders.forEach(order => {
        // Update mill input state
        if ((order as any).millInputs && (order as any).millInputs.length > 0) {
          setOrderMillInputs(prev => ({
            ...prev,
            [order.orderId]: (order as any).millInputs
          }));
        }

        // Update mill output state
        if ((order as any).millOutputs && (order as any).millOutputs.length > 0) {
          setOrderMillOutputs(prev => ({
            ...prev,
            [order.orderId]: (order as any).millOutputs
          }));
        }

        // Update dispatch state
        if ((order as any).dispatches && (order as any).dispatches.length > 0) {
          setOrderDispatches(prev => ({
            ...prev,
            [order.orderId]: (order as any).dispatches
          }));
        }

        // Update grey information state (store with both _id and orderId as keys)
        if ((order as any).greyInformation && Array.isArray((order as any).greyInformation) && (order as any).greyInformation.length > 0) {
          setOrderGreyInfo(prev => ({
            ...prev,
            [String(order._id)]: (order as any).greyInformation,
            ...(order.orderId ? {
              [String(order.orderId)]: (order as any).greyInformation
            } : {})
          }));
        }
      });

      // ⚡ CRITICAL: Force button re-render after updating grey info state
      setForceRender(prev => prev + 1);

      console.log('Button states updated from orders data');

      // Ensure process data loading is set to false when orders are loaded
      if (processDataLoading) {
        console.log('🔄 Setting process data loading to false - orders are loaded');
        setProcessDataLoading(false);
      }
    }
  }, [orders, ordersLoaded, processDataLoading]); // Run when orders change

  // Auto-refresh lab data states when orders change
  useEffect(() => {
    if (orders.length > 0 && ordersLoaded) {
      // Lab data is already included in orders, so no additional API call needed
      console.log('Lab data states updated for all orders');
    }
  }, [orders, ordersLoaded]); // Run when orders change

  // Fetch all order data (mill inputs, outputs, dispatches, grey info) on initial load
  useEffect(() => {
    if (ordersLoaded && isInitialized && !hasFetchedOrderDataRef.current) {
      // Only fetch once on initial load
      hasFetchedOrderDataRef.current = true;
      console.log('🔄 Fetching all order data (including grey information)...');
      fetchAllOrderData().catch(error => {
        console.error('Error fetching all order data:', error);
        hasFetchedOrderDataRef.current = false; // Reset on error so it can retry
      });
    }
  }, [ordersLoaded, isInitialized, fetchAllOrderData]);

  // Load additional data only when needed (lazy loading)
  const loadPartiesData = useCallback(async () => {
    try {
      const response = await fetch('/api/parties?limit=100', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setParties(data.data);
          return data.data;
        }
      }
      return [];
    } catch (error) {
      console.error('Error loading parties:', error);
      return [];
    }
  }, []);

  const loadQualitiesData = useCallback(async () => {
    try {
      const response = await fetch('/api/qualities?limit=100', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setQualities(data.data);
          return data.data;
        }
      }
      return [];
    } catch (error) {
      console.error('Error loading qualities:', error);
      return [];
    }
  }, []);

  // Function to open form with data loading
  const openFormWithData = useCallback(async (order?: Order) => {
    // If editing an order, fetch fresh data from API first
    if (order?._id) {
      try {
        console.log('🔄 Fetching fresh order data for editing...', order._id);
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/orders/${order._id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-cache'
        });

        if (response.ok) {
          const orderData = await response.json();
          if (orderData.success && orderData.data) {
            console.log('✅ Fresh order data fetched successfully');
            // Set the fresh order data with all populated fields
            setEditingOrder(orderData.data);
          } else {
            // Fallback to original order if API fails
            console.warn('⚠️ API returned unsuccessful, using original order data');
            setEditingOrder(order);
          }
        } else {
          // Fallback to original order if API fails
          console.warn('⚠️ Failed to fetch order data, using original order');
          setEditingOrder(order);
        }
      } catch (error) {
        console.error('❌ Error fetching order data:', error);
        // Fallback to original order on error
        setEditingOrder(order);
      }
    } else {
      // Creating new order
      setEditingOrder(null);
    }

    // Show form immediately
    setShowForm(true);

    // ⚡ FIX: Fetch parties and qualities from API when Create Order is clicked
    // Use forceRefresh=true and updateFormState=true to ensure fresh data and form state update
    try {
      console.log('🔄 Fetching parties and qualities for form...');

      // Fetch parties and qualities with force refresh and force form state update
      await Promise.all([
        fetchParties(true, true), // Force refresh + force form state update
        fetchQualities(true, true) // Force refresh + force form state update
      ]);

      console.log('✅ Parties and qualities fetched successfully');
    } catch (error) {
      console.error('Error loading form data:', error);
      // Form is already shown, data will be set by fetchParties/fetchQualities
    }
  }, [fetchParties, fetchQualities]);

  // Mills data loading disabled for performance
  const loadMillsData = useCallback(async () => {
    // Function disabled for performance - mills will be loaded when needed
    console.log('loadMillsData disabled for performance');
  }, []);

  const loadMillInputsData = useCallback(async (orderId: string, forceRefresh = false) => {
    // Always load fresh data when forceRefresh is true
    if (!forceRefresh && orderMillInputs[orderId]) {
      console.log('Mill inputs already loaded for order:', orderId);
      return; // Already loaded for this order
    }

    try {
      console.log('Loading mill inputs for order:', orderId, forceRefresh ? '(forced refresh)' : '');
      const token = localStorage.getItem('token');

      // Make request with or without token
      const headers: any = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/mill-inputs?orderId=${orderId}&limit=100&t=${Date.now()}`, {
        headers: headers
      });

      console.log('Mill inputs API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Mill inputs API response data:', data);
        if (data.success && data.data?.millInputs) {
          console.log('Setting mill inputs data:', data.data.millInputs);
          setOrderMillInputs(prev => ({
            ...prev,
            [orderId]: data.data.millInputs
          }));
        } else {
          console.log('No mill inputs data found in response');
        }
      } else {
        console.log('Mill inputs API response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error loading mill inputs:', error);
    }
  }, [orderMillInputs]);

  const loadMillOutputsData = useCallback(async (orderId: string, forceRefresh = false) => {
    if (!forceRefresh && orderMillOutputs[orderId]) return; // Already loaded for this order

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/mill-outputs?orderId=${orderId}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.millOutputs) {
          setOrderMillOutputs(prev => ({
            ...prev,
            [orderId]: data.data.millOutputs
          }));
        }
      }
    } catch (error) {
      console.error('Error loading mill outputs:', error);
    }
  }, [orderMillOutputs]);

  const loadDispatchesData = useCallback(async (orderId: string, forceRefresh = false) => {
    if (!forceRefresh && orderDispatches[orderId]) return; // Already loaded for this order

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/dispatch?orderId=${orderId}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.dispatches) {
          setOrderDispatches(prev => ({
            ...prev,
            [orderId]: data.data.dispatches
          }));
        }
      }
    } catch (error) {
      console.error('Error loading dispatches:', error);
    }
  }, [orderDispatches]);

  // Function to refresh orders data (includes all button states)
  const refreshOrdersData = useCallback(async () => {
    try {
      await fetchOrders();
      console.log('Orders data refreshed');
    } catch (error) {
      console.error('Error refreshing orders data:', error);
    }
  }, [fetchOrders]);

  // Function to refresh lab data states for all orders
  const refreshLabDataStates = useCallback(async () => {
    if (orders.length === 0) return;

    try {
      // Refresh orders to get latest lab data
      await refreshOrdersWithRetry();
      console.log('Lab data states refreshed');
    } catch (error) {
      console.error('Error refreshing lab data states:', error);
    }
  }, [orders, refreshOrdersWithRetry]);

  // Function to refresh lab data for a specific order
  const refreshOrderLabData = useCallback(async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/labs/by-order/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const labDataResponse = await response.json();
        if (labDataResponse.success && labDataResponse.data && Array.isArray(labDataResponse.data)) {
          // ⚡ CRITICAL FIX: Update the specific order with fresh lab data
          // Match lab data to items by orderItemId to ensure all lab data is preserved
          setOrders(prevOrders =>
            prevOrders.map(order => {
              if (order._id?.toString() === orderId?.toString()) {
                const updatedOrder = { ...order };

                // Update items with lab data - match by orderItemId
                updatedOrder.items = updatedOrder.items.map(item => {
                  const itemLabData = labDataResponse.data.find((lab: any) => {
                    const labItemId = lab.orderItemId?.toString();
                    const itemId = item._id?.toString();
                    return labItemId === itemId;
                  });

                  if (itemLabData) {
                    return {
                      ...item,
                      labData: {
                        labSendDate: itemLabData.labSendDate || null,
                        approvalDate: itemLabData.labSendData?.approvalDate || null,
                        sampleNumber: itemLabData.labSendData?.sampleNumber || '',
                        color: itemLabData.labSendData?.color || '',
                        shade: itemLabData.labSendData?.shade || '',
                        notes: itemLabData.labSendData?.notes || '',
                        imageUrl: itemLabData.labSendData?.imageUrl || '',
                        labSendNumber: itemLabData.labSendNumber || '',
                        status: itemLabData.status || 'sent',
                        remarks: itemLabData.remarks || ''
                      }
                    };
                  } else {
                    // No lab data for this item - preserve item but no lab data
                    return {
                      ...item,
                      labData: undefined
                    };
                  }
                });

                // Update order lab data array
                updatedOrder.labData = labDataResponse.data.length > 0 ? labDataResponse.data : [];

                console.log('✅ Lab data refreshed for order:', orderId, {
                  itemsCount: updatedOrder.items.length,
                  itemsWithLabData: updatedOrder.items.filter(item => item.labData?.labSendDate).length,
                  labDataFromAPI: labDataResponse.data.length
                });

                return updatedOrder;
              }
              return order;
            })
          );
        } else {
          console.log('⚠️ No lab data found in API response for order:', orderId);
        }
      }
    } catch (error) {
      console.error('Error refreshing order lab data:', error);
    }
  }, []);

  // Keyboard navigation for image preview
  useEffect(() => {
    if (showImagePreview) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showImagePreview, currentImageIndex]);

  // NO MORE EVENT LISTENERS - No multiple refreshes

  // Optimized refresh function - preserves existing orders during refresh
  const handleRefresh = useCallback(async () => {
    if (refreshing) {
      console.log('🔄 Refresh already in progress, skipping...');
      return; // Prevent multiple simultaneous refreshes
    }

    // ⚡ FIX: Don't set tableLoading to true - keep orders visible during refresh
    setRefreshing(true);
    console.log('🔄 Starting refresh (will preserve existing orders)...');

    try {
      // Refresh orders - merge logic will preserve existing orders
      // Use forceRefresh=true to get fresh data from server
      // The merge logic will handle preserving existing orders
      await fetchOrders(0, currentPage, itemsPerPage, true, filters, searchTerm);
      console.log('✅ Orders refresh completed successfully');

      // ⚡ FIX: Also refresh grey info and other process data
      console.log('🔄 Refreshing grey info and process data...');
      await fetchAllOrderData();
      console.log('✅ Grey info refresh completed successfully');

      // Refresh happens silently - no success message
    } catch (error: any) {
      console.error('❌ Error during refresh:', error);
      showMessage('error', '❌ Failed to refresh orders. Please try again.', {
        autoDismiss: true,
        dismissTime: 4000
      });
    } finally {
      setRefreshing(false);
      // ⚡ FIX: Don't set tableLoading to false here - let fetchOrders handle it
    }
  }, [fetchOrders, fetchAllOrderData, showMessage, refreshing, currentPage, itemsPerPage, filters, searchTerm]);

  // PDF Download function for individual items - fetches fresh data
  const handleDownloadItemPDF = useCallback(async (order: any, item: any, itemIndex: number) => {
    try {
      showMessage('info', 'Fetching latest data for PDF...', {
        autoDismiss: true,
        dismissTime: 2000
      });

      const token = localStorage.getItem('token');

      // Fetch fresh order data and grey information in parallel
      const [orderResponse, greyInfoResponse] = await Promise.all([
        fetch(`/api/orders/${order._id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          cache: 'no-store' // Don't use cache for fresh data
        }),
        fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          cache: 'no-store'
        })
      ]);

      if (!orderResponse.ok) {
        if (orderResponse.status === 503) {
          throw new Error('Server is temporarily unavailable. Please try again in a moment.');
        } else if (orderResponse.status === 404) {
          throw new Error('Order not found. It may have been deleted.');
        } else if (orderResponse.status === 401 || orderResponse.status === 403) {
          throw new Error('You are not authorized to access this order. Please log in again.');
        }
        throw new Error(`Failed to fetch order data (${orderResponse.status})`);
      }

      const orderData = await orderResponse.json();
      if (!orderData.success) {
        throw new Error(orderData.message || 'Failed to get order data');
      }

      // Parse grey information data
      let greyInformation: any[] = [];
      if (greyInfoResponse.ok) {
        const greyInfoData = await greyInfoResponse.json();
        if (greyInfoData.success && greyInfoData.data?.greyInfo) {
          greyInformation = greyInfoData.data.greyInfo;
        }
      }

      // Create a modified order object with only the specific item
      const itemOrder = {
        ...orderData.data,
        items: [item], // Only include the specific item
        greyInformation: greyInformation, // Add grey information data
        // Add item-specific information to the order
        itemIndex: itemIndex + 1,
        qualityName: item.quality && typeof item.quality === 'object' ? item.quality.name || 'Not selected' : 'Not selected',
        totalAmount: item.totalPrice || 0,
        finalAmount: item.totalPrice || 0
        // The orderData.data already includes fresh millInputs, millOutputs, and dispatches
        // from the API, so we don't need to add them separately
      };

      // Validate order data before generating PDF
      if (!itemOrder || !itemOrder.orderId) {
        throw new Error('Invalid order data: Order ID is missing');
      }

      if (!itemOrder.items || !Array.isArray(itemOrder.items) || itemOrder.items.length === 0) {
        throw new Error('Invalid order data: No items found');
      }

      // Generate PDF
      generateOrderPDF(itemOrder);

      showMessage('success', `PDF downloaded for ${item.quality && typeof item.quality === 'object' ? item.quality.name || 'Item' : 'Item'}`, {
        autoDismiss: true,
        dismissTime: 3000
      });
    } catch (error: any) {
      console.error('PDF generation error:', error);
      console.error('PDF generation error details:', {
        error: error?.message || error?.toString(),
        stack: error?.stack,
        orderId: order?.orderId,
        itemIndex
      });

      const errorMessage = error?.message || 'Failed to generate PDF. Please try again.';
      showMessage('error', errorMessage, {
        autoDismiss: true,
        dismissTime: 5000
      });
    }
  }, [showMessage]);

  // Reset ID function - shows confirmation modal first
  const handleResetIdClick = useCallback(() => {
    // Prevent opening modal if already resetting
    if (resettingCounter) {
      return;
    }
    setShowResetIdModal(true);
    setShowQuickActions(false);
  }, [resettingCounter]);

  // Reset ID function - renumbers orders sequentially (fills gaps)
  const handleResetIdConfirm = useCallback(async () => {
    setResettingCounter(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders/renumber-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      });

      const data = await response.json();

      if (data.success) {
        const relatedData = data.relatedDataUpdated || {};
        const relatedCounts = [
          relatedData.greyInfo > 0 ? `${relatedData.greyInfo} grey info` : null,
          relatedData.millInputs > 0 ? `${relatedData.millInputs} mill inputs` : null,
          relatedData.millOutputs > 0 ? `${relatedData.millOutputs} mill outputs` : null,
          relatedData.dispatches > 0 ? `${relatedData.dispatches} dispatches` : null,
          relatedData.labs > 0 ? `${relatedData.labs} labs` : null
        ].filter(Boolean);

        const relatedMsg = relatedCounts.length > 0
          ? ` Updated: ${relatedCounts.join(', ')}.`
          : '';

        showMessage('success', `${data.message || `Order IDs renumbered successfully. Next new order will be ${data.nextOrderId}`}${relatedMsg}`, { autoDismiss: true, dismissTime: 6000 });
        setIsResetIdModalClosing(true);
        setTimeout(() => {
          setShowResetIdModal(false);
          setIsResetIdModalClosing(false);
          setShowQuickActions(false);
        }, 200);

        // ⚡ CLEAR ALL CACHES - Complete cache clear for fresh data
        try {
          // Clear all localStorage caches
          localStorage.removeItem('orders_cache');
          localStorage.removeItem('process-data-cache');

          // Clear all grey-info caches
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('grey-info-')) {
              localStorage.removeItem(key);
            }
          });

          // Clear sessionStorage
          sessionStorage.removeItem('last-orders-path');
          sessionStorage.removeItem('orders-cache-timestamp');

          // Clear in-memory caches
          dataCache.current.orders = null;
          dataCache.current.mills = null;
          dataCache.current.parties = null;
        } catch (e) {
          console.error('Error clearing caches:', e);
        }

        // Clear all state for related data
        setOrderMillInputs({});
        setOrderMillOutputs({});
        setOrderDispatches({});
        setOrderGreyInfo({});

        // Trigger real-time update for Dashboard and Order Activity Log
        const event = new CustomEvent('orderUpdated', {
          detail: {
            action: 'order_renumber_ids',
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(event);

        // ⚡ IMMEDIATE REFRESH - No delays, refresh immediately after success
        // Clear orders state first to force fresh load
        setOrders([]);
        setOrdersLoaded(false);

        // Immediately refresh orders list with force refresh (goes to page 1)
        // The API cache is already cleared on the server, so this will get fresh data
        try {
          // Refresh orders list immediately - no delay needed since server cache is cleared
          await refreshOrdersWithRetry(2, true);

          // Also fetch all order data to refresh buttons and related data
          await fetchAllOrderData();

          // Force re-render to ensure all components update
          setForceRender(prev => prev + 1);
        } catch (error) {
          console.error('Error refreshing after renumber:', error);
          // Retry once more if first attempt fails
          try {
            await refreshOrdersWithRetry(2, true);
          } catch (retryError) {
            console.error('Retry also failed:', retryError);
          }
        }
      } else {
        showMessage('error', data.message || 'Failed to renumber order IDs', { autoDismiss: true, dismissTime: 4000 });
      }
    } catch (error) {
      showMessage('error', 'Failed to renumber order IDs', { autoDismiss: true, dismissTime: 4000 });
    } finally {
      setResettingCounter(false);
    }
  }, [refreshOrdersWithRetry, fetchAllOrderData, showMessage]);

  // Delete all orders function
  const handleDeleteAllOrders = useCallback(async () => {
    setDeletingAll(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders/delete-all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      });

      const data = await response.json();

      if (data.success) {
        showMessage('success', data.message, { autoDismiss: true, dismissTime: 5000 });
        setShowDeleteAllModal(false);

        // Clear all local state immediately
        setOrders([]);
        setOrderMillInputs({});
        setOrderMillOutputs({});
        setOrderDispatches({});
        setOrderGreyInfo({});
        setPaginationInfo({
          totalCount: 0,
          totalPages: 0,
          currentPage: 1,
          hasNextPage: false,
          hasPrevPage: false
        });
        setCurrentPage(1);

        // Clear localStorage cache
        localStorage.removeItem('orders_cache');
        dataCache.current.orders = null;

        // Trigger real-time update for Order Activity Log
        const event = new CustomEvent('orderUpdated', {
          detail: {
            action: 'order_delete_all',
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(event);

        await fetchOrders(); // Refresh the orders list (will be empty)
      } else {
        showMessage('error', data.message, { autoDismiss: true, dismissTime: 4000 });
      }
    } catch (error: any) {
      showMessage('error', 'Failed to delete all orders', { autoDismiss: true, dismissTime: 4000 });
    } finally {
      setDeletingAll(false);
    }
  }, [fetchOrders, showMessage]);

  // Handle status change with confirmation
  const handleStatusChangeClick = useCallback((orderId: string, newStatus: "pending" | "delivered", orderIdDisplay: string) => {
    setStatusChangeData({ orderId, newStatus, orderIdDisplay });
    setShowStatusConfirmModal(true);
  }, []);

  // Handle confirmed status change with optimistic updates
  const handleStatusChange = useCallback(async () => {
    if (!statusChangeData) return;

    setChangingStatus(true);

    // Optimistic update - immediately update the UI
    setOrders(prev => prev.map(order =>
      order._id === statusChangeData.orderId ? { ...order, status: statusChangeData.newStatus } : order
    ));

    // Close modal with animation
    setIsStatusModalClosing(true);
    setTimeout(() => {
      setShowStatusConfirmModal(false);
      setIsStatusModalClosing(false);
    }, 200);
    // Don't clear statusChangeData yet - we need it for loading state

    try {
      const token = localStorage.getItem('token');

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for better stability

      const response = await fetch(`/api/orders/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          orderId: statusChangeData.orderId,
          status: statusChangeData.newStatus
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        // Show only one success message
        showMessage('success', `Order ${statusChangeData.orderIdDisplay} status updated to ${statusChangeData.newStatus}`, { autoDismiss: true, dismissTime: 1000 });

        // Clear dashboard cache when status changes to delivered
        if (statusChangeData.newStatus === 'delivered') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('dashboard-cache');
          }
        }

        // Trigger real-time update for Order Activity Log
        const event = new CustomEvent('orderUpdated', {
          detail: {
            orderId: statusChangeData.orderId,
            action: 'order_status_change',
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(event);
      } else {
        // Revert optimistic update on error
        setOrders(prev => prev.map(order =>
          order._id === statusChangeData.orderId ? { ...order, status: statusChangeData.newStatus === 'pending' ? 'delivered' : 'pending' } : order
        ));
        showMessage('error', data.message || 'Failed to update order status', { autoDismiss: true, dismissTime: 1500 });
      }
    } catch (error) {
      // Revert optimistic update on error
      setOrders(prev => prev.map(order =>
        order._id === statusChangeData.orderId ? { ...order, status: statusChangeData.newStatus === 'pending' ? 'delivered' : 'pending' } : order
      ));

      // Handle different error types
      if (error instanceof Error && error.name === 'AbortError') {
        showMessage('error', 'Request timed out. Please try again.', { autoDismiss: true, dismissTime: 1500 });
      } else {
        showMessage('error', 'Failed to update order status', { autoDismiss: true, dismissTime: 1500 });
      }
    } finally {
      setChangingStatus(false);
      setStatusChangeData(null); // Clear statusChangeData after loading is complete
    }
  }, [statusChangeData, showMessage]);

  // Memoized order statistics
  const orderStats = useMemo(() => {
    // Ensure orders is an array before using filter
    const ordersArray = Array.isArray(orders) ? orders : [];
    const total = ordersArray.length;
    const pending = ordersArray.filter(order => {
      const now = new Date();
      return now <= new Date(order.arrivalDate || '');
    }).length;
    const arrived = ordersArray.filter(order => {
      const now = new Date();
      return now > new Date(order.arrivalDate || '') &&
        (!order.deliveryDate || now <= new Date(order.deliveryDate));
    }).length;
    const delivered = ordersArray.filter(order => {
      const now = new Date();
      return order.deliveryDate && now > new Date(order.deliveryDate);
    }).length;

    return { total, pending, arrived, delivered };
  }, [orders]);

  // Use server-side filtered orders directly
  const filteredOrders = orders;

  const handleDeleteClick = useCallback((order: Order) => {
    setOrderToDelete(order);
    setShowDeleteModal(true);
  }, []);

  // Item deletion confirmation handlers
  const handleDeleteItemClick = useCallback((orderId: string, itemId: string | number, itemName: string) => {
    setItemToDelete({ orderId, itemId, itemName });
    setShowItemDeleteModal(true);
  }, []);

  const handleItemDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return;

    setDeletingItem(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${itemToDelete.orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action: 'deleteItem',
          itemIndex: itemToDelete.itemId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update the order in the local state
          setOrders(prev => prev.map(order =>
            order._id === itemToDelete.orderId
              ? { ...order, items: order.items.filter((_, index) => index !== itemToDelete.itemId) }
              : order
          ));

          showMessage('success', 'Item deleted successfully', { autoDismiss: true, dismissTime: 3000 });

          // Trigger real-time update for Order Activity Log
          const event = new CustomEvent('orderUpdated', {
            detail: { orderId: itemToDelete.orderId, action: 'itemDeleted' }
          });
          window.dispatchEvent(event);
        } else {
          showMessage('error', data.message || 'Failed to delete item');
        }
      } else {
        const errorData = await response.json();
        showMessage('error', errorData.message || 'Failed to delete item');
      }
    } catch (error) {
      showMessage('error', 'An error occurred while deleting the item');
    } finally {
      setDeletingItem(false);
      setShowItemDeleteModal(false);
      setItemToDelete(null);
    }
  }, [itemToDelete, showMessage]);

  const handleItemDeleteCancel = useCallback(() => {
    setIsItemDeleteModalClosing(true);
    setTimeout(() => {
      setShowItemDeleteModal(false);
      setIsItemDeleteModalClosing(false);
      setItemToDelete(null);
      setDeletingItem(false);
    }, 200);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!orderToDelete) return;

    const orderIdToDelete = orderToDelete._id;
    const orderIdDisplay = orderToDelete.orderId;

    if (!orderIdToDelete) {
      showMessage('error', 'Invalid order ID');
      return;
    }

    setDeleting(true);
    // Set the order ID that's being deleted to show loading state
    setDeletingOrderId(String(orderIdToDelete));

    // Close modal but keep order visible with loading state
    setShowDeleteModal(false);
    setOrderToDelete(null);

    // Clear cache immediately
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('orders-') || key.startsWith('process-data-cache')) {
          localStorage.removeItem(key);
        }
      });
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showMessage('error', 'Authentication required');
        return;
      }

      console.log('🗑️ Starting cascade delete for order:', orderIdDisplay);

      // Step 1: Delete all related data first
      const deletePromises = [];

      // Delete Lab Data
      console.log('🗑️ Deleting lab data...');
      deletePromises.push(
        fetch(`/api/labs/delete-by-order/${orderIdToDelete}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(error => {
          console.log('Lab data deletion failed (may not exist):', error);
          return { ok: true }; // Continue even if lab data doesn't exist
        })
      );

      // Delete Mill Input Data
      console.log('🗑️ Deleting mill input data...');
      deletePromises.push(
        fetch(`/api/mill-inputs?orderId=${orderIdDisplay}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
          .then(response => response.json())
          .then(data => {
            if (data.success && data.data?.millInputs?.length > 0) {
              const millInputDeletePromises = data.data.millInputs.map((input: any) =>
                fetch(`/api/mill-inputs/${input._id}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                })
              );
              return Promise.all(millInputDeletePromises);
            }
            return [];
          })
          .catch(error => {
            console.log('Mill input deletion failed (may not exist):', error);
            return [];
          })
      );

      // Delete Mill Output Data
      console.log('🗑️ Deleting mill output data...');
      deletePromises.push(
        fetch(`/api/mill-outputs?orderId=${orderIdDisplay}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
          .then(response => response.json())
          .then(data => {
            if (data.success && data.data?.millOutputs?.length > 0) {
              const millOutputDeletePromises = data.data.millOutputs.map((output: any) =>
                fetch(`/api/mill-outputs/${output._id}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                })
              );
              return Promise.all(millOutputDeletePromises);
            }
            return [];
          })
          .catch(error => {
            console.log('Mill output deletion failed (may not exist):', error);
            return [];
          })
      );

      // Delete Dispatch Data
      console.log('🗑️ Deleting dispatch data...');
      deletePromises.push(
        fetch(`/api/dispatch?orderId=${orderIdDisplay}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
          .then(response => response.json())
          .then(data => {
            if (data.success && data.data?.dispatches?.length > 0) {
              const dispatchDeletePromises = data.data.dispatches.map((dispatch: any) =>
                fetch(`/api/dispatch/${dispatch._id}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                })
              );
              return Promise.all(dispatchDeletePromises);
            }
            return [];
          })
          .catch(error => {
            console.log('Dispatch deletion failed (may not exist):', error);
            return [];
          })
      );

      // Delete Grey Information Data
      console.log('🗑️ Deleting grey information data...');
      deletePromises.push(
        fetch(`/api/grey-info?orderId=${encodeURIComponent(orderIdDisplay)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(error => {
          console.log('Grey info deletion failed (may not exist):', error);
          return { ok: true }; // Continue even if grey info doesn't exist
        })
      );

      // Wait for all related data to be deleted
      console.log('⏳ Waiting for all related data to be deleted...');
      await Promise.allSettled(deletePromises);
      console.log('✅ All related data deleted successfully');

      // Step 2: Delete the order itself
      console.log('🗑️ Deleting order...');
      const response = await fetch(`/api/orders/${orderIdToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Track deleted order ID to prevent it from reappearing
        deletedOrderIdsRef.current.add(String(orderIdToDelete));
        if (orderIdDisplay) {
          deletedOrderIdsRef.current.add(String(orderIdDisplay));
        }

        // Show success message
        showMessage('success', 'Order and all related data deleted successfully');

        // Trigger real-time update for Order Activity Log
        const event = new CustomEvent('orderUpdated', {
          detail: {
            orderId: orderIdToDelete,
            action: 'order_delete',
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(event);

        // ⚡ FIX: Remove order from UI only after deletion is confirmed
        console.log('🗑️ Removing order from UI after successful deletion:', orderIdToDelete);
        setOrders(prev => {
          const filtered = prev.filter(order => {
            const orderId = order._id || '';
            const orderIdStr = order.orderId || '';
            return String(orderId) !== String(orderIdToDelete) &&
              String(orderIdStr) !== String(orderIdDisplay);
          });
          console.log('🔄 Removed order from state:', filtered.length, 'remaining');
          return filtered;
        });

        // Clear related data from local state
        setOrderMillInputs(prev => {
          const newState = { ...prev };
          delete newState[orderIdDisplay];
          if (orderIdToDelete) {
            delete newState[String(orderIdToDelete)];
          }
          return newState;
        });
        setOrderMillOutputs(prev => {
          const newState = { ...prev };
          delete newState[orderIdDisplay];
          if (orderIdToDelete) {
            delete newState[String(orderIdToDelete)];
          }
          return newState;
        });
        setOrderDispatches(prev => {
          const newState = { ...prev };
          delete newState[orderIdDisplay];
          if (orderIdToDelete) {
            delete newState[String(orderIdToDelete)];
          }
          return newState;
        });
        setOrderGreyInfo(prev => {
          const newState = { ...prev };
          delete newState[orderIdDisplay];
          if (orderIdToDelete) {
            delete newState[String(orderIdToDelete)];
          }
          return newState;
        });
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || `Failed to delete order (${response.status})`;
        showMessage('error', errorMessage);

        // Order remains visible, just clear loading state
      }
    } catch (error) {
      console.error('Error during cascade delete:', error);
      showMessage('error', 'Failed to delete order and related data');

      // Order remains visible, just clear loading state
    } finally {
      setDeleting(false);
      // Clear the deleting order ID to remove loading state
      setDeletingOrderId(null);
    }
  }, [orderToDelete, showMessage, currentPage, itemsPerPage]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteModalClosing(true);
    setTimeout(() => {
      setShowDeleteModal(false);
      setIsDeleteModalClosing(false);
      setOrderToDelete(null);
      setDeleting(false);
      setDeletingOrderId(null);
    }, 200);
  }, []);

  const handleEdit = (order: Order) => {
    openFormWithData(order);
  };

  const handleView = (order: Order) => {
    router.push(`/orders/orderdetails?id=${order._id}`);
  };

  const handleAddLab = (order: Order) => {
    setSelectedOrderForLab(order);
    setShowLabAddModal(true);
  };

  const handleViewLogs = (order: Order) => {
    setSelectedOrderForLogs(order);
    setShowLogsModal(true);
  };

  const handleLabData = (order: Order) => {
    // ⚡ CRITICAL FIX: Always get the latest order from state to ensure lab data is current
    // This ensures that even if order was updated, we use the latest version
    const latestOrder = orders.find(o => o._id === order._id) || order;
    setSelectedOrderForLabData(latestOrder);
    setShowLabDataModal(true);
  };

  // ⚡ FAST CHECK: Check if grey info exists for an order (using fast API endpoint)
  const checkGreyInfoExists = useCallback(async (orderId: string) => {
    if (!orderId || greyInfoExists[orderId] !== undefined) {
      return greyInfoExists[orderId] || false;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await fetch(`/api/grey-info/check?orderId=${encodeURIComponent(orderId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        const exists = data.success && data.data && data.data.exists === true;
        setGreyInfoExists(prev => ({ ...prev, [orderId]: exists }));
        return exists;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking grey info existence:', error);
      }
    }
    return false;
  }, [greyInfoExists]);

  // ⚡ OPTIMIZED: Use batch data from orders API instead of individual checks
  // Grey info is now fetched in batch with orders (like lab, mill inputs/outputs, dispatch)
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    // Update greyInfoExists state from orders data (batch fetched)
    // Use functional update to avoid dependency on greyInfoExists
    setGreyInfoExists(prev => {
      const updates: { [key: string]: boolean } = {};
      let hasChanges = false;

      orders.forEach(order => {
        if (order.orderId) {
          // Check if order has grey info from batch fetch
          const hasGreyInfoData = (order as any).greyInformation &&
            Array.isArray((order as any).greyInformation) &&
            (order as any).greyInformation.length > 0;

          // Only update if different from current state
          if (prev[order.orderId] !== hasGreyInfoData) {
            updates[order.orderId] = hasGreyInfoData;
            hasChanges = true;
          }
        }
      });

      // Only return new state if there are changes
      return hasChanges ? { ...prev, ...updates } : prev;
    });
  }, [orders]); // Removed greyInfoExists from dependencies to prevent infinite loop

  // ⚡ SUPER FAST: Check if order has grey information (EXACTLY like hasMillInputs, hasLabData)
  // Moved before handleGreyInfo so it can be used
  const hasGreyInfo = useCallback((order: Order) => {
    if (!order) return false;

    // ⚡ FIRST: Check order property from batch fetch (most reliable - from orders API)
    const orderGreyInfoProperty = (order as any).greyInformation;
    const hasPropertyData = Array.isArray(orderGreyInfoProperty) && orderGreyInfoProperty.length > 0;
    if (hasPropertyData) {
      return true;
    }

    // ⚡ SECOND: Check fast check result (instant - no API call needed)
    if (order.orderId && greyInfoExists[order.orderId] === true) {
      return true;
    }

    // ⚡ THIRD: Check state (most reliable - already loaded)
    const orderGreyInfoStateByOrderId = orderGreyInfo[order.orderId];
    const orderGreyInfoStateById = orderGreyInfo[String(order._id)];
    const orderGreyInfoState = orderGreyInfoStateByOrderId || orderGreyInfoStateById;
    const hasStateData = Array.isArray(orderGreyInfoState) && orderGreyInfoState.length > 0;

    if (hasStateData) {
      return true;
    }

    // ⚡ FOURTH: Check process-data-cache synchronously (for instant first render)
    if (order.orderId) {
      try {
        const processDataCache = localStorage.getItem('process-data-cache');
        if (processDataCache) {
          const processCacheData = JSON.parse(processDataCache);
          if (processCacheData.greyInfo) {
            const cachedGreyInfo = processCacheData.greyInfo[order.orderId] || processCacheData.greyInfo[String(order._id)];
            if (Array.isArray(cachedGreyInfo) && cachedGreyInfo.length > 0) {
              // Update state immediately for next check (async but triggers re-render)
              setOrderGreyInfo(prev => ({
                ...prev,
                [order.orderId]: cachedGreyInfo,
                [String(order._id)]: cachedGreyInfo
              }));
              setGreyInfoExists(prev => ({ ...prev, [order.orderId]: true }));
              setForceRender(prev => prev + 1); // Force re-render
              return true;
            }
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }

    return false;
  }, [forceRender, orderGreyInfo, greyInfoExists]);

  const handleGreyInfo = (order: Order) => {
    // ⚡ OPEN IMMEDIATELY - Just like handleLabData and handleMillInput
    setSelectedOrderForGreyInfo(order);
    setShowGreyInfoModal(true);

    // ⚡ SMART LOGIC: Use fast check result first, then fallback to hasGreyInfo
    // Check fast check state first (instant)
    const fastCheckResult = order.orderId ? greyInfoExists[order.orderId] : undefined;
    const hasExistingData = fastCheckResult === true || (fastCheckResult === undefined && hasGreyInfo(order));

    if (hasExistingData) {
      // Edit mode: Fetch data in background (non-blocking)
      setLoadingGreyInfo(order._id);

      // ⚡ INSTANT: Check localStorage cache first
      if (order.orderId) {
        const cacheKey = `grey-info-${order.orderId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            if (Date.now() - cachedData.timestamp < 300000) { // 5 minutes
              console.log('⚡ INSTANT: Using cached grey info!');
              setOrderGreyInfo(prev => ({
                ...prev,
                [String(order._id)]: cachedData.data || [],
                ...(order.orderId ? {
                  [String(order.orderId)]: cachedData.data || []
                } : {})
              }));
              // Clear loading state if we have cached data
              setLoadingGreyInfo(null);
            }
          } catch (e) { }
        }
      }

      // ⚡ FIX: Fetch fresh data in background (non-blocking) with cache busting
      const token = localStorage.getItem('token');
      if (token && order.orderId) {
        // ⚡ FIX: Add cache busting timestamp and use no-store to ensure fresh data
        fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}&t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store' // Force fresh data
        })
          .then(res => res.json())
          .then(greyInfoData => {
            if (greyInfoData.success && greyInfoData.data) {
              const greyInfo = greyInfoData.data.greyInfo || [];
              // Update state with fetched grey information (use string keys)
              setOrderGreyInfo(prev => ({
                ...prev,
                [String(order._id)]: greyInfo,
                ...(order.orderId ? {
                  [String(order.orderId)]: greyInfo
                } : {})
              }));
              // Save to localStorage
              if (order.orderId) {
                localStorage.setItem(`grey-info-${order.orderId}`, JSON.stringify({
                  data: greyInfo,
                  timestamp: Date.now()
                }));
              }
            } else {
              // Clear state if no data (use string keys)
              setOrderGreyInfo(prev => {
                const updated = { ...prev };
                updated[String(order._id)] = [];
                if (order.orderId) {
                  updated[String(order.orderId)] = [];
                }
                return updated;
              });
            }
            // Clear loading state when fetch completes
            setLoadingGreyInfo(null);
          })
          .catch(error => {
            console.error('Error fetching grey information:', error);
            // Clear loading state on error
            setLoadingGreyInfo(null);
          });
      } else {
        // No token, clear loading state
        setLoadingGreyInfo(null);
      }
    } else {
      // Add mode: No API call needed, modal opens immediately with empty form
      // ⚡ IMPORTANT: Clear loading state to ensure no spinner shows
      setLoadingGreyInfo(null);
      console.log('⚡ Add mode - opening modal immediately without API call');
    }
  };

  const handleMillInput = async (order: Order) => {
    console.log('Opening Mill Input form for order:', order.orderId);

    // ⚡ OPEN IMMEDIATELY - Just like handleGreyInfo
    setSelectedOrderForMillInputForm(order);
    setShowMillInputForm(true);

    // Smart logic: Check if order has existing mill input data
    const hasExistingData = hasMillInputs(order);
    console.log('🔍 Mill Input Smart Detection:', {
      orderId: order.orderId,
      hasExistingData,
      mode: hasExistingData ? 'EDIT' : 'ADD'
    });

    // Set editing mode based on existing data
    setIsEditingMillInput(hasExistingData);

    // ⚡ SMART LOGIC: Only show loading if editing (has existing data)
    if (hasExistingData) {
      // Edit mode: Show loading spinner while data is fetched
      setLoadingMillInput(order._id);
      console.log('📊 Order has existing mill input data - will fetch for edit mode');
      setExistingMillInputs([]);
      // Clear loading state after modal finishes loading (safety timeout)
      setTimeout(() => {
        setLoadingMillInput(null);
      }, 5000); // 5 second safety timeout
    } else {
      // Add mode: No loading, modal opens immediately
      setLoadingMillInput(null);
      console.log('⚡ No existing mill input data - add mode');
      setExistingMillInputs([]);
    }

    // Load qualities data in background (non-blocking)
    if (qualities.length === 0) {
      loadQualitiesData().catch(error => {
        console.error('Error loading qualities for mill input:', error);
      });
    }
  };

  const handleMillOutput = async (order: Order) => {
    console.log('Opening Mill Output form for order:', order.orderId);

    // ⚡ OPEN IMMEDIATELY - Just like handleGreyInfo
    setSelectedOrderForMillOutput(order);
    setShowMillOutputForm(true);

    // Smart logic: Check if order has existing mill output data
    const hasExistingData = hasMillOutputs(order);
    console.log('🔍 Mill Output Smart Detection:', {
      orderId: order.orderId,
      hasExistingData,
      mode: hasExistingData ? 'EDIT' : 'ADD'
    });

    // Set editing mode based on existing data
    setIsEditingMillOutput(hasExistingData);

    // ⚡ SMART LOGIC: Only show loading if editing (has existing data)
    if (hasExistingData) {
      // Edit mode: Show loading spinner while data is fetched
      setLoadingMillOutput(order._id);
      console.log('📊 Order has existing mill output data - will fetch for edit mode');
      setExistingMillOutputs([]);
      // Clear loading state after modal finishes loading (safety timeout)
      setTimeout(() => {
        setLoadingMillOutput(null);
      }, 5000); // 5 second safety timeout
    } else {
      // Add mode: No loading, modal opens immediately
      setLoadingMillOutput(null);
      console.log('⚡ No existing mill output data - add mode');
      setExistingMillOutputs([]);
    }

    // Load qualities data in background (non-blocking)
    if (qualities.length === 0) {
      loadQualitiesData().catch(error => {
        console.error('Error loading qualities for mill output:', error);
      });
    }
  };

  const handleDispatch = async (order: Order) => {
    console.log('🚀 Opening Dispatch form for order:', order.orderId);

    // ⚡ OPEN IMMEDIATELY - Just like handleGreyInfo
    setSelectedOrderForDispatch(order);
    setShowDispatchForm(true);

    // Smart logic: Check if order has existing dispatch data
    const hasExistingData = hasDispatches(order);
    console.log('🔍 Dispatch Smart Detection:', {
      orderId: order.orderId,
      hasExistingData,
      mode: hasExistingData ? 'EDIT' : 'ADD'
    });

    // Set editing mode based on existing data
    setIsEditingDispatch(hasExistingData);

    // ⚡ SMART LOGIC: Only show loading if editing (has existing data)
    if (hasExistingData) {
      // Edit mode: Show loading spinner while data is fetched
      setLoadingDispatch(order._id);
      console.log('📊 Order has existing dispatch data - will fetch for edit mode');
      setExistingDispatches([]);
      // Clear loading state after modal finishes loading (safety timeout)
      setTimeout(() => {
        setLoadingDispatch(null);
      }, 5000); // 5 second safety timeout
    } else {
      // Add mode: No loading, modal opens immediately
      setLoadingDispatch(null);
      console.log('⚡ No existing dispatch data - add mode');
      setExistingDispatches([]);
    }

    // Load parties data in background (non-blocking) if not available
    if (parties.length === 0) {
      console.log('👥 Loading parties in background for dispatch form...');
      loadPartiesData().catch(error => {
        console.error('Error loading parties for dispatch:', error);
      });
    } else {
      console.log('✅ Parties already available for dispatch form');
    }
  };

  const handleImagePreview = (url: string, alt: string, allImages?: string[], startIndex?: number) => {
    if (allImages && allImages.length > 0) {
      setPreviewImages(allImages);
      setCurrentImageIndex(startIndex || 0);
      setPreviewImage({ url: allImages[startIndex || 0], alt });
    } else {
      setPreviewImages([url]);
      setCurrentImageIndex(0);
      setPreviewImage({ url, alt });
    }
    setShowImagePreview(true);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (previewImages.length <= 1) return;

    // Set slide direction for animation
    setImageSlideDirection(direction === 'prev' ? 'right' : 'left');

    let newIndex;
    if (direction === 'prev') {
      newIndex = currentImageIndex === 0 ? previewImages.length - 1 : currentImageIndex - 1;
    } else {
      newIndex = currentImageIndex === previewImages.length - 1 ? 0 : currentImageIndex + 1;
    }

    setCurrentImageIndex(newIndex);
    setPreviewImage({ url: previewImages[newIndex], alt: `Image ${newIndex + 1}` });

    // Reset direction after animation
    setTimeout(() => setImageSlideDirection(null), 300);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showImagePreview) return;

    if (e.key === 'ArrowLeft') {
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      navigateImage('next');
    } else if (e.key === 'Escape') {
      setShowImagePreview(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart(touch.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.touches[0];
    const diff = touchStart - touch.clientX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        navigateImage('next');
      } else {
        navigateImage('prev');
      }
      setTouchStart(null);
    }
  };

  // Use filtered and paginated data for both table and card views
  // Ensure we always have data to display if orders exist in memory
  const currentOrders = useMemo(() => {
    // If we have filtered orders, use them
    if (filteredOrders && filteredOrders.length > 0) {
      console.log('🔍 Using filteredOrders:', filteredOrders.length);
      return filteredOrders;
    }

    // If we have orders in memory but no filtered orders, use the orders array
    if (orders && orders.length > 0) {
      console.log('🔍 Using orders array:', orders.length);
      return orders;
    }

    // Otherwise return empty array
    console.log('🔍 No orders available, returning empty array');
    return [];
  }, [filteredOrders, orders]);

  // Enhanced loading and empty state logic
  const shouldShowEmptyState = useMemo(() => {
    // NEVER show empty state if:
    // 1. Any loading operation is happening
    if (loading || orderCreating || isChangingPage || tableLoading || refreshing || sortLoading || filterLoading || searchLoading) {
      return false;
    }

    // 2. We have orders in the database
    if (paginationInfo.totalCount > 0) {
      return false;
    }

    // 3. We're on any page other than 1
    if (currentPage > 1) {
      return false;
    }

    // 4. We have any orders loaded in memory
    if (orders && orders.length > 0) {
      return false;
    }

    // 5. We have any current orders to display
    if (currentOrders && currentOrders.length > 0) {
      return false;
    }

    // 6. Orders are not yet loaded (most important check)
    if (!ordersLoaded) {
      return false;
    }

    // 7. We have pagination info indicating there are orders
    if (paginationInfo.totalPages > 0) {
      return false;
    }

    // 8. We're still in initial loading phase (first 2 seconds)
    if (Date.now() - (initialLoadTime || 0) < 2000) {
      return false;
    }

    // ONLY show empty state if ALL of these are true:
    // - Orders are loaded
    // - No orders in database (totalCount === 0)
    // - No orders in memory (orders.length === 0)
    // - No current orders to display (currentOrders.length === 0)
    // - We're on page 1
    // - No pagination data exists
    // - Enough time has passed since initial load
    return ordersLoaded &&
      paginationInfo.totalCount === 0 &&
      orders.length === 0 &&
      currentOrders.length === 0 &&
      currentPage === 1 &&
      paginationInfo.totalPages === 0;
  }, [
    loading, orderCreating, isChangingPage, tableLoading, refreshing,
    sortLoading, filterLoading, searchLoading, ordersLoaded, currentOrders.length,
    paginationInfo.totalCount, paginationInfo.totalPages, currentPage, orders.length, initialLoadTime
  ]);

  // Pagination debug info removed for production

  // Reset to page 1 when filters change - NO API CALLS
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, itemsPerPage]);

  // Auto-correct current page if it exceeds total pages - NO API CALLS
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, itemsPerPage]);

  // Ensure pagination state consistency - but don't clear newly created orders
  useEffect(() => {
    // Only refresh if there's a real inconsistency, not when we have newly created orders
    // Skip if we just created orders (they might not be in backend yet)
    if (orderCreating) {
      return; // Don't check inconsistencies while creating orders
    }

    // If we have orders but pagination shows 0, update pagination (don't clear orders)
    if (ordersLoaded && orders.length > 0 && paginationInfo.totalCount === 0) {
      console.log('🔄 Detected pagination inconsistency, updating pagination...');
      setPaginationInfo(prev => ({
        ...prev,
        totalCount: orders.length,
        totalPages: Math.ceil(orders.length / itemsPerPage)
      }));
    } else if (ordersLoaded && orders.length === 0 && paginationInfo.totalCount > 0 && !loading) {
      // Only refresh if we truly have no orders and pagination says we should have some
      console.log('🔄 Detected data inconsistency, refreshing...');
      fetchOrders(0, currentPage, itemsPerPage, true, filters, searchTerm);
    }
  }, [orders.length, paginationInfo.totalCount, ordersLoaded, currentPage, itemsPerPage, filters, searchTerm, fetchOrders, orderCreating, loading]);

  // Format date
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'Not selected';

    const formatToDDMMYYYY = (d: number, m: number, y: number) => {
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    };

    // Handle Date objects
    if (dateString instanceof Date) {
      if (isNaN(dateString.getTime())) return 'Not selected';
      return formatToDDMMYYYY(dateString.getDate(), dateString.getMonth() + 1, dateString.getFullYear());
    }

    const dateStr = String(dateString).trim();
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return 'Not selected';

    // Handle YYYY-MM-DD format directly to avoid timezone issues
    const yyyyMmDdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyyMmDdMatch) {
      const [, year, month, day] = yyyyMmDdMatch;
      return formatToDDMMYYYY(parseInt(day), parseInt(month), parseInt(year));
    }

    // Handle ISO date strings (extract date part to avoid timezone issues)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return formatToDDMMYYYY(parseInt(day), parseInt(month), parseInt(year));
    }

    // Fallback to standard date parsing
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Not selected';
    return formatToDDMMYYYY(date.getDate(), date.getMonth() + 1, date.getFullYear());
  };

  // Format date and time on separate lines
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return (
      <div className="flex flex-col">
        <span>{dateStr}</span>
        <span className="text-xs opacity-75">{timeStr}</span>
      </div>
    );
  };

  // Get total quantity for an order
  const getTotalQuantity = (order: Order) => {
    return order.items.reduce((total: number, item: any) => total + (item.quantity || 0), 0);
  };

  if (!mounted) return null;

  // Add global animations
  const globalStyles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.6s ease-out forwards;
    }
    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: calc(200px + 100%) 0; }
    }
    .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(243, 244, 246, 0.5)'} 0px,
        ${isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(243, 244, 246, 0.7)'} 40px,
        ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(243, 244, 246, 0.5)'} 80px
      );
      background-size: 200px 100%;
      animation: shimmer 1.5s infinite;
    }
  `;

  // Don't show full-page skeleton - show page structure with table skeleton in table area

  // Debug logging for troubleshooting
  console.log('Orders page render state:', {
    loading,
    ordersLoaded,
    isInitialized,
    ordersCount: orders.length,
    currentOrdersCount: currentOrders.length,
    searchTerm,
    filters
  });

  return (
    <div className={`min-h-screen ${isDarkMode
      ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      : 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'
      }`}>
      {/* Enhanced Message System Styles */}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes glowPulse {
          0%, 100% {
            box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.6);
          }
        }
        
        @keyframes errorGlow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(239, 68, 68, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
          }
        }
        
        @keyframes successGlow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
          }
        }
        
        .message-enter {
          animation: slideInRight 0.3s ease-out forwards;
        }
        
        .message-exit {
          animation: slideOutRight 0.3s ease-in forwards;
        }
        
        .validation-error {
          animation: fadeInUp 0.3s ease-out forwards;
        }
        
        .glow-pulse {
          animation: glowPulse 2s ease-in-out infinite;
        }
        
        .error-glow {
          animation: errorGlow 2s ease-in-out infinite;
        }
        
        .success-glow {
          animation: successGlow 2s ease-in-out infinite;
        }
        
        /* Dark mode specific enhancements */
        .dark .message-container {
          backdrop-filter: blur(10px);
          background: rgba(31, 41, 55, 0.95);
        }
        
        .dark .validation-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        .dark .input-error {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
        }
      `}</style>

      <div className="space-y-4">

        {/* Enhanced Header with Stats */}
        <div className="space-y-6">
          {/* Main Header - Removed */}
          {/* Action buttons moved to search bar row */}
        </div>

        {/* Quick Actions Panel */}
        {showQuickActions && (
          <div className={`p-4 rounded-xl border-2 transition-all duration-300 panel-slide-down ${isDarkMode
            ? 'bg-white/5 border-white/10 shadow-xl'
            : 'bg-white border-gray-200 shadow-xl'
            }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                ⚡ Quick Actions
              </h3>
              <button
                onClick={() => setShowQuickActions(false)}
                className={`p-1 rounded-lg transition-colors ${isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {/* Add Party */}
              <button
                onClick={() => {
                  setShowPartyModal(true);
                  setShowQuickActions(false);
                }}
                className={`group p-2 rounded-md border transition-all duration-200 hover-lift active:scale-95 ${isDarkMode
                  ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 hover:border-green-500/40'
                  : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300'
                  }`}
              >
                <BuildingOfficeIcon className="h-4 w-4 mx-auto mb-0.5 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] font-medium">Add Party</div>
              </button>

              {/* Add Quality */}
              <button
                onClick={() => {
                  setShowQualityModal(true);
                  setShowQuickActions(false);
                }}
                className={`group p-2 rounded-md border transition-all duration-200 hover-lift active:scale-95 ${isDarkMode
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/40'
                  : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300'
                  }`}
              >
                <ChartBarIcon className="h-4 w-4 mx-auto mb-0.5 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] font-medium">Add Quality</div>
              </button>

              {/* Add Mill */}
              <button
                onClick={() => {
                  setShowMillModal(true);
                  setShowQuickActions(false);
                }}
                className={`group p-2 rounded-md border transition-all duration-200 hover-lift active:scale-95 ${isDarkMode
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300'
                  }`}
              >
                <BuildingOfficeIcon className="h-4 w-4 mx-auto mb-0.5 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] font-medium">Add Mill</div>
              </button>

              {/* Delete All Orders - Only show when orders exist and user is super admin */}
              {orders.length > 0 && isSuperAdmin && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className={`group p-2 rounded-md border transition-all duration-200 hover-lift active:scale-95 ${isDarkMode
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40'
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300'
                    }`}
                >
                  <TrashIcon className="h-4 w-4 mx-auto mb-0.5 group-hover:scale-110 transition-transform" />
                  <div className="text-[10px] font-medium">Delete All</div>
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Enhanced Message System */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`transform transition-all duration-300 ease-out ${isDarkMode ? 'bg-gray-800/95 border-gray-600 backdrop-blur-sm' : 'bg-white border-gray-200'
              } rounded-lg border shadow-lg p-4 max-w-sm ${message.type === 'success'
                ? isDarkMode
                  ? 'border-green-500/40 bg-green-900/30 shadow-green-500/20'
                  : 'border-green-200 bg-green-50'
                : message.type === 'warning'
                  ? isDarkMode
                    ? 'border-yellow-500/40 bg-yellow-900/30 shadow-yellow-500/20'
                    : 'border-yellow-200 bg-yellow-50'
                  : message.type === 'info'
                    ? isDarkMode
                      ? 'border-blue-500/40 bg-blue-900/30 shadow-blue-500/20'
                      : 'border-blue-200 bg-blue-50'
                    : isDarkMode
                      ? 'border-red-500/40 bg-red-900/30 shadow-red-500/20'
                      : 'border-red-200 bg-red-50'
              } ${isDarkMode ? 'backdrop-blur-md' : ''}`}
            style={{
              transform: `translateX(${index * 10}px)`,
              animation: 'slideInRight 0.3s ease-out',
              boxShadow: isDarkMode ?
                message.type === 'success' ? '0 4px 20px rgba(34, 197, 94, 0.3)' :
                  message.type === 'warning' ? '0 4px 20px rgba(234, 179, 8, 0.3)' :
                    message.type === 'info' ? '0 4px 20px rgba(59, 130, 246, 0.3)' :
                      '0 4px 20px rgba(239, 68, 68, 0.3)' : undefined
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 ${message.type === 'success'
                  ? isDarkMode ? 'text-green-400' : 'text-green-500'
                  : message.type === 'warning'
                    ? isDarkMode ? 'text-yellow-400' : 'text-yellow-500'
                    : message.type === 'info'
                      ? isDarkMode ? 'text-blue-400' : 'text-blue-500'
                      : isDarkMode ? 'text-red-400' : 'text-red-500'
                  }`}>
                  {message.type === 'success' ? (
                    <CheckIcon className="h-5 w-5" />
                  ) : message.type === 'warning' ? (
                    <WarningIcon className="h-5 w-5" />
                  ) : message.type === 'info' ? (
                    <ChartBarIcon className="h-5 w-5" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${message.type === 'success'
                    ? isDarkMode ? 'text-green-300' : 'text-green-800'
                    : message.type === 'warning'
                      ? isDarkMode ? 'text-yellow-300' : 'text-yellow-800'
                      : message.type === 'info'
                        ? isDarkMode ? 'text-blue-300' : 'text-blue-800'
                        : isDarkMode ? 'text-red-300' : 'text-red-800'
                    }`}>
                    {message.text}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismissMessage(message.id)}
                className={`flex-shrink-0 ml-3 p-1.5 rounded-full transition-all duration-200 hover:scale-110 ${message.type === 'success'
                  ? isDarkMode ? 'hover:bg-green-500/20 text-green-400 hover:text-green-300' : 'hover:bg-green-100 text-green-500'
                  : message.type === 'warning'
                    ? isDarkMode ? 'hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300' : 'hover:bg-yellow-100 text-yellow-500'
                    : message.type === 'info'
                      ? isDarkMode ? 'hover:bg-blue-500/20 text-blue-400 hover:text-blue-300' : 'hover:bg-blue-100 text-blue-500'
                      : isDarkMode ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300' : 'hover:bg-red-100 text-red-500'
                  }`}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`p-2 sm:p-3 md:p-4 rounded-lg border ${isDarkMode
        ? 'bg-white/5 border-white/10'
        : 'bg-white border-gray-200'
        }`}>
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Top Row - Create Order, Search, Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
            {/* Left Side - Create Order Button */}
            <div className="flex items-center order-1 sm:order-1 w-full sm:w-auto">
              <button
                onClick={() => openFormWithData()}
                className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 hover-lift active:scale-95 w-full sm:w-auto text-xs sm:text-sm ${isDarkMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                  }`}
              >
                <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                <span className="font-medium">Create Order</span>
              </button>
            </div>

            {/* Center - Enhanced Search */}
            <div className="flex-1 order-2 sm:order-2 min-w-0 w-full sm:w-auto">
              <div className="relative search-dropdown-container flex items-stretch overflow-visible">
                {/* Search Type Dropdown */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                    className={`h-full px-2 sm:px-3 rounded-l-lg border-2 border-r transition-all duration-300 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center ${isDarkMode
                      ? 'bg-white/10 border-gray-600 text-gray-300 hover:bg-white/20 hover:border-gray-500'
                      : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400'
                      }`}
                  >
                    <span className="hidden xs:inline">
                      {searchType === 'all' ? 'All Fields' :
                        searchType === 'orderId' ? 'Order ID' :
                          searchType === 'poNumber' ? 'PO No' :
                            searchType === 'styleNo' ? 'Style No' :
                              searchType === 'party' ? 'Party' :
                                searchType === 'quality' ? 'Quality' :
                                  searchType === 'mill' ? 'Mill' :
                                    searchType === 'weaver' ? 'Weaver' :
                                      searchType === 'phone' ? 'Phone' : 'All Fields'}
                    </span>
                    <span className="xs:hidden">{searchType === 'all' ? 'All' : searchType === 'party' ? 'Party' : searchType === 'quality' ? 'Quality' : searchType === 'orderId' ? 'ID' : 'All'}</span>
                    <svg className={`inline-block ml-0.5 sm:ml-1 h-3 w-3 transition-transform duration-200 ${showSearchDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu - Fixed positioning */}
                  {showSearchDropdown && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSearchDropdown(false)}
                      />
                      <div className={`absolute top-full left-0 mt-1 w-56 sm:w-64 rounded-lg border shadow-xl z-[100] dropdown-enter overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                        }`}>
                        {[
                          { value: 'all', label: 'All Fields', description: 'Search everything' },
                          { value: 'orderId', label: 'Order ID', description: 'Search by order number' },
                          { value: 'poNumber', label: 'PO No', description: 'Search by PO number' },
                          { value: 'styleNo', label: 'Style No', description: 'Search by style number' },
                          { value: 'party', label: 'Party', description: 'Search by party name' },
                          { value: 'quality', label: 'Quality', description: 'Search by quality name' },
                          { value: 'mill', label: 'Mill', description: 'Search by mill name' },
                          { value: 'weaver', label: 'Weaver', description: 'Search by weaver/supplier name' },
                          { value: 'phone', label: 'Phone', description: 'Search by phone number' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              const newSearchType = option.value;
                              setSearchType(newSearchType);
                              setShowSearchDropdown(false);
                              // Immediately trigger search with new type if there's a search term
                              if (searchTerm && searchTerm.trim()) {
                                const searchQuery = newSearchType !== 'all'
                                  ? `${newSearchType}:${searchTerm.trim()}`
                                  : searchTerm.trim();
                                setSearchLoading(true);
                                fetchOrders(0, 1, itemsPerPage, true, filters, searchQuery).finally(() => {
                                  setSearchLoading(false);
                                });
                              } else if (searchTerm) {
                                // If search term exists but is empty after trim, clear and refresh
                                handleSearchChange('');
                              }
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors first:rounded-t-lg last:rounded-b-lg flex items-center justify-between group ${searchType === option.value
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'bg-blue-100 text-blue-700 font-semibold'
                              : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            title={option.description}
                          >
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description && (
                                <span className={`text-xs mt-0.5 ${searchType === option.value
                                  ? isDarkMode ? 'text-blue-300/70' : 'text-blue-600/70'
                                  : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                  {option.description}
                                </span>
                              )}
                            </div>
                            {searchType === option.value && (
                              <CheckIcon className="h-4 w-4 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* {searchLoading ? (
                  <ArrowPathIcon className={`absolute left-20 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-500'
                  }`} />
                ) : (
                  <MagnifyingGlassIcon className={`absolute left-20 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                )} */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={searchType === 'all' ? "Search all fields (Order ID, Party, Quality, Mill, etc.)..." :
                      searchType === 'orderId' ? "Search by Order ID (e.g., 123)..." :
                        searchType === 'poNumber' ? "Search by PO No..." :
                          searchType === 'styleNo' ? "Search by Style No..." :
                            searchType === 'party' ? "Search by Party Name..." :
                              searchType === 'quality' ? "Search by Quality Name..." :
                                searchType === 'mill' ? "Search by Mill Name..." :
                                  searchType === 'weaver' ? "Search by Weaver/Supplier Name..." :
                                    searchType === 'phone' ? "Search by Phone Number..." : "Search all fields..."}
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchTerm.trim()) {
                        e.preventDefault();
                        setSearchLoading(true);
                        const searchQuery = searchType !== 'all' ? `${searchType}:${searchTerm.trim()}` : searchTerm.trim();
                        fetchOrders(0, 1, itemsPerPage, true, filters, searchQuery).finally(() => {
                          setSearchLoading(false);
                        });
                      }
                    }}
                    className={`w-full pl-3 pr-12 xs:pr-14 sm:pr-16 py-2 sm:py-2.5 rounded-r-lg rounded-l-none border-l-0 border-2 transition-all duration-300 font-medium text-xs sm:text-sm outline-none ${isDarkMode
                      ? 'bg-white/10 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-0 focus:outline-none'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 focus:outline-none'
                      }`}
                  />
                  {/* Search Button - Right side with no gap */}
                  <button
                    onClick={() => {
                      if (searchTerm.trim()) {
                        setSearchLoading(true);
                        const searchQuery = searchType !== 'all' ? `${searchType}:${searchTerm.trim()}` : searchTerm.trim();
                        fetchOrders(0, 1, itemsPerPage, true, filters, searchQuery).finally(() => {
                          setSearchLoading(false);
                        });
                      }
                    }}
                    disabled={!searchTerm.trim() || searchLoading}
                    className={`absolute right-0 top-0 bottom-0 h-full px-3 rounded-r-lg transition-all duration-200 flex items-center justify-center border-r-2 ${searchTerm.trim() && !searchLoading
                      ? isDarkMode
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-l border-blue-500 border-r-blue-500'
                        : 'bg-blue-500 hover:bg-blue-600 text-white border-l border-blue-400 border-r-blue-400'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed border-l border-gray-600 border-r-gray-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed border-l border-gray-300 border-r-gray-300'
                      }`}
                    title="Search"
                  >
                    {searchLoading ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <MagnifyingGlassIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Clear Button */}
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchLoading(false);
                        handleSearchChange('');
                      }}
                      className={`absolute right-12 xs:right-14 sm:right-16 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors hover-lift ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      title="Clear search"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Quick Actions Button */}
            <div className="flex items-center order-3 sm:order-3 w-full sm:w-auto">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 hover-lift active:scale-95 w-full sm:w-auto text-xs sm:text-sm ${showQuickActions
                  ? isDarkMode
                    ? 'bg-white/20 border border-white/30 text-white'
                    : 'bg-gray-200 border border-gray-400 text-gray-800'
                  : isDarkMode
                    ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                    : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <BoltIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                <span className="font-medium hidden sm:inline">Quick Actions</span>
                <span className="font-medium sm:hidden">Actions</span>
              </button>
            </div>
          </div>

          {/* Second Row - Filters and Controls */}
          <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 items-start lg:items-center justify-between">
            {/* Left Side - Filters and Search Results */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 order-2 lg:order-1 w-full lg:w-auto">
              {/* Search Results Indicator */}
              {searchTerm && (
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${isDarkMode
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                  {(() => {
                    // Use pagination total count if available (from server), otherwise use client-side count
                    const count = paginationInfo.totalCount > 0
                      ? paginationInfo.totalCount
                      : (currentOrders.length > 0 ? currentOrders.length : orders.length);
                    return `${count} result${count !== 1 ? 's' : ''} for "${searchTerm}"`;
                  })()}
                </div>
              )}

              {/* Sort Filter - Dropdown Style */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Sort:
                </span>
                <div className="relative sort-dropdown-container flex-1 sm:flex-initial">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    disabled={sortLoading}
                    className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 min-w-[80px] hover-lift ${isDarkMode
                      ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40'
                      : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                      } ${sortLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {sortLoading && (
                      <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-white' : 'border-gray-600'
                        }`}></div>
                    )}
                    {filters.orderFilter === 'latest_first' ? 'Latest' : 'Oldest'}
                    <svg className={`h-3 w-3 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Sort Dropdown Menu */}
                  {showSortDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSortDropdown(false)}
                      />
                      <div className={`absolute top-full left-0 mt-1 w-32 rounded-lg border shadow-xl z-[100] dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                        }`}>
                        <button
                          onClick={() => {
                            handleFilterChange('orderFilter', 'latest_first');
                            setShowSortDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${filters.orderFilter === 'latest_first'
                            ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          Latest
                        </button>
                        <button
                          onClick={() => {
                            handleFilterChange('orderFilter', 'oldest_first');
                            setShowSortDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${filters.orderFilter === 'oldest_first'
                            ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          Oldest
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Status Filter - Dropdown Style */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Status:
                </span>
                <div className="relative status-dropdown-container flex-1 sm:flex-initial">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    disabled={filterLoading}
                    className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 min-w-[100px] hover-lift ${isDarkMode
                      ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40'
                      : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                      } ${filterLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {filterLoading && (
                      <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-white' : 'border-gray-600'
                        }`}></div>
                    )}
                    {filters.statusFilter === 'all' ? 'All' :
                      filters.statusFilter === 'pending' ? 'Pending' :
                        filters.statusFilter === 'delivered' ? 'Delivered' : 'All'}
                    <svg className={`h-3 w-3 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Status Dropdown Menu */}
                  {showStatusDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowStatusDropdown(false)}
                      />
                      <div className={`absolute top-full left-0 mt-1 w-32 rounded-lg border shadow-xl z-[100] dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                        }`}>
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'pending', label: 'Pending' },
                          { value: 'delivered', label: 'Delivered' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              handleFilterChange('statusFilter', option.value);
                              setShowStatusDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${filters.statusFilter === option.value
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                              : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Type Filter - Dropdown Style */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Type:
                </span>
                <div className="relative type-dropdown-container flex-1 sm:flex-initial">
                  <button
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    disabled={filterLoading}
                    className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 min-w-[110px] hover-lift ${isDarkMode
                      ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40'
                      : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                      } ${filterLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {filterLoading && (
                      <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-white' : 'border-gray-600'
                        }`}></div>
                    )}
                    {filters.typeFilter === 'all' ? 'All Types' :
                      filters.typeFilter === 'Dying' ? 'Dying' :
                        filters.typeFilter === 'Printing' ? 'Printing' : 'All Types'}
                    <svg className={`h-3 w-3 transition-transform duration-200 ${showTypeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Type Dropdown Menu */}
                  {showTypeDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowTypeDropdown(false)}
                      />
                      <div className={`absolute top-full left-0 mt-1 w-36 rounded-lg border shadow-xl z-[100] dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                        }`}>
                        {[
                          { value: 'all', label: 'All Types' },
                          { value: 'Dying', label: 'Dying' },
                          { value: 'Printing', label: 'Printing' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              handleFilterChange('typeFilter', option.value);
                              setShowTypeDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${filters.typeFilter === option.value
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                              : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Financial Year Filter - Dropdown Style */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  FY:
                </span>
                <div className="relative fy-dropdown-container flex-1 sm:flex-initial">
                  <button
                    onClick={async () => {
                      setShowFYDropdown(!showFYDropdown);
                      // Fetch FY options if not loaded yet
                      if (fyOptions.length === 0) {
                        try {
                          const token = localStorage.getItem('token');
                          if (token) {
                            const res = await fetch('/api/orders/financial-years', {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const json = await res.json();
                            if (json.success && json.data?.options) {
                              setFyOptions(json.data.options);
                            }
                          }
                        } catch (e) {
                          console.error('Failed to fetch FY options:', e);
                        }
                      }
                    }}
                    disabled={filterLoading}
                    className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 min-w-[100px] hover-lift ${isDarkMode
                      ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40'
                      : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                      } ${filterLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {filterLoading && (
                      <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${isDarkMode ? 'border-white' : 'border-gray-600'}`}></div>
                    )}
                    {filters.fyFilter === ''
                      ? 'All Years'
                      : `FY ${filters.fyFilter.slice(0, 2)}-${filters.fyFilter.slice(2, 4)}`
                    }
                    <svg className={`h-3 w-3 transition-transform duration-200 ${showFYDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* FY Dropdown Menu */}
                  {showFYDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowFYDropdown(false)}
                      />
                      <div className={`absolute top-full left-0 mt-1 w-44 rounded-lg border shadow-xl z-[100] dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                        {/* All Years option */}
                        <button
                          onClick={() => {
                            handleFilterChange('fyFilter', '');
                            setShowFYDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors rounded-t-lg ${filters.fyFilter === ''
                            ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          All Years
                        </button>
                        {/* Dynamic FY options */}
                        {fyOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              handleFilterChange('fyFilter', option.value);
                              setShowFYDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors last:rounded-b-lg flex items-center gap-2 ${filters.fyFilter === option.value
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                              : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                          >
                            {option.label}
                            {option.isCurrent && (
                              <span className={`inline-block w-2 h-2 rounded-full ${isDarkMode ? 'bg-green-400' : 'bg-green-500'}`} title="Current FY"></span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Mill Filter - Enhanced Searchable Dropdown */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Mill:
                </span>
                <div className="relative flex-1 sm:flex-initial min-w-0" ref={millDropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={filterLoading ? "Loading..." : "Search mills..."}
                      value={millSearchTerm}
                      onChange={(e) => {
                        handleMillSearchChange(e.target.value);
                        setShowMillDropdown(true);
                      }}
                      onFocus={async () => {
                        // ⚡ FIX: Clear ALL mill-related caches and refresh mills when focusing on the input
                        if (typeof window !== 'undefined') {
                          try {
                            localStorage.removeItem('mills_cache');
                            // Clear all mill-related caches
                            Object.keys(localStorage).forEach(key => {
                              if (key.includes('mill') || key.includes('mills')) {
                                localStorage.removeItem(key);
                              }
                            });
                            // Also clear process-data-cache if it exists
                            try {
                              const processCache = localStorage.getItem('process-data-cache');
                              if (processCache) {
                                const cacheData = JSON.parse(processCache);
                                cacheData.millsTimestamp = 0;
                                localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
                              }
                            } catch (e) { }
                            console.log('🗑️ Cleared ALL mill caches on input focus');
                          } catch (e) {
                            console.error('Error clearing caches:', e);
                          }
                        }

                        try {
                          const token = localStorage.getItem('token');
                          if (token) {
                            const millsResponse = await fetch(`/api/mills?t=${Date.now()}&limit=1000`, {
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache',
                                'Expires': '0'
                              },
                              cache: 'no-store'
                            });

                            if (millsResponse.ok) {
                              const millsData = await millsResponse.json();
                              if (millsData.success && Array.isArray(millsData.data)) {
                                setMills(millsData.data);
                                console.log('✅ Refreshed mills on input focus:', millsData.data.length, 'mills');
                              }
                            }
                          }
                        } catch (error) {
                          console.error('Error fetching fresh mills:', error);
                        }

                        setShowMillDropdown(true);
                      }}
                      disabled={filterLoading}
                      className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all duration-200 min-w-[120px] sm:min-w-[150px] input-focus hover-lift ${isDarkMode
                        ? 'bg-white/10 border-white/30 text-gray-300 placeholder-gray-400 hover:bg-white/20 hover:border-white/40'
                        : 'bg-gray-50 border-gray-400 text-gray-600 placeholder-gray-500 hover:bg-gray-100 hover:border-gray-500'
                        } ${filterLoading ? 'opacity-50 cursor-not-allowed' : ''} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    />
                    <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                      {millSearchTerm && !filterLoading && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClearMillFilter();
                          }}
                          className={`p-0.5 sm:p-1 rounded-full transition-colors ${isDarkMode
                            ? 'text-gray-400 hover:text-red-400 hover:bg-gray-600'
                            : 'text-gray-500 hover:text-red-500 hover:bg-gray-100'
                            }`}
                          title="Clear"
                        >
                          <XMarkIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await handleMillDropdownToggle();
                        }}
                        className={`p-0.5 sm:p-1 rounded transition-colors cursor-pointer ${isDarkMode
                          ? 'hover:bg-gray-600'
                          : 'hover:bg-gray-100'
                          }`}
                        title="Toggle mill dropdown"
                      >
                        <ChevronDownIcon className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-200 ${showMillDropdown ? 'rotate-180' : ''
                          } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      </button>
                    </div>
                  </div>
                  {showMillDropdown && !filterLoading && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMillDropdown(false)}
                      />
                      <div className={`absolute z-[100] mt-1 w-full max-h-60 overflow-auto rounded-lg border shadow-xl dropdown-enter ${isDarkMode
                        ? 'bg-gray-800 border-gray-600'
                        : 'bg-white border-gray-200'
                        }`}>
                        <button
                          type="button"
                          onClick={async () => {
                            console.log('🔧 All Mills selected - clearing mill filter');
                            await handleClearMillFilter();
                            setShowMillDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${!filters.millId || filters.millId === ''
                            ? isDarkMode
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-blue-50 text-blue-700 font-bold border-b border-blue-200'
                            : isDarkMode
                              ? 'hover:bg-gray-700 text-white'
                              : 'hover:bg-blue-50 text-gray-700'
                            }`}
                        >
                          ✓ All Mills {!filters.millId || filters.millId === '' ? '(Showing All)' : ''}
                        </button>
                        {millsLoading ? (
                          <div className={`px-3 py-2 text-sm border-t ${isDarkMode
                            ? 'text-gray-400 border-gray-600'
                            : 'text-gray-500 border-gray-200'
                            }`}>
                            Loading mills...
                          </div>
                        ) : mills.length === 0 ? (
                          <div className={`px-3 py-2 text-sm border-t ${isDarkMode
                            ? 'text-gray-400 border-gray-600'
                            : 'text-gray-500 border-gray-200'
                            }`}>
                            No mills available
                          </div>
                        ) : filteredMills.length > 0 ? (
                          filteredMills.map((mill) => {
                            const millIdStr = String(mill._id || '');
                            const filterIdStr = String(filters.millId || '');
                            const isSelected = millIdStr === filterIdStr;

                            return (
                              <button
                                key={mill._id}
                                type="button"
                                onClick={() => handleMillSelect(mill)}
                                className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors border-t ${isSelected
                                  ? isDarkMode
                                    ? 'bg-blue-600 text-white border-gray-600 font-bold'
                                    : 'bg-blue-50 text-blue-700 border-gray-200 font-bold'
                                  : isDarkMode
                                    ? 'hover:bg-gray-700 text-white border-gray-600'
                                    : 'hover:bg-blue-50 text-gray-700 border-gray-200'
                                  }`}
                              >
                                {isSelected ? '✓ ' : ''}{mill.name}
                              </button>
                            );
                          })
                        ) : (
                          <div className={`px-3 py-2 text-sm border-t ${isDarkMode
                            ? 'text-gray-400 border-gray-600'
                            : 'text-gray-500 border-gray-200'
                            }`}>
                            No mills match "{millSearchTerm}"
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Loading Indicator for Filters */}
              {(sortLoading || filterLoading) && (
                <div className="flex items-center gap-2">
                  <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'
                    }`}></div>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                    {sortLoading ? 'Sorting...' : 'Filtering...'}
                  </span>
                </div>
              )}

              {/* Clear All Filters Button - Show when any filter is active */}
              {(filters.millId || filters.statusFilter !== 'pending' || filters.typeFilter !== 'all' || filters.fyFilter !== '' || searchTerm || filters.startDate || filters.endDate) && (
                <button
                  onClick={handleClearFilters}
                  disabled={filterLoading || sortLoading}
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 active:scale-95 shadow-md whitespace-nowrap ${isDarkMode
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 shadow-red-600/20'
                    : 'bg-red-600 text-white hover:bg-red-700 border border-red-500 shadow-red-600/30'
                    } ${(filterLoading || sortLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Clear all filters and reset to default (pending status)"
                >
                  <XMarkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Clear All Filters</span>
                </button>
              )}

            </div>

            {/* Right Side - View Toggle and Refresh */}
            <div className="flex items-center gap-2 order-1 lg:order-2 w-full sm:w-auto justify-between sm:justify-start">
              <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>View:</span>
              <div className={`flex rounded-lg border overflow-hidden ${isDarkMode ? 'border-gray-600' : 'border-gray-300'
                }`}>
                <button
                  onClick={() => handleViewModeChange('table')}
                  className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 hover-lift active:scale-95 ${viewMode === 'table'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white badge-pulse'
                      : 'bg-blue-500 text-white badge-pulse'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  title="Table View"
                >
                  <ListBulletIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('cards')}
                  className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 hover-lift active:scale-95 ${viewMode === 'cards'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white badge-pulse'
                      : 'bg-blue-500 text-white badge-pulse'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  title="Card View"
                >
                  <Squares2X2Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>

              {/* Refresh Button - Icon only on small screens */}
              <button
                onClick={() => handleRefresh()}
                disabled={refreshing}
                className={`group inline-flex items-center justify-center px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-all duration-200 hover:scale-105 hover-lift text-[10px] xs:text-xs sm:text-sm ${refreshing
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
                  } ${isDarkMode
                    ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/30'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                title="Refresh"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${refreshing ? 'animate-spin' : 'hover-rotate-icon'} sm:mr-1`} />
                <span className="font-medium hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Pagination Info Bar */}
      <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:justify-between ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
        }`}>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:space-x-3 lg:space-x-4">
          <span className={`text-[10px] xs:text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className="hidden sm:inline">Showing {paginationDisplayInfo.start} to {paginationDisplayInfo.end} of {paginationDisplayInfo.total} orders</span>
            <span className="sm:hidden">{paginationDisplayInfo.start}-{paginationDisplayInfo.end} of {paginationDisplayInfo.total}</span>
          </span>

          {/* Items per page dropdown */}
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] xs:text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const value = parseInt(e.target.value);
                if (!isNaN(value) && [10, 25, 50, 100].includes(value)) {
                  debouncedHandleItemsPerPageChange(value);
                }
              }}
              disabled={isChangingPage || loading}
              className={`px-2 sm:px-3 py-1 rounded-lg border text-[10px] xs:text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {itemsPerPageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Enhanced Navigation - Show when there are multiple pages */}
        {(totalPages > 1 || orders.length > 0) && (
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isChangingPage || loading}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-medium transition-all duration-200 hover-lift active:scale-95 ${currentPage === 1 || isChangingPage || loading
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
                        className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-medium transition-all duration-200 hover-lift active:scale-95 ${currentPage === i
                          ? isDarkMode ? 'bg-blue-600 text-white shadow-md badge-pulse' : 'bg-blue-500 text-white shadow-md badge-pulse'
                          : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
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
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === 1
                        ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                        : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
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
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                            ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                            : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                            } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {i}
                        </button>
                      );
                    }
                    pages.push(
                      <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        ...
                      </span>
                    );
                  } else if (currentPage >= totalPages - 3) {
                    // Show: 1, ..., last-4, last-3, last-2, last-1, last
                    pages.push(
                      <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        ...
                      </span>
                    );
                    for (let i = totalPages - 4; i <= totalPages; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          disabled={isChangingPage || loading}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                            ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                            : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                            } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {i}
                        </button>
                      );
                    }
                  } else {
                    // Show: 1, ..., current-1, current, current+1, ..., last
                    pages.push(
                      <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        ...
                      </span>
                    );
                    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          disabled={isChangingPage || loading}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                            ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                            : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                            } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {i}
                        </button>
                      );
                    }
                    pages.push(
                      <span key="ellipsis2" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border-2 hover-lift active:scale-95 ${currentPage === totalPages
                          ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500 badge-pulse' : 'bg-blue-500 text-white shadow-lg border-blue-400 badge-pulse'
                          : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
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
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-medium transition-all duration-200 hover-lift active:scale-95 ${currentPage === totalPages || isChangingPage || loading
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
                </>
              )}
            </button>
          </div>
        )}
      </div>


      {/* New Financial Year Alert Banner - Thoughtful and Premium */}
      {isNewFYPeriod && !fyAlertDismissed && (
        <div className={`mt-4 mx-2 sm:mx-3 md:mx-4 rounded-2xl border-2 p-5 shadow-2xl flex items-start sm:items-center justify-between gap-6 animate-slide-in-down transition-all duration-500 hover:scale-[1.01] ${isDarkMode
          ? 'bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-transparent border-blue-500/40'
          : 'bg-gradient-to-br from-blue-50 via-white to-blue-50/30 border-blue-200'
          }`}>
          <div className="flex items-start sm:items-center gap-5">
            <div className={`p-3 rounded-2xl shrink-0 shadow-lg ${isDarkMode ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-400/30' : 'bg-blue-100 text-blue-600 ring-1 ring-blue-200'}`}>
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className={`font-extrabold text-base sm:text-lg lg:text-xl tracking-tight leading-tight ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>
                New Financial Year, New Milestones! 🎉
              </h3>
              <p className={`text-xs sm:text-sm font-medium leading-relaxed max-w-2xl ${isDarkMode ? 'text-blue-200/80' : 'text-blue-700/90'}`}>
                Welcome to the new financial year. Order IDs have automatically reset to 001 for the fresh sequence. You can always access previous year records from the FY Filter dropdown below.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setFyAlertDismissed(true);
              if (typeof window !== 'undefined') {
                localStorage.setItem('fyAlertDismissed_2026_27', 'true');
              }
            }}
            className={`p-2 rounded-xl shrink-0 transition-all duration-200 hover:scale-110 active:scale-95 ${isDarkMode
              ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-400/20'
              : 'bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 shadow-sm'
              }`}
            aria-label="Dismiss notification"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      )}

      {/* Orders Display */}
      {viewMode === 'table' ? (
        <>
          {/* Show skeleton when loading */}
          {(loading || !isInitialized || orderCreating || searchLoading || tableLoading || isChangingPage || refreshing || sortLoading || filterLoading || (currentOrders.length === 0 && !ordersLoaded)) ? (
            <OrdersTableSkeleton />
          ) : (
            <div className={`rounded-xl border overflow-hidden shadow-lg animate-fade-in-scale ${isDarkMode
              ? 'bg-white/5 border-white/10 shadow-2xl'
              : 'bg-white border-gray-300 shadow-xl'
              }`}>
              <div className="overflow-x-auto min-w-full">
                <table className="w-full min-w-max">
                  <thead className={`${isDarkMode ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b border-slate-600' : 'bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-300'
                    }`}>
                    <tr>
                      <th className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold uppercase tracking-wide border-b-2 min-w-[300px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-black/50 bg-blue-50'
                        }`}>
                        Order Information
                      </th>
                      <th className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold uppercase tracking-wide border-b-2 min-w-[350px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-black bg-blue-50'
                        }`}>
                        Items
                      </th>
                      <th className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold uppercase tracking-wide border-b-2 min-w-[200px] ${isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-black bg-blue-50'
                        }`}>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {/* Show actual orders data */}
                    {(!loading && !orderCreating && !tableLoading && !isChangingPage && !refreshing && !sortLoading && !filterLoading && !searchLoading && ordersLoaded) &&
                      (() => {
                        // Determine which orders to display
                        const ordersToDisplay = currentOrders.length > 0 ? currentOrders : (orders.length > 0 ? orders : []);

                        console.log('🔍 Table render check:', {
                          loading,
                          orderCreating,
                          tableLoading,
                          isChangingPage,
                          refreshing,
                          sortLoading,
                          filterLoading,
                          searchLoading,
                          ordersLoaded,
                          currentOrdersLength: currentOrders.length,
                          ordersLength: orders.length,
                          ordersToDisplayLength: ordersToDisplay.length,
                          paginationTotalCount: paginationInfo.totalCount,
                          shouldRender: ordersToDisplay.length > 0 || paginationInfo.totalCount > 0
                        });

                        // Show orders if we have them
                        // If pagination says we should have orders but array is empty, 
                        // it means data is still loading or there's a state sync issue
                        if (ordersToDisplay.length > 0) {
                          return ordersToDisplay.map((order, index) => (
                            <tr
                              key={order._id}
                              className={`relative border-l-4 border-b-6 border-transparent table-row-enter ${isDarkMode
                                ? 'border-b-gray-700 hover:border-l-blue-800'
                                : 'border-b-gray-300 hover:border-l-blue-500'
                                } hover:${isDarkMode ? 'bg-white/5' : 'bg-gray-50'
                                } transition-all duration-300 ${deletingOrderId === String(order._id) ? 'opacity-60' : ''
                                }`}
                              style={{
                                animationDelay: `${index * 30}ms`,
                                opacity: 0
                              }}
                            >
                              {/* Loading overlay when deleting in table view */}
                              {deletingOrderId === String(order._id) && (
                                <td colSpan={100} className={`absolute inset-0 z-50 flex items-center justify-center ${isDarkMode ? 'bg-gray-900/80' : 'bg-white/80'
                                  } backdrop-blur-sm`}>
                                  <div className="flex flex-col items-center gap-2">
                                    <ArrowPathIcon className={`h-6 w-6 animate-spin ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      Deleting Order...
                                    </span>
                                  </div>
                                </td>
                              )}
                              {/* Order Information Column */}
                              <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
                                <div className="space-y-3">
                                  {/* Row 1: Order ID and Type in separate columns */}
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* Order ID Column */}
                                    <div className={`p-3 rounded-lg border ${isDarkMode
                                      ? 'bg-green-500/10 border-green-500/20'
                                      : 'bg-green-50 border-green-200'
                                      }`}>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                          Order ID:
                                        </span>
                                        <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {getDisplayOrderId(order.orderId)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Order Type Column */}
                                    <div className={`p-3 rounded-lg border ${isDarkMode
                                      ? 'bg-purple-500/10 border-purple-500/20'
                                      : 'bg-purple-50 border-purple-200'
                                      }`}>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                          Order Type:
                                        </span>
                                        <span className={`text-lg font-bold ${order.orderType === 'Dying'
                                          ? isDarkMode
                                            ? 'text-orange-400'
                                            : 'text-orange-600'
                                          : isDarkMode
                                            ? 'text-blue-400'
                                            : 'text-blue-600'
                                          }`}>
                                          {order.orderType || 'Not selected'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Responsive Layout: Single column on small screens, 2 columns on larger screens */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Left: PO and Style */}
                                    <div className={`p-3 rounded-lg border ${isDarkMode
                                      ? 'bg-blue-500/10 border-blue-500/20'
                                      : 'bg-blue-50 border-blue-200'
                                      }`}>
                                      <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                                        Order Details
                                      </h4>
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                            PO:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {order.poNumber || 'Not selected'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                            Style:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {order.styleNo || 'Not selected'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Party Information */}
                                    <div className={`p-3 rounded-lg border ${isDarkMode
                                      ? 'bg-orange-500/10 border-orange-500/20'
                                      : 'bg-orange-50 border-orange-200'
                                      }`}>
                                      <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                                        Party Information
                                      </h4>
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                            Name:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {order.party && typeof order.party === 'object' ? order.party.name || 'Not selected' : 'Not selected'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                            Contact:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {order.contactName || 'Not selected'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                            Phone:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {order.contactPhone || 'Not selected'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Responsive Layout: Single column on small screens, 2 columns on larger screens */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Left: All Dates */}
                                    <div className={`p-3 rounded-lg border ${isDarkMode
                                      ? 'bg-green-500/10 border-green-500/20'
                                      : 'bg-green-50 border-green-200'
                                      }`}>
                                      <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                                        Important Dates
                                      </h4>
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                            Arrival:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {formatDate(order.arrivalDate)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                            PO Date:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {formatDate(order.poDate)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                            Delivery:
                                          </span>
                                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {formatDate(order.deliveryDate)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Timestamps */}
                                    <div className={`p-3 rounded-lg border ${isDarkMode
                                      ? 'bg-purple-500/10 border-purple-500/20'
                                      : 'bg-purple-50 border-purple-200'
                                      }`}>
                                      <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                                        System Timestamps
                                      </h4>
                                      <div className="space-y-1">
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                              Created: {formatDate(order.createdAt)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 ml-6">
                                            <ClockIcon className="h-3 w-3 text-gray-400" />
                                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                              {new Date(order.createdAt).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                              Updated: {formatDate(order.updatedAt)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 ml-6">
                                            <ClockIcon className="h-3 w-3 text-gray-400" />
                                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                              {new Date(order.updatedAt).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true
                                              })}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Items Column */}
                              <td className="py-3 sm:py-4 lg:py-5">
                                <div className="space-y-2">
                                  <div className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                    {order.items.length} items
                                  </div>

                                  {/* Items Table */}
                                  <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-white border-gray-300'
                                    }`}>
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-max">
                                        <thead className={`${isDarkMode
                                          ? 'bg-gray-700 border-b border-gray-600'
                                          : 'bg-gray-50 border-b border-gray-300'
                                          }`}>
                                          <tr>
                                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                              }`}>
                                              Quality
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                              }`}>
                                              Qty
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                              }`}>
                                              Desc.
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                              }`}>
                                              Process
                                            </th>
                                            <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                              }`}>
                                              Images
                                            </th>
                                            <th className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                              }`}>
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
                                          }`}>
                                          {order.items.map((item, index) => (
                                            <tr key={index} className={`table-row-enter hover:${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                                              } transition-colors duration-200`} style={{ animationDelay: `${index * 20}ms` }}>
                                              {/* Quality */}
                                              <td className="px-4 py-4">
                                                <div className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                  {(() => {
                                                    // ⚡ FIX: Handle quality display properly - check object, string, or lookup
                                                    if (!item.quality) {
                                                      return 'Not selected';
                                                    }

                                                    // If quality is an object with name
                                                    if (typeof item.quality === 'object' && item.quality.name) {
                                                      return item.quality.name;
                                                    }

                                                    // If quality is a string (ID), try to find it in qualities array
                                                    if (typeof item.quality === 'string') {
                                                      const qualityObj = qualities.find(q => {
                                                        const qId = q._id || (q as any).id;
                                                        return qId?.toString() === item.quality?.toString();
                                                      });
                                                      return qualityObj?.name || item.quality || 'Not selected';
                                                    }

                                                    // If quality is an object but no name, try to get _id and lookup
                                                    if (typeof item.quality === 'object' && item.quality && '_id' in item.quality) {
                                                      const qualityId = (item.quality as any)._id;
                                                      if (qualityId) {
                                                        const qualityObj = qualities.find(q => {
                                                          const qId = q._id || (q as any).id;
                                                          return qId?.toString() === (qualityId?.toString() || '');
                                                        });
                                                        const qualityIdStr = typeof qualityId === 'string' ? qualityId : (qualityId?.toString() || '');
                                                        return qualityObj?.name || qualityIdStr || 'Not selected';
                                                      }
                                                    }

                                                    // Fallback
                                                    return 'Not selected';
                                                  })()}
                                                </div>
                                              </td>

                                              {/* Quantity */}
                                              <td className="px-4 py-4">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDarkMode
                                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                                                  }`}>
                                                  {item.quantity || 0}
                                                </span>
                                              </td>

                                              {/* Description */}
                                              <td className="px-4 py-4">
                                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} max-w-[120px] truncate`}>
                                                  {item.description || '-'}
                                                </div>
                                              </td>





                                              {/* Process */}
                                              <td className="px-4 py-4">
                                                <div className="max-w-[150px]">
                                                  {(() => {
                                                    // Show loading indicator while process data is being fetched
                                                    if (processDataLoading) {
                                                      return (
                                                        <div className="flex items-center space-x-2">
                                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                                                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</span>
                                                        </div>
                                                      );
                                                    }

                                                    const qualityName = typeof item.quality === 'string' ? item.quality : item.quality?.name || 'N/A';
                                                    const qualityId = typeof item.quality === 'object' && item.quality ? item.quality._id : item.quality;

                                                    // Check if we have mill input data for this order
                                                    const orderMillInputsData = orderMillInputs[order.orderId] || [];

                                                    // Debug logging removed for performance

                                                    // ⚡ FIXED: Get process data for this specific quality and order
                                                    const processes = getProcessDataForQuality(item.quality, order.orderId);

                                                    // ⚡ FIXED: Always check mill inputs directly as fallback (more reliable)
                                                    // Check if we have any mill input data at all for this order
                                                    const hasAnyMillInputs = Array.isArray(orderMillInputsData) && orderMillInputsData.length > 0;

                                                    // Look for process data in mill inputs for this quality (always check, not just if processes.length === 0)
                                                    const relevantMillInputs = hasAnyMillInputs ? orderMillInputsData.filter((input: any) => {
                                                      if (!input.quality) return false;

                                                      const inputQualityId = typeof input.quality === 'object' ? input.quality._id : input.quality;
                                                      const itemQualityId = typeof item.quality === 'object' ? item.quality._id : item.quality;

                                                      return inputQualityId === itemQualityId && input.processName;
                                                    }) : [];

                                                    // If we have processes from getProcessDataForQuality, use them
                                                    if (processes.length > 0) {
                                                      // Show only the highest priority process (first one in the sorted array)
                                                      const highestPriorityProcess = processes[0];
                                                      return (
                                                        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                                          ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                                          : 'bg-orange-100 text-orange-700 border border-orange-200'
                                                          }`}>
                                                          {highestPriorityProcess}
                                                        </div>
                                                      );
                                                    }

                                                    // ⚡ FIXED: If no processed data but we have mill inputs, extract from mill inputs directly
                                                    if (hasAnyMillInputs && relevantMillInputs.length > 0) {
                                                      // Collect all process names from relevant mill inputs
                                                      const allProcesses = relevantMillInputs
                                                        .map((input: any) => input.processName)
                                                        .filter((process: string) => process && process.trim() !== '');

                                                      // Also check additional meters for more processes
                                                      relevantMillInputs.forEach((input: any) => {
                                                        if (input.additionalMeters && Array.isArray(input.additionalMeters)) {
                                                          input.additionalMeters.forEach((additional: any) => {
                                                            if (additional.quality && additional.processName) {
                                                              const additionalQualityId = typeof additional.quality === 'object' ? additional.quality._id : additional.quality;
                                                              const itemQualityId = typeof item.quality === 'object' ? item.quality._id : item.quality;
                                                              if (additionalQualityId === itemQualityId && additional.processName) {
                                                                allProcesses.push(additional.processName);
                                                              }
                                                            }
                                                          });
                                                        }
                                                      });

                                                      if (allProcesses.length > 0) {
                                                        // Remove duplicates and sort by priority
                                                        const uniqueProcesses = [...new Set(allProcesses)];

                                                        // Define process priority order (higher number = higher priority)
                                                        const processPriority = [
                                                          'Lot No Greigh',    // 1
                                                          'Charkha',          // 2
                                                          'Drum',             // 3
                                                          'Soflina WR',       // 4
                                                          'long jet',         // 5
                                                          'setting',          // 6
                                                          'In Dyeing',        // 7
                                                          'jigar',            // 8
                                                          'in printing',      // 9
                                                          'loop',             // 10
                                                          'washing',          // 11
                                                          'Finish',           // 12
                                                          'folding',          // 13
                                                          'ready to dispatch' // 14
                                                        ];

                                                        // Sort by priority (highest number first)
                                                        const sortedProcesses = uniqueProcesses.sort((a, b) => {
                                                          const aIndex = processPriority.indexOf(a);
                                                          const bIndex = processPriority.indexOf(b);
                                                          if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                                                          if (aIndex === -1) return 1;
                                                          if (bIndex === -1) return -1;
                                                          return bIndex - aIndex; // Higher index = higher priority
                                                        });

                                                        const highestPriorityProcess = sortedProcesses[0];

                                                        return (
                                                          <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                                            ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                                            : 'bg-orange-100 text-orange-700 border border-orange-200'
                                                            }`}>
                                                            {highestPriorityProcess}
                                                          </div>
                                                        );
                                                      }

                                                      // Check if there are mill inputs for this quality but no process names
                                                      const hasMillInputsForQuality = orderMillInputsData.some((input: any) => {
                                                        if (!input.quality) return false;
                                                        const inputQualityId = typeof input.quality === 'object' ? input.quality._id : input.quality;
                                                        const itemQualityId = typeof item.quality === 'object' ? item.quality._id : item.quality;
                                                        return inputQualityId === itemQualityId;
                                                      });

                                                      // Only show "Processing..." if we have mill inputs for this quality with process names
                                                      // Otherwise show "No process data"
                                                      return (
                                                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                          {hasMillInputsForQuality && relevantMillInputs.length > 0 ? 'Processing...' : 'No process data'}
                                                        </span>
                                                      );
                                                    }

                                                    // Final fallback: No process data
                                                    return (
                                                      <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        No process data
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                              </td>

                                              {/* Images - Proper Display with Error Handling */}
                                              <td className="px-4 py-4">
                                                {item.imageUrls && item.imageUrls.length > 0 ? (
                                                  <div className="flex flex-wrap gap-3 items-center">
                                                    {/* Show up to 3 images - Always show placeholders even if images fail */}
                                                    {(item.imageUrls.length <= 3
                                                      ? item.imageUrls
                                                      : item.imageUrls.slice(0, 3)
                                                    ).map((imageUrl, imgIndex) => {
                                                      const imageKey = `${order._id}-${index}-${imgIndex}`;
                                                      return (
                                                        <div
                                                          key={imgIndex}
                                                          className="relative group"
                                                          style={{ minWidth: '100px', minHeight: '100px' }}
                                                        >
                                                          <img
                                                            src={imageUrl}
                                                            alt={`Item ${index + 1} - Image ${imgIndex + 1}`}
                                                            className="max-w-[180px] max-h-[180px] sm:max-w-[190px] sm:max-h-[190px] md:max-w-[200px] md:max-h-[200px] lg:max-w-[210px] lg:max-h-[210px] w-auto h-auto object-contain rounded-lg border-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:z-20 hover:shadow-xl bg-gray-50 dark:bg-gray-800 p-1"
                                                            style={{
                                                              borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.8)' : 'rgba(229, 231, 235, 0.8)',
                                                              minWidth: '100px',
                                                              minHeight: '100px'
                                                            }}
                                                            onError={(e) => {
                                                              const target = e.target as HTMLImageElement;
                                                              target.style.display = 'none';
                                                              // Show fallback placeholder
                                                              const fallback = target.nextElementSibling as HTMLElement;
                                                              if (fallback) fallback.style.display = 'flex';
                                                            }}
                                                            onLoad={(e) => {
                                                              // Hide fallback when image loads successfully
                                                              const target = e.target as HTMLImageElement;
                                                              const fallback = target.nextElementSibling as HTMLElement;
                                                              if (fallback) fallback.style.display = 'none';
                                                            }}
                                                            onClick={(e) => {
                                                              e.preventDefault();
                                                              e.stopPropagation();
                                                              if (item.imageUrls && item.imageUrls.length > 0) {
                                                                handleImagePreview(imageUrl, `Item ${index + 1} - Image ${imgIndex + 1}`, item.imageUrls, imgIndex);
                                                              }
                                                            }}
                                                            loading="lazy"
                                                          />
                                                          {/* Fallback placeholder - shown when image fails to load */}
                                                          <div
                                                            className="hidden w-[180px] h-[180px] sm:w-[190px] sm:h-[190px] md:w-[200px] md:h-[200px] lg:w-[210px] lg:h-[210px] items-center justify-center rounded-lg border-2 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-pointer transition-all duration-300 hover:scale-110"
                                                            onClick={(e) => {
                                                              e.preventDefault();
                                                              e.stopPropagation();
                                                              console.warn('Image failed to load:', imageUrl);
                                                            }}
                                                          >
                                                            <div className="flex flex-col items-center">
                                                              <PhotoIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-1" />
                                                              <span className="text-xs text-gray-500 dark:text-gray-400">Failed</span>
                                                            </div>
                                                          </div>
                                                          {/* Hover overlay */}
                                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center pointer-events-none">
                                                            <span className="text-white text-xs font-bold">Click to view</span>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}

                                                    {/* Show "+X more" button if more than 3 images */}
                                                    {item.imageUrls && item.imageUrls.length > 3 && (
                                                      <button
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          if (item.imageUrls && item.imageUrls.length > 0) {
                                                            handleImagePreview(item.imageUrls[0], `Item ${index + 1} - All Images`, item.imageUrls, 0);
                                                          }
                                                        }}
                                                        className={`w-[180px] h-[180px] sm:w-[190px] sm:h-[190px] md:w-[200px] md:h-[200px] lg:w-[210px] lg:h-[210px] rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 relative overflow-hidden group ${isDarkMode
                                                          ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                                                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                                          }`}
                                                        title={`View all ${item.imageUrls.length} images`}
                                                      >
                                                        <PhotoIcon className="h-8 w-8 mb-2 group-hover:scale-110 transition-transform" />
                                                        <span className="text-sm font-bold">+{item.imageUrls.length - 3}</span>
                                                        <span className="text-xs mt-1">More</span>
                                                      </button>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center justify-center py-2">
                                                    <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No images</span>
                                                  </div>
                                                )}
                                              </td>

                                              {/* Actions */}
                                              <td className="px-2 py-2 text-center">
                                                <div className="flex flex-col gap-2">
                                                  {/* PDF Download Button - Only show for non-users */}
                                                  {!isUser && (
                                                    <button
                                                      onClick={() => handleDownloadItemPDF(order, item, index)}
                                                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-105 shadow-sm ${isDarkMode
                                                        ? 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-600/30 hover:border-indigo-500/50'
                                                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 border border-indigo-200 hover:border-indigo-300'
                                                        }`}
                                                      title={`Download PDF for ${item.quality && typeof item.quality === 'object' ? item.quality.name || 'Item' : 'Item'}`}
                                                    >
                                                      <DocumentArrowDownIcon className="h-3.5 w-3.5 inline mr-1.5" />
                                                      PDF
                                                    </button>
                                                  )}

                                                  {/* Delete Button */}
                                                  <button
                                                    onClick={() => handleDeleteItemClick(order._id, index, item.quality && typeof item.quality === 'object' ? item.quality.name || 'Item' : 'Item')}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-105 shadow-sm delete-button-hover ${isDarkMode
                                                      ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 hover:border-red-500/50'
                                                      : 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200 hover:border-red-300'
                                                      }`}
                                                    title="Delete item"
                                                  >
                                                    <TrashIcon className="h-3.5 w-3.5 inline mr-1.5" />
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Actions Column */}
                              <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
                                <div className="flex flex-col gap-2">
                                  {/* Row 0: Status Label and Buttons */}
                                  <div className={`flex items-center justify-center gap-3 px-3 py-2 rounded-lg border transition-colors ${isDarkMode
                                    ? 'bg-gray-700/50 border-gray-600'
                                    : 'bg-gray-100 border-gray-300'
                                    }`}>
                                    <label className={`text-base font-bold whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                      }`}>
                                      Status:
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleStatusChangeClick(order._id, 'pending', order.orderId)}
                                        disabled={changingStatus}
                                        className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center justify-center ${(order.status || 'pending') === 'pending'
                                          ? isDarkMode
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-blue-600 text-white'
                                          : isDarkMode
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                          } ${changingStatus ? 'opacity-50 cursor-not-allowed pointer-events-none scale-95' : 'hover:scale-105'}`}
                                      >
                                        Pending
                                      </button>
                                      <button
                                        onClick={() => handleStatusChangeClick(order._id, 'delivered', order.orderId)}
                                        disabled={changingStatus}
                                        className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center justify-center ${order.status === 'delivered'
                                          ? isDarkMode
                                            ? 'bg-green-600 text-white'
                                            : 'bg-green-600 text-white'
                                          : isDarkMode
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                          } ${changingStatus ? 'opacity-50 cursor-not-allowed pointer-events-none scale-95' : 'hover:scale-105'}`}
                                      >
                                        Delivered
                                      </button>
                                    </div>
                                  </div>

                                  {/* Table Actions - 2 Columns Layout (Same as Card View) */}
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* Column 1: Lab, Input, Output, Dispatch */}
                                    <div className="space-y-3">
                                      <button
                                        type="button"
                                        key={`grey-info-${order._id}-${forceRender}`}
                                        onClick={() => handleGreyInfo(order)}
                                        disabled={loadingGreyInfo === order._id}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 relative disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${isDarkMode
                                          ? 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
                                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                          }`}
                                        title={hasGreyInfo(order) ? "Edit Grey Information" : "Add Grey Information"}
                                      >
                                        {loadingGreyInfo === order._id ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>Loading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <DocumentTextIcon className="h-4 w-4" />
                                            <span>{hasGreyInfo(order) ? "Edit Grey Info" : "Add Grey Info"}</span>
                                          </>
                                        )}
                                        {/* Status indicator */}
                                        {loadingGreyInfo !== order._id && (
                                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                            } ${hasGreyInfo(order) ? 'bg-green-500' : 'bg-gray-400'
                                            }`} title={hasGreyInfo(order) ? "Data exists" : "No data"} />
                                        )}
                                      </button>

                                      <button
                                        key={`lab-${order._id}-${forceRender}`}
                                        onClick={() => handleLabData(order)}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 relative ${isDarkMode
                                          ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                          }`}
                                        title={hasLabData(order) ? "Edit Lab Data" : "Add Lab Data"}
                                      >
                                        <BeakerIcon className="h-4 w-4" />
                                        <span>{hasLabData(order) ? "Edit Lab Data" : "Add Lab Data"}</span>
                                        {/* Status indicator */}
                                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                          } ${hasLabData(order) ? 'bg-green-500' : 'bg-gray-400'
                                          }`} title={hasLabData(order) ? "Data exists" : "No data"} />
                                      </button>

                                      <button
                                        key={`mill-input-${order._id}-${forceRender}`}
                                        onClick={() => handleMillInput(order)}
                                        disabled={loadingMillInput === order._id}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 relative ${isDarkMode
                                          ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30'
                                          : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                          } ${loadingMillInput === order._id ? 'opacity-75 cursor-not-allowed' : ''}`}
                                        title={hasMillInputs(order) ? "Edit Mill Input" : "Add Mill Input"}
                                      >
                                        {loadingMillInput === order._id ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>Loading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CubeIcon className="h-4 w-4" />
                                            <span>{hasMillInputs(order) ? "Edit Mill Input" : "Add Mill Input"}</span>
                                          </>
                                        )}
                                        {/* Status indicator */}
                                        {loadingMillInput !== order._id && (
                                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                            } ${hasMillInputs(order) ? 'bg-green-500' : 'bg-gray-400'
                                            }`} title={hasMillInputs(order) ? "Data exists" : "No data"} />
                                        )}
                                      </button>

                                      <button
                                        key={`mill-output-${order._id}-${forceRender}`}
                                        onClick={() => handleMillOutput(order)}
                                        disabled={loadingMillOutput === order._id}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 relative ${isDarkMode
                                          ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600/30'
                                          : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                                          } ${loadingMillOutput === order._id ? 'opacity-75 cursor-not-allowed' : ''}`}
                                        title={hasMillOutputs(order) ? "Edit Mill Output" : "Add Mill Output"}
                                      >
                                        {loadingMillOutput === order._id ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>Loading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <DocumentTextIcon className="h-4 w-4" />
                                            <span>{hasMillOutputs(order) ? "Edit Mill Output" : "Add Mill Output"}</span>
                                          </>
                                        )}
                                        {/* Status indicator */}
                                        {loadingMillOutput !== order._id && (
                                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                            } ${hasMillOutputs(order) ? 'bg-green-500' : 'bg-gray-400'
                                            }`} title={hasMillOutputs(order) ? "Data exists" : "No data"} />
                                        )}
                                      </button>

                                      <button
                                        key={`dispatch-${order._id}-${forceRender}`}
                                        onClick={() => handleDispatch(order)}
                                        disabled={loadingDispatch === order._id}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 relative ${isDarkMode
                                          ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30'
                                          : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                                          } ${loadingDispatch === order._id ? 'opacity-75 cursor-not-allowed' : ''}`}
                                        title={hasDispatches(order) ? "Edit Dispatch" : "Add Dispatch"}
                                      >
                                        {loadingDispatch === order._id ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>Loading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <TruckIcon className="h-4 w-4" />
                                            <span>{hasDispatches(order) ? "Edit Dispatch" : "Add Dispatch"}</span>
                                          </>
                                        )}
                                        {/* Status indicator */}
                                        {loadingDispatch !== order._id && (
                                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                            } ${hasDispatches(order) ? 'bg-green-500' : 'bg-gray-400'
                                            }`} title={hasDispatches(order) ? "Data exists" : "No data"} />
                                        )}
                                      </button>
                                    </div>

                                    {/* Column 2: View, Edit, Delete, Logs */}
                                    <div className="space-y-3">
                                      <button
                                        onClick={() => handleView(order)}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 ${isDarkMode
                                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                          }`}
                                        title="View Order Details"
                                      >
                                        <EyeIcon className="h-4 w-4" />
                                        <span>View Details</span>
                                      </button>

                                      <button
                                        onClick={() => handleEdit(order)}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 ${isDarkMode
                                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                          }`}
                                        title="Edit Order"
                                      >
                                        <PencilIcon className="h-4 w-4" />
                                        <span>Edit Order</span>
                                      </button>

                                      <button
                                        onClick={() => handleDeleteClick(order)}
                                        disabled={deletingOrderId === String(order._id)}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 delete-button-hover ${deletingOrderId === String(order._id)
                                          ? 'opacity-50 cursor-not-allowed'
                                          : ''
                                          } ${isDarkMode
                                            ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                                            : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                          }`}
                                        title={deletingOrderId === String(order._id) ? "Deleting..." : "Delete Order"}
                                      >
                                        {deletingOrderId === String(order._id) ? (
                                          <>
                                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                            <span>Deleting...</span>
                                          </>
                                        ) : (
                                          <>
                                            <TrashIcon className="h-4 w-4" />
                                            <span>Delete ({getDisplayOrderId(order.orderId)})</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        onClick={() => handleViewLogs(order)}
                                        className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 ${isDarkMode
                                          ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/30'
                                          : 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100'
                                          }`}
                                        title="View Logs"
                                      >
                                        <ChartBarIcon className="h-4 w-4" />
                                        <span>View Logs</span>
                                      </button>
                                    </div>
                                  </div>

                                </div>
                              </td>

                            </tr>
                          ));
                        } else {
                          return null;
                        }
                      })()
                    }

                    {/* Empty state message */}
                    {!loading && !orderCreating && !tableLoading && !isChangingPage && !refreshing && !sortLoading && !filterLoading && !searchLoading && currentOrders.length === 0 && ordersLoaded && paginationInfo.totalCount === 0 && orders.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 sm:px-4 lg:px-6 py-12 text-center">
                          <div className="flex flex-col items-center space-y-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                              }`}>
                              <svg className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                No orders found
                              </h3>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                                {searchTerm ? 'Try adjusting your search criteria' : 'No orders match your current filters'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Enhanced Card Layout - Complete Order Information */
        <div className="space-y-0">
          {!loading && !orderCreating && !tableLoading && !isChangingPage && !refreshing && !sortLoading && !filterLoading && !searchLoading && ordersLoaded && (currentOrders.length > 0 || (paginationInfo.totalCount > 0 && orders.length > 0)) ? (
            /* Show orders in card view */
            (currentOrders.length > 0 ? currentOrders : orders).map((order, orderIndex) => {
              const ordersToDisplay = currentOrders.length > 0 ? currentOrders : orders;
              return (
                <div key={order._id} className={`${orderIndex < ordersToDisplay.length - 1 ? 'mb-4 sm:mb-6' : ''} relative animate-slide-in-up`} style={{ animationDelay: `${orderIndex * 50}ms`, opacity: 0 }}>
                  <div className={`rounded-2xl border-2 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover-lift ${deletingOrderId === String(order._id) ? 'opacity-60' : ''
                    } ${isDarkMode
                      ? 'bg-gradient-to-br from-gray-800 via-gray-800/95 to-gray-800/90 border-gray-600/50'
                      : 'bg-gradient-to-br from-white via-gray-50/50 to-white border-gray-200'
                    }`}>
                    {/* Loading overlay when deleting */}
                    {deletingOrderId === String(order._id) && (
                      <div className={`absolute inset-0 z-50 flex items-center justify-center rounded-2xl ${isDarkMode ? 'bg-gray-900/80' : 'bg-white/80'
                        } backdrop-blur-sm`}>
                        <div className="flex flex-col items-center gap-3">
                          <ArrowPathIcon className={`h-8 w-8 animate-spin ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            Deleting Order...
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Header - Order ID and Type - Mobile Optimized */}
                    <div className={`p-3 sm:p-4 border-b-2 ${isDarkMode
                      ? 'border-gray-600/50 bg-gradient-to-r from-gray-700/50 to-gray-800/50'
                      : 'border-gray-200 bg-gradient-to-r from-blue-50/50 to-gray-50/50'
                      }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-lg sm:text-xl font-extrabold truncate ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                              }`}>
                              #{order.orderId ? getDisplayOrderId(order.orderId) : 'N/A'}
                            </h3>
                            <span className={`text-xs sm:text-sm px-2 py-0.5 sm:py-1 rounded-full font-semibold whitespace-nowrap ${isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                              }`}>
                              {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div className={`text-xs sm:text-sm font-medium ${order.orderType === 'Dying'
                            ? isDarkMode ? 'text-orange-400' : 'text-orange-600'
                            : isDarkMode ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                            {order.orderType || 'Not selected'}
                          </div>
                        </div>
                        {/* Status Buttons - Mobile Optimized */}
                        <div className="flex items-center gap-2 sm:gap-2">
                          <button
                            onClick={() => handleStatusChangeClick(order._id, 'pending', order.orderId)}
                            disabled={changingStatus}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center justify-center shadow-md hover-lift ${(order.status || 'pending') === 'pending'
                              ? isDarkMode
                                ? 'bg-blue-600 text-white shadow-blue-600/50 badge-pulse'
                                : 'bg-blue-600 text-white shadow-blue-600/30 badge-pulse'
                              : isDarkMode
                                ? 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 border border-gray-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                              } ${changingStatus ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                          >
                            Pending
                          </button>
                          <button
                            onClick={() => handleStatusChangeClick(order._id, 'delivered', order.orderId)}
                            disabled={changingStatus}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center justify-center shadow-md hover-lift ${order.status === 'delivered'
                              ? isDarkMode
                                ? 'bg-green-600 text-white shadow-green-600/50 badge-pulse'
                                : 'bg-green-600 text-white shadow-green-600/30 badge-pulse'
                              : isDarkMode
                                ? 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 border border-gray-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                              } ${changingStatus ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                          >
                            Delivered
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Order Details Section - Ultra Compact */}
                    <div className="p-1.5 sm:p-2 space-y-1.5">
                      {/* Complete Order Information - Ultra Compact Design */}
                      <div className={`p-1.5 sm:p-2 rounded border ${isDarkMode
                        ? 'bg-gray-700/10 border-gray-600/20'
                        : 'bg-gray-50/30 border-gray-200/30'
                        }`}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-1 sm:gap-1.5">
                          {/* All fields in ultra compact grid - No section header */}
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>PO</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {order.poNumber || '—'}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Style</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {order.styleNo || '—'}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Party</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {order.party && typeof order.party === 'object' ? order.party.name || '—' : order.party || '—'}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Contact</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {order.contactName || '—'}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Phone</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {order.contactPhone || '—'}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Arrival</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {formatDate(order.arrivalDate) === 'Not selected' ? '—' : formatDate(order.arrivalDate)}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>PO Date</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {formatDate(order.poDate) === 'Not selected' ? '—' : formatDate(order.poDate)}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded border ${isDarkMode ? 'bg-gray-800/20 border-gray-600/10' : 'bg-white/80 border-gray-200/40'
                            }`}>
                            <span className={`text-[8px] sm:text-[9px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Delivery</span>
                            <div className={`text-[10px] sm:text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {formatDate(order.deliveryDate) === 'Not selected' ? '—' : formatDate(order.deliveryDate)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Items Section - Responsive Grid Showing All Items */}
                      {order.items && order.items.length > 0 && (
                        <div className={`p-1.5 sm:p-2 rounded border ${isDarkMode
                          ? 'bg-gray-700/10 border-gray-600/20'
                          : 'bg-gray-50/30 border-gray-200/30'
                          }`}>
                          <div className={`text-[9px] sm:text-[10px] font-bold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Items ({order.items.length})
                          </div>

                          {/* Responsive Grid - All Items Visible - More Compact */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2">
                            {order.items.map((item, itemIndex) => (
                              <div key={itemIndex} className={`${isDarkMode ? 'bg-gray-800/30 border-gray-600/20' : 'bg-white/90 border-gray-200/60'
                                } rounded border shadow-sm overflow-hidden hover:shadow transition-shadow`}>
                                <div className="p-1.5 sm:p-2 space-y-1.5">
                                  {/* Item Image - Ultra Compact */}
                                  <div className="relative group">
                                    {item.imageUrls && item.imageUrls.length > 0 ? (
                                      <div className="relative w-full aspect-square rounded overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                                        <img
                                          src={item.imageUrls?.[0] || ''}
                                          alt={`Item ${itemIndex + 1}`}
                                          className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                                          onClick={() => {
                                            const imageUrls = item.imageUrls;
                                            if (imageUrls && imageUrls.length > 0) {
                                              handleImagePreview(imageUrls[0], `Item ${itemIndex + 1}`, imageUrls, 0);
                                            }
                                          }}
                                        />
                                        {item.imageUrls.length > 1 && (
                                          <div className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold shadow border border-white dark:border-gray-800">
                                            {item.imageUrls.length}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className={`w-full aspect-square rounded border flex items-center justify-center ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'
                                        }`}>
                                        <PhotoIcon className={`h-6 w-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                          }`} />
                                      </div>
                                    )}
                                  </div>

                                  {/* Item Details - All Data Ultra Compact Grid */}
                                  <div className="grid grid-cols-2 gap-1">
                                    {/* Quality */}
                                    <div className={`p-1 rounded border col-span-2 ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                      }`}>
                                      <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Quality</span>
                                      <div className={`text-[10px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {item.quality && typeof item.quality === 'object' ? item.quality.name || '—' : '—'}
                                      </div>
                                    </div>

                                    {/* Quantity */}
                                    <div className={`p-1 rounded border ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                      }`}>
                                      <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Qty</span>
                                      <div className={`text-[10px] font-extrabold mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                        {item.quantity || 0}
                                      </div>
                                    </div>

                                    {/* Description - if exists */}
                                    {item.description && (
                                      <div className={`p-1 rounded border col-span-2 ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                        }`}>
                                        <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Desc</span>
                                        <p className={`text-[9px] mt-0.5 line-clamp-1 truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                          {item.description}
                                        </p>
                                      </div>
                                    )}

                                    {/* Weaver/Supplier Name */}
                                    {item.weaverSupplierName && (
                                      <div className={`p-1 rounded border col-span-2 ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                        }`}>
                                        <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Weaver</span>
                                        <div className={`text-[10px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {item.weaverSupplierName}
                                        </div>
                                      </div>
                                    )}

                                    {/* Purchase Rate */}
                                    {item.purchaseRate && (
                                      <div className={`p-1 rounded border ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                        }`}>
                                        <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>P.Rate</span>
                                        <div className={`text-[9px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                          ₹{item.purchaseRate}
                                        </div>
                                      </div>
                                    )}

                                    {/* Mill Rate */}
                                    {item.millRate && (
                                      <div className={`p-1 rounded border ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                        }`}>
                                        <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>M.Rate</span>
                                        <div className={`text-[9px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                          ₹{item.millRate}
                                        </div>
                                      </div>
                                    )}

                                    {/* Sales Rate */}
                                    {item.salesRate && (
                                      <div className={`p-1 rounded border col-span-2 ${isDarkMode ? 'bg-gray-700/15 border-gray-600/15' : 'bg-gray-50/60 border-gray-200/40'
                                        }`}>
                                        <span className={`text-[8px] font-semibold uppercase block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>S.Rate</span>
                                        <div className={`text-[9px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                          ₹{item.salesRate}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Action Buttons - Ultra Compact */}
                                  <div className="flex gap-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                                    {/* PDF Download Button - Only show for non-users */}
                                    {!isUser && (
                                      <button
                                        onClick={() => handleDownloadItemPDF(order, item, itemIndex)}
                                        className={`flex-1 px-1.5 py-1 text-[9px] font-bold rounded transition-all duration-200 hover-lift active:scale-95 ${isDarkMode
                                          ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40'
                                          : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-500'
                                          }`}
                                        title="Generate PDF"
                                      >
                                        <DocumentArrowDownIcon className="h-2.5 w-2.5 inline mr-0.5" />
                                        PDF
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleDeleteItemClick(order._id, itemIndex, item.quality && typeof item.quality === 'object' ? item.quality.name || 'Item' : 'Item')}
                                      className={`flex-1 px-1.5 py-1 text-[9px] font-bold rounded transition-all duration-200 hover-lift active:scale-95 delete-button-hover ${isDarkMode
                                        ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40'
                                        : 'bg-red-600 text-white hover:bg-red-700 border border-red-500'
                                        }`}
                                      title="Delete item"
                                    >
                                      <TrashIcon className="h-2.5 w-2.5 inline mr-0.5" />
                                      Del
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - Mobile Optimized Grid */}
                    <div className={`p-3 sm:p-4 border-t-2 ${isDarkMode
                      ? 'border-gray-600/50 bg-gradient-to-br from-gray-700/30 to-gray-800/20'
                      : 'border-gray-200 bg-gradient-to-br from-gray-50/50 to-white'
                      }`}>
                      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
                        {/* Column 1: Add Grey Info, Add Mill Input, Mill Output, Dispatch */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            key={`grey-info-card-${order._id}-${forceRender}`}
                            onClick={() => handleGreyInfo(order)}
                            disabled={loadingGreyInfo === order._id}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleGreyInfo(order);
                              }
                            }}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-1.5 sm:gap-2 relative disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${isDarkMode
                              ? 'bg-gray-700/60 text-gray-200 border border-gray-600/50 hover:bg-gray-700 shadow-gray-900/20 focus:ring-offset-gray-800'
                              : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 shadow-gray-200/50 focus:ring-offset-white'
                              }`}
                            title={hasGreyInfo(order) ? "Edit Grey Information" : "Add Grey Information"}
                            aria-label={hasGreyInfo(order) ? "Edit Grey Information" : "Add Grey Information"}
                          >
                            {loadingGreyInfo === order._id ? (
                              <>
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <span className="truncate">Loading...</span>
                              </>
                            ) : (
                              <>
                                <DocumentTextIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{hasGreyInfo(order) ? "Edit Grey Info" : "Add Grey Info"}</span>
                              </>
                            )}
                            {/* Status indicator */}
                            {loadingGreyInfo !== order._id && (
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                } ${hasGreyInfo(order) ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-400'
                                }`} title={hasGreyInfo(order) ? "Data exists" : "No data"} />
                            )}
                          </button>

                          <button
                            key={`mill-input-card-${order._id}-${forceRender}`}
                            onClick={() => handleMillInput(order)}
                            disabled={loadingMillInput === order._id}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 relative ${isDarkMode
                              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/40 shadow-purple-900/20'
                              : 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 shadow-purple-200/50'
                              } ${loadingMillInput === order._id ? 'opacity-75 cursor-not-allowed' : ''}`}
                            title={hasMillInputs(order) ? "Edit Mill Input" : "Add Mill Input"}
                          >
                            {loadingMillInput === order._id ? (
                              <>
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <span className="truncate">Loading...</span>
                              </>
                            ) : (
                              <>
                                <CubeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{hasMillInputs(order) ? "Mill Input" : "Add Input"}</span>
                              </>
                            )}
                            {/* Status indicator */}
                            {loadingMillInput !== order._id && (
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                } ${hasMillInputs(order) ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-400'
                                }`} title={hasMillInputs(order) ? "Data exists" : "No data"} />
                            )}
                          </button>

                          <button
                            key={`mill-output-card-${order._id}-${forceRender}`}
                            onClick={() => handleMillOutput(order)}
                            disabled={loadingMillOutput === order._id}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 relative ${isDarkMode
                              ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40 hover:bg-teal-600/40 shadow-teal-900/20'
                              : 'bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200 shadow-teal-200/50'
                              } ${loadingMillOutput === order._id ? 'opacity-75 cursor-not-allowed' : ''}`}
                            title={hasMillOutputs(order) ? "Edit Mill Output" : "Add Mill Output"}
                          >
                            {loadingMillOutput === order._id ? (
                              <>
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <span className="truncate">Loading...</span>
                              </>
                            ) : (
                              <>
                                <DocumentTextIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{hasMillOutputs(order) ? "Mill Output" : "Add Output"}</span>
                              </>
                            )}
                            {/* Status indicator */}
                            {loadingMillOutput !== order._id && (
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                } ${hasMillOutputs(order) ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-400'
                                }`} title={hasMillOutputs(order) ? "Data exists" : "No data"} />
                            )}
                          </button>

                          <button
                            key={`dispatch-card-${order._id}-${forceRender}`}
                            onClick={() => handleDispatch(order)}
                            disabled={loadingDispatch === order._id}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 relative ${isDarkMode
                              ? 'bg-orange-600/30 text-orange-300 border border-orange-500/40 hover:bg-orange-600/40 shadow-orange-900/20'
                              : 'bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200 shadow-orange-200/50'
                              } ${loadingDispatch === order._id ? 'opacity-75 cursor-not-allowed' : ''}`}
                            title={hasDispatches(order) ? "Edit Dispatch" : "Add Dispatch"}
                          >
                            {loadingDispatch === order._id ? (
                              <>
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <span className="truncate">Loading...</span>
                              </>
                            ) : (
                              <>
                                <TruckIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{hasDispatches(order) ? "Dispatch" : "Add Dispatch"}</span>
                              </>
                            )}
                            {/* Status indicator */}
                            {loadingDispatch !== order._id && (
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                                } ${hasDispatches(order) ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-400'
                                }`} title={hasDispatches(order) ? "Data exists" : "No data"} />
                            )}
                          </button>
                        </div>

                        {/* Column 2: View Details, Edit, Lab Data, Delete, View Logs */}
                        <div className="space-y-2">
                          <button
                            onClick={() => handleView(order)}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 ${isDarkMode
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40 shadow-blue-900/20'
                              : 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200 shadow-blue-200/50'
                              }`}
                            title="View Order Details"
                          >
                            <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">View</span>
                          </button>

                          <button
                            onClick={() => handleEdit(order)}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 ${isDarkMode
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40 shadow-emerald-900/20'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 shadow-emerald-200/50'
                              }`}
                            title="Edit Order"
                          >
                            <PencilIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">Edit</span>
                          </button>

                          <button
                            key={`lab-card-${order._id}-${forceRender}`}
                            onClick={() => {
                              // ⚡ CRITICAL FIX: Always get the latest order from state to ensure lab data is current
                              // This ensures that even if order was updated, we use the latest version
                              const latestOrder = orders.find(o => o._id === order._id) || order;
                              setSelectedOrderForLabData(latestOrder);
                              setShowLabDataModal(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                // ⚡ CRITICAL FIX: Always get the latest order from state
                                const latestOrder = orders.find(o => o._id === order._id) || order;
                                setSelectedOrderForLabData(latestOrder);
                                setShowLabDataModal(true);
                              }
                            }}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 flex items-center justify-center gap-1.5 sm:gap-2 relative ${isDarkMode
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/40 shadow-amber-900/20 focus:ring-offset-gray-800'
                              : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 shadow-amber-200/50 focus:ring-offset-white'
                              }`}
                            title={hasLabData(order) ? "Edit Lab Data" : "Add Lab Data"}
                            aria-label={hasLabData(order) ? "Edit Lab Data" : "Add Lab Data"}
                          >
                            <BeakerIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{hasLabData(order) ? "Lab Data" : "Add Lab"}</span>
                            {/* Status indicator */}
                            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'
                              } ${hasLabData(order) ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-400'
                              }`} title={hasLabData(order) ? "Data exists" : "No data"} />
                          </button>

                          <button
                            onClick={() => handleDeleteClick(order)}
                            disabled={deletingOrderId === String(order._id)}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 delete-button-hover ${deletingOrderId === String(order._id)
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                              } ${isDarkMode
                                ? 'bg-red-600/30 text-red-300 border border-red-500/40 hover:bg-red-600/40 shadow-red-900/20'
                                : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200 shadow-red-200/50'
                              }`}
                            title={deletingOrderId === String(order._id) ? "Deleting..." : "Delete Order"}
                          >
                            {deletingOrderId === String(order._id) ? (
                              <>
                                <ArrowPathIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 animate-spin" />
                                <span className="truncate">Deleting...</span>
                              </>
                            ) : (
                              <>
                                <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">Delete</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleViewLogs(order)}
                            className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 hover-lift active:scale-95 shadow-md flex items-center justify-center gap-1.5 sm:gap-2 ${isDarkMode
                              ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40 hover:bg-violet-600/40 shadow-violet-900/20'
                              : 'bg-violet-100 text-violet-800 border border-violet-300 hover:bg-violet-200 shadow-violet-200/50'
                              }`}
                            title="View Logs"
                          >
                            <ChartBarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">Logs</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                  {/* Dark divider line between orders - bold */}
                  {orderIndex < ordersToDisplay.length - 1 && (
                    <div className={`h-1.5 w-full my-6 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-500'
                      }`} style={{
                        boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.2)'
                      }}></div>
                  )}
                </div>
              );
            })
          ) : !loading && !orderCreating && !tableLoading && !isChangingPage && !refreshing && !sortLoading && !filterLoading && !searchLoading && ordersLoaded && currentOrders.length === 0 && paginationInfo.totalCount === 0 && orders.length === 0 ? (
            /* Empty state message for card view */
            <div className={`rounded-2xl border-2 shadow-xl p-8 sm:p-12 text-center ${isDarkMode
              ? 'bg-gradient-to-br from-gray-800 via-gray-800/95 to-gray-800/90 border-gray-600/50'
              : 'bg-gradient-to-br from-white via-gray-50/50 to-white border-gray-200'
              }`}>
              <div className="flex flex-col items-center space-y-4">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                  <svg className={`w-8 h-8 sm:w-10 sm:h-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-lg sm:text-xl font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    No orders found
                  </h3>
                  <p className={`text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    {searchTerm || filters.status || filters.orderType || filters.millId || filters.startDate || filters.endDate
                      ? 'No orders match your current filters'
                      : 'Get started by creating your first order'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Card Layout Pagination removed - using top pagination only */}
          {false && (
            <div className={`mt-8 px-3 sm:px-4 py-2 sm:py-3 border-t flex justify-center items-center ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border-2 ${currentPage === 1 || isChangingPage || loading
                    ? isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'
                    : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                    }`}
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
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
                            className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                              ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                              : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
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
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border-2 ${currentPage === 1
                            ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                            : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
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
                              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                                ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                                : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {i}
                            </button>
                          );
                        }
                        pages.push(
                          <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ...
                          </span>
                        );
                      } else if (currentPage >= totalPages - 3) {
                        // Show: 1, ..., last-4, last-3, last-2, last-1, last
                        pages.push(
                          <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ...
                          </span>
                        );
                        for (let i = totalPages - 4; i <= totalPages; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => handlePageChange(i)}
                              disabled={isChangingPage || loading}
                              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                                ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                                : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {i}
                            </button>
                          );
                        }
                      } else {
                        // Show: 1, ..., current-1, current, current+1, ..., last
                        pages.push(
                          <span key="ellipsis1" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ...
                          </span>
                        );
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => handlePageChange(i)}
                              disabled={isChangingPage || loading}
                              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-200 border-2 ${currentPage === i
                                ? isDarkMode ? 'bg-blue-600 text-white shadow-lg border-blue-500' : 'bg-blue-500 text-white shadow-lg border-blue-400'
                                : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {i}
                            </button>
                          );
                        }
                        pages.push(
                          <span key="ellipsis2" className={`px-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                              ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                              : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
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
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border-2 ${currentPage === totalPages || isChangingPage || loading
                    ? isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'
                    : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-500 border-gray-600 shadow-md hover:shadow-lg' : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-400 shadow-md hover:shadow-lg'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Modals */}
      {showForm && (
        <OrderForm
          order={editingOrder}
          parties={formParties}
          qualities={formQualities}
          onRefreshQualities={fetchQualities}
          onFormOpen={() => {
            // Data is already loaded by openFormWithData
            // But refresh if needed - only fetch once, not in a loop
            if (formParties.length === 0) {
              loadPartiesData().then(data => {
                if (data && data.length > 0) {
                  setFormParties(data);
                }
              });
            }
            if (formQualities.length === 0) {
              loadQualitiesData().then(data => {
                if (data && data.length > 0) {
                  setFormQualities(data);
                }
              });
            }
          }}
          onClose={() => {
            setShowForm(false);
            setEditingOrder(null);
          }}
          onSuccess={async (updatedOrderData?: any) => {
            // ⚡ IMMEDIATE: Close modal first for instant feedback
            setShowForm(false);
            const wasEditing = !!editingOrder;
            const orderId = editingOrder?._id;
            setEditingOrder(null);
            setOrderCreating(false);

            // Update UI immediately without waiting
            if (updatedOrderData) {
              if (wasEditing && orderId) {
                // Update existing order in list
                setOrders(prevOrders =>
                  prevOrders.map(order => {
                    if (order._id === orderId || order._id?.toString() === orderId?.toString()) {
                      // ⚡ FIX: Preserve lab data from original order and merge with updated data
                      const originalLabData = order.labData || [];
                      const originalItemsWithLabData = order.items || [];

                      // ⚡ CRITICAL FIX: Create a comprehensive map of item IDs to their lab data
                      // This includes both _id and any temporary IDs that might be used
                      const itemLabDataMap = new Map();
                      originalItemsWithLabData.forEach((item: any) => {
                        if (item._id && item.labData) {
                          const itemId = item._id.toString();
                          itemLabDataMap.set(itemId, item.labData);
                          // Also store by any other possible ID formats
                          if (item._id._id) {
                            itemLabDataMap.set(item._id._id.toString(), item.labData);
                          }
                        }
                      });

                      // ⚡ CRITICAL FIX: Merge items with preserved lab data
                      // The API returns items with lab data attached, so prioritize that
                      // But also preserve lab data from original items as fallback
                      const mergedItems = (updatedOrderData.items || []).map((item: any, index: number) => {
                        const itemId = item._id?.toString();
                        // Try multiple ways to find preserved lab data
                        let preservedLabData = itemId ? itemLabDataMap.get(itemId) : null;

                        // If not found by ID, try to match by position (for cases where IDs might have changed)
                        if (!preservedLabData && index < originalItemsWithLabData.length) {
                          const originalItem = originalItemsWithLabData[index];
                          if (originalItem && originalItem.labData) {
                            preservedLabData = originalItem.labData;
                          }
                        }

                        // ⚡ CRITICAL: Use lab data from API response first (it's the latest)
                        // Only fall back to preserved lab data if API didn't return lab data
                        // Check if item.labData has actual data (not just empty structure)
                        const hasApiLabData = item.labData && (
                          item.labData.labSendDate ||
                          item.labData.approvalDate ||
                          item.labData.sampleNumber ||
                          item.labData.color ||
                          item.labData.shade
                        );

                        // ⚡ CRITICAL: Always preserve lab data - use API data if available, otherwise preserved, otherwise empty
                        const finalLabData = hasApiLabData ? item.labData : (preservedLabData || {
                          color: '',
                          shade: '',
                          notes: '',
                          labSendDate: null,
                          approvalDate: null,
                          sampleNumber: '',
                          imageUrl: '',
                          labSendNumber: '',
                          status: 'not_sent',
                          remarks: ''
                        });

                        return {
                          ...item,
                          quality: (item.quality && typeof item.quality === 'object')
                            ? item.quality
                            : (item.quality || null),
                          // ⚡ CRITICAL FIX: Always attach lab data (even if empty) to ensure it's preserved
                          labData: finalLabData
                        };
                      });

                      const updatedOrder = {
                        ...order,
                        ...updatedOrderData,
                        party: (updatedOrderData.party && typeof updatedOrderData.party === 'object')
                          ? updatedOrderData.party
                          : (updatedOrderData.party || order.party),
                        items: mergedItems,
                        // ⚡ FIX: Preserve lab data array from original order or use from updated data
                        labData: updatedOrderData.labData || originalLabData
                      };

                      // ⚡ CRITICAL FIX: Refresh lab data from API after order update to ensure it's always current
                      // This ensures that when user clicks Lab Data button, they see the latest lab data
                      // Use a longer delay to ensure the order update is fully complete
                      setTimeout(() => {
                        console.log('🔄 Refreshing lab data after order update for order:', orderId);
                        refreshOrderLabData(orderId).then(() => {
                          console.log('✅ Lab data refreshed successfully after order update');
                        }).catch(err => {
                          console.error('❌ Error refreshing lab data after order update:', err);
                        });
                      }, 1000); // Increased delay to ensure order update is fully complete

                      return updatedOrder;
                    }
                    return order;
                  })
                );

                // Update localStorage cache
                try {
                  const currentCache = localStorage.getItem('orders_cache');
                  if (currentCache) {
                    const cached = JSON.parse(currentCache);
                    if (cached.data && Array.isArray(cached.data)) {
                      cached.data = cached.data.map((order: any) =>
                        (order._id === orderId || order._id?.toString() === orderId?.toString())
                          ? updatedOrderData
                          : order
                      );
                      cached.timestamp = Date.now();
                      localStorage.setItem('orders_cache', JSON.stringify(cached));
                    }
                  }
                } catch (e) {
                  // Ignore localStorage errors
                }
              } else {
                // Add new order to the beginning of the list immediately
                setOrders(prevOrders => {
                  // Ensure prevOrders is an array
                  if (!Array.isArray(prevOrders)) {
                    return [updatedOrderData];
                  }

                  // Check if order already exists (avoid duplicates)
                  const exists = prevOrders.some(o =>
                    o._id === updatedOrderData._id ||
                    o._id?.toString() === updatedOrderData._id?.toString()
                  );
                  if (exists) {
                    // Update existing instead of adding duplicate
                    return prevOrders.map(order =>
                      (order._id === updatedOrderData._id || order._id?.toString() === updatedOrderData._id?.toString())
                        ? {
                          ...order,
                          ...updatedOrderData,
                          party: (updatedOrderData.party && typeof updatedOrderData.party === 'object')
                            ? updatedOrderData.party
                            : order.party,
                          items: updatedOrderData.items?.map((item: any) => ({
                            ...item,
                            quality: (item.quality && typeof item.quality === 'object')
                              ? item.quality
                              : item.quality
                          })) || updatedOrderData.items || order.items
                        }
                        : order
                    );
                  }
                  // Add new order and sort by createdAt (newest first)
                  const newOrders = [updatedOrderData, ...prevOrders];
                  return newOrders.sort((a, b) => {
                    const dateA = new Date(a.createdAt || 0).getTime();
                    const dateB = new Date(b.createdAt || 0).getTime();
                    return dateB - dateA; // Newest first
                  });
                });

                // Update pagination
                setPaginationInfo(prev => ({
                  ...prev,
                  totalCount: prev.totalCount + 1,
                  currentPage: 1
                }));

                // Update localStorage cache immediately
                try {
                  const currentCache = localStorage.getItem('orders_cache');
                  if (currentCache) {
                    const cached = JSON.parse(currentCache);
                    if (cached.data && Array.isArray(cached.data)) {
                      // Check if order already exists in cache
                      const existsInCache = cached.data.some((o: any) =>
                        o._id === updatedOrderData._id ||
                        o._id?.toString() === updatedOrderData._id?.toString()
                      );
                      if (!existsInCache) {
                        cached.data = [updatedOrderData, ...cached.data];
                        cached.timestamp = Date.now();
                        localStorage.setItem('orders_cache', JSON.stringify(cached));
                      }
                    }
                  } else {
                    // Create new cache entry
                    localStorage.setItem('orders_cache', JSON.stringify({
                      data: [updatedOrderData],
                      timestamp: Date.now()
                    }));
                  }
                } catch (e) {
                  // Ignore localStorage errors
                }

                // Go to page 1 to show the new order
                setCurrentPage(1);
              }
            }

            // Show success message
            showMessage('success', wasEditing ? 'Order updated successfully' : 'Order created successfully', {
              autoDismiss: true,
              dismissTime: 3000
            });

            // Trigger real-time update for Dashboard and Order Activity Log
            const event = new CustomEvent('orderUpdated', {
              detail: {
                orderId: updatedOrderData?._id || orderId,
                action: wasEditing ? 'order_update' : 'order_create',
                timestamp: new Date().toISOString()
              }
            });
            window.dispatchEvent(event);
          }}
          onError={async () => {
            setOrderCreating(false);
            // ⚡ FIX: Refresh data in case of partial updates, go to page 1
            await refreshOrdersWithRetry(2, true);
            // Don't close form on error, let user retry
          }}
          onStart={() => {
            setOrderCreating(true);
          }}
          onAddParty={() => {
            setShowPartyModal(true);
          }}
          onRefreshParties={fetchParties}
          onAddQuality={async (newQualityData?: any) => {
            if (newQualityData) {
              console.log('🎉 Adding new quality to state:', newQualityData);

              // ⚡ FIX: Clear ALL caches aggressively to ensure fresh data
              if (typeof window !== 'undefined') {
                try {
                  localStorage.removeItem('qualities_cache');
                  // Also clear any other quality-related caches
                  Object.keys(localStorage).forEach(key => {
                    if (key.includes('quality') || key.includes('qualities')) {
                      localStorage.removeItem(key);
                    }
                  });
                  console.log('🗑️ Cleared all qualities caches from localStorage');
                } catch (e) {
                  console.error('Failed to clear qualities cache:', e);
                }
              }
              // Clear in-memory cache
              if (dataCache.current.qualities) {
                dataCache.current.qualities = null;
                console.log('🗑️ Cleared in-memory qualities cache');
              }

              // ⚡ IMMEDIATE UI UPDATE: Add to both states for instant UI update
              setQualities(prev => {
                const exists = prev.some(q => {
                  const qId = q._id || (q as any).id || '';
                  const newId = newQualityData._id || newQualityData.id || '';
                  return qId === newId || qId?.toString() === newId?.toString();
                });
                if (exists) {
                  return prev.map(q => {
                    const qId = q._id || (q as any).id || '';
                    const newId = newQualityData._id || newQualityData.id || '';
                    return (qId === newId || qId?.toString() === newId?.toString())
                      ? { ...q, ...newQualityData }
                      : q;
                  });
                }
                const updated = [newQualityData, ...prev];
                console.log('📊 Qualities updated:', updated.length);
                return updated;
              });

              setFormQualities(prev => {
                const exists = prev.some(q => {
                  const qId = q._id || (q as any).id || '';
                  const newId = newQualityData._id || newQualityData.id || '';
                  return qId === newId || qId?.toString() === newId?.toString();
                });
                if (exists) {
                  return prev.map(q => {
                    const qId = q._id || (q as any).id || '';
                    const newId = newQualityData._id || newQualityData.id || '';
                    return (qId === newId || qId?.toString() === newId?.toString())
                      ? { ...q, ...newQualityData }
                      : q;
                  });
                }
                const updated = [newQualityData, ...prev];
                console.log('📊 FormQualities updated:', updated.length);
                return updated;
              });

              // ⚡ CRITICAL: Force re-render of all modals to ensure they pick up the new quality
              setForceRender(prev => prev + 1);

              // ⚡ FIX: Clear ALL caches aggressively before broadcasting event
              if (typeof window !== 'undefined') {
                try {
                  // Clear localStorage cache
                  localStorage.removeItem('qualities_cache');
                  // Clear all quality-related caches
                  Object.keys(localStorage).forEach(key => {
                    if (key.includes('quality') || key.includes('qualities')) {
                      localStorage.removeItem(key);
                    }
                  });
                  // Clear process-data-cache quality data
                  try {
                    const processCache = localStorage.getItem('process-data-cache');
                    if (processCache) {
                      const cacheData = JSON.parse(processCache);
                      // Don't delete entire cache, just mark as stale
                      cacheData.qualitiesTimestamp = 0;
                      localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
                    }
                  } catch (e) { }
                  console.log('🗑️ Cleared ALL quality caches before dispatching event');
                } catch (e) {
                  console.error('Error clearing caches:', e);
                }
              }

              // ⚡ FIX: Broadcast event MULTIPLE times to ensure all components catch it
              // Some components might miss the first event due to timing
              if (typeof window !== 'undefined') {
                // Dispatch immediately
                window.dispatchEvent(new CustomEvent('qualityAdded', {
                  detail: { quality: newQualityData }
                }));
                console.log('📢 Dispatched qualityAdded event (1st time) for:', newQualityData.name);

                // Dispatch again after a short delay to catch any components that weren't ready
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('qualityAdded', {
                    detail: { quality: newQualityData }
                  }));
                  console.log('📢 Dispatched qualityAdded event (2nd time) for:', newQualityData.name);
                }, 50);

                // Dispatch a third time after another delay
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('qualityAdded', {
                    detail: { quality: newQualityData }
                  }));
                  console.log('📢 Dispatched qualityAdded event (3rd time) for:', newQualityData.name);
                }, 150);
              }

              // ⚡ FIX: Trigger a background refresh to ensure everything is synced
              // This ensures the dropdown always has the latest data from server
              setTimeout(async () => {
                try {
                  await fetchQualities(true, true); // Force refresh and update form state
                  // Force another re-render after server refresh
                  setForceRender(prev => prev + 1);

                  // ⚡ FIX: Dispatch another event after refresh to ensure all modals get updated
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('qualitiesRefreshed', {
                      detail: { timestamp: Date.now() }
                    }));
                    // Also dispatch qualityAdded again after refresh
                    window.dispatchEvent(new CustomEvent('qualityAdded', {
                      detail: { quality: newQualityData }
                    }));
                  }

                  console.log('✅ Background refresh completed after adding quality');
                } catch (err) {
                  console.error('Error in background refresh:', err);
                }
              }, 300);

              // ⚡ CRITICAL: DO NOT call router.refresh() - it causes full page refresh and data loss
              // State is already updated immediately above, no need for page refresh

              console.log('✅ Quality added to local state immediately');
            } else {
              // Refresh from server
              console.log('🔄 Refreshing qualities from server...');
              await fetchQualities(true, true);
            }
          }}
          onRemoveParty={(partyId: string) => {
            console.log('🔄 onRemoveParty called with ID:', partyId);
            console.log('📊 Current parties count:', parties.length);
            console.log('📊 Current formParties count:', formParties.length);

            // ⚡ FIX: Clear localStorage cache FIRST to prevent stale data
            try {
              localStorage.removeItem('parties_cache');
              console.log('🗑️ Cleared parties_cache from localStorage');
            } catch (e) {
              console.error('Failed to clear parties cache:', e);
            }

            // Clear dataCache
            if (dataCache.current.parties) {
              dataCache.current.parties = null;
            }

            // Immediately remove from both main and form states (handle both _id and id fields)
            setParties(prev => {
              const filtered = prev.filter(party => {
                const partyIdFromItem = party._id || (party as any).id || '';
                return String(partyIdFromItem) !== String(partyId);
              });
              console.log('📊 Parties after filter:', filtered.length);
              return filtered;
            });
            setFormParties(prev => {
              const filtered = prev.filter(party => {
                const partyIdFromItem = party._id || (party as any).id || '';
                return String(partyIdFromItem) !== String(partyId);
              });
              console.log('📊 FormParties after filter:', filtered.length);
              return filtered;
            });

            // Clear recently added party if it was the deleted one
            if (recentlyAddedPartyId === partyId) {
              setRecentlyAddedPartyId(null);
              console.log('🔄 Cleared recently added party ID');
            }

            // ⚡ FIX: Refresh from server with cache bypass to ensure fresh data
            fetchParties(true).then(() => {
              console.log('✅ Parties refreshed from server after deletion');
            }).catch(error => {
              console.error('❌ Failed to refresh parties after deletion:', error);
            });
          }}
          onRemoveQuality={async (qualityId: string) => {
            console.log('🔄 onRemoveQuality called with ID:', qualityId);
            console.log('📊 Current qualities count:', qualities.length);
            console.log('📊 Current formQualities count:', formQualities.length);

            // ⚡ FIX: Only clear cache and remove from state if deletion was successful
            // This function is called AFTER successful deletion, so proceed with cleanup

            // ⚡ FIX: Clear localStorage cache to prevent stale data
            try {
              localStorage.removeItem('qualities_cache');
              console.log('🗑️ Cleared qualities_cache from localStorage');
            } catch (e) {
              console.error('Failed to clear qualities cache:', e);
            }

            // Clear dataCache
            if (dataCache.current.qualities) {
              dataCache.current.qualities = null;
            }

            // ⚡ IMMEDIATE: Remove from both main and form states (handle both _id and id fields)
            setQualities(prev => {
              const filtered = prev.filter(quality => {
                const qualityIdFromItem = quality._id || (quality as any).id || '';
                return String(qualityIdFromItem) !== String(qualityId);
              });
              console.log('📊 Qualities after filter:', filtered.length);
              return filtered;
            });
            setFormQualities(prev => {
              const filtered = prev.filter(quality => {
                const qualityIdFromItem = quality._id || (quality as any).id || '';
                return String(qualityIdFromItem) !== String(qualityId);
              });
              console.log('📊 FormQualities after filter:', filtered.length);
              return filtered;
            });

            // Clear recently added quality if it was the deleted one
            if (recentlyAddedQualityId === qualityId) {
              setRecentlyAddedQualityId(null);
              console.log('🔄 Cleared recently added quality ID');
            }

            // ⚡ IMMEDIATE: Force re-render to update all dropdowns immediately
            setForceRender(prev => prev + 1);

            // ⚡ FIX: Refresh from server with cache bypass to ensure fresh data (in background)
            // Don't wait for this - UI is already updated above
            fetchQualities(true, true)
              .then(() => {
                console.log('✅ Qualities refreshed from server after deletion');
                // Force another re-render after server refresh to ensure consistency
                setForceRender(prev => prev + 1);
              })
              .catch(error => {
                console.error('❌ Failed to refresh qualities after deletion:', error);
              });
          }}
          onSetRecentlyAddedParty={setRecentlyAddedPartyId}
          onSetRecentlyAddedQuality={setRecentlyAddedQualityId}
        />
      )}

      {showPartyModal && (
        <PartyModal
          onClose={() => setShowPartyModal(false)}
          onSuccess={async (newPartyData?: any) => {
            // ⚡ IMMEDIATE: Update state immediately before closing modal
            if (newPartyData) {
              console.log('🎉 Party modal success - adding to state:', newPartyData);

              // Immediately add to both main and form states
              setParties(prev => {
                const exists = prev.some(p => {
                  const pId = p._id || (p as any).id || '';
                  const newId = newPartyData._id || newPartyData.id || '';
                  return pId === newId || pId?.toString() === newId?.toString();
                });
                if (exists) {
                  return prev.map(p => {
                    const pId = p._id || (p as any).id || '';
                    const newId = newPartyData._id || newPartyData.id || '';
                    return (pId === newId || pId?.toString() === newId?.toString())
                      ? { ...p, ...newPartyData }
                      : p;
                  });
                }
                const updated = [newPartyData, ...prev];
                console.log('📊 Main parties updated:', updated.length);
                return updated;
              });

              setFormParties(prev => {
                const exists = prev.some(p => {
                  const pId = p._id || (p as any).id || '';
                  const newId = newPartyData._id || newPartyData.id || '';
                  return pId === newId || pId?.toString() === newId?.toString();
                });
                if (exists) {
                  return prev.map(p => {
                    const pId = p._id || (p as any).id || '';
                    const newId = newPartyData._id || newPartyData.id || '';
                    return (pId === newId || pId?.toString() === newId?.toString())
                      ? { ...p, ...newPartyData }
                      : p;
                  });
                }
                const updated = [newPartyData, ...prev];
                console.log('📊 FormParties updated:', updated.length);
                return updated;
              });

              // Clear cache to ensure fresh data
              if (typeof window !== 'undefined') {
                localStorage.removeItem('parties_cache');
              }

              // Set the recently added party ID for auto-selection
              setRecentlyAddedPartyId(newPartyData._id || newPartyData.id);

              console.log('✅ Party added to local state immediately');

              // ⚡ CRITICAL: DO NOT call router.refresh() - it causes full page refresh and data loss
              // State is already updated immediately above, no need for page refresh

              // Refresh parties from API in background with force refresh to ensure consistency
              fetchParties(true).catch(error => {
                console.error('Background parties refresh error (non-blocking):', error);
              });
            }

            setShowPartyModal(false);
          }}
        />
      )}

      {showQualityModal && (
        <QualityModal
          onClose={() => setShowQualityModal(false)}
          onSuccess={async (newQualityName?: string, newQualityData?: any) => {
            setShowQualityModal(false);

            // ⚡ IMMEDIATE UI UPDATE: Update UI instantly without waiting for refresh
            if (newQualityData) {
              console.log('🎉 Quality modal success - adding to state:', newQualityData);

              // Check if quality already exists (avoid duplicates)
              setQualities(prev => {
                const exists = prev.some(q => {
                  const qId = q._id || (q as any).id || '';
                  const newId = newQualityData._id || newQualityData.id || '';
                  return qId === newId || qId?.toString() === newId?.toString();
                });
                if (exists) {
                  // Update existing instead of adding duplicate
                  return prev.map(q => {
                    const qId = q._id || (q as any).id || '';
                    const newId = newQualityData._id || newQualityData.id || '';
                    return (qId === newId || qId?.toString() === newId?.toString())
                      ? { ...q, ...newQualityData }
                      : q;
                  });
                }
                // Add new quality at the beginning for immediate visibility
                const updated = [newQualityData, ...prev];
                console.log('📊 Main qualities updated:', updated.length);
                return updated;
              });

              setFormQualities(prev => {
                const exists = prev.some(q => {
                  const qId = q._id || (q as any).id || '';
                  const newId = newQualityData._id || newQualityData.id || '';
                  return qId === newId || qId?.toString() === newId?.toString();
                });
                if (exists) {
                  return prev.map(q => {
                    const qId = q._id || (q as any).id || '';
                    const newId = newQualityData._id || newQualityData.id || '';
                    return (qId === newId || qId?.toString() === newId?.toString())
                      ? { ...q, ...newQualityData }
                      : q;
                  });
                }
                const updated = [newQualityData, ...prev];
                console.log('📊 Form qualities updated:', updated.length);
                return updated;
              });

              // Set the recently added quality ID for auto-selection
              setRecentlyAddedQualityId(newQualityData._id || newQualityData.id);
              console.log('✅ Quality added to local state immediately:', newQualityData.name);

              // Clear cache to ensure fresh data
              if (typeof window !== 'undefined') {
                localStorage.removeItem('qualities_cache');
              }

              // ⚡ CRITICAL: DO NOT call router.refresh() - it causes full page refresh and data loss
              // State is already updated immediately above, no need for page refresh

              // Refresh qualities from API in background with force refresh to ensure consistency
              fetchQualities(true).then(() => {
                console.log('✅ Qualities refreshed from server');
              }).catch(error => {
                console.error('❌ Failed to refresh qualities:', error);
              });
            }
          }}
        />
      )}

      {showMillModal && (
        <MillModal
          onClose={() => setShowMillModal(false)}
          onSuccess={async (newMillData?: any) => {
            setShowMillModal(false);

            // ⚡ IMMEDIATE UI UPDATE: Update UI instantly without waiting for refresh
            if (newMillData) {
              console.log('🎉 Mill modal success - adding to state:', newMillData);

              // ⚡ FIX: Clear all caches first to ensure fresh data
              if (typeof window !== 'undefined') {
                try {
                  localStorage.removeItem('mills_cache');
                  console.log('🗑️ Cleared mills_cache from localStorage');
                } catch (e) {
                  console.error('Failed to clear mills cache:', e);
                }
              }

              // Clear dataCache
              if (dataCache.current.mills) {
                dataCache.current.mills = null;
              }

              // Check if mill already exists (avoid duplicates)
              setMills(prev => {
                const exists = prev.some(m => {
                  const mId = m._id || (m as any).id || '';
                  const newId = newMillData._id || newMillData.id || '';
                  return mId === newId || mId?.toString() === newId?.toString();
                });
                if (exists) {
                  // Update existing instead of adding duplicate
                  return prev.map(m => {
                    const mId = m._id || (m as any).id || '';
                    const newId = newMillData._id || newMillData.id || '';
                    return (mId === newId || mId?.toString() === newId?.toString())
                      ? { ...m, ...newMillData }
                      : m;
                  });
                }
                // Add new mill at the beginning for immediate visibility
                const updated = [newMillData, ...prev];
                console.log('📊 Mills updated:', updated.length);
                return updated;
              });

              console.log('✅ Mill added to local state immediately:', newMillData.name);
            }

            // ⚡ FIX: Removed router.refresh() - it causes full page reload
            // State updates and fetchMills() are sufficient for UI updates

            // Refresh mills from API in background with force refresh to ensure consistency
            fetchMills().then(() => {
              console.log('✅ Mills refreshed from server');
            }).catch(error => {
              console.error('❌ Failed to refresh mills:', error);
            });
          }}
        />
      )}

      {showLabAddModal && selectedOrderForLab && (
        <LabAddModal
          isOpen={showLabAddModal}
          order={selectedOrderForLab}
          onClose={() => {
            setShowLabAddModal(false);
            setSelectedOrderForLab(null);
          }}
          onLabDataUpdate={async (operationType?: 'add' | 'edit' | 'delete' | 'deleteAll') => {
            const orderId = selectedOrderForLab?._id;

            if (orderId) {
              console.log('🔄 Lab data update:', operationType, 'for order:', orderId);

              // Immediate UI update based on operation type
              setOrders(prevOrders =>
                prevOrders.map(order => {
                  if (order._id === orderId) {
                    const updatedOrder = { ...order };

                    if (operationType === 'delete' || operationType === 'deleteAll') {
                      // Remove lab data from all items
                      updatedOrder.items = updatedOrder.items.map(item => ({
                        ...item,
                        labData: undefined
                      }));
                      // Clear labData array
                      updatedOrder.labData = [];
                      console.log('🗑️ Lab data cleared for order:', orderId, 'updatedOrder.labData:', updatedOrder.labData, 'items with labData:', updatedOrder.items.filter(item => item.labData).length);

                      // ⚡ FIX: Clear localStorage cache for lab data
                      if (orderId) {
                        localStorage.removeItem(`lab_data_${orderId}`);
                        // Also clear process-data-cache
                        try {
                          const processDataCache = localStorage.getItem('process-data-cache');
                          if (processDataCache) {
                            const processCacheData = JSON.parse(processDataCache);
                            if (processCacheData.labData) {
                              delete processCacheData.labData[orderId];
                              delete processCacheData.labData[String(orderId)];
                              localStorage.setItem('process-data-cache', JSON.stringify(processCacheData));
                            }
                          }
                        } catch (e) { }
                      }
                    } else if (operationType === 'add' || operationType === 'edit') {
                      // Mark as having lab data (will be updated with real data from API)
                      updatedOrder.labData = [{ _id: 'temp', order: orderId, createdAt: new Date() }];
                      // Also mark items as having lab data for immediate UI update
                      updatedOrder.items = updatedOrder.items.map(item => ({
                        ...item,
                        labData: item.labData || {
                          labSendDate: new Date().toISOString().split('T')[0],
                          sampleNumber: '',
                          approvalDate: ''
                        }
                      }));
                    }

                    return updatedOrder;
                  }
                  return order;
                })
              );

              // Force re-render to update button text immediately
              setForceRender(prev => {
                const newValue = prev + 1;
                console.log('🔄 Force render triggered for lab data:', operationType, 'new value:', newValue);
                return newValue;
              });

              // Refresh lab data in background to get the latest state
              setTimeout(() => {
                refreshOrderLabData(orderId);
              }, 1000); // 1 second delay to allow the modal to close
            }

            setShowLabAddModal(false);
            setSelectedOrderForLab(null);
            showMessage('success', 'Lab data added successfully');

            console.log('Lab data button state updated for order:', orderId);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && orderToDelete && (
        <div className={`fixed inset-0 backdrop-blur-md bg-black/60 bg-opacity-50 flex items-center justify-center z-50 p-4 ${isDeleteModalClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
          <div className={`relative w-full max-w-md mx-auto ${isDarkMode ? 'bg-[#1D293D]' : 'bg-white'} rounded-lg shadow-xl ${isDeleteModalClosing ? 'modal-exit' : 'modal-enter'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <ExclamationTriangleIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Delete Order
                </h3>
              </div>
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className={`p-1 rounded-full transition-all duration-200 close-button-hover hover:scale-110 active:scale-95 ${isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                Are you sure you want to delete this order? This action cannot be undone.
              </p>

              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Order ID:
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {getDisplayOrderId(orderToDelete.orderId)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Type:
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {orderToDelete.orderType}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Items:
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {orderToDelete.items.length} item(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end space-x-3 p-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isDarkMode
                  ? 'text-gray-300 bg-white/10 hover:bg-white/20 disabled:opacity-50'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 ${deleting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
              >
                {deleting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusConfirmModal && statusChangeData && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/60 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`relative w-full max-w-md mx-auto ${isDarkMode ? 'bg-[#1D293D]' : 'bg-white'} rounded-lg shadow-xl`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${statusChangeData.newStatus === 'delivered'
                  ? isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                  : isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                  }`}>
                  <CheckIcon className={`h-6 w-6 ${statusChangeData.newStatus === 'delivered'
                    ? isDarkMode ? 'text-green-400' : 'text-green-600'
                    : isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Change Order Status
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsStatusModalClosing(true);
                  setTimeout(() => {
                    setShowStatusConfirmModal(false);
                    setIsStatusModalClosing(false);
                    setStatusChangeData(null);
                  }, 200);
                }}
                className={`p-1 rounded-full transition-all duration-200 close-button-hover hover:scale-110 active:scale-95 ${isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                Are you sure you want to change the status of this order?
              </p>

              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Order ID:
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {statusChangeData.orderIdDisplay}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    New Status:
                  </span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${statusChangeData.newStatus === 'delivered'
                    ? isDarkMode ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                    : isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
                    }`}>
                    {statusChangeData.newStatus.charAt(0).toUpperCase() + statusChangeData.newStatus.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end space-x-3 p-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setIsStatusModalClosing(true);
                  setTimeout(() => {
                    setShowStatusConfirmModal(false);
                    setIsStatusModalClosing(false);
                    setStatusChangeData(null);
                  }, 200);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isDarkMode
                  ? 'text-gray-300 bg-white/10 hover:bg-white/20'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 ${statusChangeData.newStatus === 'delivered'
                  ? isDarkMode
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                  : isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                <CheckIcon className="h-4 w-4" />
                <span>Update Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Delete Confirmation Modal */}
      {showItemDeleteModal && itemToDelete && (
        <div className={`fixed inset-0 backdrop-blur-md bg-black/60 bg-opacity-50 flex items-center justify-center z-50 p-4 ${isItemDeleteModalClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
          <div className={`relative w-full max-w-md mx-auto ${isDarkMode ? 'bg-[#1D293D]' : 'bg-white'} rounded-lg shadow-xl ${isItemDeleteModalClosing ? 'modal-exit' : 'modal-enter'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <ExclamationTriangleIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Delete Item
                </h3>
              </div>
              <button
                onClick={handleItemDeleteCancel}
                disabled={deletingItem}
                className={`p-1 rounded-full transition-all duration-200 close-button-hover hover:scale-110 active:scale-95 ${isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Are you sure you want to delete this item? This action cannot be undone.
                </p>

                <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Item:
                    </span>
                    <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {itemToDelete.itemName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end space-x-3 p-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={handleItemDeleteCancel}
                disabled={deletingItem}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isDarkMode
                  ? 'text-gray-300 bg-white/10 hover:bg-white/20 disabled:opacity-50'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleItemDeleteConfirm}
                disabled={deletingItem}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 ${isDarkMode
                  ? 'text-white bg-red-600 hover:bg-red-700 disabled:opacity-50'
                  : 'text-white bg-red-600 hover:bg-red-700 disabled:opacity-50'
                  }`}
              >
                {deletingItem ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete Item</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset ID Confirmation Modal */}
      {showResetIdModal && (
        <div className={`fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 ${isResetIdModalClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
          <div className={`w-full max-w-md sm:max-w-lg rounded-xl sm:rounded-2xl shadow-2xl ${isResetIdModalClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
            } overflow-hidden`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className={`p-1.5 sm:p-2 rounded-full ${isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                  <ExclamationTriangleIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <h3 className={`text-base sm:text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Reset Order ID Sequence
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsResetIdModalClosing(true);
                  setTimeout(() => {
                    setShowResetIdModal(false);
                    setIsResetIdModalClosing(false);
                  }, 200);
                }}
                disabled={resettingCounter}
                className={`p-1 rounded-full transition-all duration-200 close-button-hover hover:scale-110 active:scale-95 ${isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Renumber all orders sequentially to fill gaps. <strong className="text-green-600 dark:text-green-400">No orders will be deleted - all data stays safe!</strong>
              </p>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end space-x-2 sm:space-x-3 p-4 sm:p-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setIsResetIdModalClosing(true);
                  setTimeout(() => {
                    setShowResetIdModal(false);
                    setIsResetIdModalClosing(false);
                  }, 200);
                }}
                disabled={resettingCounter}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-300 ${isDarkMode
                  ? 'text-gray-300 bg-white/10 hover:bg-white/20 disabled:opacity-50'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleResetIdConfirm}
                disabled={resettingCounter}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-300 flex items-center space-x-1.5 sm:space-x-2 ${resettingCounter
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
              >
                {resettingCounter ? (
                  <>
                    <ArrowPathIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Orders Confirmation Modal */}
      {showDeleteAllModal && (
        <div className={`fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 ${isDeleteAllModalClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDeleteAllModalClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
            } overflow-hidden`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <ExclamationTriangleIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Delete All Orders
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsDeleteAllModalClosing(true);
                  setTimeout(() => {
                    setShowDeleteAllModal(false);
                    setIsDeleteAllModalClosing(false);
                  }, 200);
                }}
                disabled={deletingAll}
                className={`p-1 rounded-full transition-all duration-200 close-button-hover hover:scale-110 active:scale-95 ${isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                Are you sure you want to delete <strong>ALL orders</strong>? This action cannot be undone and will permanently remove all order data, including all related data (lab data, grey information, mill inputs, mill outputs, and dispatch data).
              </p>

              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center space-x-2">
                  <ExclamationTriangleIcon className={`h-5 w-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                    Warning: This will delete ALL orders and ALL related data (lab data, grey information, mill inputs, mill outputs, dispatch data) and reset the counter to 0
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end space-x-3 p-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setIsDeleteAllModalClosing(true);
                  setTimeout(() => {
                    setShowDeleteAllModal(false);
                    setIsDeleteAllModalClosing(false);
                  }, 200);
                }}
                disabled={deletingAll}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isDarkMode
                  ? 'text-gray-300 bg-white/10 hover:bg-white/20 disabled:opacity-50'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllOrders}
                disabled={deletingAll}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 ${deletingAll
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
              >
                {deletingAll ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Deleting All...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete All Orders</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImagePreview && previewImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-enter">
          <div
            className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            {/* Action Buttons */}
            <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
              {/* Download Button */}
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewImage.url;
                  link.download = `image-${currentImageIndex + 1}.jpg`;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg"
                title="Download Image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>

              {/* Open in New Tab Button */}
              <button
                onClick={() => {
                  window.open(previewImage.url, '_blank');
                }}
                className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg"
                title="Open in New Tab"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowImagePreview(false);
                  setPreviewImages([]);
                  setCurrentImageIndex(0);
                  setPreviewImage(null);
                  setImageSlideDirection(null);
                }}
                className="p-2.5 bg-black/70 text-white rounded-full hover:bg-black/90 transition-all duration-200 close-button-hover hover:scale-110 active:scale-95 shadow-lg"
                title="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Navigation Buttons - Only show if multiple images */}
            {previewImages.length > 1 && (
              <>
                {/* Previous Button */}
                <button
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Next Button */}
                <button
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Image with slide animation */}
            <img
              key={currentImageIndex}
              src={previewImage.url}
              alt={previewImage.alt}
              className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${imageSlideDirection === 'left' ? 'image-slide-left' :
                imageSlideDirection === 'right' ? 'image-slide-right' :
                  'image-fade-in'
                }`}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />

            {/* Image Info with Navigation */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded-lg backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{previewImage.alt}</p>
                {previewImages.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">
                      {currentImageIndex + 1} of {previewImages.length}
                    </span>
                    {/* Image Dots Indicator */}
                    <div className="flex gap-1">
                      {previewImages.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-all duration-200 ${index === currentImageIndex
                            ? 'bg-white'
                            : 'bg-white/40'
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Logs Modal */}
      {showLogsModal && selectedOrderForLogs && (
        <OrderLogsModal
          orderId={selectedOrderForLogs._id}
          orderNumber={selectedOrderForLogs.orderId}
          onClose={() => {
            setShowLogsModal(false);
            setSelectedOrderForLogs(null);
          }}
        />
      )}

      {/* Lab Data Modal */}
      {showLabDataModal && selectedOrderForLabData && (
        <LabDataModal
          isOpen={showLabDataModal}
          onClose={() => {
            setShowLabDataModal(false);
            setSelectedOrderForLabData(null);
          }}
          order={(() => {
            // ⚡ CRITICAL FIX: Always get the latest order from state to ensure lab data is current
            // This ensures that even if order was updated, we pass the latest version to the modal
            const latestOrder = orders.find(o => o._id === selectedOrderForLabData?._id);
            return latestOrder || selectedOrderForLabData;
          })()} //@ts-ignore  
          onLabDataUpdate={async (operationType?: 'add' | 'edit' | 'delete' | 'deleteAll') => {
            const orderId = selectedOrderForLabData?._id;

            if (orderId) {
              console.log('🔄 Lab data update (view):', operationType, 'for order:', orderId);

              // Immediate UI update based on operation type
              setOrders(prevOrders =>
                prevOrders.map(order => {
                  if (order._id === orderId) {
                    const updatedOrder = { ...order };

                    if (operationType === 'delete' || operationType === 'deleteAll') {
                      // Remove lab data from all items
                      updatedOrder.items = updatedOrder.items.map(item => ({
                        ...item,
                        labData: undefined
                      }));
                      // Clear labData array
                      updatedOrder.labData = [];

                      // ⚡ FIX: Clear localStorage cache for lab data
                      if (orderId) {
                        localStorage.removeItem(`lab_data_${orderId}`);
                        // Also clear process-data-cache
                        try {
                          const processDataCache = localStorage.getItem('process-data-cache');
                          if (processDataCache) {
                            const processCacheData = JSON.parse(processDataCache);
                            if (processCacheData.labData) {
                              delete processCacheData.labData[orderId];
                              delete processCacheData.labData[String(orderId)];
                              localStorage.setItem('process-data-cache', JSON.stringify(processCacheData));
                            }
                          }
                        } catch (e) { }
                      }
                    } else if (operationType === 'add' || operationType === 'edit') {
                      // Mark as having lab data (will be updated with real data from API)
                      updatedOrder.labData = [{ _id: 'temp', order: orderId, createdAt: new Date() }];
                      // Also mark items as having lab data for immediate UI update
                      updatedOrder.items = updatedOrder.items.map(item => ({
                        ...item,
                        labData: item.labData || {
                          labSendDate: new Date().toISOString().split('T')[0],
                          sampleNumber: '',
                          approvalDate: ''
                        }
                      }));
                    }

                    return updatedOrder;
                  }
                  return order;
                })
              );

              // Force re-render to update button text immediately
              setForceRender(prev => {
                const newValue = prev + 1;
                console.log('🔄 Force render triggered for lab data (view):', operationType, 'new value:', newValue);
                return newValue;
              });

              // Trigger real-time update for Order Activity Log
              const event = new CustomEvent('orderUpdated', {
                detail: {
                  orderId: orderId,
                  action: operationType === 'delete' || operationType === 'deleteAll' ? 'lab_delete' : (operationType === 'edit' ? 'lab_update' : 'lab_create'),
                  timestamp: new Date().toISOString()
                }
              });
              window.dispatchEvent(event);

              // Refresh lab data in background to get the latest state
              setTimeout(() => {
                refreshOrderLabData(orderId);
              }, 1000); // 1 second delay to allow the modal to close
            }

            showMessage('success', 'Lab data updated successfully!');

            console.log('Lab data button state updated for order:', orderId);
          }}
        />
      )}

      {/* Mill Input Form */}
      {showMillInputForm && selectedOrderForMillInputForm && (() => {
        return (
          <MillInputForm
            key={`mill-input-form-${selectedOrderForMillInputForm.orderId}-${forceRender}`}
            order={selectedOrderForMillInputForm}
            mills={filters.millId ? mills.filter(m => m._id === filters.millId) : mills}
            qualities={qualities}
            isOpen={showMillInputForm}
            isEditing={isEditingMillInput}
            existingMillInputs={existingMillInputs}
            onRefreshQualities={fetchQualities}
            onClose={() => {
              setShowMillInputForm(false);
              setSelectedOrderForMillInputForm(null);
              setIsEditingMillInput(false);
              setExistingMillInputs([]);
              setLoadingMillInput(null); // Clear loading state
              // Clear cache when closing
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('millInputFormCache');
                window.localStorage.removeItem('millInputFormData');
              }
            }}
            onSuccess={async (operationType?: 'add' | 'edit' | 'delete') => {
              const orderId = selectedOrderForMillInputForm?.orderId;

              if (orderId) {
                // Immediate UI update based on operation type
                setOrders(prevOrders =>
                  prevOrders.map(order => {
                    if (order.orderId === orderId) {
                      const updatedOrder = { ...order };

                      if (operationType === 'delete') {
                        // Remove mill input data
                        updatedOrder.millInputs = [];

                        // ⚡ FIX: Clear state for mill inputs
                        setOrderMillInputs(prev => {
                          const updated = { ...prev };
                          delete updated[orderId];
                          if (selectedOrderForMillInputForm?._id) {
                            delete updated[String(selectedOrderForMillInputForm._id)];
                          }
                          return updated;
                        });

                        // Clear localStorage cache
                        localStorage.removeItem(`mill-inputs-${orderId}`);
                        // Also clear process-data-cache
                        try {
                          const processDataCache = localStorage.getItem('process-data-cache');
                          if (processDataCache) {
                            const processCacheData = JSON.parse(processDataCache);
                            if (processCacheData.millInputs) {
                              delete processCacheData.millInputs[orderId];
                              delete processCacheData.millInputs[String(orderId)];
                              localStorage.setItem('process-data-cache', JSON.stringify(processCacheData));
                            }
                          }
                        } catch (e) { }
                      } else if (operationType === 'add' || operationType === 'edit') {
                        // Mark as having mill input data (will be updated with real data from API)
                        updatedOrder.millInputs = [{ _id: 'temp', order: orderId, createdAt: new Date() }];

                        // ⚡ FIX: Immediately update state to show "Edit" button
                        setOrderMillInputs(prev => ({
                          ...prev,
                          [orderId]: [{ _id: 'temp', order: orderId, createdAt: new Date() }],
                          ...(selectedOrderForMillInputForm?._id ? {
                            [String(selectedOrderForMillInputForm._id)]: [{ _id: 'temp', order: orderId, createdAt: new Date() }]
                          } : {})
                        }));
                      }

                      return updatedOrder;
                    }
                    return order;
                  })
                );

                // Force re-render to update button text immediately
                setForceRender(prev => prev + 1);
              }

              // Refresh mill input data specifically for this order
              if (orderId) {
                try {
                  // ⚡ FIX: Fetch immediately without delay for instant update
                  console.log('🔄 Refreshing mill input data for order:', orderId);
                  await fetchMillInputsForOrder(orderId);
                  // Also use loadMillInputsData for immediate state update
                  await loadMillInputsData(orderId, true);

                  // Also refresh the full orders list to ensure consistency
                  console.log('🔄 Refreshing full orders list for consistency');
                  await refreshOrdersWithRetry();
                } catch (error) {
                  console.error('❌ Error refreshing mill input data:', error);
                  // Fallback: try to fetch individual order data
                  try {
                    const response = await fetch(`/api/orders/${selectedOrderForMillInputForm?._id}`, {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                      }
                    });

                    if (response.ok) {
                      const updatedOrder = await response.json();
                      if (updatedOrder.success) {
                        // Update with real data from API
                        setOrders(prevOrders =>
                          prevOrders.map(order =>
                            order.orderId === orderId
                              ? { ...order, ...updatedOrder.data }
                              : order
                          )
                        );
                      }
                    }
                  } catch (fallbackError) {
                    console.log('❌ Fallback refresh also failed:', fallbackError);
                  }
                }
              }

              // Trigger real-time update for Order Activity Log
              if (selectedOrderForMillInputForm?._id) {
                const event = new CustomEvent('orderUpdated', {
                  detail: {
                    orderId: selectedOrderForMillInputForm._id,
                    action: operationType === 'delete' ? 'mill_input_delete' : (operationType === 'edit' ? 'mill_input_update' : 'mill_input_create'),
                    timestamp: new Date().toISOString()
                  }
                });
                window.dispatchEvent(event);
              }

              // Show success message
              const message = isEditingMillInput ? 'Mill input updated successfully!' : 'Mill input added successfully!';
              showMessage('success', message);

              console.log('🎯 Mill input button state updated for order:', orderId, 'operationType:', operationType);
              console.log('🎯 Updated order millInputs:', orders.find(o => o.orderId === orderId)?.millInputs);
            }}
            onAddMill={async (newMillData?: any) => {
              if (newMillData) {
                console.log('🎉 Adding new mill to state:', newMillData);

                // ⚡ FIX: Clear ALL caches aggressively before broadcasting event
                if (typeof window !== 'undefined') {
                  try {
                    // Clear localStorage cache
                    localStorage.removeItem('mills_cache');
                    // Clear all mill-related caches
                    Object.keys(localStorage).forEach(key => {
                      if (key.includes('mill') || key.includes('mills')) {
                        localStorage.removeItem(key);
                      }
                    });
                    console.log('🗑️ Cleared ALL mill caches from localStorage');
                  } catch (e) {
                    console.error('Failed to clear mills cache:', e);
                  }
                }
                // Clear in-memory cache
                if (dataCache.current.mills) {
                  dataCache.current.mills = null;
                  console.log('🗑️ Cleared in-memory mills cache');
                }

                // ⚡ IMMEDIATE UI UPDATE: Add to mills state for instant UI update
                setMills(prev => {
                  const exists = prev.some(m => {
                    const mId = m._id || (m as any).id || '';
                    const newId = newMillData._id || newMillData.id || '';
                    return mId === newId || mId?.toString() === newId?.toString();
                  });
                  if (exists) {
                    return prev.map(m => {
                      const mId = m._id || (m as any).id || '';
                      const newId = newMillData._id || newMillData.id || '';
                      return (mId === newId || mId?.toString() === newId?.toString())
                        ? { ...m, ...newMillData }
                        : m;
                    });
                  }
                  const updated = [newMillData, ...prev];
                  console.log('📊 Mills updated:', updated.length);
                  return updated;
                });

                // ⚡ FIX: Broadcast event MULTIPLE times to ensure all components catch it
                if (typeof window !== 'undefined') {
                  // Dispatch immediately
                  window.dispatchEvent(new CustomEvent('millAdded', {
                    detail: { mill: newMillData }
                  }));
                  console.log('📢 Dispatched millAdded event (1st time) for:', newMillData.name);

                  // Dispatch again after a short delay
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('millAdded', {
                      detail: { mill: newMillData }
                    }));
                    console.log('📢 Dispatched millAdded event (2nd time) for:', newMillData.name);
                  }, 50);

                  // Dispatch a third time
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('millAdded', {
                      detail: { mill: newMillData }
                    }));
                    console.log('📢 Dispatched millAdded event (3rd time) for:', newMillData.name);
                  }, 150);
                }

                // ⚡ FIX: Trigger a background refresh to ensure everything is synced
                setTimeout(async () => {
                  try {
                    await fetchMills();
                    // Dispatch event after refresh
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('millsRefreshed', {
                        detail: { timestamp: Date.now() }
                      }));
                      // Also dispatch millAdded again after refresh
                      window.dispatchEvent(new CustomEvent('millAdded', {
                        detail: { mill: newMillData }
                      }));
                    }
                    console.log('✅ Background refresh completed after adding mill');
                  } catch (err) {
                    console.error('Error in background refresh:', err);
                  }
                }, 300);
              } else {
                // If no data provided, just refresh
                fetchMills();
              }
            }}
            onRemoveMill={async (millId: string) => {
              console.log('🔄 onRemoveMill called with ID:', millId);
              console.log('📊 Current mills count:', mills.length);

              // ⚡ FIX: Clear cache immediately when deleting mill
              if (typeof window !== 'undefined') {
                try {
                  localStorage.removeItem('mills_cache');
                  console.log('🗑️ Cleared mills_cache from localStorage after deleting mill');
                } catch (e) {
                  console.error('Failed to clear mills cache:', e);
                }
              }
              // Clear in-memory cache
              if (dataCache.current.mills) {
                dataCache.current.mills = null;
                console.log('🗑️ Cleared in-memory mills cache');
              }

              // Immediately remove from mills state (handle both _id and id fields)
              setMills(prev => {
                const filtered = prev.filter(mill => {
                  const millIdFromItem = mill._id || (mill as any).id || '';
                  return millIdFromItem !== millId;
                });
                console.log('📊 Mills after filter:', filtered.length);
                return filtered;
              });

              // ⚡ FIX: Refresh from server to ensure everything is synced
              setTimeout(async () => {
                try {
                  await fetchMills();
                  console.log('✅ Background refresh completed after deleting mill');
                } catch (err) {
                  console.error('Error in background refresh:', err);
                }
              }, 100);
            }}
            onSetRecentlyAddedMill={(millId: string | null) => {
              // This can be used for highlighting if needed
              console.log('🎯 Recently added mill:', millId);
            }}
            onRefreshMills={fetchMills}
          />
        );
      })()}

      {/* Mill Output Form */}
      {showMillOutputForm && selectedOrderForMillOutput && (
        <MillOutputForm
          key={`mill-output-${selectedOrderForMillOutput?._id}-${forceRender}`}
          order={selectedOrderForMillOutput}
          qualities={qualities}
          isOpen={showMillOutputForm}
          isEditing={isEditingMillOutput}
          existingMillOutputs={existingMillOutputs}
          onRefreshQualities={fetchQualities}
          onClose={() => {
            setShowMillOutputForm(false);
            setSelectedOrderForMillOutput(null);
            setIsEditingMillOutput(false);
            setExistingMillOutputs([]);
            setLoadingMillOutput(null); // Clear loading state
          }}
          onSuccess={async (operationType?: 'add' | 'edit' | 'delete') => {
            const orderId = selectedOrderForMillOutput?.orderId;

            // ⚡ FIX: Removed router.refresh() - it causes full page reload
            // State updates and fetchAllOrderData() are sufficient for UI updates

            if (orderId) {
              // Immediate UI update based on operation type
              setOrders(prevOrders =>
                prevOrders.map(order => {
                  if (order.orderId === orderId) {
                    const updatedOrder = { ...order };

                    if (operationType === 'delete') {
                      // Remove mill output data
                      updatedOrder.millOutputs = [];

                      // ⚡ FIX: Clear state for mill outputs
                      setOrderMillOutputs(prev => {
                        const updated = { ...prev };
                        delete updated[orderId];
                        if (selectedOrderForMillOutput?._id) {
                          delete updated[String(selectedOrderForMillOutput._id)];
                        }
                        return updated;
                      });

                      // Clear localStorage cache
                      localStorage.removeItem(`mill-outputs-${orderId}`);
                      // Also clear process-data-cache
                      try {
                        const processDataCache = localStorage.getItem('process-data-cache');
                        if (processDataCache) {
                          const processCacheData = JSON.parse(processDataCache);
                          if (processCacheData.millOutputs) {
                            delete processCacheData.millOutputs[orderId];
                            delete processCacheData.millOutputs[String(orderId)];
                            if (selectedOrderForMillOutput?._id) {
                              delete processCacheData.millOutputs[String(selectedOrderForMillOutput._id)];
                            }
                            localStorage.setItem('process-data-cache', JSON.stringify(processCacheData));
                          }
                        }
                      } catch (e) { }
                    } else if (operationType === 'add' || operationType === 'edit') {
                      // Mark as having mill output data (will be updated with real data from API)
                      updatedOrder.millOutputs = [{ _id: 'temp', order: orderId, createdAt: new Date() }];

                      // ⚡ FIX: Immediately update state to show "Edit" button
                      setOrderMillOutputs(prev => ({
                        ...prev,
                        [orderId]: [{ _id: 'temp', order: orderId, createdAt: new Date() }],
                        ...(selectedOrderForMillOutput?._id ? {
                          [String(selectedOrderForMillOutput._id)]: [{ _id: 'temp', order: orderId, createdAt: new Date() }]
                        } : {})
                      }));
                    }

                    return updatedOrder;
                  }
                  return order;
                })
              );

              // Force re-render to update button text immediately
              setForceRender(prev => prev + 1);
            }

            // ⚡ FIX: Fetch fresh data immediately for instant update
            if (orderId) {
              try {
                // Fetch mill outputs directly
                const token = localStorage.getItem('token');
                if (token) {
                  const millOutputsResponse = await fetch(`/api/mill-outputs?orderId=${orderId}&t=${Date.now()}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'Expires': '0'
                    },
                    cache: 'no-store'
                  });

                  if (millOutputsResponse.ok) {
                    const data = await millOutputsResponse.json();
                    if (data.success && data.data?.millOutputs) {
                      setOrderMillOutputs(prev => ({
                        ...prev,
                        [orderId]: data.data.millOutputs,
                        ...(selectedOrderForMillOutput?._id ? {
                          [String(selectedOrderForMillOutput._id)]: data.data.millOutputs
                        } : {})
                      }));
                      setForceRender(prev => prev + 1);
                    }
                  }
                }

                // Also fetch order data
                const response = await fetch(`/api/orders/${selectedOrderForMillOutput?._id}`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                  }
                });

                if (response.ok) {
                  const updatedOrder = await response.json();
                  if (updatedOrder.success) {
                    // Update with real data from API
                    setOrders(prevOrders =>
                      prevOrders.map(order =>
                        order.orderId === orderId
                          ? { ...order, ...updatedOrder.data }
                          : order
                      )
                    );
                  }
                }
              } catch (error) {
                console.log('Background refresh failed, but UI already updated:', error);
              }
            }

            // Trigger real-time update for Order Activity Log
            if (selectedOrderForMillOutput?._id) {
              const event = new CustomEvent('orderUpdated', {
                detail: {
                  orderId: selectedOrderForMillOutput._id,
                  action: operationType === 'delete' ? 'mill_output_delete' : (operationType === 'edit' ? 'mill_output_update' : 'mill_output_create'),
                  timestamp: new Date().toISOString()
                }
              });
              window.dispatchEvent(event);
            }

            // Show success message
            const message = isEditingMillOutput ? 'Mill output updated successfully!' : 'Mill output added successfully!';
            showMessage('success', message);

            console.log('🎯 Mill output button state updated for order:', orderId, 'operationType:', operationType);
            console.log('🎯 Updated order millOutputs:', orders.find(o => o.orderId === orderId)?.millOutputs);
            console.log('🎯 hasMillOutputs check result:', hasMillOutputs(orders.find(o => o.orderId === orderId)!));
          }}
        />
      )}

      {/* Dispatch Form */}
      {showDispatchForm && selectedOrderForDispatch && (
        <DispatchForm
          key={`dispatch-${selectedOrderForDispatch?._id}-${forceRender}`}
          order={selectedOrderForDispatch}
          qualities={qualities}
          isOpen={showDispatchForm}
          isEditing={isEditingDispatch}
          existingDispatches={existingDispatches}
          onRefreshQualities={fetchQualities}
          onClose={() => {
            setShowDispatchForm(false);
            setSelectedOrderForDispatch(null);
            setIsEditingDispatch(false);
            setExistingDispatches([]);
            setLoadingDispatch(null); // Clear loading state
          }}
          onSuccess={async (operationType?: 'add' | 'edit' | 'delete') => {
            const orderId = selectedOrderForDispatch?.orderId;

            // ⚡ FIX: Removed router.refresh() - it causes full page reload
            // State updates and fetchAllOrderData() are sufficient for UI updates

            if (orderId) {
              // Immediate UI update based on operation type
              setOrders(prevOrders =>
                prevOrders.map(order => {
                  if (order.orderId === orderId) {
                    const updatedOrder = { ...order };

                    if (operationType === 'delete') {
                      // Remove dispatch data
                      updatedOrder.dispatches = [];

                      // ⚡ FIX: Clear state for dispatches
                      setOrderDispatches(prev => {
                        const updated = { ...prev };
                        delete updated[orderId];
                        if (selectedOrderForDispatch?._id) {
                          delete updated[String(selectedOrderForDispatch._id)];
                        }
                        return updated;
                      });

                      // Clear localStorage cache
                      localStorage.removeItem(`dispatches-${orderId}`);
                      // Also clear process-data-cache
                      try {
                        const processDataCache = localStorage.getItem('process-data-cache');
                        if (processDataCache) {
                          const processCacheData = JSON.parse(processDataCache);
                          if (processCacheData.dispatches) {
                            delete processCacheData.dispatches[orderId];
                            delete processCacheData.dispatches[String(orderId)];
                            if (selectedOrderForDispatch?._id) {
                              delete processCacheData.dispatches[String(selectedOrderForDispatch._id)];
                            }
                            localStorage.setItem('process-data-cache', JSON.stringify(processCacheData));
                          }
                        }
                      } catch (e) { }
                    } else if (operationType === 'add' || operationType === 'edit') {
                      // Mark as having dispatch data (will be updated with real data from API)
                      updatedOrder.dispatches = [{ _id: 'temp', order: orderId, createdAt: new Date() }];

                      // ⚡ FIX: Immediately update state to show "Edit" button
                      setOrderDispatches(prev => ({
                        ...prev,
                        [orderId]: [{ _id: 'temp', order: orderId, createdAt: new Date() }],
                        ...(selectedOrderForDispatch?._id ? {
                          [String(selectedOrderForDispatch._id)]: [{ _id: 'temp', order: orderId, createdAt: new Date() }]
                        } : {})
                      }));
                    }

                    return updatedOrder;
                  }
                  return order;
                })
              );

              // Force re-render to update button text immediately
              setForceRender(prev => prev + 1);
            }

            // ⚡ FIX: Fetch fresh data immediately for instant update
            if (orderId) {
              try {
                // Fetch dispatches directly
                const token = localStorage.getItem('token');
                if (token) {
                  const dispatchResponse = await fetch(`/api/dispatch?orderId=${orderId}&t=${Date.now()}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'Expires': '0'
                    },
                    cache: 'no-store'
                  });

                  if (dispatchResponse.ok) {
                    const data = await dispatchResponse.json();
                    if (data.success && data.data?.dispatches) {
                      setOrderDispatches(prev => ({
                        ...prev,
                        [orderId]: data.data.dispatches,
                        ...(selectedOrderForDispatch?._id ? {
                          [String(selectedOrderForDispatch._id)]: data.data.dispatches
                        } : {})
                      }));
                      setForceRender(prev => prev + 1);
                    }
                  }
                }

                // Also fetch order data
                const response = await fetch(`/api/orders/${selectedOrderForDispatch?._id}`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                  }
                });

                if (response.ok) {
                  const updatedOrder = await response.json();
                  if (updatedOrder.success) {
                    // Update with real data from API
                    setOrders(prevOrders =>
                      prevOrders.map(order =>
                        order.orderId === orderId
                          ? { ...order, ...updatedOrder.data }
                          : order
                      )
                    );
                  }
                }
              } catch (error) {
                console.log('Background refresh failed, but UI already updated:', error);
              }
            }

            // Trigger real-time update for Order Activity Log
            if (selectedOrderForDispatch?._id) {
              const event = new CustomEvent('orderUpdated', {
                detail: {
                  orderId: selectedOrderForDispatch._id,
                  action: operationType === 'delete' ? 'dispatch_delete' : (operationType === 'edit' ? 'dispatch_update' : 'dispatch_create'),
                  timestamp: new Date().toISOString()
                }
              });
              window.dispatchEvent(event);
            }

            // ⚡ CRITICAL FIX: Refresh all order data to ensure dispatch button state updates properly
            // This is especially important when dispatch is created from mill output update mode
            try {
              console.log('🔄 Refreshing all order data after dispatch operation...');
              await fetchAllOrderData();
              console.log('✅ All order data refreshed successfully');
            } catch (error) {
              console.error('⚠️ Error refreshing order data:', error);
              // Continue anyway - UI already updated above
            }

            // Force re-render to ensure button states update
            setForceRender(prev => prev + 1);

            // Show success message
            const message = isEditingDispatch ? 'Dispatch updated successfully!' : 'Dispatch added successfully!';
            showMessage('success', message);

            console.log('🎯 Dispatch button state updated for order:', orderId, 'operationType:', operationType);
            console.log('🎯 Updated order dispatches:', orders.find(o => o.orderId === orderId)?.dispatches);
            console.log('🎯 hasDispatches check result:', hasDispatches(orders.find(o => o.orderId === orderId)!));
          }}
        />
      )}

      {/* Grey Information Modal */}
      {showGreyInfoModal && selectedOrderForGreyInfo && (
        <GreyInformationModal
          key={`grey-info-${selectedOrderForGreyInfo?._id}-${forceRender}`}
          order={selectedOrderForGreyInfo}
          qualities={qualities}
          isOpen={showGreyInfoModal}
          existingGreyInfo={
            selectedOrderForGreyInfo._id
              ? (orderGreyInfo[String(selectedOrderForGreyInfo._id)] || (selectedOrderForGreyInfo.orderId ? orderGreyInfo[String(selectedOrderForGreyInfo.orderId)] : undefined) || undefined)
              : undefined
          }
          onClose={() => {
            setShowGreyInfoModal(false);
            setSelectedOrderForGreyInfo(null);
            setLoadingGreyInfo(null); // Clear loading state when modal closes
          }}
          onSuccess={async (savedEntries?: any[]) => {
            // ⚡ IMMEDIATE UI UPDATE: Update orders list and state instantly
            if (selectedOrderForGreyInfo?._id || selectedOrderForGreyInfo?.orderId) {
              const order = selectedOrderForGreyInfo;
              const token = localStorage.getItem('token');

              // ⚡ FIX: Clear all caches FIRST to ensure fresh data
              if (typeof window !== 'undefined') {
                if (order.orderId) {
                  localStorage.removeItem(`grey-info-${order.orderId}`);
                }
                // Clear process data cache as well
                localStorage.removeItem('process-data-cache');
              }

              // ⚡ FIX: Add delay on fast servers (AWS) to ensure cache clearing completes
              await new Promise(resolve => setTimeout(resolve, 100));

              // ⚡ IMMEDIATE: Use saved entries data if available (from API response)
              if (savedEntries && savedEntries.length > 0) {
                // Update fast check state immediately (for instant button update)
                if (order.orderId) {
                  setGreyInfoExists(prev => ({ ...prev, [order.orderId]: true }));
                }

                // Update state immediately with saved entries
                setOrderGreyInfo(prev => ({
                  ...prev,
                  [order._id]: savedEntries,
                  ...(order.orderId ? {
                    [order.orderId]: savedEntries
                  } : {})
                }));

                // ⚡ FIX: Add small delay before updating orders list
                await new Promise(resolve => setTimeout(resolve, 50));

                // Update orders list immediately with saved entries
                setOrders(prevOrders =>
                  prevOrders.map(o => {
                    if (o._id === order._id || o._id?.toString() === order._id?.toString() ||
                      o.orderId === order.orderId) {
                      return {
                        ...o,
                        greyInformation: savedEntries
                      };
                    }
                    return o;
                  })
                );

                // ⚡ FIX: Add delay before saving to localStorage
                await new Promise(resolve => setTimeout(resolve, 50));

                // Save to localStorage with fresh timestamp
                if (order.orderId) {
                  localStorage.setItem(`grey-info-${order.orderId}`, JSON.stringify({
                    data: savedEntries,
                    timestamp: Date.now()
                  }));
                }
              } else {
                // ⚡ FIX: Update fast check state when grey info is deleted
                if (order.orderId) {
                  setGreyInfoExists(prev => ({ ...prev, [order.orderId]: false }));
                }
                // ⚡ FIX: Clear state and order property when data is deleted (empty array)
                // Clear state
                setOrderGreyInfo(prev => {
                  const updated = { ...prev };
                  delete updated[String(order._id)];
                  if (order.orderId) {
                    delete updated[String(order.orderId)];
                  }
                  return updated;
                });

                // Clear order property
                setOrders(prevOrders =>
                  prevOrders.map(o => {
                    if (o._id === order._id || o._id?.toString() === order._id?.toString() ||
                      o.orderId === order.orderId) {
                      const { greyInformation, ...rest } = o;
                      return rest;
                    }
                    return o;
                  })
                );

                // Clear localStorage cache
                if (order.orderId) {
                  localStorage.removeItem(`grey-info-${order.orderId}`);
                  // Also clear process-data-cache
                  try {
                    const processDataCache = localStorage.getItem('process-data-cache');
                    if (processDataCache) {
                      const processCacheData = JSON.parse(processDataCache);
                      if (processCacheData.greyInfo) {
                        delete processCacheData.greyInfo[order.orderId];
                        delete processCacheData.greyInfo[String(order.orderId)];
                        delete processCacheData.greyInfo[String(order._id)];
                        localStorage.setItem('process-data-cache', JSON.stringify(processCacheData));
                      }
                    }
                  } catch (e) { }
                }
              }

              // ⚡ FIX: Trigger re-render to update button text
              setForceRender(prev => prev + 1);

              // Trigger real-time update for Order Activity Log
              const orderIdForEvent = order._id || order.orderId;
              if (orderIdForEvent) {
                const event = new CustomEvent('orderUpdated', {
                  detail: {
                    orderId: orderIdForEvent,
                    action: savedEntries && savedEntries.length > 0 ? 'grey_info_update' : 'grey_info_delete',
                    timestamp: new Date().toISOString()
                  }
                });
                window.dispatchEvent(event);
              }

              // ⚡ FIX: Refresh all grey info from server to ensure consistency across all orders
              console.log('🔄 Refreshing all grey info after add/edit...');
              try {
                await fetchAllOrderData();
                console.log('✅ All grey info refreshed successfully');
              } catch (error) {
                console.error('❌ Error refreshing grey info:', error);
              }

              // Don't refresh orders list - we've already updated the state
              // This prevents clearing orders when updating grey information

              // ⚡ FIX: Fetch fresh grey info data in background to verify consistency
              // Use savedEntries if available, otherwise fetch from API
              if (!savedEntries || savedEntries.length === 0) {
                const fetchPromise = (async () => {
                  try {
                    if (token && order.orderId) {
                      // ⚡ FIX: Add cache busting timestamp and use no-store
                      const greyInfoResponse = await fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}&t=${Date.now()}`, {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Cache-Control': 'no-cache, no-store, must-revalidate',
                          'Pragma': 'no-cache',
                          'Expires': '0'
                        },
                        cache: 'no-store' // Force fresh data
                      });

                      if (greyInfoResponse.ok) {
                        const greyInfoData = await greyInfoResponse.json();
                        if (greyInfoData.success && greyInfoData.data) {
                          const greyInfo = greyInfoData.data.greyInfo || [];
                          // Update state with fetched grey information
                          setOrderGreyInfo(prev => ({
                            ...prev,
                            [order._id]: greyInfo,
                            ...(order.orderId ? {
                              [order.orderId]: greyInfo
                            } : {})
                          }));

                          // Update orders list with actual grey info data
                          setOrders(prevOrders =>
                            prevOrders.map(o => {
                              if (o._id === order._id || o._id?.toString() === order._id?.toString() ||
                                o.orderId === order.orderId) {
                                return {
                                  ...o,
                                  greyInformation: greyInfo
                                };
                              }
                              return o;
                            })
                          );

                          // Save to localStorage
                          if (order.orderId) {
                            localStorage.setItem(`grey-info-${order.orderId}`, JSON.stringify({
                              data: greyInfo,
                              timestamp: Date.now()
                            }));
                          }
                          // ⚡ IMMEDIATE: Trigger re-render to update button text
                          setForceRender(prev => prev + 1);
                        } else {
                          // No data - clear state
                          setOrderGreyInfo(prev => {
                            const updated = { ...prev };
                            updated[order._id] = [];
                            if (order.orderId) {
                              updated[order.orderId] = [];
                            }
                            return updated;
                          });

                          // Update orders list to remove grey info
                          setOrders(prevOrders =>
                            prevOrders.map(o => {
                              if (o._id === order._id || o._id?.toString() === order._id?.toString() ||
                                o.orderId === order.orderId) {
                                const { greyInformation, ...rest } = o;
                                return rest;
                              }
                              return o;
                            })
                          );

                          // Clear localStorage
                          if (order.orderId) {
                            localStorage.removeItem(`grey-info-${order.orderId}`);
                          }
                          // ⚡ IMMEDIATE: Trigger re-render to update button text
                          setForceRender(prev => prev + 1);
                        }
                      }
                    }
                  } catch (error) {
                    console.error('❌ Error refreshing grey info:', error);
                  }
                })();

                // Wait for fetch to complete
                await fetchPromise;
              }
            }
          }}
        />
      )}

      {/* Offline Notification (REMOVED) */}

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
  );
}

// export default OrdersPage;           // Cache bust Mon Mar 30 06:24:03 PM IST 2026
