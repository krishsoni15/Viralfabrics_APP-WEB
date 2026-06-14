'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeftIcon, 
  PlusIcon, 
  TrashIcon, 
  CheckIcon,
  PhotoIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ArrowUpIcon,
  ArrowPathIcon,
  HashtagIcon,
  TagIcon,
  CubeIcon,
  UserIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  ScaleIcon,
  DocumentTextIcon,
  BeakerIcon,
  PencilIcon,
  CurrencyDollarIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useSession } from '../../hooks/useSession';
import { FabricFormData } from '@/types/fabric';
import CameraModal from '../../components/CameraModal';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import { Fabric } from '@/types/fabric';
import { Z_INDEX } from '../constants';

// Development-only logging utilities
const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args: any[]) => isDev && console.log(...args);
const devError = (...args: any[]) => isDev && console.error(...args);

type CreateFabricProps = {
  /**
   * When true, render form inline (inside modal) without outer page/overlay wrappers.
   */
  embedMode?: boolean;
  /**
   * Optional fabric data to prefill when editing via component embed.
   */
  fabric?: Fabric | null;
  /**
   * Optional callback to close the parent modal when embedded.
   */
  onClose?: () => void;
  /**
   * Optional callback to notify parent that save completed.
   */
  onSave?: (wasEdit: boolean, fabricData?: Fabric | Fabric[]) => void;
};

