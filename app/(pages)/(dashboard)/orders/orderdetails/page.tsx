'use client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

import {
  XMarkIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BeakerIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon as ClockIconSolid,
  TruckIcon,
  CogIcon,
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Order, Mill, Quality } from '@/types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useSession } from '../../hooks/useSession';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MillInputForm from '../components/MillInputForm';
import MillOutputForm from '../components/MillOutputForm';
import DispatchForm from '../components/DispatchForm';
import { getDisplayOrderId } from '@/utils/orders';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import GreyInformationModal from '../components/GreyInformationModal';
import LabDataModal from '../components/LabDataModal';

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

export default function OrderDetailsPage() {
  const { isDarkMode, mounted } = useDarkMode();
  const { isParty } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderMongoId = searchParams?.get('id');

  // ALL hooks must be declared before any conditional returns (React Rules of Hooks)
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [millInputs, setMillInputs] = useState<any[]>([]);
  const [millOutputs, setMillOutputs] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [greyInformation, setGreyInformation] = useState<any[]>([]);
  const [processDataByQuality, setProcessDataByQuality] = useState<{ [key: string]: string[] }>({});
  const [showMillInputModal, setShowMillInputModal] = useState(false);
  const [isEditingMillInput, setIsEditingMillInput] = useState(false);
  const [showMillOutputModal, setShowMillOutputModal] = useState(false);
  const [isEditingMillOutput, setIsEditingMillOutput] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [isEditingDispatch, setIsEditingDispatch] = useState(false);
  const [mills, setMills] = useState<Mill[]>([]);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [showGreyInfoModal, setShowGreyInfoModal] = useState(false);
  const [showLabDataModal, setShowLabDataModal] = useState(false);
  const [isItemsExpanded, setIsItemsExpanded] = useState(true);
  const [isGreyInfoExpanded, setIsGreyInfoExpanded] = useState(true);
  const [isMillInputsExpanded, setIsMillInputsExpanded] = useState(true);
  const [isMillOutputsExpanded, setIsMillOutputsExpanded] = useState(true);
  const [isDispatchesExpanded, setIsDispatchesExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'mill-input' | 'mill-output' | 'dispatch' | 'grey-info' | 'lab-data';
    id: string | string[];
    displayName: string;
    itemId?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleGreyInfoSuccess = useCallback((savedEntries?: any[]) => {
    setShowGreyInfoModal(false);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleLabDataSuccess = useCallback((operationType?: 'add' | 'edit' | 'delete' | 'deleteAll') => {
    setShowLabDataModal(false);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const promptDelete = useCallback((
    type: 'mill-input' | 'mill-output' | 'dispatch' | 'grey-info' | 'lab-data',
    id: string | string[],
    displayName: string,
    itemId?: string
  ) => {
    setDeleteTarget({ type, id, displayName, itemId });
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const token = localStorage.getItem('token');
    try {
      if (deleteTarget.type === 'grey-info') {
        const id = deleteTarget.id as string;
        const res = await fetch(`/api/grey-info/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete grey information');
        showSuccessMessage('Grey information deleted successfully');
      } else if (deleteTarget.type === 'mill-input') {
        const id = deleteTarget.id as string;
        const res = await fetch(`/api/mill-inputs/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete mill input');
        showSuccessMessage('Mill input deleted successfully');
      } else if (deleteTarget.type === 'mill-output') {
        const ids = Array.isArray(deleteTarget.id) ? deleteTarget.id : [deleteTarget.id];
        await Promise.all(
          ids.map(id =>
            fetch(`/api/mill-outputs/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => {
              if (!r.ok) throw new Error('Failed to delete mill output entry');
            })
          )
        );
        showSuccessMessage('Mill output entry deleted successfully');
      } else if (deleteTarget.type === 'dispatch') {
        const ids = Array.isArray(deleteTarget.id) ? deleteTarget.id : [deleteTarget.id];
        await Promise.all(
          ids.map(id =>
            fetch(`/api/dispatch/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => {
              if (!r.ok) throw new Error('Failed to delete dispatch entry');
            })
          )
        );
        showSuccessMessage('Dispatch entry deleted successfully');
      } else if (deleteTarget.type === 'lab-data') {
        const orderId = order?._id || orderMongoId;
        const itemId = deleteTarget.itemId;
        const res = await fetch(`/api/labs/${orderId}/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete lab data');
        showSuccessMessage('Lab data deleted successfully');
      }
      
      setRefreshTrigger(prev => prev + 1);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // ⚡ FIX: Prevent modal flickering - refs to track if modal is opening/closing
  const modalOperationRef = useRef({
    millInput: false,
    millOutput: false,
    dispatch: false
  });
  const [loadingSections, setLoadingSections] = useState({
    millInputs: true,
    millOutputs: true,
    dispatches: true,
    greyInformation: true,
    mills: true,
    qualities: true
  });

  // Ultra-fast progressive loading - show data as it arrives
  useEffect(() => {
    if (orderMongoId) {
      const fetchAllOrderData = async () => {
        const token = localStorage.getItem('token');

        // Fetch critical order data first for instant display
        try {
          const timestamp = Date.now();
          const orderResponse = await fetch(`/api/orders/${orderMongoId}?t=${timestamp}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store', // Ensure fresh data
            method: 'GET'
          });

          if (!orderResponse.ok) {
            setLoading(false);
            return;
          }

          const orderData = await orderResponse.json();

          if (orderData.success) {
            // ⚡ CRITICAL FIX: Always fetch fresh order data to ensure lab data is included
            // The API endpoint should return order with lab data attached to items
            const freshOrderData = orderData.data;
            setOrder(freshOrderData);
            // Set loading to false after order is set
            setLoading(false);
          } else {
            // If order not found, keep loading true (show loading indefinitely)
            // Don't set loading to false - just keep showing loading
          }
        } catch (error) {
          console.error('Error fetching order:', error);
          // Keep loading true on error - just show loading indefinitely
        }

        // Fetch all other data in parallel in background with progress tracking
        const backgroundPromises = [
          // Fetch mills and qualities with optimized headers
          fetch('/api/mills', {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'default' // Allow caching for static data
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) setMills(data.data || []);
              setLoadingSections(prev => ({ ...prev, mills: false }));
            }),

          fetch('/api/qualities', {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'default' // Allow caching for static data
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) setQualities(data.data || []);
              setLoadingSections(prev => ({ ...prev, qualities: false }));
            }),

          // Fetch order-specific data if order is available
          order && Promise.all([
            fetch(`/api/mill-inputs?orderId=${order.orderId}&t=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' },
              cache: 'no-store' // Fresh data for order-specific info
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  const millInputsData = data.data?.millInputs || [];
                  setMillInputs(millInputsData);
                  // Process mill input data by quality
                  const processedData = processMillInputDataByQuality(millInputsData);
                  setProcessDataByQuality(processedData);
                }
                setLoadingSections(prev => ({ ...prev, millInputs: false }));
              }),

            fetch(`/api/mill-outputs?orderId=${order.orderId}&t=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' },
              cache: 'no-store' // Fresh data for order-specific info
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) setMillOutputs(data.data?.millOutputs || []);
                setLoadingSections(prev => ({ ...prev, millOutputs: false }));
              }),

            fetch(`/api/dispatch?orderId=${order.orderId}&t=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' },
              cache: 'no-store' // Fresh data for order-specific info
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) setDispatches(data.data?.dispatches || []);
                setLoadingSections(prev => ({ ...prev, dispatches: false }));
              }),

            fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}&t=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' },
              cache: 'no-store' // Fresh data for order-specific info
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) setGreyInformation(data.data?.greyInfo || []);
                setLoadingSections(prev => ({ ...prev, greyInformation: false }));
              })
          ])
        ];

        // Process background data as it loads
        Promise.allSettled(backgroundPromises).catch(error => {
          console.error('Error in background data loading:', error);
        });
      };

      fetchAllOrderData();
    }
  }, [orderMongoId, order?.orderId, loading, refreshTrigger]);

  // ⚡ FIX: Add Real-Time event listeners for Dashboard Refresh
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleRealtimeSync = () => {
      // Debounce the refresh
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 500);
    };

    window.addEventListener('dashboardRefresh', handleRealtimeSync);
    window.addEventListener('realtimeDataChanged', handleRealtimeSync);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dashboardRefresh') {
        handleRealtimeSync();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('dashboardRefresh', handleRealtimeSync);
      window.removeEventListener('realtimeDataChanged', handleRealtimeSync);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);


  const party = typeof order?.party === 'string' ? null : order?.party;

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'Not selected';

    // Handle Date objects
    if (dateString instanceof Date) {
      if (isNaN(dateString.getTime())) return 'Not selected';
      return dateString.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    const dateStr = String(dateString).trim();
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return 'Not selected';

    // Handle YYYY-MM-DD format directly to avoid timezone issues
    const yyyyMmDdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyyMmDdMatch) {
      const [, year, month, day] = yyyyMmDdMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // Handle ISO date strings (extract date part to avoid timezone issues)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // Fallback to standard date parsing
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Not selected';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Function to process mill input data and group by order and quality
  const processMillInputDataByQuality = (millInputs: any[]) => {
    const processMap: { [key: string]: Set<string> } = {};

    millInputs.forEach((millInput) => {
      // Process main input
      if (millInput.quality && millInput.processName && millInput.orderId) {
        const qualityId = typeof millInput.quality === 'object' ? millInput.quality._id : millInput.quality;
        const qualityName = typeof millInput.quality === 'object' ? millInput.quality.name : millInput.quality;
        // Include orderId in the key to make it order-specific
        const key = `${millInput.orderId}_${qualityId}_${qualityName}`;

        if (!processMap[key]) {
          processMap[key] = new Set();
        }
        processMap[key].add(millInput.processName);
      }

      // Process additional meters
      if (millInput.additionalMeters && Array.isArray(millInput.additionalMeters)) {
        millInput.additionalMeters.forEach((additional: any) => {
          if (additional.quality && additional.processName && millInput.orderId) {
            const qualityId = typeof additional.quality === 'object' ? additional.quality._id : additional.quality;
            const qualityName = typeof additional.quality === 'object' ? additional.quality.name : additional.quality;
            // Include orderId in the key to make it order-specific
            const key = `${millInput.orderId}_${qualityId}_${qualityName}`;

            if (!processMap[key]) {
              processMap[key] = new Set();
            }
            processMap[key].add(additional.processName);
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
    });

    return result;
  };

  // Function to get process data for a specific quality and order
  const getProcessDataForQuality = (quality: any, orderId?: string) => {
    if (!quality || !orderId) return [];

    const qualityId = typeof quality === 'object' ? quality._id : quality;
    const qualityName = typeof quality === 'object' ? quality.name : quality;
    // Include orderId in the key to make it order-specific
    const key = `${orderId}_${qualityId}_${qualityName}`;

    return processDataByQuality[key] || [];
  };

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Image preview functions
  const handleImageClick = (images: string[], startIndex: number = 0) => {
    setPreviewImages(images);
    setCurrentImageIndex(startIndex);
    setShowImagePreview(true);
  };


  const navigateImage = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentImageIndex(prev => prev > 0 ? prev - 1 : previewImages.length - 1);
    } else {
      setCurrentImageIndex(prev => prev < previewImages.length - 1 ? prev + 1 : 0);
    }
  };

  // Mill Input handlers
  const handleAddMillInput = useCallback(() => {
    // ⚡ FIX: Prevent multiple rapid clicks
    if (modalOperationRef.current.millInput) {
      console.log('⚠️ Mill Input modal operation already in progress, ignoring click');
      return;
    }
    modalOperationRef.current.millInput = true;
    setIsEditingMillInput(false);
    setShowMillInputModal(true);
    // Reset flag after a short delay
    setTimeout(() => {
      modalOperationRef.current.millInput = false;
    }, 300);
  }, []);

  const handleEditMillInput = useCallback(() => {
    // ⚡ FIX: Prevent multiple rapid clicks
    if (modalOperationRef.current.millInput) {
      console.log('⚠️ Mill Input modal operation already in progress, ignoring click');
      return;
    }
    modalOperationRef.current.millInput = true;
    setIsEditingMillInput(true);
    setShowMillInputModal(true);
    // Reset flag after a short delay
    setTimeout(() => {
      modalOperationRef.current.millInput = false;
    }, 300);
  }, []);

  const handleMillInputSuccess = useCallback(() => {
    // ⚡ FIX: Prevent multiple calls
    if (modalOperationRef.current.millInput) {
      return;
    }
    modalOperationRef.current.millInput = true;

    // ⚡ FIX: Close modal first, then refresh data (prevents flickering)
    setShowMillInputModal(false);
    setIsEditingMillInput(false);

    // Refresh mill inputs data using Promise.all for better performance
    if (orderMongoId && order) {
      const refreshMillInputs = async () => {
        try {
          const token = localStorage.getItem('token');

          // Fetch mill inputs and mills in parallel
          const [millInputsResponse, millsResponse] = await Promise.all([
            fetch(`/api/mill-inputs?orderId=${order.orderId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('/api/mills', {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          ]);

          const [millInputsData, millsData] = await Promise.all([
            millInputsResponse.json(),
            millsResponse.json()
          ]);

          if (millInputsData.success) {
            const millInputsArray = millInputsData.data?.millInputs || [];
            setMillInputs(millInputsArray);
            // Process mill input data by quality
            const processedData = processMillInputDataByQuality(millInputsArray);
            setProcessDataByQuality(processedData);
          }
          if (millsData.success) {
            setMills(millsData.data || []);
          }
        } catch (error) {
          console.error('Error refreshing mill inputs:', error);
        } finally {
          // Reset flag after operation completes
          setTimeout(() => {
            modalOperationRef.current.millInput = false;
          }, 200);
        }
      };
      refreshMillInputs();
    } else {
      // Reset flag if no order
      setTimeout(() => {
        modalOperationRef.current.millInput = false;
      }, 200);
    }
  }, [orderMongoId, order]);

  // Mill Output handlers
  const handleAddMillOutput = useCallback(() => {
    // ⚡ FIX: Prevent multiple rapid clicks
    if (modalOperationRef.current.millOutput) {
      console.log('⚠️ Mill Output modal operation already in progress, ignoring click');
      return;
    }
    modalOperationRef.current.millOutput = true;
    // Check if there's existing data to determine edit mode
    const hasExistingData = millOutputs && millOutputs.length > 0;
    setIsEditingMillOutput(hasExistingData);
    setShowMillOutputModal(true);
    // Reset flag after a short delay
    setTimeout(() => {
      modalOperationRef.current.millOutput = false;
    }, 300);
  }, [millOutputs]);

  const handleEditMillOutput = useCallback(() => {
    // ⚡ FIX: Prevent multiple rapid clicks
    if (modalOperationRef.current.millOutput) {
      console.log('⚠️ Mill Output modal operation already in progress, ignoring click');
      return;
    }
    modalOperationRef.current.millOutput = true;
    // Always set to edit mode when clicking edit button
    setIsEditingMillOutput(true);
    setShowMillOutputModal(true);
    // Reset flag after a short delay
    setTimeout(() => {
      modalOperationRef.current.millOutput = false;
    }, 300);
  }, []);

  const handleMillOutputSuccess = useCallback((operationType?: 'add' | 'edit' | 'delete') => {
    // ⚡ FIX: Prevent multiple calls
    if (modalOperationRef.current.millOutput) {
      return;
    }
    modalOperationRef.current.millOutput = true;

    // ⚡ FIX: Close modal first, then refresh data (prevents flickering)
    setShowMillOutputModal(false);
    setIsEditingMillOutput(false);

    // Refresh data without page reload
    if (order) {
      const refreshMillOutputs = async () => {
        try {
          const token = localStorage.getItem('token');
          const cacheBuster = Date.now();

          const response = await fetch(`/api/mill-outputs?orderId=${order.orderId}&t=${cacheBuster}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          });

          const data = await response.json();
          if (data.success) {
            setMillOutputs(data.data?.millOutputs || []);
            setLoadingSections(prev => ({ ...prev, millOutputs: false }));
          }
        } catch (error) {
          console.error('Error refreshing mill outputs:', error);
        } finally {
          // Reset flag after operation completes
          setTimeout(() => {
            modalOperationRef.current.millOutput = false;
          }, 200);
        }
      };
      refreshMillOutputs();
    } else {
      // Reset flag if no order
      setTimeout(() => {
        modalOperationRef.current.millOutput = false;
      }, 200);
    }
  }, [order]);

  // Dispatch handlers
  const handleAddDispatch = useCallback(() => {
    // ⚡ FIX: Prevent multiple rapid clicks
    if (modalOperationRef.current.dispatch) {
      console.log('⚠️ Dispatch modal operation already in progress, ignoring click');
      return;
    }
    modalOperationRef.current.dispatch = true;
    // Check if there's existing data to determine edit mode
    const hasExistingData = dispatches && dispatches.length > 0;
    setIsEditingDispatch(hasExistingData);
    setShowDispatchModal(true);
    // Reset flag after a short delay
    setTimeout(() => {
      modalOperationRef.current.dispatch = false;
    }, 300);
  }, [dispatches]);

  const handleEditDispatch = useCallback(() => {
    // ⚡ FIX: Prevent multiple rapid clicks
    if (modalOperationRef.current.dispatch) {
      console.log('⚠️ Dispatch modal operation already in progress, ignoring click');
      return;
    }
    modalOperationRef.current.dispatch = true;
    // Always set to edit mode when clicking edit button
    setIsEditingDispatch(true);
    setShowDispatchModal(true);
    // Reset flag after a short delay
    setTimeout(() => {
      modalOperationRef.current.dispatch = false;
    }, 300);
  }, []);

  const handleDispatchSuccess = useCallback((operationType?: 'add' | 'edit' | 'delete') => {
    // ⚡ FIX: Prevent multiple calls
    if (modalOperationRef.current.dispatch) {
      return;
    }
    modalOperationRef.current.dispatch = true;

    // ⚡ FIX: Close modal first, then refresh data (prevents flickering)
    setShowDispatchModal(false);
    setIsEditingDispatch(false);

    // Refresh data without page reload
    if (order) {
      const refreshDispatches = async () => {
        try {
          const token = localStorage.getItem('token');
          const cacheBuster = Date.now();

          const response = await fetch(`/api/dispatch?orderId=${order.orderId}&t=${cacheBuster}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          });

          const data = await response.json();
          if (data.success) {
            setDispatches(data.data?.dispatches || []);
            setLoadingSections(prev => ({ ...prev, dispatches: false }));
          }
        } catch (error) {
          console.error('Error refreshing dispatches:', error);
        } finally {
          // Reset flag after operation completes
          setTimeout(() => {
            modalOperationRef.current.dispatch = false;
          }, 200);
        }
      };
      refreshDispatches();
    } else {
      // Reset flag if no order
      setTimeout(() => {
        modalOperationRef.current.dispatch = false;
      }, 200);
    }
  }, [order]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showImagePreview) {
        if (e.key === 'ArrowLeft') {
          navigateImage('prev');
        } else if (e.key === 'ArrowRight') {
          navigateImage('next');
        } else if (e.key === 'Escape') {
          setShowImagePreview(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImagePreview]);

  // Handle touch/swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchEndX(touch.clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;

    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      navigateImage('next');
    } else if (isRightSwipe) {
      navigateImage('prev');
    }
  };



  // Loading logic moved below to prevent "Order not found" flash

  // If still loading, show loading skeleton
  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode
          ? 'bg-background'
          : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
        }`}>
        {/* Simple Header */}
        <div className={`${isDarkMode ? 'bg-slate-800 border-gray-600' : 'bg-white border-gray-200'} border-b px-4 py-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
              <div className={`w-32 h-5 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
            </div>
            <div className={`w-6 h-6 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
          </div>
        </div>

        {/* Simple Content */}
        <div className="p-4 space-y-4">
          {/* Top Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${isDarkMode ? 'bg-slate-700 border-gray-600' : 'bg-white border-gray-200'} rounded-lg p-3 border`}>
                <div className={`w-16 h-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse mb-2`}></div>
                <div className={`w-12 h-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${isDarkMode ? 'bg-slate-700 border-gray-600' : 'bg-white border-gray-200'} rounded-lg p-3 border`}>
              <div className={`w-20 h-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse mb-3`}></div>
              <div className={`w-full h-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse mb-2`}></div>
              <div className={`w-full h-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
            </div>
            <div className={`${isDarkMode ? 'bg-slate-700 border-gray-600' : 'bg-white border-gray-200'} rounded-lg p-3 border`}>
              <div className={`w-16 h-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse mb-3`}></div>
              <div className={`w-full h-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse mb-2`}></div>
              <div className={`w-full h-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
            </div>
          </div>

          {/* Bottom Sections */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${isDarkMode ? 'bg-slate-700 border-gray-600' : 'bg-white border-gray-200'} rounded-lg p-3 border`}>
                <div className={`w-24 h-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse mb-3`}></div>
                <div className={`w-full h-16 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If no order and not loading, just show loading (no error message)
  if (!loading && !order) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode
        ? 'bg-background'
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
      }`}>
      <div className={`w-full ${isDarkMode
          ? 'bg-background'
          : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
        }`}>
        {/* Clean Header */}
        <div className={`border-b ${isDarkMode ? 'border-gray-600 bg-slate-800' : 'border-gray-200 bg-white'}`}>
          {/* Success Message */}
          {successMessage && (
            <div className={`px-2 py-2 text-center ${isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'}`}>
              <div className="flex items-center justify-center space-x-2">
                <CheckCircleIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          <div className="px-1 py-4 ">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/orders')}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center space-x-4">
                    <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Order #{getDisplayOrderId(order?.orderId)}
                    </h1>
                    <span className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full ${order?.status === 'delivered'
                        ? isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800 border border-green-200'
                        : isDarkMode ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      }`}>
                      {order?.status === 'delivered' ? <CheckCircleIcon className="h-4 w-4 mr-2" /> : <ClockIcon className="h-4 w-4 mr-2" />}
                      {order?.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push('/orders')}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`px-2 py-3 min-h-screen ${isDarkMode
            ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800'
            : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
          }`}>
          {/* Header Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            {/* Order Information */}
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                  <DocumentTextIcon className={`h-8 w-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Order Information
                </h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Order ID</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{getDisplayOrderId(order?.orderId)}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Order Type</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order?.orderType || 'Not selected'}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>PO Number</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order?.poNumber || 'Not selected'}</p>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Style</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order?.styleNo || 'Not selected'}</p>
                </div>
              </div>
            </div>

            {/* Party Information */}
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-green-600/20' : 'bg-green-100'}`}>
                  <UserIcon className={`h-8 w-8 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Party Information
                </h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {party?.name || 'Not available'}
                  </p>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Contact</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {order?.contactName || 'Not available'}
                  </p>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Phone</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {order?.contactPhone || 'Not available'}
                  </p>
                </div>
              </div>
            </div>

            {/* Important Dates */}
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                  <CalendarIcon className={`h-8 w-8 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Important Dates
                </h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Arrival Date</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatDate(order?.arrivalDate)}
                  </p>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>PO Date</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatDate(order?.poDate)}
                  </p>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Delivery Date</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatDate(order?.deliveryDate)}
                  </p>
                </div>
              </div>
            </div>

            {/* System Timestamps */}
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-orange-600/20' : 'bg-orange-100'}`}>
                  <ClockIconSolid className={`h-8 w-8 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  System Timestamps
                </h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Created</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Not available'}
                  </p>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Updated</span>
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {order?.updatedAt ? new Date(order.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Not available'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Grey Information - Full Width Card */}
          <div className="mt-4">
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} transition-all duration-300`}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsGreyInfoExpanded(!isGreyInfoExpanded)}>
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-gray-600/20' : 'bg-gray-100'}`}>
                    <DocumentTextIcon className={`h-6 w-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Grey Information
                    </h2>
                    {greyInformation.length > 0 && (
                      <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {greyInformation.length} {greyInformation.length === 1 ? 'Entry' : 'Entries'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {!isParty && isGreyInfoExpanded && (
                    <button
                      onClick={() => setShowGreyInfoModal(true)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        isDarkMode 
                          ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20' 
                          : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      + Add Grey Info
                    </button>
                  )}
                  <div className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} onClick={() => setIsGreyInfoExpanded(!isGreyInfoExpanded)}>
                    {isGreyInfoExpanded ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>

              {isGreyInfoExpanded && (
                <div className="mt-4">
                  {loadingSections.greyInformation ? (
                    <div className={`space-y-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className={`h-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
                      <div className={`h-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded animate-pulse`}></div>
                    </div>
                  ) : greyInformation && greyInformation.length > 0 ? (
                    <div className="space-y-4">
                      {greyInformation.map((greyInfo: any, index: number) => {
                        const qualityName = typeof greyInfo.quality === 'object'
                          ? greyInfo.quality?.name || 'Not selected'
                          : greyInfo.quality || 'Not selected';

                        const qualityId = typeof greyInfo.quality === 'object'
                          ? greyInfo.quality?._id || greyInfo.quality?.id
                          : greyInfo.quality;

                        let weaverName = '--';
                        if (order?.items && qualityId) {
                          const matchingItem = order.items.find((item: any) => {
                            const itemQualityId = typeof item.quality === 'string'
                              ? item.quality
                              : item.quality?._id || item.quality?.id;
                            return String(itemQualityId) === String(qualityId);
                          });

                          if (matchingItem?.weaverSupplierName) {
                            weaverName = matchingItem.weaverSupplierName;
                          }
                        }

                        return (
                          <div key={greyInfo._id || index} className={`p-4 rounded-xl border transition-all ${
                            isDarkMode ? 'bg-gray-800/40 border-gray-700 hover:bg-gray-800' : 'bg-gray-50/50 border-gray-100 hover:bg-gray-55'
                          }`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {qualityName}
                                  </span>
                                  {greyInfo.chalanNo && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                      Chalan #{greyInfo.chalanNo}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">
                                  Weaver: <span className="font-semibold text-gray-700 dark:text-gray-300">{weaverName}</span> &middot; Qty: <span className="font-semibold">{greyInfo.quantity || '--'}</span> &middot; Pcs: <span className="font-semibold">{greyInfo.numberOfPieces || '--'}</span> &middot; Date: <span className="font-semibold">{greyInfo.date ? formatDate(greyInfo.date) : '--'}</span>
                                </p>
                              </div>

                              {!isParty && (
                                <div className="flex items-center space-x-1.5 flex-shrink-0">
                                  <button
                                    onClick={() => setShowGreyInfoModal(true)}
                                    className={`p-1.5 rounded-lg border transition ${
                                      isDarkMode 
                                        ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20' 
                                        : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                                    }`}
                                    title="Edit Grey Info"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => promptDelete('grey-info', greyInfo._id, 'Grey Info')}
                                    className={`p-1.5 rounded-lg border transition ${
                                      isDarkMode 
                                        ? 'bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600/20' 
                                        : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                    }`}
                                    title="Delete Grey Info"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg font-medium">No grey information available</p>
                      <p className="text-sm">Grey information will appear here when available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Order Items & Lab Data Section */}
          {order?.items && order.items.length > 0 && (
            <div className="mt-4">
              <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} transition-all duration-300`}>
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-indigo-600/20' : 'bg-indigo-100'}`}>
                      <DocumentTextIcon className={`h-8 w-8 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <h2 className={`text-2xl font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Items & Lab Data
                      <span className={`px-2.5 py-0.5 text-sm font-semibold rounded-full ${isDarkMode ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-55 text-indigo-600'}`}>
                        {order?.items?.length || 0}
                      </span>
                    </h2>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                    {isItemsExpanded ? (
                      <ChevronUpIcon className="h-6 w-6" />
                    ) : (
                      <ChevronDownIcon className="h-6 w-6" />
                    )}
                  </div>
                </div>

                {isItemsExpanded && (
                  <div className="mt-6 space-y-4">
                    {order.items.map((item, index) => {
                      const totalImages = item.imageUrls?.length || 0;
                      const mainImage = totalImages > 0 && item.imageUrls ? item.imageUrls[0] : null;
                      const qualityName = typeof item.quality === 'string' ? item.quality : item.quality?.name || '--';
                      
                      const hasLabData = !!(item.labData?.labSendDate || item.labData?.sampleNumber);

                      return (
                        <div key={index} className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                        }`}>
                          <div className="flex flex-col gap-4 w-full">
                            {/* Details Column */}
                            <div className="flex-1 space-y-4 w-full">
                              {/* Horizontal Row: Title, Weaver, Process, Quantity */}
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {qualityName}
                                  </h3>
                                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Weaver: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.weaverSupplierName || '--'}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Process Badge */}
                                  {(() => {
                                    const processFromAPI = getHighestPriorityProcess((item as any).processData, qualityName);
                                    if (processFromAPI) {
                                      return (
                                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20`}>
                                          {processFromAPI}
                                        </span>
                                      );
                                    }
                                    const itemQualityId = typeof item.quality === 'object' ? item.quality._id : item.quality;
                                    const relevantProcesses: string[] = [];
                                    millInputs.forEach((millInput: any) => {
                                      if (millInput.quality?._id?.toString() === itemQualityId?.toString() || millInput.quality?.name === qualityName) {
                                        if (millInput.processName) relevantProcesses.push(millInput.processName);
                                      }
                                      if (millInput.additionalMeters) {
                                        millInput.additionalMeters.forEach((add: any) => {
                                          if (add.quality?._id?.toString() === itemQualityId?.toString() || add.quality?.name === qualityName) {
                                            if (add.processName) relevantProcesses.push(add.processName);
                                          }
                                        });
                                      }
                                    });
                                    const unique = [...new Set(relevantProcesses)];
                                    if (unique.length > 0) {
                                      return (
                                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20`}>
                                          {unique[0]}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20`}>
                                        No Process
                                      </span>
                                    );
                                  })()}

                                  {/* Quantity Badge */}
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    isDarkMode ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                  }`}>
                                    Qty: {item.quantity || '--'}
                                  </span>
                                </div>
                              </div>

                              {/* Rates Grid */}
                              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-gray-905 border-gray-700' : 'bg-gray-55 border-gray-100'}`}>
                                  <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Purchase</p>
                                  <p className="text-sm sm:text-base font-bold text-emerald-500">
                                    {item.purchaseRate ? `₹${Number(item.purchaseRate).toFixed(2)}` : '--'}
                                  </p>
                                </div>
                                <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-gray-905 border-gray-700' : 'bg-gray-55 border-gray-100'}`}>
                                  <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Mill</p>
                                  <p className="text-sm sm:text-base font-bold text-sky-500">
                                    {item.millRate ? `₹${Number(item.millRate).toFixed(2)}` : '--'}
                                  </p>
                                </div>
                                <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-gray-905 border-gray-700' : 'bg-gray-55 border-gray-100'}`}>
                                  <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Sales</p>
                                  <p className="text-sm sm:text-base font-bold text-violet-500">
                                    {item.salesRate ? `₹${Number(item.salesRate).toFixed(2)}` : '--'}
                                  </p>
                                </div>
                              </div>

                              {/* Description */}
                              {item.description && (
                                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} leading-relaxed`}>
                                  {item.description}
                                </p>
                              )}

                              {/* Horizontal Scroll of Enlarged Images */}
                              {item.imageUrls && item.imageUrls.length > 0 && (
                                <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                                  {item.imageUrls.map((imageUrl, imgIndex) => (
                                    <div
                                      key={imgIndex}
                                      className="relative group cursor-pointer flex-shrink-0 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transition-all duration-300 hover:scale-102 hover:shadow-lg"
                                      style={{ height: '140px' }}
                                      onClick={() => handleImageClick(item.imageUrls!, imgIndex)}
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`Item image ${imgIndex + 1}`}
                                        className="h-full w-auto object-cover rounded-2xl"
                                        style={{ height: '100%', minWidth: '100px' }}
                                      />
                                      {/* Count Badge on the top-left */}
                                      <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-md">
                                        {imgIndex + 1}/{totalImages}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Lab Data Box */}
                              <div className={`mt-2 p-4 rounded-xl border ${
                                hasLabData
                                  ? (isDarkMode ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-yellow-50/30 border-yellow-200/50')
                                  : (isDarkMode ? 'bg-gray-900/20 border-gray-800' : 'bg-gray-50/50 border-gray-100')
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-2">
                                    <BeakerIcon className={`h-5 w-5 ${hasLabData ? 'text-yellow-500' : 'text-gray-400'}`} />
                                    <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Lab Data</span>
                                  </div>
                                  {hasLabData && !isParty && (
                                    <div className="flex items-center space-x-1.5">
                                      <button
                                        onClick={() => setShowLabDataModal(true)}
                                        className={`p-1.5 rounded-lg border transition ${
                                          isDarkMode 
                                            ? 'bg-purple-600/10 border-purple-500/20 text-purple-400 hover:bg-purple-600/20' 
                                            : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100'
                                        }`}
                                        title="Edit Lab Data"
                                      >
                                        <PencilIcon className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => promptDelete('lab-data', order?._id || orderMongoId || '', 'Lab Data', item._id)}
                                        className={`p-1.5 rounded-lg border transition ${
                                          isDarkMode 
                                            ? 'bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600/20' 
                                            : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                        }`}
                                        title="Delete Lab Data"
                                      >
                                        <TrashIcon className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {hasLabData ? (
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <span className="text-gray-400 block mb-0.5">Send Date</span>
                                      <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-855'}`}>
                                        {item.labData?.labSendDate ? formatDate(item.labData.labSendDate) : '--'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 block mb-0.5">Approval Date</span>
                                      <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-855'}`}>
                                        {item.labData?.approvalDate ? formatDate(item.labData.approvalDate) : '--'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 block mb-0.5">Sample No</span>
                                      <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-855'}`}>
                                        {item.labData?.sampleNumber || '--'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">No lab data yet.</span>
                                    {!isParty && (
                                      <button
                                        onClick={() => setShowLabDataModal(true)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                                          isDarkMode 
                                            ? 'bg-purple-600/10 border-purple-500/20 text-purple-400 hover:bg-purple-600/20' 
                                            : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100'
                                        }`}
                                      >
                                        + Add Lab Data
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mill Input Data Section */}
          <div className="mt-6">
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} transition-all duration-300`}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsMillInputsExpanded(!isMillInputsExpanded)}>
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                    <CogIcon className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Mill Input Data
                    </h2>
                    {millInputs.length > 0 && (
                      <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {millInputs.length} {millInputs.length === 1 ? 'Entry' : 'Entries'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {!isParty && isMillInputsExpanded && (
                    <button
                      onClick={handleAddMillInput}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        isDarkMode 
                          ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20' 
                          : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      + Add Mill Input
                    </button>
                  )}
                  <div className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} onClick={() => setIsMillInputsExpanded(!isMillInputsExpanded)}>
                    {isMillInputsExpanded ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>

              {isMillInputsExpanded && (
                <div className="mt-6">
                  {millInputs && millInputs.length > 0 ? (
                    <div className="space-y-4">
                      {millInputs.map((millInput: any, index: number) => {
                        const millName = typeof millInput.mill === 'object' ? millInput.mill?.name || 'Unknown Mill' : millInput.mill || 'Unknown Mill';
                        const qualityName = typeof millInput.quality === 'object' ? millInput.quality?.name || '--' : millInput.quality || '--';
                        return (
                          <div key={millInput._id || index} className={`p-4 rounded-xl border transition-all ${
                            isDarkMode ? 'bg-gray-800/40 border-gray-700 hover:bg-gray-800' : 'bg-gray-50/50 border-gray-100 hover:bg-gray-55'
                          }`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {millName}
                                  </span>
                                  {millInput.processName && (
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                      isDarkMode ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-600 border border-orange-100'
                                    }`}>
                                      {millInput.processName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">
                                  Quality: <span className="font-semibold text-gray-700 dark:text-gray-300">{qualityName}</span> &middot; Qty: <span className="font-semibold">{millInput.greighMtr || '--'} mtr</span> &middot; Pcs: <span className="font-semibold">{millInput.pcs || '--'} pcs</span> &middot; Date: <span className="font-semibold">{millInput.millDate ? formatDate(millInput.millDate) : '--'}</span> &middot; Chalan: <span className="font-semibold">{millInput.chalanNo || '--'}</span>
                                </p>

                                {/* Additional Cuts Vertical line block */}
                                {millInput.additionalMeters && millInput.additionalMeters.length > 0 && (
                                  <div className="mt-3 pl-3 border-l-2 border-blue-500 space-y-1">
                                    {millInput.additionalMeters.map((cut: any, cutIndex: number) => {
                                      const cutQualityName = typeof cut.quality === 'object' ? cut.quality?.name || '--' : cut.quality || '--';
                                      return (
                                        <div key={cutIndex} className="text-xs text-gray-400 dark:text-gray-400 flex items-center gap-1.5">
                                          <span className="font-semibold text-gray-600 dark:text-gray-300">{cutQualityName}:</span>
                                          <span>{cut.greighMtr || '--'} mtr, {cut.pcs || '--'} pcs &middot; <span className="text-orange-500 dark:text-orange-400">{cut.processName || '--'}</span></span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {!isParty && (
                                <div className="flex items-center space-x-1.5 flex-shrink-0">
                                  <button
                                    onClick={handleEditMillInput}
                                    className={`p-1.5 rounded-lg border transition ${
                                      isDarkMode 
                                        ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20' 
                                        : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                                    }`}
                                    title="Edit Mill Inputs"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => promptDelete('mill-input', millInput._id, 'Mill Input')}
                                    className={`p-1.5 rounded-lg border transition ${
                                      isDarkMode 
                                        ? 'bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600/20' 
                                        : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                    }`}
                                    title="Delete Mill Input"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <CogIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-xl font-semibold mb-2">No mill input data yet</p>
                      <p className="text-sm">Click "Add Mill Input" to get started</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mill Output Data Section */}
          <div className="mt-6">
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} transition-all duration-300`}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsMillOutputsExpanded(!isMillOutputsExpanded)}>
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-green-600/20' : 'bg-green-100'}`}>
                    <BuildingOfficeIcon className={`h-6 w-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Mill Output Data
                    </h2>
                    {millOutputs.length > 0 && (
                      <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {millOutputs.length} {millOutputs.length === 1 ? 'Entry' : 'Entries'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {!isParty && isMillOutputsExpanded && (
                    <button
                      onClick={handleAddMillOutput}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        isDarkMode 
                          ? 'bg-green-600/10 border-green-500/20 text-green-400 hover:bg-green-600/20' 
                          : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      + Add Mill Output
                    </button>
                  )}
                  <div className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} onClick={() => setIsMillOutputsExpanded(!isMillOutputsExpanded)}>
                    {isMillOutputsExpanded ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>

              {isMillOutputsExpanded && (
                <div className="mt-6">
                  {millOutputs && millOutputs.length > 0 ? (
                    <div className="space-y-6">
                      {(() => {
                        const groupedByDateAndBill = millOutputs.reduce((groups: any, millOutput: any) => {
                          const key = `${millOutput.recdDate}_${millOutput.millBillNo}`;
                          if (!groups[key]) {
                            groups[key] = [];
                          }
                          groups[key].push(millOutput);
                          return groups;
                        }, {});

                        return Object.entries(groupedByDateAndBill).map(([key, millOutputsForGroup]: [string, any]) => {
                          const groupIds = millOutputsForGroup.map((o: any) => o._id);
                          return (
                            <div key={key} className={`rounded-xl border shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'}`}>
                              {/* Group Header */}
                              <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-4 ${isDarkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-100'}`}>
                                <div className="flex flex-wrap items-center gap-3">
                                  <div>
                                    <span className="text-xs text-gray-400">Recd Date:</span>
                                    <span className={`ml-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {millOutputsForGroup[0].recdDate ? formatDate(millOutputsForGroup[0].recdDate) : '--'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs text-gray-400">Bill No:</span>
                                    <span className={`ml-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {millOutputsForGroup[0].millBillNo || '--'}
                                    </span>
                                  </div>
                                </div>
                                {!isParty && (
                                  <button
                                    onClick={() => promptDelete('mill-output', groupIds, 'Mill Output Group')}
                                    className={`p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-lg transition`}
                                    title="Delete Group"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>

                              {/* Mill Output Items */}
                              <div className="p-3 space-y-2">
                                {millOutputsForGroup.map((millOutput: any, groupIndex: number) => {
                                  const qualityName = typeof millOutput.quality === 'object' ? millOutput.quality?.name || '--' : millOutput.quality || '--';
                                  return (
                                    <div key={millOutput._id || groupIndex} className={`p-3 rounded-lg border flex items-center justify-between gap-4 ${
                                      isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50/50 border-gray-105'
                                    }`}>
                                      <div className="flex-1 text-sm space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{qualityName}</span>
                                          <span className="text-xs text-gray-400">
                                            Meters: <span className="font-semibold text-gray-600 dark:text-gray-300">{millOutput.finishedMtr || '--'} mtr</span> &middot; Rate: <span className="font-semibold text-gray-600 dark:text-gray-300">{millOutput.millRate ? `₹${millOutput.millRate}` : '--'}</span>
                                          </span>
                                        </div>
                                      </div>
                                      {!isParty && (
                                        <div className="flex items-center space-x-1.5">
                                          <button
                                            onClick={handleEditMillOutput}
                                            className={`p-1.5 rounded-lg border transition ${
                                              isDarkMode 
                                                ? 'bg-green-600/10 border-green-500/20 text-green-400 hover:bg-green-600/20' 
                                                : 'bg-green-50 border-green-300 text-green-600 hover:bg-green-100'
                                            }`}
                                            title="Edit Mill Output"
                                          >
                                            <PencilIcon className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => promptDelete('mill-output', millOutput._id, 'Mill Output Entry')}
                                            className={`p-1.5 rounded-lg border transition ${
                                              isDarkMode 
                                                ? 'bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600/20' 
                                                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                            }`}
                                            title="Delete Mill Output"
                                          >
                                            <TrashIcon className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <BuildingOfficeIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-xl font-semibold mb-2">No mill output data yet</p>
                      <p className="text-sm">Click "Add Mill Output" to get started</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dispatch Section */}
          <div className="mt-6">
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} transition-all duration-300`}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsDispatchesExpanded(!isDispatchesExpanded)}>
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-orange-600/20' : 'bg-orange-100'}`}>
                    <TruckIcon className={`h-6 w-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Dispatch Data
                    </h2>
                    {dispatches.length > 0 && (
                      <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                        {dispatches.length} {dispatches.length === 1 ? 'Entry' : 'Entries'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {!isParty && isDispatchesExpanded && (
                    <button
                      onClick={handleAddDispatch}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        isDarkMode 
                          ? 'bg-orange-600/10 border-orange-500/20 text-orange-400 hover:bg-orange-600/20' 
                          : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                      }`}
                    >
                      + Add Dispatch
                    </button>
                  )}
                  <div className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`} onClick={() => setIsDispatchesExpanded(!isDispatchesExpanded)}>
                    {isDispatchesExpanded ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>

              {isDispatchesExpanded && (
                <div className="mt-6">
                  {dispatches && dispatches.length > 0 ? (
                    <div className="space-y-6">
                      {(() => {
                        const groupedByDateAndBill = dispatches.reduce((groups: any, dispatch: any) => {
                          const key = `${dispatch.dispatchDate}_${dispatch.billNo}`;
                          if (!groups[key]) {
                            groups[key] = [];
                          }
                          groups[key].push(dispatch);
                          return groups;
                        }, {});

                        return Object.entries(groupedByDateAndBill).map(([key, dispatchesForGroup]: [string, any]) => {
                          const groupIds = dispatchesForGroup.map((o: any) => o._id);
                          return (
                            <div key={key} className={`rounded-xl border shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'}`}>
                              {/* Group Header */}
                              <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-4 ${isDarkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-100'}`}>
                                <div className="flex flex-wrap items-center gap-3">
                                  <div>
                                    <span className="text-xs text-gray-400">Dispatch Date:</span>
                                    <span className={`ml-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {dispatchesForGroup[0].dispatchDate ? formatDate(dispatchesForGroup[0].dispatchDate) : '--'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs text-gray-400">Bill No:</span>
                                    <span className={`ml-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {dispatchesForGroup[0].billNo || '--'}
                                    </span>
                                  </div>
                                  {dispatchesForGroup[0].transportNo && (
                                    <div>
                                      <span className="text-xs text-gray-400">Transport:</span>
                                      <span className={`ml-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-850'}`}>
                                        {dispatchesForGroup[0].transportNo}
                                      </span>
                                    </div>
                                  )}
                                  {dispatchesForGroup[0].lrNo && (
                                    <div>
                                      <span className="text-xs text-gray-400">LR:</span>
                                      <span className={`ml-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-850'}`}>
                                        {dispatchesForGroup[0].lrNo}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {!isParty && (
                                  <button
                                    onClick={() => promptDelete('dispatch', groupIds, 'Dispatch Group')}
                                    className={`p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-lg transition`}
                                    title="Delete Group"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>

                              {/* Dispatch Items */}
                              <div className="p-3 space-y-2">
                                {dispatchesForGroup.map((dispatch: any, groupIndex: number) => {
                                  const qualityName = typeof dispatch.quality === 'object' ? dispatch.quality?.name || '--' : dispatch.quality || '--';
                                  
                                  const allEntries = [
                                    {
                                      id: 'D1',
                                      finishMtr: dispatch.finishMtr,
                                      qualityName: qualityName
                                    },
                                    ...(dispatch.subItems || []).map((subItem: any, subIndex: number) => ({
                                      id: `D${subIndex + 2}`,
                                      finishMtr: subItem.finishMtr,
                                      qualityName: typeof subItem.quality === 'object' ? subItem.quality?.name || '--' : subItem.quality || '--'
                                    }))
                                  ];

                                  return (
                                    <div key={dispatch._id || groupIndex} className="space-y-2">
                                      {allEntries.map((entry, entryIndex) => (
                                        <div key={entryIndex} className={`p-3 rounded-lg border flex items-center justify-between gap-4 ${
                                          isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50/50 border-gray-105'
                                        }`}>
                                          <div className="flex-1 text-sm space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{entry.qualityName}</span>
                                              <span className="text-xs text-gray-400">
                                                Finish Meters: <span className="font-semibold text-gray-600 dark:text-gray-300">{entry.finishMtr || '--'} mtr</span>
                                              </span>
                                            </div>
                                          </div>
                                          {!isParty && entryIndex === 0 && (
                                            <div className="flex items-center space-x-1.5">
                                              <button
                                                onClick={handleEditDispatch}
                                                className={`p-1.5 rounded-lg border transition ${
                                                  isDarkMode 
                                                    ? 'bg-orange-600/10 border-orange-500/20 text-orange-400 hover:bg-orange-600/20' 
                                                    : 'bg-orange-55 border-orange-300 text-orange-650 hover:bg-orange-100'
                                                }`}
                                                title="Edit Dispatch"
                                              >
                                                <PencilIcon className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                onClick={() => promptDelete('dispatch', dispatch._id, 'Dispatch Entry')}
                                                className={`p-1.5 rounded-lg border transition ${
                                                  isDarkMode 
                                                    ? 'bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600/20' 
                                                    : 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
                                                }`}
                                                title="Delete Dispatch"
                                              >
                                                <TrashIcon className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <TruckIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-xl font-semibold mb-2">No dispatch data yet</p>
                      <p className="text-sm">Click "Add Dispatch" to get started</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        images={previewImages}
        initialIndex={currentImageIndex}
        isDarkMode={isDarkMode}
      />

      {/* Mill Input Modal */}
      {showMillInputModal && (
        <MillInputForm
          order={order}
          mills={mills}
          qualities={qualities}
          onClose={() => {
            setShowMillInputModal(false);
            setIsEditingMillInput(false);
          }}
          onSuccess={handleMillInputSuccess}
          onAddMill={() => { }}
          onRefreshMills={() => {
            // Refresh mills and qualities in parallel for better performance
            const refreshMillsAndQualities = async () => {
              try {
                const token = localStorage.getItem('token');

                const [millsResponse, qualitiesResponse] = await Promise.all([
                  fetch('/api/mills', {
                    headers: { 'Authorization': `Bearer ${token}` }
                  }),
                  fetch('/api/qualities', {
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                ]);

                const [millsData, qualitiesData] = await Promise.all([
                  millsResponse.json(),
                  qualitiesResponse.json()
                ]);

                if (millsData.success) {
                  setMills(millsData.data || []);
                }
                if (qualitiesData.success) {
                  setQualities(qualitiesData.data || []);
                }
              } catch (error) {
                console.error('Error refreshing mills and qualities:', error);
              }
            };
            refreshMillsAndQualities();
          }}
          isEditing={isEditingMillInput}
          existingMillInputs={millInputs}
        />
      )}

      {/* Mill Output Modal */}
      {showMillOutputModal && (
        <MillOutputForm
          order={order}
          qualities={qualities}
          onClose={() => {
            setShowMillOutputModal(false);
            setIsEditingMillOutput(false);
          }}
          onSuccess={handleMillOutputSuccess}
          onRefreshQualities={() => {
            const refreshQualities = async () => {
              try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/qualities', {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.success) {
                  setQualities(data.data || []);
                }
              } catch (error) {
                console.error('Error refreshing qualities:', error);
              }
            };
            refreshQualities();
          }}
          isOpen={showMillOutputModal}
          isEditing={isEditingMillOutput}
          existingMillOutputs={millOutputs}
        />
      )}

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <DispatchForm
          order={order}
          qualities={qualities}
          onClose={() => {
            setShowDispatchModal(false);
            setIsEditingDispatch(false);
          }}
          onSuccess={handleDispatchSuccess}
          onRefreshQualities={() => {
            const refreshQualities = async () => {
              try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/qualities', {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (data.success) {
                  setQualities(data.data || []);
                }
              } catch (error) {
                console.error('Error refreshing qualities:', error);
              }
            };
            refreshQualities();
          }}
          isOpen={showDispatchModal}
          isEditing={isEditingDispatch}
          existingDispatches={dispatches}
          onPreviewImage={(url, alt, allImages, startIndex) => {
            handleImageClick(allImages || [url], startIndex || 0);
          }}
        />
      )}

      {/* Grey Information Modal */}
      {showGreyInfoModal && (
        <GreyInformationModal
          order={order}
          qualities={qualities}
          isOpen={showGreyInfoModal}
          onClose={() => setShowGreyInfoModal(false)}
          onSuccess={handleGreyInfoSuccess}
          existingGreyInfo={greyInformation}
          readOnly={isParty}
        />
      )}

      {/* Lab Data Modal */}
      {showLabDataModal && order && (
        <LabDataModal
          isOpen={showLabDataModal}
          onClose={() => setShowLabDataModal(false)}
          order={order}
          onLabDataUpdate={handleLabDataSuccess}
          readOnly={isParty}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-2xl transition-all duration-300 transform scale-100 ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-white' 
              : 'bg-white border-gray-100 text-gray-900'
          }`}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full animate-bounce">
                <ExclamationTriangleIcon className="h-10 w-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Confirm Deletion</h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Are you sure you want to delete <span className="font-semibold text-red-500">{deleteTarget.displayName}</span>? This action is irreversible.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full mt-4">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition ${
                    isDarkMode 
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-gray-355' 
                      : 'bg-gray-105 border-transparent hover:bg-gray-200 text-gray-700'
                  } disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}