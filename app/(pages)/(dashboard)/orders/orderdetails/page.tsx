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

  if (isParty) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[70vh] p-6 text-center transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50/45 text-gray-800'
      }`}>
        <div className={`max-w-md w-full p-8 rounded-2xl border transition-all duration-300 shadow-xl ${
          isDarkMode 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Orders Portal</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            Your personalized order portal is under development. In the future, all your fabric orders, processing stages, and details will be tracked here.
          </p>
          <div className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/20">
            Coming Soon
          </div>
        </div>
      </div>
    );
  }

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
          const orderResponse = await fetch(`/api/orders/${orderMongoId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            cache: 'no-cache', // Ensure fresh data
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
            fetch(`/api/mill-inputs?orderId=${order.orderId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              cache: 'no-cache' // Fresh data for order-specific info
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

            fetch(`/api/mill-outputs?orderId=${order.orderId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              cache: 'no-cache' // Fresh data for order-specific info
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) setMillOutputs(data.data?.millOutputs || []);
                setLoadingSections(prev => ({ ...prev, millOutputs: false }));
              }),

            fetch(`/api/dispatch?orderId=${order.orderId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              cache: 'no-cache' // Fresh data for order-specific info
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) setDispatches(data.data?.dispatches || []);
                setLoadingSections(prev => ({ ...prev, dispatches: false }));
              }),

            fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              cache: 'no-cache' // Fresh data for order-specific info
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
  }, [orderMongoId, order?.orderId, loading]);


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

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // Loading logic moved below to prevent "Order not found" flash

  // If still loading, show loading skeleton
  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode
          ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800'
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
        ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800'
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
      }`}>
      <div className={`w-full ${isDarkMode
          ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800'
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
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
              <div className="flex items-center space-x-3 mb-6">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-600/20' : 'bg-gray-100'}`}>
                  <DocumentTextIcon className={`h-8 w-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Grey Information {greyInformation.length > 0 && `(${greyInformation.length})`}
                  {loadingSections.greyInformation && (
                    <div className="ml-3 inline-flex items-center">
                      <div className={`animate-spin rounded-full h-5 w-5 border-2 ${isDarkMode
                          ? 'border-gray-600 border-t-blue-400'
                          : 'border-gray-300 border-t-blue-600'
                        }`}></div>
                    </div>
                  )}
                </h2>
              </div>
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

                    // Get quality ID from greyInfo
                    const qualityId = typeof greyInfo.quality === 'object'
                      ? greyInfo.quality?._id || greyInfo.quality?.id
                      : greyInfo.quality;

                    // Find matching order item to get weaver name
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
                      <div key={greyInfo._id || index} className={`p-4 rounded-xl border-2 ${isDarkMode ? 'bg-gray-600 border-gray-500 hover:bg-gray-500' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        } transition-all duration-300`}>
                        {/* Data displayed in a single row */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div className="space-y-2">
                            <label className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Quality
                            </label>
                            <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {qualityName}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Weaver Name
                            </label>
                            <p className={`text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {weaverName}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Quantity
                            </label>
                            <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {greyInfo.quantity || '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Chalan Number
                            </label>
                            <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {greyInfo.chalanNo || '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Number of Pieces
                            </label>
                            <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {greyInfo.numberOfPieces || '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Date
                            </label>
                            <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {greyInfo.date ? formatDate(greyInfo.date) : '--'}
                            </p>
                          </div>
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
          </div>

          {/* Order Items and Lab Data Section */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Order Items Cards */}
            {order?.items && order.items.length > 0 && (
              <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
                <div className="flex items-center space-x-3 mb-6">
                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-indigo-600/20' : 'bg-indigo-100'}`}>
                    <DocumentTextIcon className={`h-8 w-8 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  </div>
                  <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Order Items ({order?.items?.length || 0})
                  </h2>
                </div>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className={`p-6 rounded-xl border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-lg hover:border-gray-300'} transition-all duration-300 shadow-md`}>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Item {index + 1}
                          </h3>
                          <span className={`px-4 py-2 rounded-full text-lg font-bold ${isDarkMode ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                            #{index + 1}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Quality
                            </label>
                            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {typeof item.quality === 'string' ? item.quality : item.quality?.name || '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Quantity
                            </label>
                            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {item.quantity || '--'}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Process
                            </label>
                            <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {(() => {
                                const qualityName = typeof item.quality === 'string' ? item.quality : item.quality?.name || 'N/A';

                                // Debug logging
                                console.log('🔍 Order Details - Process data debug:', {
                                  qualityName,
                                  processData: (item as any).processData,
                                  millInputs: millInputs.length,
                                  orderId: order?.orderId
                                });

                                // Use process data from API if available
                                const processFromAPI = getHighestPriorityProcess((item as any).processData, qualityName);
                                console.log('🔍 Order Details - Process from API:', processFromAPI);

                                // TEST: Show test data for order 234
                                if (order?.orderId === '234' && !processFromAPI) {
                                  console.log('🧪 TEST: Showing test process data for order 234');
                                  return (
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                        ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                                      }`}>
                                      Lot No Greigh (TEST)
                                    </span>
                                  );
                                }

                                if (processFromAPI) {
                                  const displayProcess = processFromAPI;

                                  return (
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                        ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                                      }`}>
                                      {displayProcess}
                                    </span>
                                  );
                                }

                                // Fallback to old method if no process data from API
                                const processes = getProcessDataForQuality(item.quality, order.orderId);
                                console.log('🔍 Order Details - Processes from fallback:', processes);

                                // If still no processes, try to extract directly from mill inputs
                                if (processes.length === 0 && millInputs.length > 0) {
                                  console.log('🔍 Order Details - Extracting from mill inputs directly');
                                  const itemQualityId = typeof item.quality === 'object' ? item.quality._id : item.quality;
                                  const itemQualityName = typeof item.quality === 'object' ? item.quality.name : item.quality;

                                  const relevantProcesses: string[] = [];

                                  millInputs.forEach((millInput: any) => {
                                    // Check main quality
                                    if (millInput.quality?._id?.toString() === itemQualityId?.toString() ||
                                      millInput.quality?.name === itemQualityName) {
                                      if (millInput.processName && millInput.processName.trim() !== '') {
                                        relevantProcesses.push(millInput.processName.trim());
                                      }
                                    }

                                    // Check additional meters
                                    if (millInput.additionalMeters) {
                                      millInput.additionalMeters.forEach((additional: any) => {
                                        if ((additional.quality?._id?.toString() === itemQualityId?.toString() ||
                                          additional.quality?.name === itemQualityName) &&
                                          additional.processName && additional.processName.trim() !== '') {
                                          relevantProcesses.push(additional.processName.trim());
                                        }
                                      });
                                    }
                                  });

                                  const uniqueProcesses = [...new Set(relevantProcesses)];

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

                                  // Sort by priority (highest number first)
                                  const sortedProcesses = uniqueProcesses.sort((a, b) => {
                                    const aIndex = processPriority.indexOf(a);
                                    const bIndex = processPriority.indexOf(b);
                                    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                                    if (aIndex === -1) return 1;
                                    if (bIndex === -1) return -1;
                                    return bIndex - aIndex; // Higher index = higher priority
                                  });

                                  if (sortedProcesses.length > 0) {
                                    const highestPriorityProcess = sortedProcesses[0];
                                    console.log('🔍 Order Details - Found highest priority process:', highestPriorityProcess);
                                    return (
                                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                                          ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                          : 'bg-orange-100 text-orange-700 border border-orange-200'
                                        }`}>
                                        {highestPriorityProcess}
                                      </span>
                                    );
                                  }
                                }

                                if (processes.length === 0) {
                                  return <span className="text-gray-500">No process data</span>;
                                }

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
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Description
                            </label>
                            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {item.description || '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Weaver
                            </label>
                            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {item.weaverSupplierName || '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Purchase Rate
                            </label>
                            <p className={`text-xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              {item.purchaseRate ? `₹${Number(item.purchaseRate).toFixed(2)}` : '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Mill Rate
                            </label>
                            <p className={`text-xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {item.millRate ? `₹${Number(item.millRate).toFixed(2)}` : '--'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Sales Rate
                            </label>
                            <p className={`text-xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                              {item.salesRate ? `₹${Number(item.salesRate).toFixed(2)}` : '--'}
                            </p>
                          </div>


                          <div className="md:col-span-2">
                            <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Images
                            </label>
                            <div className="mt-4">
                              {item.imageUrls && item.imageUrls.length > 0 ? (
                                <div className="flex flex-wrap gap-6">
                                  {item.imageUrls.slice(0, 2).map((imageUrl, imgIndex) => (
                                    <div key={imgIndex} className="relative group">
                                      <img
                                        src={imageUrl}
                                        alt={`Item ${index + 1} - Image ${imgIndex + 1}`}
                                        className="w-48 h-48 rounded-2xl border-3 border-gray-200 dark:border-gray-600 object-cover cursor-pointer hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-3xl hover:border-blue-400 dark:hover:border-blue-500"
                                        onClick={() => handleImageClick(item.imageUrls!, imgIndex)}
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          // Show fallback icon if image fails to load
                                          const fallback = target.nextElementSibling as HTMLElement;
                                          if (fallback) fallback.style.display = 'block';
                                        }}
                                        loading="lazy"
                                      />
                                      <PhotoIcon className="h-16 w-16 text-gray-400 absolute inset-0 m-auto hidden" />
                                      {/* Enhanced hover tooltip */}
                                      <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-base px-4 py-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                                        <div className="flex items-center space-x-2">
                                          <PhotoIcon className="h-5 w-5" />
                                          <span>Click to view all images</span>
                                        </div>
                                        {/* Tooltip arrow */}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                                      </div>
                                    </div>
                                  ))}
                                  {item.imageUrls.length > 2 && (
                                    <button
                                      onClick={() => handleImageClick(item.imageUrls!, 0)}
                                      className={`w-48 h-48 flex items-center justify-center rounded-2xl border-3 border-dashed transition-all duration-300 hover:scale-105 ${isDarkMode
                                          ? 'border-gray-500 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 hover:border-blue-400'
                                          : 'border-gray-300 text-gray-500 hover:text-gray-600 hover:bg-gray-50 hover:border-blue-500'
                                        }`}
                                      title={`View all ${item.imageUrls.length} images`}
                                    >
                                      <div className="text-center">
                                        <PhotoIcon className="h-12 w-12 mx-auto mb-3" />
                                        <span className="text-lg font-bold">
                                          +{item.imageUrls.length - 2}
                                        </span>
                                        <p className="text-sm mt-1">More Images</p>
                                      </div>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <PhotoIcon className="h-6 w-6 text-gray-400" />
                                  <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    No images
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lab Data Section */}
            <div className={`p-6 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:shadow-xl hover:border-gray-500' : 'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300'} transition-all duration-300`}>
              <div className="flex items-center space-x-3 mb-6">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-yellow-600/20' : 'bg-yellow-100'}`}>
                  <BeakerIcon className={`h-8 w-8 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Lab Data ({order?.items?.length || 0})
                </h2>
              </div>
              <div className="space-y-4">
                {order?.items?.map((item, index) => (
                  <div key={index} className={`p-6 rounded-xl border-2 ${isDarkMode ? 'bg-gray-600 border-gray-500 hover:bg-gray-500 hover:shadow-lg' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:shadow-md'} transition-all duration-300`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Sample {index + 1}
                        </h3>
                        <span className={`px-4 py-2 rounded-full text-sm font-bold ${isDarkMode ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                          Item {index + 1}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Lab Send Date *
                          </label>
                          <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {item.labData?.labSendDate ? formatDate(item.labData.labSendDate) : '--'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Approval Date
                          </label>
                          <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {item.labData?.approvalDate ? formatDate(item.labData.approvalDate) : '--'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Sample Number
                          </label>
                          <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {item.labData?.sampleNumber || '--'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mill Input Data Section */}
          <div className="mt-6">
            <div className={`p-4 rounded-xl shadow-md border-2 ${isDarkMode ? 'bg-gray-800/50 border-blue-500/30 hover:border-blue-500/50' : 'bg-white border-blue-200 hover:border-blue-300'} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-blue-600/20 border-2 border-blue-500/30' : 'bg-blue-100 border-2 border-blue-200'}`}>
                    <CogIcon className={`h-8 w-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
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
                {loadingSections.millInputs && (
                  <div className="flex items-center space-x-2">
                    <div className={`animate-spin rounded-full h-6 w-6 border-2 ${isDarkMode
                        ? 'border-gray-600 border-t-blue-400'
                        : 'border-gray-300 border-t-blue-600'
                      }`}></div>
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading...</span>
                  </div>
                )}
              </div>

              {millInputs && millInputs.length > 0 ? (
                <div className="space-y-6">
                  {(() => {
                    // Group mill inputs by mill name
                    const groupedByMill = millInputs.reduce((groups: any, millInput: any) => {
                      const millName = typeof millInput.mill === 'object' ? millInput.mill.name : 'Unknown Mill';
                      if (!groups[millName]) {
                        groups[millName] = [];
                      }
                      groups[millName].push(millInput);
                      return groups;
                    }, {});

                    return Object.entries(groupedByMill).map(([millName, millInputsForMill]: [string, any]) => (
                      <div key={millName} className={`rounded-xl border shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'}`}>
                        {/* Mill Name Header */}
                        <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-100'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {millName}
                              </h3>
                              <p className={`text-sm font-semibold mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {millInputsForMill.length} {millInputsForMill.length === 1 ? 'entry' : 'entries'}
                              </p>
                            </div>
                            <div className={`px-4 py-2 rounded-full ${isDarkMode ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                              <span className="text-sm font-semibold">Mill Input</span>
                            </div>
                          </div>
                        </div>

                        {/* Mill Input Entries */}
                        <div className="p-4 space-y-3">
                          {millInputsForMill.map((millInput: any, index: number) => {
                            // Combine main entry and additional meters into one array for unified display
                            const allEntries = [
                              {
                                id: 'M1',
                                greighMtr: millInput.greighMtr,
                                pcs: millInput.pcs,
                                quality: millInput.quality,
                                processName: millInput.processName
                              },
                              ...(millInput.additionalMeters || []).map((additional: any, addIndex: number) => ({
                                id: `M${addIndex + 2}`,
                                greighMtr: additional.greighMtr,
                                pcs: additional.pcs,
                                quality: additional.quality,
                                processName: additional.processName
                              }))
                            ];

                            return (
                              <div key={millInput._id || index} className={`p-3 rounded-lg border-2 ${isDarkMode ? 'bg-gray-800/50 border-blue-500/50' : 'bg-white border-blue-300'} transition-all duration-200`}>
                                {/* Improved Header with Better Date/Chalan Display */}
                                <div className={`mb-3 pb-2 border-b ${isDarkMode ? 'border-blue-500/30' : 'border-blue-200'}`}>
                                  <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <div>
                                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Mill Date:
                                      </span>
                                      <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {millInput.millDate ? formatDate(millInput.millDate) : '--'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Chalan Number:
                                      </span>
                                      <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {millInput.chalanNo || '--'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Unified Layout: All Entries (M1, M2, M3...) in Same Style */}
                                <div className="space-y-2">
                                  {allEntries.map((entry, entryIndex) => (
                                    <div key={entryIndex} className={`p-2.5 rounded border ${isDarkMode ? 'bg-gray-800/30 border-blue-400/30' : 'bg-gray-50 border-blue-200'}`}>
                                      {/* Entry Data in same row */}
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Greigh Meters:
                                          </span>
                                          <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {entry.greighMtr || '--'}
                                          </span>
                                        </div>
                                        <div className="flex-1">
                                          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Pieces:
                                          </span>
                                          <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {entry.pcs || '--'}
                                          </span>
                                        </div>
                                        <div className="flex-1">
                                          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Quality:
                                          </span>
                                          <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {typeof entry.quality === 'object' ? entry.quality.name : entry.quality || '--'}
                                          </span>
                                        </div>
                                        <div className="flex-1">
                                          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Process:
                                          </span>
                                          <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {entry.processName || '--'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <CogIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-semibold mb-2">No mill input data yet</p>
                  <p className="text-sm">Click "Add Mill Input" to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Mill Output Data Section */}
          <div className="mt-6">
            <div className={`p-4 rounded-xl shadow-md border-2 ${isDarkMode ? 'bg-gray-800/50 border-green-500/30 hover:border-green-500/50' : 'bg-white border-green-200 hover:border-green-300'} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-green-600/20 border-2 border-green-500/30' : 'bg-green-100 border-2 border-green-200'}`}>
                    <BuildingOfficeIcon className={`h-8 w-8 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
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
                <div className="flex items-center space-x-2">
                  {loadingSections.millOutputs && (
                    <div className="flex items-center space-x-2">
                      <div className={`animate-spin rounded-full h-6 w-6 border-2 ${isDarkMode
                          ? 'border-gray-600 border-t-green-400'
                          : 'border-gray-300 border-t-green-600'
                        }`}></div>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading...</span>
                    </div>
                  )}
                  {!isParty && !loadingSections.millOutputs && (
                    <>
                      {millOutputs.length > 0 ? (
                        <button
                          onClick={handleEditMillOutput}
                          className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 flex items-center space-x-2 ${isDarkMode
                              ? 'bg-green-600/20 border-green-500/50 text-green-400 hover:bg-green-600/30 hover:border-green-400'
                              : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400'
                            }`}
                        >
                          <PencilIcon className="h-5 w-5" />
                          <span className="font-medium">Edit</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleAddMillOutput}
                          className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 flex items-center space-x-2 ${isDarkMode
                              ? 'bg-green-600/20 border-green-500/50 text-green-400 hover:bg-green-600/30 hover:border-green-400'
                              : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400'
                            }`}
                        >
                          <PlusIcon className="h-5 w-5" />
                          <span className="font-medium">Add Mill Output</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {millOutputs && millOutputs.length > 0 ? (
                <div className="space-y-6">
                  {(() => {
                    // Group mill outputs by date and bill number
                    const groupedByDateAndBill = millOutputs.reduce((groups: any, millOutput: any) => {
                      const key = `${millOutput.recdDate}_${millOutput.millBillNo}`;
                      if (!groups[key]) {
                        groups[key] = [];
                      }
                      groups[key].push(millOutput);
                      return groups;
                    }, {});

                    return Object.entries(groupedByDateAndBill).map(([key, millOutputsForGroup]: [string, any]) => (
                      <div key={key} className={`rounded-xl border shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'}`}>
                        {/* Group Header: Date and Bill (shown once) */}
                        <div className={`px-4 py-2.5 border-b ${isDarkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-100'}`}>
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Received Date:
                              </span>
                              <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {millOutputsForGroup[0].recdDate ? formatDate(millOutputsForGroup[0].recdDate) : '--'}
                              </span>
                            </div>
                            <div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Mill Bill Number:
                              </span>
                              <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {millOutputsForGroup[0].millBillNo || '--'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mill Output Items */}
                        <div className="p-3 space-y-2">
                          {millOutputsForGroup.map((millOutput: any, groupIndex: number) => {
                            // Combine main entry and additional finished meters into one array with M1, M2, M3 labels
                            const allEntries = [
                              {
                                id: 'M1',
                                finishedMtr: millOutput.finishedMtr,
                                quality: millOutput.quality
                              },
                              ...(millOutput.additionalFinishedMtr || []).map((additional: any, addIndex: number) => ({
                                id: `M${addIndex + 2}`,
                                finishedMtr: additional.meters,
                                quality: additional.quality
                              }))
                            ];

                            // Return all entries directly without item header
                            return allEntries.map((entry, entryIndex) => (
                              <div key={`${millOutput._id || groupIndex}-${entryIndex}`} className={`p-2.5 rounded border ${isDarkMode ? 'bg-gray-800/30 border-green-400/30' : 'bg-gray-50 border-green-200'}`}>
                                {/* Entry Data in same row */}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Finished Meters:
                                    </span>
                                    <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {entry.finishedMtr || '--'}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Quality:
                                    </span>
                                    <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {typeof entry.quality === 'object' ? entry.quality.name : entry.quality || '--'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ));
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <BuildingOfficeIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-semibold mb-2">No mill output data yet</p>
                  <p className="text-sm">Mill output data will appear here when available</p>
                </div>
              )}
            </div>
          </div>

          {/* Dispatch Data Section */}
          <div className="mt-6">
            <div className={`p-4 rounded-xl shadow-md border-2 ${isDarkMode ? 'bg-gray-800/50 border-orange-500/30 hover:border-orange-500/50' : 'bg-white border-orange-200 hover:border-orange-300'} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl shadow-sm ${isDarkMode ? 'bg-orange-600/20 border-2 border-orange-500/30' : 'bg-orange-100 border-2 border-orange-200'}`}>
                    <TruckIcon className={`h-8 w-8 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
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
                <div className="flex items-center space-x-2">
                  {loadingSections.dispatches && (
                    <div className="flex items-center space-x-2">
                      <div className={`animate-spin rounded-full h-6 w-6 border-2 ${isDarkMode
                          ? 'border-gray-600 border-t-orange-400'
                          : 'border-gray-300 border-t-orange-600'
                        }`}></div>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading...</span>
                    </div>
                  )}
                  {!isParty && !loadingSections.dispatches && (
                    <>
                      {dispatches.length > 0 ? (
                        <button
                          onClick={handleEditDispatch}
                          className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 flex items-center space-x-2 ${isDarkMode
                              ? 'bg-orange-600/20 border-orange-500/50 text-orange-400 hover:bg-orange-600/30 hover:border-orange-400'
                              : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400'
                            }`}
                        >
                          <PencilIcon className="h-5 w-5" />
                          <span className="font-medium">Edit</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleAddDispatch}
                          className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 flex items-center space-x-2 ${isDarkMode
                              ? 'bg-orange-600/20 border-orange-500/50 text-orange-400 hover:bg-orange-600/30 hover:border-orange-400'
                              : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400'
                            }`}
                        >
                          <PlusIcon className="h-5 w-5" />
                          <span className="font-medium">Add Dispatch</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {dispatches && dispatches.length > 0 ? (
                <div className="space-y-6">
                  {(() => {
                    // Group dispatches by date and bill number
                    const groupedByDateAndBill = dispatches.reduce((groups: any, dispatch: any) => {
                      const key = `${dispatch.dispatchDate}_${dispatch.billNo}`;
                      if (!groups[key]) {
                        groups[key] = [];
                      }
                      groups[key].push(dispatch);
                      return groups;
                    }, {});

                    return Object.entries(groupedByDateAndBill).map(([key, dispatchesForGroup]: [string, any]) => (
                      <div key={key} className={`rounded-xl border shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'}`}>
                        {/* Group Header: Date, Bill, Transport No, and LR (shown once) */}
                        <div className={`px-4 py-2.5 border-b ${isDarkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-100'}`}>
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Dispatch Date:
                              </span>
                              <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {dispatchesForGroup[0].dispatchDate ? formatDate(dispatchesForGroup[0].dispatchDate) : '--'}
                              </span>
                            </div>
                            <div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Bill Number:
                              </span>
                              <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {dispatchesForGroup[0].billNo || '--'}
                              </span>
                            </div>
                            <div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Transport No:
                              </span>
                              <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {dispatchesForGroup[0].transportNo || '--'}
                              </span>
                            </div>
                            <div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                LR:
                              </span>
                              <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {dispatchesForGroup[0].lrNo || '--'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dispatch Items */}
                        <div className="p-3 space-y-2">
                          {dispatchesForGroup.map((dispatch: any, groupIndex: number) => {
                            // Combine main entry and sub-items into one array with D1, D2, D3 labels
                            const allEntries = [
                              {
                                id: 'D1',
                                finishMtr: dispatch.finishMtr,
                                quality: dispatch.quality
                              },
                              ...(dispatch.subItems || []).map((subItem: any, subIndex: number) => ({
                                id: `D${subIndex + 2}`,
                                finishMtr: subItem.finishMtr,
                                quality: subItem.quality
                              }))
                            ];

                            // Return all entries directly without item header
                            return allEntries.map((entry, entryIndex) => (
                              <div key={`${dispatch._id || groupIndex}-${entryIndex}`} className={`p-2.5 rounded border ${isDarkMode ? 'bg-gray-800/30 border-orange-400/30' : 'bg-gray-50 border-orange-200'}`}>
                                {/* Entry Data in same row */}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Finish Meters:
                                    </span>
                                    <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {entry.finishMtr || '--'}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Quality:
                                    </span>
                                    <span className={`ml-1 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {typeof entry.quality === 'object' ? entry.quality.name : entry.quality || '--'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ));
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <TruckIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-semibold mb-2">No dispatch data yet</p>
                  <p className="text-sm">Dispatch data will appear here when available</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Image Preview Modal */}
      {showImagePreview && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[80] flex items-center justify-center p-2">
          <div className="relative max-w-7xl max-h-[98vh] w-full">
            {/* Action Buttons */}
            <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
              {/* Download Button */}
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewImages[currentImageIndex];
                  link.download = `image-${currentImageIndex + 1}.jpg`;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 backdrop-blur-sm"
                title="Download Image"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>

              {/* Open in New Tab Button */}
              <button
                onClick={() => {
                  window.open(previewImages[currentImageIndex], '_blank');
                }}
                className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 transition-all duration-200 backdrop-blur-sm"
                title="Open in New Tab"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              {/* Share on WhatsApp Button */}
              {/* <button
                onClick={async () => {
                  const shareText = `Check out this order image ${currentImageIndex + 1}`;
                  const shareUrl = previewImages[currentImageIndex];
                  
                  try {
                    if (navigator.share) {
                      const response = await fetch(shareUrl);
                      const blob = await response.blob();
                      const file = new File([blob], 'shared-image.jpg', { type: blob.type || 'image/jpeg' });
                      
                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          files: [file],
                          title: 'Shared Image',
                          text: shareText,
                        });
                        return;
                      }
                    }
                  } catch (error) {
                    console.error('Error sharing file natively:', error);
                  }
                  
                  window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
                }}
                className="p-3 rounded-full bg-[#25D366] text-white hover:bg-[#128C7E] transition-all duration-200 backdrop-blur-sm"
                title="Share on WhatsApp"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
              </button> */}

              {/* Close Button */}
              <button
                onClick={() => setShowImagePreview(false)}
                className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all duration-200 backdrop-blur-sm"
                title="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Navigation Buttons */}
            {previewImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all duration-200 backdrop-blur-sm"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all duration-200 backdrop-blur-sm"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Main Image Container */}
            <div
              className="w-full h-full flex items-center justify-center p-4"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={previewImages[currentImageIndex]}
                  alt={`Preview ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    // Show error message
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'flex items-center justify-center h-64 bg-gray-800 rounded-lg text-white';
                    errorDiv.innerHTML = '<div class="text-center"><PhotoIcon class="h-12 w-12 mx-auto mb-2 opacity-50"/><p>Failed to load image</p></div>';
                    target.parentNode?.appendChild(errorDiv);
                  }}
                />
              </div>
            </div>

            {/* Image Counter */}
            {previewImages.length > 1 && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                {currentImageIndex + 1} / {previewImages.length}
              </div>
            )}

            {/* Thumbnail Strip */}
            {previewImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-3 max-w-full overflow-x-auto pb-2">
                {previewImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0 ${index === currentImageIndex
                        ? 'border-white shadow-lg scale-110'
                        : 'border-transparent opacity-60 hover:opacity-80 hover:scale-105'
                      }`}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full bg-gray-600 flex items-center justify-center"><PhotoIcon class="h-6 w-6 text-white opacity-50"/></div>';
                        }
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Keyboard Instructions */}
            {previewImages.length > 1 && (
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm">
                Use ← → keys or swipe to navigate
              </div>
            )}
          </div>
        </div>
      )}

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

    </div>
  );
}