export default function CreateFabricPage({ embedMode = false, fabric = null, onClose, onSave }: CreateFabricProps) {
  const { isDarkMode, mounted: darkModeMounted } = useDarkMode();
  const { isMaster } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Check if we're in edit mode
  // ⚡ FIX: Only consider it edit mode if we actually have a fabric to edit
  // In embed mode: only edit if fabric prop is provided and has an _id
  // In non-embed mode: only edit if URL has edit parameter AND it's a valid ID
  const editId = embedMode 
    ? (fabric?._id ?? null) 
    : (searchParams?.get('edit') || null);
  // ⚡ FIX: Only true edit mode if we have a valid fabric ID (not just any string)
  const isEditMode = !!(editId && (embedMode ? fabric?._id : editId));
  const forceRefresh = embedMode ? false : searchParams?.get('refresh') === 'true';
  const isModal = embedMode ? false : searchParams?.get('modal') === 'true'; // Check if opened as modal
  const isEmbedded = embedMode ? true : searchParams?.get('embedded') === 'true'; // Check if embedded in iframe
  
  const [formData, setFormData] = useState<FabricFormData>({
    items: [{
      qualityCode: '',
      qualityName: '',
      type: '',
      weaver: '',
      weaverQualityName: '',
      rack: '',
      greighWidth: '',
      finishWidth: '',
      weight: '',
      gsm: '',
      content: '',
      danier: '',
      count: '',
      reed: '',
      pick: '',
      greighRate: '',
      images: []
    }]
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false); // Separate state for loading edit data
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false); // Prevent multiple load attempts
  const [loadError, setLoadError] = useState<string | null>(null); // Track load errors
  const [pageLoading, setPageLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<{ url: string; index: number } | null>(null);
  // Store pending files (not yet uploaded to S3)
  const [pendingImageFiles, setPendingImageFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const validationTimeoutRef = useRef<any>(null);
  // ✨ Form validation states for strict gating
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [checkingQualityCode, setCheckingQualityCode] = useState(false);
  const [isQualityCodeValid, setIsQualityCodeValid] = useState(false);
  const [qualityCodeCache, setQualityCodeCache] = useState<{ [key: string]: boolean }>({});
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [originalQualityCode, setOriginalQualityCode] = useState<string>(''); // Track original quality code for edit mode
  const [timeoutCountdown, setTimeoutCountdown] = useState<number>(0); // Track timeout countdown
  const [originalItemCount, setOriginalItemCount] = useState<number>(1); // Track original number of items
  const [originalItemIds, setOriginalItemIds] = useState<string[]>([]); // Track original item IDs for deletion
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false); // Control dropdown open/close state
  const [showTypeDropdown, setShowTypeDropdown] = useState<boolean>(false); // Control type dropdown open/close state
  const [typeSearch, setTypeSearch] = useState<string>(''); // Type search value
  const typeDropdownRef = useRef<HTMLDivElement>(null); // Ref for type dropdown
  const qualityCodeDebounceRef = useRef<any>(null); // Ref for quality code debounce
  const dropdownBlurTimeoutRef = useRef<any>(null); // Ref for dropdown blur timeout
  // Derived validity - keeps Save disabled until the required fields are present
  const isFormValid = (() => {
    const first = formData.items[0];
    if (!first) return false;
    const requiredShared = first.qualityCode?.trim() && first.qualityName?.trim();
    const requiredFirstWeaver = first.weaver?.trim() && first.weaverQualityName?.trim();
    // All items must have weaver + weaverQualityName
    const allItemsValid = formData.items.every(it => it.weaver?.trim() && it.weaverQualityName?.trim());
    return Boolean(requiredShared && requiredFirstWeaver && allItemsValid && !loadingData);
  })();

  // ✨ Track form dirty state - mark dirty once any field changes
  useEffect(() => {
    // Skip on initial mount and while loading edit data
    if (!mounted || loadingData) return;
    
    // In edit mode, check if form has changed from original
    // In create mode, mark dirty if any field has content
    const hasContent = formData.items.some(item => 
      item.qualityCode || item.qualityName || item.weaver || 
      item.weaverQualityName || item.type || item.rack ||
      item.greighWidth || item.finishWidth || item.weight ||
      item.gsm || item.content || item.danier || item.count ||
      item.reed || item.pick || item.greighRate
    );
    
    if (hasContent && !isFormDirty) {
      setIsFormDirty(true);
    }
  }, [formData, mounted, loadingData, isFormDirty]);

  // Fabric type options
  const typeOptions = [
    'Polyester',
    'Blend',
    'Viscose',
    'Cotton',
    'Rayon',
    'Other'
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isDropdownOpen && !target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
      if (showTypeDropdown && typeDropdownRef.current && !typeDropdownRef.current.contains(target as Node)) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen, showTypeDropdown]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      if (qualityCodeDebounceRef.current) {
        clearTimeout(qualityCodeDebounceRef.current);
      }
      if (dropdownBlurTimeoutRef.current) {
        clearTimeout(dropdownBlurTimeoutRef.current);
      }
    };
  }, []);

  // Listen for Escape key to close the form / image preview / camera / dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showImagePreview) {
          setShowImagePreview(null);
        } else if (showCamera) {
          setShowCamera(false);
        } else if (showTypeDropdown) {
          setShowTypeDropdown(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, showImagePreview, showCamera, showTypeDropdown]);

  // Optimized load fabric data for editing - Fast loading with better error handling
  // Prevent background scrolling when form is open (modal mode)
  useEffect(() => {
    // Lock body scroll when form is open in modal mode
    if (isModal) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isModal]);

  const loadFabricForEdit = useCallback(async () => {
    // ⚡ FIX: Prevent multiple load attempts if already attempted or if there's an error
    if (hasAttemptedLoad || loadError) {
      devLog('⚠️ Skipping load - already attempted or error exists');
      return;
    }
    
    // ⚡ MULTI-WEAVER EDIT: In embed mode, use fabric._id to load ALL weavers with same quality code
    const fabricIdToLoad = embedMode ? fabric?._id : editId;
    if (!fabricIdToLoad) {
      if (embedMode) {
        devLog('⚠️ Embed mode: No fabric ID provided, cannot load weavers');
        return;
      }
      return;
    }
    
    devLog('🔄 Loading fabric for edit - ID:', fabricIdToLoad, 'Embed mode:', embedMode);
    setHasAttemptedLoad(true);
    setLoadError(null);
    
    let timeoutId: any = null;
    let countdownInterval: any = null;
    
    try {
      setLoadingData(true);
      
      // Clear existing form data to prevent showing old data
      setFormData({
        items: [{
          qualityCode: '',
          qualityName: '',
          type: '',
          weaver: '',
          weaverQualityName: '',
          rack: '',
          greighWidth: '',
          finishWidth: '',
          weight: '',
          gsm: '',
          content: '',
          danier: '',
          count: '',
          reed: '',
          pick: '',
          greighRate: '',
          images: []
        }]
      });
      // Use a longer timeout for better reliability in edit mode
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30s timeout for better reliability
      
      // Start countdown timer
      const startTime = Date.now();
      countdownInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 30 - elapsed);
        setTimeoutCountdown(remaining);
        
        if (remaining <= 0 && countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }, 1000);
      
      const token = localStorage.getItem('token');
      // ⚡ FIX: Always use fresh timestamp and force no-cache to ensure latest data
      const cacheBuster = `t=${Date.now()}&_nocache=${Date.now()}`;
      const response = await fetch(`/api/fabrics/${fabricIdToLoad}?${cacheBuster}`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'If-Modified-Since': '0',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        cache: 'no-store' // Force no cache
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      setTimeoutCountdown(0); // Reset countdown
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        let allItems = data.data;
        
        // ⚡ MULTI-WEAVER EDIT: Filter to only selected weavers if 2+ are selected
        const selectedWeaverIds = embedMode ? ((fabric as any)?._selectedWeaverIds) : null;
        if (selectedWeaverIds && Array.isArray(selectedWeaverIds) && selectedWeaverIds.length >= 2) {
          // Filter to only show selected weavers
          allItems = allItems.filter((item: any) => 
            selectedWeaverIds.includes(String(item._id))
          );
          devLog('⚡ Filtered to selected weavers:', selectedWeaverIds.length, 'of', data.data.length, 'weavers');
        } else {
          // ⚡ FIX: Always show ALL weavers when editing (no filtering)
          devLog('⚡ Loading ALL weavers for edit:', allItems.length, 'weaver(s) with quality code:', allItems[0]?.qualityCode);
        }
        
        // Set the original quality code for edit mode (from first item)
        const loadedQualityCode = allItems[0]?.qualityCode || '';
        setOriginalQualityCode(loadedQualityCode);
        devLog('🔄 Loaded fabric for edit - Quality Code:', loadedQualityCode, 'Edit ID:', editId);
        devLog('📊 All items loaded:', allItems.length, 'First item:', allItems[0]);
        
        // Set the original item count for edit mode
        setOriginalItemCount(allItems.length);
        
        // ⚡ FIX: Track original item IDs for deletion tracking (only valid IDs)
        const originalIds: string[] = allItems
          .map((item: any) => {
            const id = item._id ? String(item._id).trim() : '';
            // Only include valid MongoDB ObjectIds (24 hex characters)
            return id && /^[0-9a-fA-F]{24}$/.test(id) ? id : null;
          })
          .filter((id: string | null): id is string => id !== null && id !== '');
        setOriginalItemIds(originalIds);
        devLog('📋 Original item IDs tracked:', {
          count: originalIds.length,
          ids: originalIds,
          allItemsCount: allItems.length
        });
        
        // Load items (all or filtered based on selection)
        const formattedItems = allItems.map((item: any, index: number) => {
          const formattedItem = {
          _id: item._id ? String(item._id) : '', // Store original ID for tracking
          qualityCode: item.qualityCode || '',
          qualityName: item.qualityName || '',
          type: item.type || '',
          weaver: item.weaver || '',
          weaverQualityName: item.weaverQualityName || '',
          rack: item.rack || '',
          greighWidth: (item.greighWidth && item.greighWidth > 0) ? item.greighWidth.toString() : '',
          finishWidth: (item.finishWidth && item.finishWidth > 0) ? item.finishWidth.toString() : '',
          weight: (item.weight && item.weight > 0) ? item.weight.toString() : '',
          gsm: (item.gsm && item.gsm > 0) ? item.gsm.toString() : '',
          content: item.content || '',
          danier: item.danier || '',
          count: (item.count && item.count > 0) ? item.count.toString() : '',
          reed: (item.reed && item.reed > 0) ? item.reed.toString() : '',
          pick: (item.pick && item.pick > 0) ? item.pick.toString() : '',
          greighRate: (item.greighRate && item.greighRate > 0) ? item.greighRate.toString() : '',
          images: item.images || []
          };
          
          return formattedItem;
        });
        
        setFormData({
          items: formattedItems
        });
        
        // Clean up URL parameters after successful load
        if (forceRefresh) {
          const newUrl = window.location.pathname + `?edit=${editId}`;
          window.history.replaceState({}, '', newUrl);
        }
      } else {
        throw new Error(data.message || 'Failed to load fabric data');
      }
    } catch (error: any) {
      // Clear loading state immediately on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      setLoadingData(false);
      setTimeoutCountdown(0);
      
      if (error.name === 'AbortError') {
        showValidationMessage('error', 'Request timed out after 30 seconds - Please check your connection and try again');
      } else if (error.message.includes('HTTP 404') || error.message.includes('404')) {
        const errorMsg = 'Fabric not found - It may have been deleted. Please close and try again.';
        setLoadError(errorMsg);
        showValidationMessage('error', errorMsg);
        // Close form after showing error if in embed mode
        if (embedMode && onClose) {
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } else if (error.message.includes('HTTP 500') || error.message.includes('500')) {
        showValidationMessage('error', 'Server error - Please try again later');
      } else {
        showValidationMessage('error', `Error loading fabric: ${error.message || 'Unknown error'}`);
      }
      
      // Set form to empty state so user can still use it
      setFormData({
        items: [{
          qualityCode: '',
          qualityName: '',
          type: '',
          weaver: '',
          weaverQualityName: '',
          rack: '',
          greighWidth: '',
          finishWidth: '',
          weight: '',
          gsm: '',
          content: '',
          danier: '',
          count: '',
          reed: '',
          pick: '',
          greighRate: '',
          images: []
        }]
      });
    } finally {
      setLoadingData(false);
      setTimeoutCountdown(0); // Reset countdown
      setPageLoading(false);
      setMounted(true);
    }
  }, [editId, forceRefresh, embedMode, fabric, onClose, hasAttemptedLoad, loadError]);

  // Load fabric data for editing - only load when actually needed
  // ⚡ FIX: Always load ALL weavers with same quality code when editing (even in embed mode)
  // ⚡ FIX: Prevent multiple load attempts and handle errors properly
  // ⚡ FIX: Don't load if we're in CREATE mode (fabric is null in embed mode)
  useEffect(() => {
    // ⚡ FIX: Early return if not in edit mode (CREATE mode)
    if (!isEditMode) {
      devLog('📝 CREATE mode detected - skipping fabric load');
      return;
    }
    
    // Don't attempt to load if already attempted or if there's an error
    if (hasAttemptedLoad || loadError) {
      devLog('⚠️ Skipping load - already attempted or error exists');
      return;
    }
    
    if (embedMode && fabric && fabric._id && !loadingData) {
      // ⚡ FIX: Always call API to load ALL weavers with same quality code (not just the single fabric prop)
      // This ensures all weavers in the quality group are shown when editing
      if (!formData.items[0]?.qualityCode && !formData.items[0]?.qualityName) {
        devLog('⚡ Embed mode edit: Loading ALL weavers for quality code:', fabric.qualityCode);
        const timeoutId = setTimeout(() => {
          loadFabricForEdit();
        }, 100);
        return () => clearTimeout(timeoutId);
      }
      return;
    }

    if (isEditMode && editId && !loadingData && !embedMode) {
      // Only load if form is empty (first time opening edit mode)
      // ⚡ FIX: Only for non-embed mode (URL-based edit)
      if (!formData.items[0]?.qualityCode && !formData.items[0]?.qualityName) {
        devLog('⚡ URL-based edit mode: Loading fabric with ID:', editId);
        const timeoutId = setTimeout(() => {
          loadFabricForEdit();
        }, 100);
        
        return () => clearTimeout(timeoutId);
      }
    }
    // No API calls in create mode - form starts empty
  }, [isEditMode, editId, embedMode, fabric?._id, loadFabricForEdit, formData.items, loadingData, hasAttemptedLoad, loadError]);
  
  // Reset hasAttemptedLoad and loadError when fabric changes
  useEffect(() => {
    if (embedMode && fabric?._id) {
      setHasAttemptedLoad(false);
      setLoadError(null);
    }
  }, [embedMode, fabric?._id]);

  // Reset validation states when edit mode changes
  useEffect(() => {
    setErrors({});
    setIsQualityCodeValid(false);
    setQualityCodeCache({}); // Clear cache when edit mode changes
  }, [isEditMode]);

  // Reset validation states on component mount
  useEffect(() => {
    setErrors({});
    setIsQualityCodeValid(false);
    setQualityCodeCache({}); // Clear cache on mount
  }, []);
  
  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      setTimeoutCountdown(0);
    };
  }, []);

  // Handle page loading - Faster and smoother
  useEffect(() => {
    // Set mounted immediately to prevent flickering
    setMounted(true);
    
    // Reduce loading time and make it smoother
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 100); // Reduced to 100ms for even faster loading
    return () => clearTimeout(timer);
  }, []);


  // Auto-sync shared fields when items change (only in create mode)
  useEffect(() => {
    if (formData.items.length > 1 && !isEditMode) {
      syncSharedFields();
    }
  }, [formData.items.length, isEditMode]);

  // Function to sync shared fields across all items (ONLY in create mode)
  const syncSharedFields = () => {
    // Don't sync in edit mode - each item should keep its individual data
    if (isEditMode) return;
    
    setFormData(prev => {
      if (prev.items.length === 0) return prev;
      
      const sharedQualityCode = prev.items[0]?.qualityCode || '';
      const sharedQualityName = prev.items[0]?.qualityName || '';
      const sharedType = prev.items[0]?.type || '';
      const sharedImages = prev.items[0]?.images || [];
      
      return {
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          qualityCode: sharedQualityCode,
          qualityName: sharedQualityName,
          type: sharedType,
          // DON'T sync weaver and weaverQualityName - keep them individual
          images: sharedImages // Only sync images across all items
        }))
      };
    });
  };

  // Check if quality code already exists (regardless of weaver/weaverQualityName)
  const checkQualityCodeExists = async (qualityCode: string) => {
    if (!qualityCode.trim() || isEditMode) {
      return; // Skip if editing or empty
    }

    const qualityCodeKey = qualityCode.trim().toLowerCase();
    
    // Check cache first for instant response
    if (qualityCodeCache.hasOwnProperty(qualityCodeKey)) {
      const exists = qualityCodeCache[qualityCodeKey];
      if (exists) {
        // Quality code exists - show error and block submission
        setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: 'Quality code already exists' }));
        setIsQualityCodeValid(false); // Mark as invalid
        // ✨ No popup - just inline error
      } else {
        setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
        setIsQualityCodeValid(true);
        // ✨ No popup - just clear error
      }
      return;
    }
    
    setCheckingQualityCode(true);
    
    let timeoutId: any = null;
    try {
      // Use a more specific endpoint and add timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/fabrics?qualityCode=${encodeURIComponent(qualityCode.trim())}&exact=true`, {
        signal: controller.signal,
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Check if the API returned data and if any item has the exact quality code
      if (data.success && data.data && Array.isArray(data.data)) {
        const exactMatch = data.data.find((item: any) => 
          item.qualityCode && item.qualityCode.toString().toLowerCase() === qualityCode.trim().toLowerCase()
        );
        
        if (exactMatch) {
          // Quality code already exists - show error and block submission
          setQualityCodeCache(prev => ({ ...prev, [qualityCodeKey]: true }));
          setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: 'Quality code already exists' }));
          setIsQualityCodeValid(false); // Mark as invalid
          // ✨ No popup - just inline error
        } else {
          // Quality code is unique, clear any existing error
          setQualityCodeCache(prev => ({ ...prev, [qualityCodeKey]: false }));
          setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
          setIsQualityCodeValid(true);
          // ✨ No popup - just clear error
        }
      } else {
        // API didn't return expected data structure, assume it's valid
        setQualityCodeCache(prev => ({ ...prev, [qualityCodeKey]: false }));
        setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
        setIsQualityCodeValid(true);
        // ✨ No popup
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request timed out, assume it's valid to avoid blocking the user
        setQualityCodeCache(prev => ({ ...prev, [qualityCodeKey]: false }));
        setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
        setIsQualityCodeValid(true);
        // ✨ No popup
      } else {
        // Other error, assume it's valid to avoid blocking the user
        setQualityCodeCache(prev => ({ ...prev, [qualityCodeKey]: false }));
        setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
        setIsQualityCodeValid(true);
        // ✨ No popup
      }
    } finally {
      setCheckingQualityCode(false);
    }
  };

  const handleSharedFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => ({
        ...item,
        [field]: value
      }))
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Reset quality code validation state when user starts typing
    if (field === 'qualityCode') {
      setIsQualityCodeValid(false);
      // Clear any cached result for this field to force re-validation
      if (qualityCodeCache[value.trim().toLowerCase()] !== undefined) {
        setQualityCodeCache(prev => {
          const newCache = { ...prev };
          delete newCache[value.trim().toLowerCase()];
          return newCache;
        });
      }
    }
    
    // Check quality code uniqueness after user stops typing (debounced)
    // Only check in create mode, not edit mode (to avoid annoying validations)
    if (field === 'qualityCode' && value.trim() && !isEditMode) {
      // Clear any existing error first
      setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
      
      // Clear existing debounce timeout
      if (qualityCodeDebounceRef.current) {
        clearTimeout(qualityCodeDebounceRef.current);
      }
      
      // Faster debounce - check after 300ms
      qualityCodeDebounceRef.current = setTimeout(() => {
        if (value.trim() === formData.items[0]?.qualityCode) {
          checkQualityCodeExists(value);
        }
        qualityCodeDebounceRef.current = null;
      }, 300);
    }
    
    // Also clear any item-specific errors for this field
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith('items.') && key.includes(`.${field}`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...prev, items: updatedItems };
    });
    
    // Clear error when user starts typing
    const errorKey = `items.${index}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  // Show validation message with auto-hide
  const showValidationMessage = (type: 'success' | 'error' | 'info' | 'warning', text: string, duration = 4000) => {
    // Clear any existing timeout to prevent memory leaks
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    setValidationMessage({ type, text });
    validationTimeoutRef.current = setTimeout(() => {
      setValidationMessage(null);
      validationTimeoutRef.current = null;
    }, duration);
  };

  const addItem = () => {
    setFormData(prev => {
      // SHARED FIELDS (copied from first item):
      // - qualityCode: Same across all items
      // - qualityName: Same across all items  
      // - images: Same across all items
      
      // INDIVIDUAL FIELDS (empty for new items):
      // - weaver: Each item has different weaver
      // - weaverQualityName: Each item has different quality name
      // - greighWidth, finishWidth, weight, gsm, danier, reed, pick, greighRate: Individual specs
      
      const sharedQualityCode = prev.items[0]?.qualityCode || '';
      const sharedQualityName = prev.items[0]?.qualityName || '';
      const sharedType = prev.items[0]?.type || '';
      const sharedImages = prev.items[0]?.images || [];
      
      return {
        ...prev,
        items: [...prev.items, {
          qualityCode: sharedQualityCode,
          qualityName: sharedQualityName,
          type: sharedType,
          weaver: '', // Empty field for new item
          weaverQualityName: '', // Empty field for new item
          rack: '', // Empty field for new item
          greighWidth: '', // Empty field for new item
          finishWidth: '', // Empty field for new item
          weight: '', // Empty field for new item
          gsm: '', // Empty field for new item
          content: '', // Empty field for new item
          danier: '', // Empty field for new item
          count: '', // Empty field for new item
          reed: '', // Empty field for new item
          pick: '', // Empty field for new item
          greighRate: '', // Empty field for new item
          images: sharedImages // Shared images
        }]
      };
    });
    
    // Clear any existing errors when adding new item
    setErrors({});
    setIsQualityCodeValid(false);
    setQualityCodeCache({}); // Clear cache when adding new items

    // Scroll down smoothly inside the form to show the new item after it's added
    setTimeout(() => {
      // Use the form ref to scroll inside the form, not the window
      if (formRef.current) {
        formRef.current.scrollBy({
          top: 400, // Scroll down 400px to show new item
          behavior: 'smooth'
        });
      }
    }, 100); // Small delay to ensure the new item is rendered
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  // Image upload functions for shared quality images
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleFiles = (files: FileList | File[]) => {
    // Store files locally (will upload on save)
    const newFiles: Array<{ file: File; previewUrl: string }> = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - matches server limit
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not an image file`);
        continue;
      }
      
      // Validate file size (10MB max)
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errors.push(`${file.name}: File size (${sizeMB}MB) exceeds 10MB limit. Please compress the image.`);
        continue;
      }
      
      // File is valid
      const previewUrl = URL.createObjectURL(file);
      newFiles.push({ file, previewUrl });
    }
    
    // Show errors if any - display in form validation area
    if (errors.length > 0) {
      const errorMessage = errors.join('; ');
      setErrors(prev => ({ ...prev, images: errorMessage }));
      // Error will be displayed in the form validation area
    }
    
    if (newFiles.length > 0) {
      setPendingImageFiles(prev => [...prev, ...newFiles]);
      setIsFormDirty(true); // Mark form as dirty
      // Clear image errors if files are valid
      if (errors.length === 0) {
        setErrors(prev => ({ ...prev, images: '' }));
      }
      // ✨ No popup - images show immediately in preview area
    }
  };

  // Upload single file to S3
  const uploadFileToS3 = async (file: File, folder: string = 'fabrics'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const token = localStorage.getItem('token');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Provide helpful error messages
      if (response.status === 403) {
        throw new Error('Access denied: AWS IAM policy not configured. Please check your AWS IAM settings.');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (response.status === 500) {
        throw new Error('Upload service error. Please check AWS configuration in .env.local');
      }
      
      throw new Error(errorData.message || `Upload failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && (data.url || data.imageUrl)) {
      return data.url || data.imageUrl;
    } else {
      throw new Error(data.message || 'Upload failed: No URL received');
    }
  };

  // Upload file with retry mechanism
  const uploadFileWithRetry = async (file: File, retryCount = 0): Promise<string> => {
    const maxRetries = 2;
    const timeoutDuration = 30000 + (retryCount * 10000); // 30s, 40s, 50s
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let timeoutId: any = null;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'fabrics');

        const token = localStorage.getItem('token');
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type for FormData - let browser set it with boundary
          },
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (parseError) {
            }
          
          // Handle 413 Payload Too Large error specifically
          if (response.status === 413) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errorMessage = `File too large (${sizeMB}MB). Maximum file size is 10MB. Please compress the image before uploading.`;
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (data.success && (data.url || data.imageUrl)) {
          return data.url || data.imageUrl;
        } else {
          throw new Error(data.message || 'Upload failed');
        }
      } catch (error: any) {
        // Ensure timeout is cleared even on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Upload failed after all retry attempts');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeImage = (imageIndex: number) => {
    // Check if it's a pending file
    if (imageIndex < pendingImageFiles.length) {
      const fileToRemove = pendingImageFiles[imageIndex];
      URL.revokeObjectURL(fileToRemove.previewUrl);
      setPendingImageFiles(prev => prev.filter((_, i) => i !== imageIndex));
    } else {
      // Remove uploaded URL (adjust index)
      const uploadedIndex = imageIndex - pendingImageFiles.length;
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          images: item.images?.filter((_, i) => i !== uploadedIndex) || []
        }))
      }));
    }
  };

  // Handle camera capture
  const handleCameraCapture = (file: File) => {
    handleFiles([file]);
  };

  // Validation function
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    // Validate shared fields (Quality Code and Quality Name)
    const qualityCode = formData.items[0]?.qualityCode?.trim();
    const qualityName = formData.items[0]?.qualityName?.trim();
    
    if (!qualityCode) {
      newErrors[`items.0.qualityCode`] = 'Quality Code is required';
    }
    
    if (!qualityName) {
      newErrors.qualityName = 'Quality Name is required';
    }
    
    // Validate each item's weaver and weaverQualityName fields
    formData.items.forEach((item, index) => {
      if (!item.weaver?.trim()) {
        newErrors[`items.${index}.weaver`] = 'Weaver is required';
      }
      
      if (!item.weaverQualityName?.trim()) {
        newErrors[`items.${index}.weaverQualityName`] = 'Weaver Quality Name is required';
      }
    });
    
    // Check if quality code validation failed
    if (errors[`items.0.qualityCode`] && errors[`items.0.qualityCode`].includes('already exists')) {
      newErrors[`items.0.qualityCode`] = errors[`items.0.qualityCode`];
    }
    
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    devLog('🔄 handleSubmit called - isEditMode:', isEditMode, 'embedMode:', embedMode, 'editId:', editId, 'fabric:', fabric?._id);
    
    // Frontload validation so UI can respond instantly
    if (!isFormValid) {
      devLog('❌ Form validation failed - isFormValid:', isFormValid);
      showValidationMessage('error', 'Please fill all required fields before saving.');
      return;
    }

    // Validate form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      devLog('❌ Form validation errors:', validationErrors);
      setErrors(validationErrors);
      showValidationMessage('error', 'Please fill all required fields');
      return;
    }
    
    devLog('✅ Form validation passed, proceeding with save...');
    
    // Show "Saving..." message that persists until save completes
    showValidationMessage('info', '💾 Saving...', 60000); // Long duration - will be cleared on success/error
    setLoading(true);
    setIsSaving(true); // ✨ Track saving state for button gating
    
    try {
      // Helper to retry critical fetches once to reduce transient failures
      const fetchWithRetry = async (fn: () => Promise<Response>, retries = 1): Promise<Response> => {
        let attempt = 0;
        let lastError: any;
        while (attempt <= retries) {
          try {
            const res = await fn();
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
          } catch (err) {
            lastError = err;
            attempt += 1;
            if (attempt > retries) break;
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          }
        }
        throw lastError;
      };

      // STEP 1: Upload all pending images to S3 first
      const uploadedUrls: string[] = [];
      if (pendingImageFiles.length > 0) {
        showValidationMessage('success', `Uploading ${pendingImageFiles.length} image(s) to AWS...`);
        setUploadingImages(true);
        
        try {
          for (let i = 0; i < pendingImageFiles.length; i++) {
            const { file } = pendingImageFiles[i];
            showValidationMessage('success', `Uploading image ${i + 1} of ${pendingImageFiles.length}...`);
            const url = await uploadFileToS3(file, 'fabrics');
            uploadedUrls.push(url);
            // Clean up preview URL
            URL.revokeObjectURL(pendingImageFiles.find(p => p.file === file)?.previewUrl || '');
          }
          showValidationMessage('success', 'All images uploaded successfully!');
        } catch (error: any) {
          setUploadingImages(false);
          // Show detailed error message
          const errorMsg = error.message || 'Failed to upload images';
          showValidationMessage('error', errorMsg);
          throw new Error(errorMsg);
        }
        setUploadingImages(false);
      }

      // STEP 2: Merge uploaded URLs with existing images
      const allImages = [...(formData.items[0]?.images || []), ...uploadedUrls];
      
      // STEP 3: Clean up pending files
      setPendingImageFiles([]);
      
      // Calculate which items were deleted (only in edit mode)
      let deletedItemIds: string[] = [];
      if (isEditMode && originalItemIds.length > 0) {
        // ⚡ FIX: Get current item IDs - must check both _id field and ensure they're valid
        const currentItemIds = formData.items
          .map(item => {
            const itemId = (item as any)?._id;
            // Only include valid IDs (not empty, not temp IDs)
            if (itemId && typeof itemId === 'string' && itemId.trim() !== '' && !itemId.startsWith('temp-')) {
              return itemId.trim();
            }
            return null;
          })
          .filter((id): id is string => Boolean(id));
        
        // ⚡ FIX: Compare IDs as strings to ensure proper matching
        deletedItemIds = originalItemIds
          .map(id => String(id).trim())
          .filter(id => {
            // Only include valid MongoDB ObjectIds
            if (!id || id.startsWith('temp-')) return false;
            // Check if this ID is NOT in current items
            return !currentItemIds.some(currentId => String(currentId).trim() === id);
          });
        
        devLog('🔍 Item deletion check:', {
          originalCount: originalItemIds.length,
          originalIds: originalItemIds,
          currentCount: currentItemIds.length,
          currentIds: currentItemIds,
          deletedCount: deletedItemIds.length,
          deletedIds: deletedItemIds
        });
        
        // ⚡ CRITICAL: Log warning if deletions detected but IDs are invalid
        if (deletedItemIds.length > 0) {
          const invalidIds = deletedItemIds.filter(id => !/^[0-9a-fA-F]{24}$/.test(id));
          if (invalidIds.length > 0) {
            console.warn('⚠️ Some deleted IDs are not valid MongoDB ObjectIds:', invalidIds);
          }
        }
      }
      
      // ⚡ FIX: Include _id only for existing items (items that were loaded from database)
      // New items (added via "Add Another Weaver") should NOT have _id
      const apiData = formData.items.map(item => {
        const itemData: any = {
          qualityCode: item.qualityCode,
          qualityName: item.qualityName,
          type: item.type || '',
          weaver: item.weaver,
          weaverQualityName: item.weaverQualityName,
          rack: item.rack || '',
          greighWidth: parseFloat(item.greighWidth) || 0,
          finishWidth: parseFloat(item.finishWidth) || 0,
          weight: parseFloat(item.weight) || 0,
          gsm: parseFloat(item.gsm) || 0,
          content: item.content || '',
          danier: item.danier,
          count: parseInt(item.count) || 0,
          reed: parseInt(item.reed) || 0,
          pick: parseInt(item.pick) || 0,
          greighRate: parseFloat(item.greighRate) || 0,
          images: allImages // Use merged images
        };
        
        // ⚡ CRITICAL: Only include _id if it's a valid existing item ID (not empty, not temp ID)
        const itemId = (item as any)._id;
        if (itemId && itemId.trim() !== '' && !itemId.startsWith('temp-')) {
          itemData._id = itemId;
        }
        // If itemId is empty or temp ID, don't include _id - this marks it as a new item
        
        return itemData;
      });

      const token = localStorage.getItem('token');
      
      if (isEditMode && editId) {
        // For edit mode, we need to handle multiple items properly
        try {
          // Check if quality code changed - this affects how we handle the update
          const currentQualityCode = formData.items[0]?.qualityCode?.trim();
          const qualityCodeChanged = originalQualityCode && originalQualityCode !== currentQualityCode;
          
          devLog('Update check - Original:', originalQualityCode, 'Current:', currentQualityCode, 'Changed:', qualityCodeChanged);
          
          if (qualityCodeChanged) {
            // Quality code changed - major change. Optimistic UI first, then PUT in background.
            const optimisticFabric = {
              _id: editId,
              qualityCode: currentQualityCode,
              qualityName: formData.items[0]?.qualityName?.trim(),
              type: formData.items[0]?.type || '',
              weaver: formData.items[0]?.weaver?.trim(),
              weaverQualityName: formData.items[0]?.weaverQualityName?.trim(),
              rack: formData.items[0]?.rack?.trim() || '',
              greighWidth: parseFloat(formData.items[0]?.greighWidth) || 0,
              finishWidth: parseFloat(formData.items[0]?.finishWidth) || 0,
              weight: parseFloat(formData.items[0]?.weight) || 0,
              gsm: parseFloat(formData.items[0]?.gsm) || 0,
              content: formData.items[0]?.content || '',
              danier: formData.items[0]?.danier || '',
              count: parseInt(formData.items[0]?.count) || 0,
              reed: parseInt(formData.items[0]?.reed) || 0,
              pick: parseInt(formData.items[0]?.pick) || 0,
              greighRate: parseFloat(formData.items[0]?.greighRate) || 0,
              label: (formData.items[0] as any)?.label || '',
              images: allImages,
              createdAt: new Date().toISOString(),
              updateAllWithQualityCode: true,
              originalQualityCode: originalQualityCode,
              updateAllItems: true,
              allItems: apiData,
              updatedAt: new Date().toISOString()
            };
            onSave?.(true, optimisticFabric); // UI first
            
            // Update all items with the new quality code (background)
            const updateResponse = await fetchWithRetry(() => fetch(`/api/fabrics/${editId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              },
              cache: 'no-store', // Force no cache
              body: JSON.stringify({
                qualityCode: currentQualityCode,
                qualityName: formData.items[0]?.qualityName?.trim(),
                type: formData.items[0]?.type || '',
                weaver: formData.items[0]?.weaver?.trim(),
                weaverQualityName: formData.items[0]?.weaverQualityName?.trim(),
                rack: formData.items[0]?.rack?.trim() || '',
                greighWidth: parseFloat(formData.items[0]?.greighWidth) || 0,
                finishWidth: parseFloat(formData.items[0]?.finishWidth) || 0,
                weight: parseFloat(formData.items[0]?.weight) || 0,
                gsm: parseFloat(formData.items[0]?.gsm) || 0,
                content: formData.items[0]?.content || '',
                danier: formData.items[0]?.danier || '',
                count: parseInt(formData.items[0]?.count) || 0,
                reed: parseInt(formData.items[0]?.reed) || 0,
                pick: parseInt(formData.items[0]?.pick) || 0,
                greighRate: parseFloat(formData.items[0]?.greighRate) || 0,
                images: allImages,
                updateAllWithQualityCode: true, // Signal to backend to update all related items
                originalQualityCode: originalQualityCode,
                // Also send allItems to update individual weaver data
                updateAllItems: true,
                allItems: apiData,
                deletedItemIds: deletedItemIds // Send IDs of items to delete
              })
          }), 1);

          const updateData = await updateResponse.json();
        
          if (updateData.success) {
              // Show success message with details about what was done
              const successMessage = updateData.createdCount > 0
                ? `✅ Successfully updated ${updateData.updatedCount || 0} fabric(s) and created ${updateData.createdCount} new fabric(s)!`
                : `✅ Successfully updated ${updateData.updatedCount || 0} fabric(s)!`;
              
              showValidationMessage('success', successMessage);
              
              // Update the original quality code to the new one
              setOriginalQualityCode(currentQualityCode);
              
              // ✨ No refresh flags needed - optimistic update via callback
              
              // Store the updated fabric data for immediate state update
              // Use API response data if available, otherwise build from form data
              let updatedFabricData;
              if (updateData.data && !Array.isArray(updateData.data)) {
                updatedFabricData = updateData.data;
              } else if (Array.isArray(updateData.data) && updateData.data.length > 0) {
                updatedFabricData = updateData.data;
              } else {
                updatedFabricData = {
                  _id: editId,
                  qualityCode: currentQualityCode,
                  qualityName: formData.items[0]?.qualityName?.trim(),
                  type: formData.items[0]?.type || '',
                  weaver: formData.items[0]?.weaver?.trim(),
                  weaverQualityName: formData.items[0]?.weaverQualityName?.trim(),
                  rack: formData.items[0]?.rack?.trim() || '',
                  greighWidth: parseFloat(formData.items[0]?.greighWidth) || 0,
                  finishWidth: parseFloat(formData.items[0]?.finishWidth) || 0,
                  weight: parseFloat(formData.items[0]?.weight) || 0,
                  gsm: parseFloat(formData.items[0]?.gsm) || 0,
                  content: formData.items[0]?.content || '',
                  danier: formData.items[0]?.danier || '',
                  count: parseInt(formData.items[0]?.count) || 0,
                  reed: parseInt(formData.items[0]?.reed) || 0,
                  pick: parseInt(formData.items[0]?.pick) || 0,
                  greighRate: parseFloat(formData.items[0]?.greighRate) || 0,
                  images: allImages
                };
              }
              
              // Store as array for consistent handling
              const fabricsToStore = Array.isArray(updatedFabricData) ? updatedFabricData : [updatedFabricData];
              // ✨ No sessionStorage needed - data passed via onSave callback
              
              // ✨ No refresh flags needed - optimistic update via callback
              // ✨ No cache clearing needed - parent handles it
              
              // ✨ OPTIMISTIC: Pass all fabric data to parent for immediate UI update
              // Pass all fabrics if multiple, or single fabric if one
              const fabricsToPass = fabricsToStore.length > 1 ? fabricsToStore : fabricsToStore[0];
              
              // In embed mode, close the modal and notify parent with fabric data
              devLog('📤 Calling onSave callback with fabric data');
              if (embedMode) {
                onSave?.(true, fabricsToPass);
                onClose?.();
              } else {
                // For non-embed mode, pass data and close - parent handles optimistic update
                onSave?.(true, fabricsToPass);
                onClose?.();
              }
            } else {
              // Handle quality code validation error
              if (updateData.message && updateData.message.includes('already exists and cannot be used')) {
                showValidationMessage('error', updateData.message);
                // Don't redirect - let user fix the quality code
              } else {
                showValidationMessage('error', updateData.message || 'Update failed');
                // ✨ No redirect - stay on form to fix error
              }
            }
          } else {
            // No quality code change - handle item updates and additions
            // ⚡ OPTIMISTIC UI: Update UI immediately (even with deletions), then run API in background
            const hasDeletions = deletedItemIds && deletedItemIds.length > 0;
            
            // ⚡ STEP 1: ALWAYS do optimistic update first - UI updates immediately
            // Build optimistic fabrics array (exclude deleted items - they're already removed from formData.items)
            // ⚡ FIX: Only include items that are NOT being deleted
            const itemsNotDeleted = formData.items.filter((item, idx) => {
              const itemId = (item as any)?._id;
              // If item has an ID, check if it's in the deleted list
              if (itemId && deletedItemIds.includes(String(itemId))) {
                return false; // Skip deleted items
              }
              return true; // Include all other items
            });
            
            const optimisticFabrics = itemsNotDeleted.map((item, idx) => {
              const itemId = (item as any)?._id;
              const apiItem = apiData.find((api: any) => 
                api.weaver === item.weaver && api.weaverQualityName === item.weaverQualityName
              ) || apiData[idx] || {};
              
              return {
                _id: itemId || `temp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
                ...apiItem,
                weaver: item.weaver,
                weaverQualityName: item.weaverQualityName,
                label: (item as any)?.label || '',
                createdAt: itemId ? ((item as any)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            });
            
            // ⚡ IMMEDIATE UI UPDATE: Remove deleted weavers from UI right away
            // Only pass fabrics that are NOT deleted
            const fabricsToPass = optimisticFabrics.length > 1 ? optimisticFabrics : (optimisticFabrics[0] || null);
            if (fabricsToPass) {
              onSave?.(true, fabricsToPass); // UI updates immediately - deleted weavers disappear
            }
            
            // Show immediate success message (optimistic)
            showValidationMessage('info', '💾 Saving...', 3000);
            
            // ⚡ STEP 2: Run PUT API in background (don't wait - fire and forget)
            // API will sync UI when complete, but UI already updated optimistically
            fetchWithRetry(() => fetch(`/api/fabrics/${editId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              },
              cache: 'no-store',
              body: JSON.stringify({
                ...apiData[0],
                updateAllItems: true,
                allItems: apiData,
                deletedItemIds: deletedItemIds,
                originalItemCount: originalItemCount,
                originalQualityCode: originalQualityCode
              })
            }), 1).then(async (updateResponse) => {
              const updateData = await updateResponse.json();
              
              if (updateData.success) {
                // ⚡ API SUCCESS: Update UI with real data from API (sync with database)
                let fabricsToStore = [];
                if (updateData.data) {
                  if (Array.isArray(updateData.data)) {
                    fabricsToStore = updateData.data;
                  } else {
                    fabricsToStore = [updateData.data];
                  }
                }
                
                // ⚡ CRITICAL: Update UI with real data from API (deleted items already removed)
                // Even if empty (all weavers deleted), we need to update UI to reflect deletion
                if (fabricsToStore.length > 0) {
                  const realFabricsToPass = fabricsToStore.length > 1 ? fabricsToStore : fabricsToStore[0];
                  onSave?.(true, realFabricsToPass);
                } else if (updateData.deletedCount > 0) {
                  // ⚡ FIX: If all weavers were deleted, pass empty array to remove them from UI
                  // The parent component will handle removing all fabrics with this qualityCode
                  onSave?.(true, []);
                }
                
                // Show success message
                let successMessage = '';
                if (updateData.deletedCount > 0) {
                  if (updateData.createdCount > 0) {
                    successMessage = `✅ Successfully deleted ${updateData.deletedCount} fabric(s), updated ${updateData.updatedCount || 0} fabric(s), and created ${updateData.createdCount} new fabric(s)!`;
                  } else {
                    successMessage = `✅ Successfully deleted ${updateData.deletedCount} fabric(s) and updated ${updateData.updatedCount || 0} fabric(s)!`;
                  }
                } else {
                  successMessage = updateData.createdCount > 0
                    ? `✅ Successfully updated ${updateData.updatedCount || 0} fabric(s) and created ${updateData.createdCount} new fabric(s)!`
                    : `✅ Successfully updated ${updateData.updatedCount || 0} fabric(s)!`;
                }
                
                showValidationMessage('success', successMessage);
              } else {
                // ⚡ API FAILED: Show error but don't rollback (user already sees updated UI)
                showValidationMessage('error', updateData.message || 'Update failed - changes may not be saved');
              }
            }).catch((error) => {
              // ⚡ API ERROR: Show error but don't rollback optimistic update
              console.error('Background API update failed:', error);
              showValidationMessage('error', 'Update failed - please refresh to see current data');
            });
            
            // ⚡ STEP 3: Close form immediately (don't wait for API)
            // UI already updated optimistically, API runs in background
            if (embedMode) {
              onClose?.();
            } else {
              onClose?.();
            }
            
            // Reset form states
            setErrors({});
            setIsQualityCodeValid(false);
            setQualityCodeCache({});
            setOriginalQualityCode(formData.items[0]?.qualityCode?.trim() || '');
            
            return; // Exit - API runs in background
          } // End of else block (no quality code change)
        } catch (error) {
          showValidationMessage('error', 'An error occurred while updating fabric');
        }
      } else {
        // CREATE MODE - POST API call
        devLog('📤 CREATE MODE: Preparing to POST fabric data...', { 
          itemsCount: formData.items.length, 
          apiDataCount: apiData.length,
          isEditMode: isEditMode,
          editId: editId,
          embedMode: embedMode,
          fabricId: fabric?._id
        });
        
        // NO CACHING - Removed all cache clearing
        
        // Optimistic UI: create temporary fabrics immediately (no loading wait)
        const clientTempIds: string[] = [];
        const optimisticFabrics = formData.items.map((item, idx) => {
          const clientTempId = `temp-${Date.now()}-${idx}`;
          clientTempIds.push(clientTempId);
          return {
            _id: clientTempId,
            clientTempId,
            _isOptimistic: true,
            qualityCode: item.qualityCode?.trim(),
            qualityName: item.qualityName?.trim(),
            type: item.type || '',
            weaver: item.weaver?.trim(),
            weaverQualityName: item.weaverQualityName?.trim(),
            rack: item.rack?.trim() || '',
            greighWidth: parseFloat(item.greighWidth) || 0,
            finishWidth: parseFloat(item.finishWidth) || 0,
            weight: parseFloat(item.weight) || 0,
            gsm: parseFloat(item.gsm) || 0,
            content: item.content || '',
            danier: item.danier || '',
            count: parseInt(item.count) || 0,
            reed: parseInt(item.reed) || 0,
            pick: parseInt(item.pick) || 0,
            greighRate: parseFloat(item.greighRate) || 0,
            label: (item as any).label || '',
            images: allImages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
        
        // ⚡ FIX: POST API MUST complete before updating UI - don't do optimistic update first
        // Create new fabric(s) - each item becomes a separate record but with same quality code
        devLog('📤 POST API call starting...', { 
          url: '/api/fabrics', 
          method: 'POST', 
          dataCount: apiData.length,
          hasToken: !!token,
          apiData: apiData
        });
        
        // ⚡ CRITICAL: Make POST API call FIRST, then update UI with real data
        const response = await fetchWithRetry(() => {
          devLog('🔄 Making POST request to /api/fabrics...', { body: JSON.stringify(apiData) });
          return fetch(`/api/fabrics`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            },
            body: JSON.stringify(apiData),
            cache: 'no-store' // Force no cache
          });
        }, 1);
        
        devLog('📥 POST response received:', { status: response.status, ok: response.ok });
        
        // ⚡ FIX: Check if response is OK before parsing JSON
        if (!response.ok) {
          const errorText = await response.text();
          devError('❌ POST API error:', { status: response.status, statusText: response.statusText, errorText });
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        devLog('📦 POST response data:', { success: data.success, hasData: !!data.data, message: data.message, fullData: data });
        
        if (data.success && data.data) {
          // ⚡ CRITICAL: Only update UI AFTER successful POST API call
          // Reset validation states on success
          setErrors({});
          setIsQualityCodeValid(false);
          setQualityCodeCache({}); // Clear cache on successful submission
          showValidationMessage('success', `✅ Fabric created successfully with ${formData.items.length} item(s)!`);
          
          // ⚡ FIX: Store created fabric data for immediate state update
          // Always ensure it's an array for consistent handling
          let fabricsToStore = [];
          if (data.data) {
            if (Array.isArray(data.data)) {
              fabricsToStore = data.data;
            } else {
              fabricsToStore = [data.data];
            }
          }
          
          if (fabricsToStore.length === 0) {
            devError('⚠️ POST API succeeded but no fabric data returned!');
            throw new Error('Fabric created but no data returned from server');
          }
          
          // ✨ No sessionStorage needed - data passed via onSave callback
          
          // NO CACHING - Removed all cache clearing
          
          // ✨ No refresh flags needed - optimistic update via onSave callback
          
          // ⚡ FIX: Pass REAL fabric data from API (not optimistic)
          // Attach clientTempId to real records so parent can replace any optimistics
          const fabricsWithTempId = fabricsToStore.map((f: any, idx: number) => ({
            ...f,
            clientTempId: clientTempIds[idx] || undefined
          }));
          const fabricsToPass = fabricsWithTempId.length > 1 ? fabricsWithTempId : (fabricsWithTempId[0] || data.data);
          
          devLog('📤 Calling onSave callback for CREATE with REAL fabric data from API:', { 
            fabricsToStoreCount: fabricsToStore.length,
            hasData: !!data.data,
            dataIsArray: Array.isArray(data.data),
            fabricsToPass: fabricsToPass
          });
          
          // ⚡ CRITICAL: Update UI with REAL data from API (POST completed successfully)
          // In embed mode, close the modal and notify parent with fabric data
          if (embedMode) {
            onSave?.(false, fabricsToPass);
            onClose?.();
          } else {
            // For non-embed mode, still pass data but also redirect
            // The parent will handle optimistic update
            onSave?.(false, fabricsToPass);
            // Don't redirect - let parent handle UI update optimistically
            onClose?.();
          }
        } else {
          // ⚡ FIX: POST API failed - show error and don't update UI
          const errorMsg = data.message || 'Operation failed - fabric was not created';
          devError('❌ POST API failed:', { success: data.success, message: errorMsg, data });
          showValidationMessage('error', errorMsg);
          throw new Error(errorMsg);
        }
      }
    } catch (error: any) {
      // ⚡ FIX: Better error handling with detailed logging
      devError('❌ Error in handleSubmit:', error);
      
      let errorMessage = 'An error occurred while saving';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'AbortError') {
        errorMessage = 'Request was cancelled or timed out';
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error - Please check your connection';
      }
      
      showValidationMessage('error', errorMessage);
      console.error('Full error details:', error);
    } finally {
      setLoading(false);
      setIsSaving(false); // ✨ Reset saving state
    }
  };


  // Get initial theme to prevent flash - check localStorage or system preference
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  };

  // Don't render until dark mode is mounted to prevent flash
  if (!darkModeMounted) {
    const initialIsDark = getInitialTheme();
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        initialIsDark ? 'bg-gray-900' : 'bg-white'
                  }`}>
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
          initialIsDark ? 'border-blue-400' : 'border-blue-600'
                      }`}></div>
      </div>
    );
  }

  // Main content wrapper
  const mainContent = (
    <div
      className={`w-full ${embedMode ? '' : 'max-w-6xl mx-auto'} transition-all duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2 ${embedMode ? '' : 'border shadow-2xl shadow-blue-500/10 ring-1 ring-blue-500/10'} ${
        isDarkMode
          ? 'text-white bg-gray-900 border-gray-800'
          : 'text-gray-900 bg-white border-gray-200'
      }`}
      onWheel={(e) => {
        // Prevent scroll from propagating to background
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        // Prevent touch scroll from propagating to background
        e.stopPropagation();
      }}
    >

      {/* Floating Validation Message */}
      {validationMessage && (
        <div 
          className={`fixed top-4 left-4 min-w-80 max-w-md p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm transform transition-all duration-300 animate-in fade-in-0 slide-in-from-left-4 ${
            validationMessage.type === 'success'
              ? 'bg-green-900/90 border-green-500 text-green-100'
              : validationMessage.type === 'error'
              ? 'bg-red-900/90 border-red-500 text-red-100'
              : validationMessage.type === 'warning'
              ? 'bg-yellow-900/90 border-yellow-500 text-yellow-100'
              : 'bg-blue-900/90 border-blue-500 text-blue-100'
          }`}
          style={{ zIndex: Z_INDEX.TOAST }}
        >
          <div className="flex items-center space-x-3">
            <div className="shrink-0 animate-fade-in-scale">
              {validationMessage.type === 'success' ? (
                <CheckIcon className="h-6 w-6 text-green-400" />
              ) : validationMessage.type === 'error' ? (
                <XMarkIcon className="h-6 w-6 text-red-400" />
              ) : validationMessage.type === 'warning' ? (
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
              ) : (
                <PhotoIcon className="h-6 w-6 text-blue-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{validationMessage.text}</p>
            </div>
            <button
              onClick={() => setValidationMessage(null)}
              className={`shrink-0 transition-all duration-200 hover:scale-110 active:scale-95 rounded-full p-1 ${
                isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {!embedMode && (
        <>
        {/* Enhanced Header - centered card style like Sampling modal */}
        <div className={`border-b shadow-lg transition-all duration-300 animate-in fade-in-0 slide-in-from-top-2 ${
          isDarkMode 
            ? 'border-gray-700/60 bg-gray-850' 
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="w-full px-2 sm:px-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 sm:py-6 lg:h-20 space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-6">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <h1 className={`text-xl sm:text-2xl font-bold transition-colors duration-300 flex items-center gap-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {isEditMode ? (
                      <>
                        <button
                          onClick={() => {
                            if (isModal) {
                              router.push('/fabrics');
                            } else {
                              router.push('/fabrics');
                            }
                          }}
                          className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Back to fabrics"
                        >
                          <PencilIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </button>
                        <span>Edit Fabric</span>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            if (isModal) {
                              router.push('/fabrics');
                            } else {
                              router.push('/fabrics');
                            }
                          }}
                          className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Back to fabrics"
                        >
                          <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </button>
                        <span>Create New Fabric</span>
                      </>
                    )}
                    {formData.items[0]?.qualityCode && (
                      <span className={`ml-3 text-lg sm:text-xl font-normal ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        - {formData.items[0].qualityCode}
                      </span>
                    )}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Main Content */}
      <div className={`w-full ${embedMode ? '' : 'px-1 sm:px-2 pb-4'} transition-all duration-300 animate-in fade-in-0 slide-in-from-top-4 delay-100 page-fade ${
        isDarkMode ? 'text-white' : 'text-gray-900'
      }`}>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="relative max-h-[85vh] sm:max-h-[80vh] overflow-y-auto p-2 sm:p-3">
          {/* Loading Overlay - Show when loading data for edit */}
          {loadingData && isEditMode && (
            <div 
              className={`absolute inset-0 backdrop-blur-sm flex items-center justify-center rounded-xl pointer-events-auto ${
                isDarkMode ? 'bg-black/40' : 'bg-white/80'
              }`}
              style={{ zIndex: Z_INDEX.MODAL }}
            >
              <div className={`flex flex-col items-center space-y-4 p-6 rounded-xl shadow-2xl border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}>
                <div className={`animate-spin rounded-full h-12 w-12 border-2 border-t-transparent ${
                  isDarkMode ? 'border-blue-500' : 'border-blue-600'
                }`}></div>
                <p className={`text-lg font-semibold ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Loading fabric data...
                </p>
              </div>
            </div>
          )}
          
          {/* Disable form interactions when loading data */}
          {loadingData && isEditMode && (
            <div className="absolute inset-0 z-40 pointer-events-auto" aria-hidden="true"></div>
          )}

          {/* Shared Fabric Information */}
          <div className={`p-3 rounded-lg border mb-3 transition-all duration-500 ease-out animate-in fade-in-0 slide-in-from-top-4 delay-200 ${
            isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
          }`}>
                            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              <CubeIcon className="h-4 w-4" />
                              Quality Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Quality Code */}
              <div>
                <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <HashtagIcon className="h-4 w-4" />
                  <span>Quality Code <span className="text-red-500">*</span></span>
                </label>
                <div className="relative">
                <input
                  type="text"
                  value={formData.items[0]?.qualityCode || ''}
                  onChange={(e) => {
                    handleSharedFieldChange('qualityCode', e.target.value);
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      checkQualityCodeExists(e.target.value);
                    } else {
                      // Clear error if field is empty
                      setErrors(prev => ({ ...prev, [`items.0.qualityCode`]: '' }));
                    }
                  }}
                  placeholder="e.g., 1001-WL"
                  disabled={loadingData}
                    className={`w-full p-2 sm:p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:scale-[1.01] hover:border-blue-300 input-focus text-sm sm:text-base ${
                    errors[`items.0.qualityCode`] 
                      ? 'border-red-500 focus:ring-red-400' 
                      : isQualityCodeValid 
                        ? 'border-green-500 focus:ring-green-400' 
                        : ''
                  } ${loadingData ? 'opacity-50 cursor-not-allowed' : ''} ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-500 text-white placeholder-gray-400 hover:border-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 hover:border-gray-400'
                  }`}
                />
                  {/* Clear button for Quality Code */}
                  {formData.items[0]?.qualityCode && (
                    <button
                      type="button"
                      onClick={() => handleSharedFieldChange('qualityCode', '')}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                          : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                      }`}
                      title="Clear field"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                  {checkingQualityCode && (
                    <div className="absolute right-3 top-3" title="Checking quality code...">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  {isQualityCodeValid && !checkingQualityCode && (
                    <div className="absolute right-3 top-3" title="Quality code is available">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {errors[`items.0.qualityCode`] && !checkingQualityCode && (
                    <div className="absolute right-3 top-3" title="Quality code error">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                </div>
                 {errors[`items.0.qualityCode`] && (
                   <div className="mt-2 p-2 sm:p-3 bg-red-900/20 border border-red-500/30 rounded-lg animate-in slide-in-from-top-2">
                     <p className="text-red-400 text-xs sm:text-sm flex items-center">
                       <XMarkIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                       <span className="flex-1">{errors[`items.0.qualityCode`]}</span>
                     </p>
                   </div>
                 )}
                 {!isEditMode && (
                   <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                     You can reuse quality codes to add items.
                   </p>
                 )}
                 {isQualityCodeValid && !isEditMode && (
                   <div className="mt-2 p-2 sm:p-3 bg-green-900/20 border border-green-500/30 rounded-lg animate-in slide-in-from-top-2">
                     <p className="text-green-400 text-xs sm:text-sm flex items-center">
                       <svg className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                       </svg>
                       <span className="flex-1">Ready to create!</span>
                     </p>
                   </div>
                 )}
              </div>

              {/* Quality Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <TagIcon className="h-4 w-4" />
                  <span>Quality Name <span className="text-red-500">*</span></span>
                </label>
                <div className="relative">
                <input
                  type="text"
                  value={formData.items[0]?.qualityName || ''}
                  onChange={(e) => handleSharedFieldChange('qualityName', e.target.value)}
                  placeholder="Enter quality name"
                    className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                   } ${errors.qualityName ? 'border-red-500' : ''}`}
                 />
                   {/* Clear button for Quality Name */}
                   {formData.items[0]?.qualityName && (
                     <button
                       type="button"
                       onClick={() => handleSharedFieldChange('qualityName', '')}
                       className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                         isDarkMode 
                           ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                           : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                       }`}
                       title="Clear field"
                     >
                       <XMarkIcon className="h-4 w-4" />
                     </button>
                   )}
                </div>
                 {errors.qualityName && (
                   <p className="text-red-500 text-sm mt-1">{errors.qualityName}</p>
                 )}
               </div>

              {/* Type Dropdown */}
              <div>
                <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <BeakerIcon className="h-4 w-4" />
                  <span>Type</span>
                </label>
                <div className="relative" ref={typeDropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={showTypeDropdown ? typeSearch : (formData.items[0]?.type || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTypeSearch(value);
                        handleSharedFieldChange('type', value);
                        if (!showTypeDropdown) {
                          setShowTypeDropdown(true);
                        }
                      }}
                      onFocus={() => {
                        setShowTypeDropdown(true);
                        setTypeSearch(formData.items[0]?.type || '');
                      }}
                      onBlur={() => {
                        // Clear existing timeout
                        if (dropdownBlurTimeoutRef.current) {
                          clearTimeout(dropdownBlurTimeoutRef.current);
                        }
                        // Delay to allow click on dropdown items
                        dropdownBlurTimeoutRef.current = setTimeout(() => {
                          setShowTypeDropdown(false);
                          if (formData.items[0]?.type) {
                            setTypeSearch('');
                          }
                          dropdownBlurTimeoutRef.current = null;
                        }, 200);
                      }}
                      placeholder="Search or select type..."
                      className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } ${errors[`items.0.type`] ? 'border-red-500' : ''}`}
                    />
                    {/* Clear button for Type */}
                    {(formData.items[0]?.type || (showTypeDropdown && typeSearch)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSharedFieldChange('type', '');
                          setTypeSearch('');
                          setShowTypeDropdown(false);
                        }}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors z-10 ${
                          isDarkMode 
                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                            : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                        }`}
                        title="Clear field"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                    {/* Dropdown arrow */}
                    {!formData.items[0]?.type && !(showTypeDropdown && typeSearch) && (
                      <button
                        type="button"
                        onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        <ChevronDownIcon className={`h-4 w-4 transition-all duration-200 ${
                          showTypeDropdown ? 'rotate-180' : ''
                        }`} />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown Options */}
                  {showTypeDropdown && (
                    <div 
                      className={`absolute w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-auto ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600' 
                          : 'bg-white border-gray-300'
                      }`}
                      style={{ zIndex: Z_INDEX.DROPDOWN }}
                    >
                      {typeOptions
                        .filter(option => 
                          option.toLowerCase().includes(typeSearch.toLowerCase())
                        )
                        .map((option, index) => (
                          <button
                            key={index}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSharedFieldChange('type', option);
                              setTypeSearch('');
                              setShowTypeDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-blue-500 hover:text-white transition-colors ${
                              isDarkMode 
                                ? 'text-gray-300 hover:bg-blue-600' 
                                : 'text-gray-900'
                            } ${formData.items[0]?.type === option ? 'bg-blue-500 text-white' : ''}`}
                          >
                            {option}
                          </button>
                        ))}
                      {typeOptions.filter(option => 
                        option.toLowerCase().includes(typeSearch.toLowerCase())
                      ).length === 0 && (
                        <div className={`px-4 py-2 text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          No types found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Type field error */}
                {errors[`items.0.type`] && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {errors[`items.0.type`]}
                  </p>
                )}
              </div>
            </div>

            {/* Quality Images Section */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className={`block text-sm font-medium flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <PhotoIcon className="h-4 w-4" />
                  <span>Quality Images</span>
                </label>
                <span className={`text-xs px-2 py-1 rounded ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                  {(pendingImageFiles?.length || 0) + (formData.items[0]?.images?.length || 0)} image(s)
                </span>
              </div>
              
              {/* Image Upload Area - Compact with Drag & Drop */}
              <div 
                className={`flex items-center space-x-3 mb-3 p-4 rounded-lg border-2 border-dashed transition-all duration-200 ${
                  dragActive
                    ? isDarkMode
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-blue-400 bg-blue-50'
                    : isDarkMode
                      ? 'border-gray-600 bg-gray-800/50'
                      : 'border-gray-300 bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                  id="quality-image-upload"
                />
                <label
                  htmlFor="quality-image-upload"
                  className={`px-6 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 hover-lift ${
                    isDarkMode 
                      ? 'border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400' 
                      : 'border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600'
                  }`}
                >
                  <CloudArrowUpIcon className="h-5 w-5 inline mr-2" />
                  Upload Image
                </label>
                
                {/* Camera Button */}
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                  }}
                  className={`px-6 py-3 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 active:scale-95 hover-lift ${
                    isDarkMode 
                      ? 'border-gray-600 hover:border-green-500 text-gray-300 hover:text-green-400' 
                      : 'border-gray-300 hover:border-green-400 text-gray-600 hover:text-green-600'
                  }`}
                >
                  <PhotoIcon className="h-5 w-5 inline mr-2" />
                  Camera
                </button>
                
                {uploadingImages && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>Uploading...</span>
                  </div>
                )}
                
                {/* Drag & Drop Hint - Hidden on screens 1200px and below */}
                {!dragActive && pendingImageFiles.length === 0 && (
                  <span className={`text-xs ml-auto hidden xl:inline ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    Drag & drop images here
                  </span>
                )}
                {dragActive && (
                  <span className={`text-xs ml-auto font-semibold animate-pulse ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    Drop images here
                  </span>
                )}
              </div>
              
              {/* Image Previews - Only show if there are valid images */}
              {((pendingImageFiles && pendingImageFiles.length > 0) || (formData.items[0]?.images && formData.items[0].images.filter(img => img && img.trim() !== '').length > 0)) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Show pending images first */}
                  {pendingImageFiles.map((pendingFile, imageIndex) => (
                    <div key={`pending-${imageIndex}`} className="relative group">
                      <div className={`aspect-square rounded-lg overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-105 animate-fade-in-scale ${
                        isDarkMode 
                          ? 'border-yellow-500 bg-gray-700' 
                          : 'border-yellow-400 bg-gray-100'
                      }`}>
                        <img
                          src={pendingFile.previewUrl}
                          alt={`Pending image ${imageIndex + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setShowImagePreview({ url: pendingFile.previewUrl, index: imageIndex })}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        {/* Preview Button */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button
                            type="button"
                            onClick={() => setShowImagePreview({ url: pendingFile.previewUrl, index: imageIndex })}
                            className="bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
                            title="Preview Image"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeImage(imageIndex)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all duration-200 z-10 hover:scale-110 active:scale-95"
                        title="Remove Image"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {/* Show uploaded images - filter out empty/invalid URLs */}
                  {formData.items[0]?.images && formData.items[0].images
                    .filter((image) => image && image.trim() !== '') // Filter out empty strings
                    .map((image, imageIndex) => {
                    const displayIndex = pendingImageFiles.length + imageIndex;
                    return (
                    <div key={`uploaded-${imageIndex}`} className="relative group">
                      <div className={`aspect-square rounded-lg overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-105 animate-fade-in-scale ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-700' 
                          : 'border-gray-200 bg-gray-100'
                      }`}>
                        <img
                          src={image}
                          alt={`Quality image ${imageIndex + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setShowImagePreview({ url: image, index: displayIndex })}
                          onError={(e) => {
                            // Simply hide the image if it fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            // Show a simple placeholder without error text
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}">
                                  <svg class="h-8 w-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                  </svg>
                                </div>
                              `;
                            }
                          }}
                          onLoad={(e) => {
                            }}
                        />
                        
                        {/* Preview Button - Shows on Hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button
                            type="button"
                            onClick={() => setShowImagePreview({ url: image, index: displayIndex })}
                            className="bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
                            title="Preview Image"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeImage(displayIndex)}
                        className={`absolute -top-2 -right-2 rounded-full p-1.5 transition-all duration-200 z-10 hover:scale-110 active:scale-95 ${
                          isDarkMode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                        title="Remove Image"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Fabric Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className={`text-base font-semibold flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <UserIcon className="h-4 w-4" />
                  <span>Weaver Information</span>
                </h3>
                
              </div>
            </div>

            {formData.items.map((item, index) => (
              <div 
                key={index}
                id={`fabric-item-${index}`}
                className={`p-3 rounded-lg border shadow-md transition-all duration-300 animate-in fade-in-0 slide-in-from-top-4 hover-lift ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-800/50' 
                    : 'border-gray-200 bg-white'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base sm:text-lg font-semibold">Weaver {index + 1}</h4>
                  {formData.items.length > 1 && (!isEditMode || !(formData.items[index] as any)?._id || (formData.items[index] as any)?._id?.startsWith('temp-') || isMaster) && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 delete-button-hover ${
                        isDarkMode 
                          ? 'text-red-400 hover:bg-red-500 hover:text-white' 
                          : 'text-red-600 hover:bg-red-500 hover:text-white'
                      }`}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  {/* Weaver */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <UserIcon className="h-4 w-4" />
                      <span>Weaver Name <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.weaver}
                      onChange={(e) => handleItemChange(index, 'weaver', e.target.value)}
                      placeholder="Enter weaver name"
                        className={`w-full p-2.5 sm:p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:scale-[1.01] hover:border-blue-300 input-focus ${errors[`items.${index}.weaver`] ? 'border-red-500 focus:ring-red-400' : ''} ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-500 text-white placeholder-gray-400 hover:border-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 hover:border-gray-400'
                      }`}
                    />
                      {/* Clear button for Weaver */}
                      {item.weaver && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'weaver', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                     {errors[`items.${index}.weaver`] && (
                       <p className="text-red-500 text-sm mt-1">{errors[`items.${index}.weaver`]}</p>
                     )}
                  </div>

                  {/* Weaver Quality Name */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <TagIcon className="h-4 w-4" />
                      <span>Weaver Quality Name <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.weaverQualityName}
                      onChange={(e) => handleItemChange(index, 'weaverQualityName', e.target.value)}
                      placeholder="Enter weaver quality name"
                        className={`w-full p-3 pr-10 rounded-lg border transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors[`items.${index}.weaverQualityName`] 
                          ? 'border-red-500 focus:ring-red-400' 
                          : ''
                      } ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Weaver Quality Name */}
                      {item.weaverQualityName && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'weaverQualityName', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {errors[`items.${index}.weaverQualityName`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`items.${index}.weaverQualityName`]}</p>
                    )}
                  </div>

                  {/* Greigh Width */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <ArrowsRightLeftIcon className="h-4 w-4" />
                      <span>Greigh Width (inches)</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.greighWidth}
                      onChange={(e) => handleItemChange(index, 'greighWidth', e.target.value)}
                      placeholder="e.g., 58.5"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Greigh Width */}
                      {item.greighWidth && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'greighWidth', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Finish Width */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <ArrowsRightLeftIcon className="h-4 w-4" />
                      <span>Finish Width (inches)</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.finishWidth}
                      onChange={(e) => handleItemChange(index, 'finishWidth', e.target.value)}
                      placeholder="e.g., 56.0"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Finish Width */}
                      {item.finishWidth && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'finishWidth', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <ScaleIcon className="h-4 w-4" />
                      <span>Weight (KG)</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.weight}
                      onChange={(e) => handleItemChange(index, 'weight', e.target.value)}
                      placeholder="e.g., 8.0"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Weight */}
                      {item.weight && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'weight', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GSM */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <DocumentTextIcon className="h-4 w-4" />
                      <span>GSM</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.gsm}
                      onChange={(e) => handleItemChange(index, 'gsm', e.target.value)}
                      placeholder="e.g., 72.5"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for GSM */}
                      {item.gsm && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'gsm', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <DocumentTextIcon className="h-4 w-4" />
                      <span>Content</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.content || ''}
                      onChange={(e) => handleItemChange(index, 'content', e.target.value)}
                      placeholder="e.g., 100% Polyester"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Content */}
                      {item.content && item.content.trim() && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'content', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Danier */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <HashtagIcon className="h-4 w-4" />
                      <span>Danier (Count)</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.danier || ''}
                      onChange={(e) => handleItemChange(index, 'danier', e.target.value)}
                      placeholder="e.g., 55*22D"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Danier */}
                      {item.danier && item.danier.trim() && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'danier', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reed */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <Squares2X2Icon className="h-4 w-4" />
                      <span>Reed</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.reed}
                      onChange={(e) => handleItemChange(index, 'reed', e.target.value)}
                      placeholder="e.g., 120"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Reed */}
                      {item.reed && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'reed', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pick */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <ArrowsRightLeftIcon className="h-4 w-4" />
                      <span>Pick</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.pick}
                      onChange={(e) => handleItemChange(index, 'pick', e.target.value)}
                      placeholder="e.g., 80"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Pick */}
                      {item.pick && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'pick', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Greigh Rate */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <CurrencyDollarIcon className="h-4 w-4" />
                      <span>Greigh Rate (₹)</span>
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={item.greighRate}
                      onChange={(e) => handleItemChange(index, 'greighRate', e.target.value)}
                      placeholder="e.g., 150.00"
                        className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:scale-[1.01] hover:border-blue-300 input-focus ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                      {/* Clear button for Greigh Rate */}
                      {item.greighRate && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'greighRate', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rack */}
                  <div>
                    <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <CubeIcon className="h-4 w-4" />
                      <span>Rack</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={item.rack || ''}
                        onChange={(e) => handleItemChange(index, 'rack', e.target.value)}
                        placeholder="Enter rack"
                        className={`w-full p-2.5 sm:p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:scale-[1.01] hover:border-blue-300 input-focus ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-500 text-white placeholder-gray-400 hover:border-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 hover:border-gray-400'
                        }`}
                      />
                      {/* Clear button for Rack */}
                      {item.rack && (
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'rack', '')}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                            isDarkMode 
                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/20' 
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                          }`}
                          title="Clear field"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Item Button - Full Width */}
          <div className="mt-4 sm:mt-6">
              <button
                type="button"
                onClick={addItem}
                              className={`w-full px-4 py-3 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center space-x-2 group hover-lift hover:scale-[1.02] active:scale-95 ${
                  isDarkMode 
                    ? 'border-gray-500 hover:border-blue-400 text-gray-300 hover:text-blue-300 hover:bg-blue-500/10' 
                    : 'border-gray-300 hover:border-blue-500 text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                }`}

            >
              <PlusIcon className="h-5 w-5 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" />
                              <span className="text-base font-medium">Add Another Weaver</span>
              </button>
          </div>

          {/* Submit Buttons - Sticky */}
          <div className={`mt-4 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 p-3 rounded-lg shadow-lg border ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            
            <button
              type="button"
              onClick={() => {
                // Always call onClose if provided (for modal/embedded mode)
                if (onClose) {
                  onClose();
                }
                // If not embedded, navigate back
                if (!embedMode) {
                  router.push('/fabrics');
                }
              }}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 hover-lift text-sm sm:text-base ${
                isDarkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || !isFormDirty || isSaving || loading || loadingData}
              className={`px-4 sm:px-6 lg:px-8 py-2 sm:py-3 rounded-lg font-semibold transition-all duration-150 hover:scale-105 active:scale-95 hover-lift flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base ${
                !isFormValid || !isFormDirty || isSaving || loading || loadingData
                  ? 'opacity-50 cursor-not-allowed bg-gray-400' 
                  : isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              title={
                !isFormValid 
                  ? 'Please fill all required fields correctly' 
                  : !isFormDirty 
                    ? 'No changes made' 
                    : isSaving 
                      ? 'Saving fabric...' 
                      : 'Save fabric'
              }
            >
              {isSaving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : loading || loadingData ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="h-5 w-5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Modal - Using Shared Component */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        isDarkMode={isDarkMode}
      />

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={showImagePreview !== null}
        onClose={() => setShowImagePreview(null)}
        images={[
          ...pendingImageFiles.map((p: any) => p.previewUrl),
          ...(formData.items[0]?.images?.filter((img: string) => img && img.trim() !== '') || [])
        ]}
        initialIndex={showImagePreview ? showImagePreview.index : 0}
        isDarkMode={isDarkMode}
      />

    </div>
  );

  // Embed mode: return only the card without any outer page/overlay wrappers
  if (embedMode) {
    return (
      <div className="w-full">
        {mainContent}
      </div>
    );
  }

  // Render as modal if modal=true, otherwise as full page
  if (isModal) {
    return (
      <div 
        className="fixed inset-0 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in"
        style={{ zIndex: Z_INDEX.MODAL }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            router.push('/fabrics');
          }
        }}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {mainContent}
        </div>
      </div>
    );
  }

  // Full page mode
  return (
    <div className={`min-h-screen flex items-start justify-center p-3 sm:p-4 bg-black/40 dark:bg-black/50`}>
      {mainContent}
    </div>
  );
}
