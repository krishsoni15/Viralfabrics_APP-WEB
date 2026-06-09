'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { logger } from '@/lib/logger';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CurrencyDollarIcon,
  ScaleIcon,
  CubeIcon as CubeIconOutline,
  HashtagIcon,
  UserIcon,
  DevicePhoneMobileIcon,
  BuildingOfficeIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  PlusIcon,
  CheckIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { useAuthSession } from '../../../hooks/useAuthSession';
import { generateSampleStickerPDF, downloadSampleStickerPDFDirect } from '@/lib/pdfGenerator';
import SampleForm from '../../components/SampleForm';
import WeaverSamplesSkeleton from './WeaverSamplesSkeleton';
import UnauthorizedMessage from '../../components/UnauthorizedMessage';
import { SearchBar } from '../../components/SearchBar';
import type { Weaver, Sample } from '../../types';
import { TIMEOUTS } from '../../constants';

export default function WeaverSamplesViewPage() {
  const router = useRouter();
  const params = useParams();
  const weaverId = params?.weaverId as string;
  const { isDarkMode, mounted: darkModeMounted } = useDarkMode();
  const { isSuperAdmin, isMaster, isLoading: authLoading } = useAuthSession();

  const [weaver, setWeaver] = useState<Weaver | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<{sampleIndex: number, imageIndex: number} | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Sticker download states
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(null);
  const [currentStickerSample, setCurrentStickerSample] = useState<Sample | null>(null);
  const [isLoadingStickerPreview, setIsLoadingStickerPreview] = useState(false);

  // Sample form states
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    id: string;
    name?: string;
  } | null>(null);
  const [deleteAllConfirmation, setDeleteAllConfirmation] = useState<{
    show: boolean;
    sampleCount: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const isFetchingRef = useRef(false); // Prevent duplicate concurrent fetches
  const abortControllerRef = useRef<AbortController | null>(null); // Store AbortController for cleanup
  const hasInitialFetchRef = useRef(false); // Track if initial fetch has been done
  const lastWeaverIdRef = useRef<string | null>(null); // Track last fetched weaverId to prevent duplicates
  const isFetchingSamplesRef = useRef(false); // Separate flag for samples-only fetches
  const dataChangedRef = useRef(false); // Track if data was edited or deleted
  const newlyAddedSamplesRef = useRef<Set<string>>(new Set()); // Track newly added samples for animation
  const editedSamplesRef = useRef<Set<string>>(new Set()); // Track edited samples for animation
  const deletingSamplesRef = useRef<Set<string>>(new Set()); // Track deleting samples for animation
  const optimisticSamplesRef = useRef<Map<string, { originalSample?: Sample; isNew: boolean }>>(new Map()); // Track optimistic updates
  const uploadingImagesRef = useRef<Map<string, Set<string>>>(new Map()); // Track which images are still uploading per sample (preview URLs)

  // Fetch only samples (optimized for after operations)
  const fetchSamplesOnly = useCallback(async () => {
    if (!weaverId) {
      setSamples([]);
      return;
    }
    
    // Prevent duplicate concurrent fetches for samples
    if (isFetchingSamplesRef.current) {
      return;
    }
    
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    isFetchingSamplesRef.current = true;
    let controller: AbortController | null = null;
    let timeoutId: any = null;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logger.error('No authentication token found', new Error('No authentication token'));
        isFetchingSamplesRef.current = false;
        return;
      }

      // Create AbortController for request cancellation
      controller = new AbortController();
      abortControllerRef.current = controller;
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 10000); // 10 second timeout

      const samplesResponse = await fetch(`/api/weaver/samples?weaverId=${weaverId}`, {
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

      if (!samplesResponse.ok) {
        logger.error('Failed to fetch samples', new Error(`HTTP ${samplesResponse.status}`));
        setSamples([]);
        return;
      }
      const samplesData = await samplesResponse.json();
      
      if (samplesData.success && samplesData.data) {
        setSamples(samplesData.data);
      } else {
        setSamples([]);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.error('Error fetching samples', error instanceof Error ? error : new Error(String(error)));
      setSamples([]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      isFetchingSamplesRef.current = false;
      // Clear AbortController ref if this was the current request
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [weaverId]);

  // Fetch weaver and samples data - optimized with parallel fetching (only for initial load)
  const fetchWeaverAndSamples = useCallback(async () => {
    if (!weaverId) {
      setWeaver(null);
      setSamples([]);
      setLoading(false);
      return;
    }
    
    // Prevent duplicate concurrent fetches for the same weaverId
    if (isFetchingRef.current && lastWeaverIdRef.current === weaverId) {
      return;
    }
    
    // If weaverId changed, reset state
    if (lastWeaverIdRef.current !== weaverId) {
      setWeaver(null);
      setSamples([]);
      lastWeaverIdRef.current = weaverId;
    }
    
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    isFetchingRef.current = true;
    setLoading(true);
    let controller: AbortController | null = null;
    let timeoutId: any = null;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logger.error('No authentication token found', new Error('No authentication token'));
        setWeaver(null);
        setSamples([]);
        setLoading(false);
        isFetchingRef.current = false;
        setMessage({ type: 'error', text: 'Authentication required. Please login again.' });
        setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
        return;
      }

      // Create AbortController for request cancellation
      controller = new AbortController();
      abortControllerRef.current = controller;
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 10000); // 10 second timeout

      // Fetch weaver and samples in parallel for faster loading - optimized to fetch single weaver
      const [weaverResponse, samplesResponse] = await Promise.all([
        fetch(`/api/weaver/weavers/${weaverId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        }),
        fetch(`/api/weaver/samples?weaverId=${weaverId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        })
      ]);
      
      // Clear timeout on successful response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Process JSON responses in parallel for better performance
      const [weaverData, samplesData] = await Promise.all([
        weaverResponse.ok ? weaverResponse.json().catch(() => ({ success: false })) : Promise.resolve({ success: false, status: weaverResponse.status }),
        samplesResponse.ok ? samplesResponse.json().catch(() => ({ success: false })) : Promise.resolve({ success: false, status: samplesResponse.status })
      ]);
      
      // Process weaver data
      if (!weaverResponse.ok) {
        if (weaverResponse.status === 404) {
          setWeaver(null);
          setSamples([]);
          setLoading(false);
          hasInitialFetchRef.current = true; // Mark as attempted
          setMessage({ type: 'error', text: 'Weaver not found' });
          setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
          return;
        }
        throw new Error(`Failed to fetch weaver: ${weaverResponse.status}`);
      }
      
      if (weaverData.success && weaverData.data) {
        setWeaver(weaverData.data);
        hasInitialFetchRef.current = true; // Mark as successfully fetched
      } else {
        setWeaver(null);
        setSamples([]);
        setLoading(false);
        hasInitialFetchRef.current = true; // Mark as attempted
        setMessage({ type: 'error', text: weaverData.message || 'Failed to fetch weaver' });
        setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
        return;
      }

      // Process samples data (non-blocking - don't fail if samples fail)
      if (samplesResponse.ok && samplesData.success && samplesData.data) {
        setSamples(samplesData.data);
      } else {
        // Log error but don't show to user if weaver loaded successfully
        if (!samplesResponse.ok) {
          logger.error('Failed to fetch samples', new Error(`HTTP ${samplesResponse.status}`));
        }
        setSamples([]);
      }
      
      // Mark initial fetch as complete (already marked when weaver loaded)
      // hasInitialFetchRef.current is already true from weaver fetch
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.error('Error fetching data', error instanceof Error ? error : new Error(String(error)));
      setWeaver(null);
      setSamples([]);
      setLoading(false);
      hasInitialFetchRef.current = true; // Mark as attempted even on error
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      setMessage({ type: 'error', text: errorMessage });
      setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoading(false);
      isFetchingRef.current = false;
      // Clear AbortController ref if this was the current request
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [weaverId]);

  // Only fetch when weaverId changes, not when fetchWeaverAndSamples reference changes
  useEffect(() => {
    // Wait for auth to be ready before fetching
    if (authLoading) return;
    
    // Reset fetch state when weaverId changes
    if (weaverId && lastWeaverIdRef.current !== weaverId) {
      hasInitialFetchRef.current = false;
      isFetchingRef.current = false;
      lastWeaverIdRef.current = weaverId;
      
      // Check token availability with retry
      const attemptFetch = async (retryCount = 0) => {
        const token = localStorage.getItem('token');
        if (!token) {
          // Token not available yet, retry up to 10 times (1 second total wait)
          if (retryCount < 10) {
            setTimeout(() => {
              if (lastWeaverIdRef.current === weaverId && !hasInitialFetchRef.current) {
                attemptFetch(retryCount + 1);
              }
            }, 100);
          } else {
            // Give up after 1 second
            setLoading(false);
            setWeaver(null);
            setSamples([]);
            setMessage({ type: 'error', text: 'Authentication required. Please login again.' });
            setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
          }
          return;
        }
        
        // Token available, proceed with fetch
        fetchWeaverAndSamples();
      };
      
      attemptFetch();
    } else if (!weaverId) {
      setWeaver(null);
      setSamples([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaverId, authLoading]); // Also depend on authLoading

  // Cleanup on unmount - abort pending requests and clear blob URLs
  useEffect(() => {
    return () => {
      // Abort pending fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Cleanup sticker preview blob URL
      if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(stickerPreviewUrl);
      }
    };
  }, [stickerPreviewUrl]);

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (!selectedImageIndex) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      const sample = samples[selectedImageIndex.sampleIndex];
      if (!sample?.images) return;

      if (e.key === 'ArrowRight') {
        const nextImageIndex = (selectedImageIndex.imageIndex + 1) % sample.images.length;
        setSelectedImageIndex({ ...selectedImageIndex, imageIndex: nextImageIndex });
      } else if (e.key === 'ArrowLeft') {
        const prevImageIndex = selectedImageIndex.imageIndex === 0 
          ? sample.images.length - 1 
          : selectedImageIndex.imageIndex - 1;
        setSelectedImageIndex({ ...selectedImageIndex, imageIndex: prevImageIndex });
      } else if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedImageIndex, samples]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (selectedImageIndex) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedImageIndex]);

  // Sticker download handlers - optimized with useCallback
  const handleStickerDownload = useCallback(async (sample: Sample) => {
    if (!weaver) return;

    // Always show preview first (for both mobile and desktop)
    setIsLoadingStickerPreview(true);
    setCurrentStickerSample(sample);
    setShowStickerPreview(true);

    try {
      // Prepare sample data for sticker
      const stickerData = {
        qualityName: sample.qualityName,
        weaverName: weaver.name,
        width: sample.finishWidth,
        gsm: sample.gsm,
        content: sample.content || '',
        count: sample.count,
        rxP: sample.reed && sample.pick ? `${sample.reed}/${sample.pick}` : '',
        danier: sample.danier || '',
        moq: undefined, // MOQ not stored in database, always empty for sticker
        rack: sample.rack || ''
      };

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
          
          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, 500);
        } else {
          setStickerPreviewUrl(pdfDataUrl);
          setTimeout(() => {
            setIsLoadingStickerPreview(false);
          }, 500);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logger.error('Error converting PDF to blob', error instanceof Error ? error : new Error(String(error)));
        }
        setStickerPreviewUrl(pdfDataUrl);
        setTimeout(() => {
          setIsLoadingStickerPreview(false);
        }, 500);
      }
    } catch (error) {
      logger.error('Error generating sticker preview', error instanceof Error ? error : new Error(String(error)));
      alert('Failed to generate sticker preview');
      setShowStickerPreview(false);
      setIsLoadingStickerPreview(false);
    }
  }, [weaver]);

  const handleFinalStickerDownload = useCallback(() => {
    if (!currentStickerSample || !weaver) return;
    
    try {
      // Prepare sample data for sticker
      const stickerData = {
        qualityName: currentStickerSample.qualityName,
        weaverName: weaver.name,
        width: currentStickerSample.finishWidth,
        gsm: currentStickerSample.gsm,
        content: currentStickerSample.content || '',
        count: currentStickerSample.count,
        rxP: currentStickerSample.reed && currentStickerSample.pick ? `${currentStickerSample.reed}/${currentStickerSample.pick}` : '',
        danier: currentStickerSample.danier || '',
        moq: undefined, // MOQ not stored in database, always empty for sticker
        rack: currentStickerSample.rack || ''
      };

      // Generate and download PDF
      downloadSampleStickerPDFDirect(stickerData);
      
      // Clean up preview
      if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(stickerPreviewUrl);
      }
      setShowStickerPreview(false);
      setStickerPreviewUrl(null);
      setCurrentStickerSample(null);
    } catch (error) {
      logger.error('Error downloading sticker PDF', error instanceof Error ? error : new Error(String(error)));
      alert('Failed to download sticker PDF');
    }
  }, [currentStickerSample, weaver, stickerPreviewUrl]);

  // Sample form handlers - optimized with useCallback
  const handleAddSample = useCallback(() => {
    setEditingSample(null);
    setShowSampleForm(true);
  }, []);

  const handleEditSample = useCallback((sample: Sample) => {
    setEditingSample(sample);
    setShowSampleForm(true);
  }, []);

  const handleDeleteSample = useCallback((id: string, name?: string) => {
    setDeleteConfirmation({
      show: true,
      id,
      name: name || 'this sample'
    });
  }, []);

  const handleDeleteAllSamples = useCallback(() => {
    if (samples.length === 0) return;
    setDeleteAllConfirmation({
      show: true,
      sampleCount: samples.length
    });
  }, [samples.length]);

  const confirmDeleteAllSamples = useCallback(async () => {
    if (!deleteAllConfirmation || samples.length === 0) return;
    
    const samplesToDelete = [...samples]; // Store for rollback
    
    // Close confirmation modal immediately
    setDeleteAllConfirmation(null);
    setIsDeletingAll(false);
    
    // Optimistic delete - start animation for all samples immediately
    samples.forEach(sample => {
      deletingSamplesRef.current.add(sample._id);
    });
    
    // Remove all samples from UI after animation completes (550ms animation)
    setTimeout(() => {
      setSamples([]);
      // Clean up animation tracking
      samples.forEach(sample => {
        deletingSamplesRef.current.delete(sample._id);
      });
    }, 550);
    
    // Close form if open
    setShowSampleForm(false);
    setEditingSample(null);
    
    // Mark that data has changed
    dataChangedRef.current = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('weaverDataChanged', 'true');
    }
    
    // Make API calls in background
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Rollback on auth error
        setSamples(samplesToDelete);
        samplesToDelete.forEach(sample => {
          deletingSamplesRef.current.delete(sample._id);
        });
        setMessage({ type: 'error', text: 'Authentication required' });
        setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
        return;
      }

      // Delete all samples in parallel
      const deletePromises = samplesToDelete.map(sample =>
        fetch(`/api/weaver/samples/${sample._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).then(res => res.json())
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(r => !r.success);
      
      if (failed.length > 0) {
        // Rollback failed deletions
        const failedIds = new Set(
          samplesToDelete
            .filter((_, index) => !results[index].success)
            .map(s => s._id)
        );
        setSamples(prevSamples => {
          const restored = samplesToDelete.filter(s => failedIds.has(s._id));
          return [...prevSamples, ...restored];
        });
        failedIds.forEach(id => deletingSamplesRef.current.delete(id));
        
        setMessage({ 
          type: 'error', 
          text: `Failed to delete ${failed.length} sample(s). Please try again.` 
        });
        setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
      }
      // No success message - animation already shows the deletion
    } catch (error) {
      // Rollback on network error
      setSamples(samplesToDelete);
      samplesToDelete.forEach(sample => {
        deletingSamplesRef.current.delete(sample._id);
      });
      logger.error('Error deleting all samples', error instanceof Error ? error : new Error(String(error)));
      setMessage({ type: 'error', text: 'Error deleting samples. Please try again.' });
      setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
    }
  }, [deleteAllConfirmation, samples]);

  const confirmDeleteSample = useCallback(async () => {
    if (!deleteConfirmation) return;
    
    const sampleId = deleteConfirmation.id;
    const sampleToDelete = samples.find(s => s._id === sampleId);
    
    // Close confirmation modal immediately
    setDeleteConfirmation(null);
    setIsDeleting(false);
    
    // Optimistic delete - start animation immediately
    deletingSamplesRef.current.add(sampleId);
    
    // Remove from UI after animation completes (550ms animation)
    setTimeout(() => {
      setSamples(prevSamples => prevSamples.filter(s => s._id !== sampleId));
      // Clean up animation tracking
      deletingSamplesRef.current.delete(sampleId);
    }, 550);
    
    // Close form if it's open for this sample
    if (editingSample?._id === sampleId) {
      setShowSampleForm(false);
      setEditingSample(null);
    }
    
    // Mark that data has changed
    dataChangedRef.current = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('weaverDataChanged', 'true');
    }
    
    // Make API call in background
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Rollback on auth error
        if (sampleToDelete) {
          setSamples(prevSamples => {
            const exists = prevSamples.find(s => s._id === sampleId);
            if (!exists) {
              return [...prevSamples, sampleToDelete];
            }
            return prevSamples;
          });
        }
        deletingSamplesRef.current.delete(sampleId);
        setMessage({ type: 'error', text: 'Authentication required' });
        setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
        return;
      }
      
      const response = await fetch(`/api/weaver/samples/${sampleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!data.success) {
        // Rollback on API error
        if (sampleToDelete) {
          setSamples(prevSamples => {
            const exists = prevSamples.find(s => s._id === sampleId);
            if (!exists) {
              return [...prevSamples, sampleToDelete];
            }
            return prevSamples;
          });
        }
        deletingSamplesRef.current.delete(sampleId);
        setMessage({ type: 'error', text: data.message || 'Failed to delete sample' });
        setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
      }
      // No success message - animation already shows the deletion
    } catch (error) {
      // Rollback on network error
      if (sampleToDelete) {
        setSamples(prevSamples => {
          const exists = prevSamples.find(s => s._id === sampleId);
          if (!exists) {
            return [...prevSamples, sampleToDelete];
          }
          return prevSamples;
        });
      }
      deletingSamplesRef.current.delete(sampleId);
      logger.error('Error deleting sample', error instanceof Error ? error : new Error(String(error)));
      setMessage({ type: 'error', text: 'Error deleting sample. Please try again.' });
      setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
    }
  }, [deleteConfirmation, samples, editingSample]);

  // Optimistic sample save handler - UI-first approach with images
  const handleOptimisticSampleSave = useCallback(async (sampleData: any, wasEdit: boolean, filesToUpload?: Array<{ file: File; previewUrl: string }>) => {
    const tempId = wasEdit && editingSample ? editingSample._id : `temp-sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Start with existing images, add preview URLs immediately for instant UI
    const existingImages = sampleData.images || [];
    const previewUrls = filesToUpload ? filesToUpload.map(f => f.previewUrl) : [];
    const initialImages = [...existingImages, ...previewUrls];
    
    // Track uploading preview URLs for this sample
    if (previewUrls.length > 0) {
      uploadingImagesRef.current.set(tempId, new Set(previewUrls));
    }
    
    // Create optimistic sample with preview images (shows immediately)
    const optimisticSample: Sample = {
      _id: tempId,
      weaverId: weaver!,
      qualityName: sampleData.qualityName,
      type: sampleData.type || '',
      rack: sampleData.rack || '',
      greighWidth: sampleData.greighWidth || 0,
      finishWidth: sampleData.finishWidth || 0,
      weight: sampleData.weight || 0,
      gsm: sampleData.gsm || 0,
      content: sampleData.content || '',
      danier: sampleData.danier || '',
      count: sampleData.count || 0,
      reed: sampleData.reed || 0,
      pick: sampleData.pick || 0,
      greighRate: sampleData.greighRate || 0,
      label: sampleData.label || '',
      note: sampleData.note || '',
      images: initialImages, // Shows preview URLs immediately
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store original state for rollback
    if (wasEdit && editingSample) {
      optimisticSamplesRef.current.set(tempId, { originalSample: editingSample, isNew: false });
      editedSamplesRef.current.add(tempId);
      setTimeout(() => {
        editedSamplesRef.current.delete(tempId);
      }, 750);
    } else {
      optimisticSamplesRef.current.set(tempId, { isNew: true });
      newlyAddedSamplesRef.current.add(tempId);
      setTimeout(() => {
        newlyAddedSamplesRef.current.delete(tempId);
      }, 650);
    }
    
    // Update UI immediately (optimistic update) - images show right away with preview URLs
    setSamples(prevSamples => {
      if (wasEdit && editingSample) {
        // Update existing sample
        return prevSamples.map(s => s._id === editingSample._id ? optimisticSample : s);
      } else {
        // Add new sample at the beginning
        return [optimisticSample, ...prevSamples];
      }
    });
    
    // Mark that data has changed
    dataChangedRef.current = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('weaverDataChanged', 'true');
    }
    
    // Upload images and make API call in background
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Upload images first if any
      let finalImages = existingImages;
      if (filesToUpload && filesToUpload.length > 0) {
        const uploadFileToS3 = async (file: File): Promise<string> => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder', 'weaver');
          if (weaver?._id) {
            formData.append('weaverId', weaver._id);
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
        
        // Upload images and track which preview URL maps to which real URL
        const uploadResults = await Promise.all(
          filesToUpload.map(async (pendingFile, index) => {
            try {
              const realUrl = await uploadFileToS3(pendingFile.file);
              return { previewUrl: pendingFile.previewUrl, realUrl, index };
            } catch (error) {
              logger.error('Error uploading image', error instanceof Error ? error : new Error(String(error)));
              return { previewUrl: pendingFile.previewUrl, realUrl: null, index };
            }
          })
        );
        
        // Filter successful uploads
        const successfulUploads = uploadResults.filter(r => r.realUrl !== null);
        const realUrls = successfulUploads.map(r => r.realUrl!);
        // Combine existing images with newly uploaded ones
        finalImages = [...existingImages, ...realUrls];
        
        // Update UI with real URLs as they upload (replace preview URLs with real URLs)
        setSamples(prevSamples => {
          return prevSamples.map(s => {
            if (s._id === tempId) {
              // Replace preview URLs with real uploaded URLs, maintaining order
              const updatedImages = s.images?.map(img => {
                const uploadResult = uploadResults.find(r => r.previewUrl === img && r.realUrl !== null);
                if (uploadResult) {
                  // Remove from uploading set
                  const uploadingSet = uploadingImagesRef.current.get(tempId);
                  if (uploadingSet) {
                    uploadingSet.delete(img);
                  }
                  return uploadResult.realUrl!;
                }
                return img;
              }) || [];
              return {
                ...s,
                images: updatedImages
              };
            }
            return s;
          });
        });
      }
      
      const url = wasEdit && editingSample
        ? `/api/weaver/samples/${editingSample._id}`
        : '/api/weaver/samples';
      const method = wasEdit && editingSample ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...sampleData, images: finalImages })
      });
      
      const data = await response.json();
      if (data.success && data.data) {
        // Replace optimistic sample with real one from server, but merge images intelligently
        const realSample: Sample = data.data;
        setSamples(prevSamples => {
          return prevSamples.map(s => {
            if (s._id === tempId) {
              // Merge images: keep any preview URLs that are still uploading, add server images
              const uploadingSet = uploadingImagesRef.current.get(tempId);
              const currentImages = s.images || [];
              const serverImages = realSample.images || [];
              
              // Keep preview URLs that are still uploading, merge with server images
              const previewImagesStillUploading = uploadingSet 
                ? currentImages.filter(img => uploadingSet.has(img))
                : [];
              
              // Combine: server images first (real URLs), then preview URLs still uploading
              const mergedImages = [
                ...serverImages,
                ...previewImagesStillUploading
              ];
              
              return {
                ...realSample,
                images: mergedImages.length > 0 ? mergedImages : serverImages
              };
            }
            return s;
          });
        });
        
        // Clean up uploading images tracking when all are done
        const uploadingSet = uploadingImagesRef.current.get(tempId);
        if (uploadingSet && uploadingSet.size === 0) {
          uploadingImagesRef.current.delete(tempId);
        }
        
        // Clean up optimistic update tracking
        optimisticSamplesRef.current.delete(tempId);
        newlyAddedSamplesRef.current.delete(tempId);
        editedSamplesRef.current.delete(tempId);
        
        // No success message - UI already updated
      } else {
        throw new Error(data.message || 'Failed to save sample');
      }
    } catch (error) {
      // Rollback on error
      const updateInfo = optimisticSamplesRef.current.get(tempId);
      if (updateInfo) {
        setSamples(prevSamples => {
          if (updateInfo.isNew) {
            // Remove the optimistic sample
            return prevSamples.filter(s => s._id !== tempId);
          } else if (updateInfo.originalSample) {
            // Restore original sample
            return prevSamples.map(s => s._id === tempId ? updateInfo.originalSample! : s);
          }
          return prevSamples;
        });
      }
      
      optimisticSamplesRef.current.delete(tempId);
      newlyAddedSamplesRef.current.delete(tempId);
      editedSamplesRef.current.delete(tempId);
      uploadingImagesRef.current.delete(tempId);
      
      // Show error message only on failure
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save sample. Please try again.' 
      });
      setTimeout(() => setMessage(null), TIMEOUTS.MESSAGE_DISPLAY);
    }
  }, [weaver, editingSample]);
  
  const handleSampleSaved = useCallback(async (wasEdit: boolean) => {
    // This is the fallback for non-optimistic saves
    // Mark that data has changed
    dataChangedRef.current = true;
    // Store flag in sessionStorage to notify main page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('weaverDataChanged', 'true');
    }
    setShowSampleForm(false);
    setEditingSample(null);
    // Reset fetch flag to force refresh
    isFetchingSamplesRef.current = false;
    // Refresh only samples (weaver data doesn't change)
    await fetchSamplesOnly();
    // No success message - UI already updated
  }, [fetchSamplesOnly]);

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

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Prevent body scroll when form is open
  useEffect(() => {
    if (showSampleForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showSampleForm]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(stickerPreviewUrl);
      }
    };
  }, [stickerPreviewUrl]);

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const filteredSamples = useMemo(() => {
    if (!normalizedSearch) return samples;
    
    return samples.filter(sample => {
      const textFields = [
        sample.qualityName,
        sample.type,
        sample.rack,
        sample.content,
        sample.danier,
        sample.label,
        sample.note
      ];
      const numericFields = [
        sample.greighWidth,
        sample.finishWidth,
        sample.weight,
        sample.gsm,
        sample.count,
        sample.reed,
        sample.pick,
        sample.greighRate
      ];
      
      const matchesText = textFields.some(value => 
        typeof value === 'string' && value.toLowerCase().includes(normalizedSearch)
      );
      
      const matchesNumber = numericFields.some(value => 
        value !== undefined && value !== null && String(value).toLowerCase().includes(normalizedSearch)
      );
      
      return matchesText || matchesNumber;
    });
  }, [samples, normalizedSearch]);
  
  const matchingSampleIds = useMemo(() => new Set(filteredSamples.map(sample => sample._id)), [filteredSamples]);
  const totalSamplesCount = samples.length;
  const filteredCount = filteredSamples.length;
  const hasSearch = normalizedSearch.length > 0;
  const sampleCountLabel = hasSearch
    ? `${filteredCount}/${totalSamplesCount} match${filteredCount === 1 ? '' : 'es'}`
    : `${totalSamplesCount} Sample${totalSamplesCount !== 1 ? 's' : ''}`;
  const hasNoSamples = totalSamplesCount === 0;
  const hasNoMatches = !hasNoSamples && filteredCount === 0;

  // Unauthorized check is handled in render - no need to redirect

  // Show skeleton while loading or before theme is mounted
  if (!darkModeMounted || authLoading || loading) {
    return (
      <div className={`w-full min-h-screen ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <WeaverSamplesSkeleton />
      </div>
    );
  }

  // Show unauthorized message if not superadmin
  if (!authLoading && !isSuperAdmin) {
    return <UnauthorizedMessage />;
  }

  // Don't render content if not superadmin and still loading
  if (!isSuperAdmin && authLoading) {
    return null;
  }

  // Only show "Weaver not found" if we're not loading and weaver is null
  // This prevents showing error before fetch completes
  if (!weaver && !loading && hasInitialFetchRef.current) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center min-h-screen ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <h2 className={`text-2xl font-bold mb-4 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>Weaver not found</h2>
        <button
          onClick={() => {
            // Mark that we're navigating back (for main page to skip reload)
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('weaverNavigatedBack', 'true');
            }
            // Use router.back() for smooth navigation without reload
            router.back();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }
  
  // If still loading or weaver not loaded yet, show skeleton
  if (!weaver) {
    return (
      <div className={`w-full min-h-screen ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <WeaverSamplesSkeleton />
      </div>
    );
  }

  return (
    <div 
      id="weaver-samples-view" 
      className={`min-h-screen w-full transition-colors duration-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
      suppressHydrationWarning
    >
      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-[200] min-w-80 max-w-md p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm transform transition-all duration-300 animate-fade-in ${
          message.type === 'success'
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
              className={`shrink-0 p-1 rounded-full transition-all hover:scale-110 active:scale-95 ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'
              }`}
              aria-label="Close message"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div 
        id="weaver-samples-header"
        className={`px-2.5 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 border-b ${
          isDarkMode 
            ? 'bg-gray-900 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="space-y-2 sm:space-y-2.5">
          {/* First Row: Back Button (hidden on small) + Name + Cross Button (small only) + Add Sample Button (on larger screens) */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
              {/* Back Arrow - Hidden on screens under 400px */}
              <button
                onClick={() => {
                  // Mark that we're navigating back (for main page to skip reload)
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('weaverNavigatedBack', 'true');
                  }
                  // Use router.back() for smooth navigation without reload
                  router.back();
                }}
                className={`hidden min-[400px]:block p-1.5 sm:p-2 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0 ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                <h2 className={`text-base sm:text-xl lg:text-2xl xl:text-3xl font-bold flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base lg:text-lg border-2 transition-all ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-400/30' 
                      : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-300'
                  }`}>
                    {weaver.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <span className="break-words min-w-0 leading-tight">{weaver.name}</span>
                </h2>
                {/* Cross Button - Only on screens under 400px, right side of name */}
                <button
                  onClick={() => {
                    // Mark that we're navigating back (for main page to skip reload)
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('weaverNavigatedBack', 'true');
                    }
                    // Use router.back() for smooth navigation without reload
                    router.back();
                  }}
                  className={`min-[400px]:hidden p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0 ${
                    isDarkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Go Back"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Add Sample and Delete All Buttons - Right side on larger screens */}
            <div className="hidden min-[400px]:flex items-center gap-2 flex-shrink-0">
              {isMaster && samples.length > 0 && (
                <button
                  onClick={handleDeleteAllSamples}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${
                    isDarkMode
                      ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                      : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                  }`}
                  title="Delete All Samples"
                >
                  <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Delete All</span>
                </button>
              )}
              <button
                onClick={handleAddSample}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${
                  isDarkMode
                    ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                    : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
                }`}
                title="Add Sample"
              >
                <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Add Sample</span>
              </button>
            </div>
          </div>

          {/* Second Row: Phone, Address, Sample Count */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:gap-3 text-xs sm:text-sm pl-0 min-[400px]:pl-8 sm:pl-11 lg:pl-12">
            {weaver.phone && (
              <span className={`flex items-center space-x-1 flex-shrink-0 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <DevicePhoneMobileIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="break-all">{weaver.phone}</span>
              </span>
            )}
            {weaver.address && (
              <span className={`flex items-start space-x-1 flex-1 min-w-0 max-[400px]:basis-full ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <BuildingOfficeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                <span className="break-words min-w-0">{weaver.address}</span>
              </span>
            )}
            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
              isDarkMode
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-blue-100 text-blue-700 border border-blue-300'
            }`}>
              {sampleCountLabel}
            </span>
          </div>

          {/* Third Row: Add Sample Button - Only on screens under 400px */}
          <div className="flex items-center gap-2 min-[400px]:hidden pl-0">
            {isMaster && samples.length > 0 && (
              <button
                onClick={handleDeleteAllSamples}
                className={`flex-1 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-2 shadow-sm text-sm font-medium ${
                  isDarkMode
                    ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                    : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                }`}
                title="Delete All Samples"
              >
                <TrashIcon className="h-5 w-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Delete All</span>
              </button>
            )}
            <button
              onClick={handleAddSample}
              className={`flex-1 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-2 shadow-sm text-sm font-medium ${
                isDarkMode
                  ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                  : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
              }`}
              title="Add Sample"
            >
              <PlusIcon className="h-5 w-5 flex-shrink-0" />
              <span className="whitespace-nowrap">Add Sample</span>
            </button>
          </div>

          {/* Search Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 pt-1 min-[400px]:pl-8 sm:pl-11 lg:pl-12">
            <div className="w-full sm:max-w-xl">
              <SearchBar
                searchQuery={searchTerm}
                onSearchChange={setSearchTerm}
                isDarkMode={isDarkMode}
                placeholder="Search samples (quality, rack, widths, gsm, content, rate, note...)"
              />
            </div>
            <div className={`flex items-center text-xs sm:text-sm font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {hasSearch
                ? `Showing ${filteredCount} of ${totalSamplesCount} sample${totalSamplesCount === 1 ? '' : 's'}`
                : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Samples Grid */}
      <div className="px-2 min-[400px]:px-3 sm:px-4 lg:px-6 py-3 min-[400px]:py-4 sm:py-6">
        {hasNoSamples ? (
          <div className={`flex flex-col items-center justify-center min-h-[60vh] ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <DocumentTextIcon className={`h-20 w-20 mb-6 opacity-50 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <p className={`text-xl font-medium mb-6 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>No samples found for this weaver</p>
            <button
              onClick={handleAddSample}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base font-medium ${
                isDarkMode
                  ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30 bg-green-500/10'
                  : 'text-green-600 hover:bg-green-100 border border-green-200 bg-green-50'
              }`}
              title="Add Sample"
            >
              <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="whitespace-nowrap">Add Sample</span>
            </button>
          </div>
        ) : hasNoMatches ? (
          <div className={`flex flex-col items-center justify-center min-h-[40vh] text-center ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <DocumentTextIcon className={`h-16 w-16 mb-4 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <p className="text-lg font-semibold mb-2">
              No samples match “{searchTerm.trim()}”
            </p>
            <p className="text-sm mb-4">
              Try searching by quality name, type, rack, widths, GSM, rates, notes, or any numeric values.
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center space-x-2 ${
                isDarkMode
                  ? 'text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 bg-blue-500/5'
                  : 'text-blue-700 hover:bg-blue-100 border border-blue-200 bg-blue-50'
              }`}
            >
              <XMarkIcon className="h-5 w-5" />
              <span>Clear search</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 min-[400px]:space-y-3 min-[500px]:space-y-4 sm:space-y-6">
            {samples.map((sample, sampleIndex) => {
              if (!matchingSampleIds.has(sample._id)) {
                return null;
              }
              const isNewlyAdded = newlyAddedSamplesRef.current.has(sample._id);
              const isEdited = editedSamplesRef.current.has(sample._id);
              const isDeleting = deletingSamplesRef.current.has(sample._id);
              return (
              <div
                key={sample._id}
                id={`sample-card-${sample._id}`}
                className={`rounded-2xl border-2 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] ${
                  isDeleting
                    ? 'animate-sample-delete-fade-out pointer-events-none'
                    : isNewlyAdded
                    ? 'animate-sample-green-glow'
                    : isEdited
                    ? 'animate-sample-edit-pulse'
                    : ''
                } ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800/90 backdrop-blur-sm'
                    : 'border-gray-300 bg-white shadow-lg'
                }`}
                style={isDeleting ? { 
                  transformOrigin: 'top center',
                  willChange: 'max-height, opacity, margin, padding, transform'
                } : {}}
              >
                {/* Sample Header */}
                <div 
                  id={`sample-header-${sample._id}`}
                  className={`p-2 min-[400px]:p-2.5 min-[500px]:p-3 sm:p-4 md:p-6 border-b ${
                    isDarkMode 
                      ? 'border-gray-700 bg-gradient-to-r from-gray-900/80 to-gray-800/50' 
                      : 'border-gray-200 bg-gradient-to-r from-gray-50 to-white'
                  }`}
                >
                  {/* Mobile Layout (under 700px): Stacked */}
                  <div className="min-[700px]:hidden space-y-3">
                    {/* First Row: Quality Name, Label, and Type */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                        <h3 className={`text-lg sm:text-xl font-bold break-words flex-1 min-w-0 flex items-center gap-1.5 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          <HashtagIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span>{sample.qualityName}</span>
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sample.label && (
                            <span className={`text-xs sm:text-sm px-2 py-1 rounded ${
                              isDarkMode 
                                ? 'bg-gray-700/50 text-gray-300' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {sample.label}
                            </span>
                          )}
                          {/* Type (Blend) - Right side */}
                          {sample.type && (
                            <span className={`text-xs sm:text-sm px-2 py-1 rounded flex items-center gap-1.5 ${
                              isDarkMode 
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' 
                                : 'bg-blue-100 text-blue-700 border border-blue-300'
                            }`}>
                              <CubeIconOutline className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span>{sample.type}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Second Row: Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 min-[500px]:flex-wrap">
                      <button
                        id={`download-sticker-btn-${sample._id}`}
                        onClick={() => handleStickerDownload(sample)}
                        className={`px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-sm text-xs sm:text-sm font-medium flex-1 min-[500px]:flex-initial ${
                          isNewlyAdded
                            ? 'animate-view-button-purple-glow'
                            : ''
                        } ${
                          isDarkMode
                            ? 'text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 bg-purple-500/10'
                            : 'text-purple-600 hover:bg-purple-100 border border-purple-200 bg-purple-50'
                        }`}
                        title="Sticker"
                      >
                        <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Sticker</span>
                      </button>
                      <button
                        id={`edit-sample-btn-${sample._id}`}
                        onClick={() => handleEditSample(sample)}
                        className={`px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-sm text-xs sm:text-sm font-medium flex-1 min-[500px]:flex-initial ${
                          isDarkMode
                            ? 'text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 bg-blue-500/10'
                            : 'text-blue-600 hover:bg-blue-100 border border-blue-200 bg-blue-50'
                        }`}
                        title="Edit Sample"
                      >
                        <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Edit</span>
                      </button>
                      {isMaster && (
                        <button
                          id={`delete-sample-btn-${sample._id}`}
                          onClick={() => handleDeleteSample(sample._id, sample.qualityName)}
                          className={`px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-sm text-xs sm:text-sm font-medium flex-1 min-[500px]:flex-initial ${
                            isDarkMode
                              ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                              : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                          }`}
                          title="Delete Sample"
                        >
                          <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span className="whitespace-nowrap">Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout (700px+): Horizontal */}
                  <div className="hidden min-[700px]:flex items-start justify-between">
                    <div className="flex-1">
                      {/* First Row: Quality Name and Label */}
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <h3 className={`text-xl md:text-2xl font-bold break-words flex items-center gap-1.5 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          <HashtagIcon className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" />
                          <span>{sample.qualityName}</span>
                        </h3>
                        {sample.label && (
                          <span className={`text-sm px-2 py-1 rounded ${
                            isDarkMode 
                              ? 'bg-gray-700/50 text-gray-300' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {sample.label}
                          </span>
                        )}
                        {/* Type (Blend) - Same row */}
                        {sample.type && (
                          <span className={`text-sm px-2 py-1 rounded flex items-center gap-1.5 ${
                            isDarkMode 
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' 
                              : 'bg-blue-100 text-blue-700 border border-blue-300'
                          }`}>
                            <CubeIconOutline className="h-4 w-4 flex-shrink-0" />
                            <span>{sample.type}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0 ml-4">
                      <button
                        id={`download-sticker-btn-${sample._id}`}
                        onClick={() => handleStickerDownload(sample)}
                        className={`px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${
                          isNewlyAdded
                            ? 'animate-view-button-purple-glow'
                            : ''
                        } ${
                          isDarkMode
                            ? 'text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 bg-purple-500/10'
                            : 'text-purple-600 hover:bg-purple-100 border border-purple-200 bg-purple-50'
                        }`}
                        title="Sticker"
                      >
                        <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Sticker</span>
                      </button>
                      <button
                        id={`edit-sample-btn-${sample._id}`}
                        onClick={() => handleEditSample(sample)}
                        className={`px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${
                          isDarkMode
                            ? 'text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 bg-blue-500/10'
                            : 'text-blue-600 hover:bg-blue-100 border border-blue-200 bg-blue-50'
                        }`}
                        title="Edit Sample"
                      >
                        <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Edit</span>
                      </button>
                      {isMaster && (
                        <button
                          id={`delete-sample-btn-${sample._id}`}
                          onClick={() => handleDeleteSample(sample._id, sample.qualityName)}
                          className={`px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-sm text-xs sm:text-sm font-medium ${
                            isDarkMode
                              ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30 bg-red-500/10'
                              : 'text-red-600 hover:bg-red-100 border border-red-200 bg-red-50'
                          }`}
                          title="Delete Sample"
                        >
                          <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span className="whitespace-nowrap">Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div id={`sample-content-${sample._id}`} className={`p-2 min-[400px]:p-2.5 min-[500px]:p-3 sm:p-4 md:p-6 ${
                  isDarkMode ? '' : 'bg-gray-50/30'
                }`}>
                  {/* Images Gallery */}
                  {sample.images && sample.images.length > 0 && (
                    <div id={`sample-images-${sample._id}`} className="mb-8">
                      <h4 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <EyeIcon className="h-5 w-5" />
                        <span>Images ({sample.images.length})</span>
                      </h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
                        {sample.images.map((img, imgIndex) => {
                          const uploadingSet = uploadingImagesRef.current.get(sample._id);
                          const isUploading = uploadingSet?.has(img);
                          const isPreviewUrl = img.startsWith('blob:');
                          
                          return (
                            <div
                              key={imgIndex}
                              onClick={() => !isUploading && setSelectedImageIndex({ sampleIndex, imageIndex: imgIndex })}
                              className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                isUploading 
                                  ? 'cursor-wait' 
                                  : 'cursor-pointer hover:scale-105'
                              } ${
                                isDarkMode 
                                  ? 'border-gray-600 hover:border-blue-500' 
                                  : 'border-gray-300 hover:border-blue-500'
                              }`}
                            >
                              {isUploading ? (
                                // Loading skeleton for uploading images
                                <div className={`w-full h-full relative overflow-hidden skeleton-shimmer ${
                                  isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                                }`}>
                                  {/* Preview image with opacity for context */}
                                  <img
                                    src={img}
                                    alt={`${sample.qualityName} ${imgIndex + 1} (uploading)`}
                                    className="w-full h-full object-cover opacity-30"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      // If preview fails, hide it
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                              ) : (
                                <>
                                  <img
                                    src={img}
                                    alt={`${sample.qualityName} ${imgIndex + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      // Show placeholder on error
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const placeholder = document.createElement('div');
                                        placeholder.className = `w-full h-full flex items-center justify-center ${
                                          isDarkMode ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400'
                                        }`;
                                        placeholder.innerHTML = `
                                          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                          </svg>
                                        `;
                                        parent.appendChild(placeholder);
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                    <EyeIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sample Details Grid */}
                  <div 
                    id={`sample-details-${sample._id}`}
                    className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 min-[400px]:gap-2 sm:gap-2 md:gap-3"
                  >
                    {sample.greighWidth > 0 && (
                      <div 
                        id={`detail-greigh-width-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CubeIconOutline className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Greigh Width</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.greighWidth}"
                        </p>
                      </div>
                    )}
                    {sample.finishWidth > 0 && (
                      <div 
                        id={`detail-finish-width-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CubeIconOutline className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Finish Width</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.finishWidth}"
                        </p>
                      </div>
                    )}
                    {sample.weight > 0 && (
                      <div 
                        id={`detail-weight-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <ScaleIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Weight</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.weight} KG
                        </p>
                      </div>
                    )}
                    {sample.gsm > 0 && (
                      <div 
                        id={`detail-gsm-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CubeIconOutline className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">GSM</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.gsm}
                        </p>
                      </div>
                    )}
                    {sample.greighRate > 0 && (
                      <div 
                        id={`detail-greigh-rate-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CurrencyDollarIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Greigh Rate</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          ₹{sample.greighRate}
                        </p>
                      </div>
                    )}
                    {sample.count > 0 && (
                      <div 
                        id={`detail-count-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <HashtagIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Count</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.count}
                        </p>
                      </div>
                    )}
                    {sample.reed > 0 && (
                      <div 
                        id={`detail-reed-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <HashtagIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Reed</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.reed}
                        </p>
                      </div>
                    )}
                    {sample.pick > 0 && (
                      <div 
                        id={`detail-pick-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <HashtagIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Pick</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.pick}
                        </p>
                      </div>
                    )}
                    {sample.content && (
                      <div 
                        id={`detail-content-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CubeIconOutline className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Content</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.content}
                        </p>
                      </div>
                    )}
                    {sample.danier && (
                      <div 
                        id={`detail-danier-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <HashtagIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Danier</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.danier}
                        </p>
                      </div>
                    )}
                    {sample.rack && (
                      <div 
                        id={`detail-rack-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CubeIconOutline className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Rack</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-bold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.rack}
                        </p>
                      </div>
                    )}
                    {sample.note?.trim() && (
                      <div 
                        id={`detail-note-${sample._id}`}
                        className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg transition-all hover:scale-105 ${
                          isDarkMode 
                            ? 'bg-gray-700/60 border border-gray-600 hover:border-blue-500' 
                            : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-[9px] min-[400px]:text-[10px] sm:text-[10px] md:text-xs font-semibold uppercase mb-0.5 flex items-center space-x-0.5 min-[400px]:space-x-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <DocumentTextIcon className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                          <span className="leading-tight">Note</span>
                        </p>
                        <p className={`text-sm min-[400px]:text-base md:text-lg font-medium line-clamp-3 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {sample.note}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {selectedImageIndex && samples[selectedImageIndex.sampleIndex]?.images && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in backdrop-blur-sm"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 z-10"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          
          <div 
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center animate-scale-in"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              setTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              setTouchEnd({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchEnd={() => {
              if (!touchStart || !touchEnd || !selectedImageIndex) return;
              
              const distanceX = touchStart.x - touchEnd.x;
              const distanceY = touchStart.y - touchEnd.y;
              const isLeftSwipe = distanceX > 50;
              const isRightSwipe = distanceX < -50;
              const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);
              
              // Only handle horizontal swipes (ignore vertical scrolling)
              if (isVerticalSwipe) {
                setTouchStart(null);
                setTouchEnd(null);
                return;
              }
              
              if (isLeftSwipe || isRightSwipe) {
                const sample = samples[selectedImageIndex.sampleIndex];
                if (sample?.images && sample.images.length > 1) {
                  if (isLeftSwipe) {
                    // Swipe left - next image
                    const nextImageIndex = (selectedImageIndex.imageIndex + 1) % sample.images.length;
                    setSelectedImageIndex({ ...selectedImageIndex, imageIndex: nextImageIndex });
                  } else if (isRightSwipe) {
                    // Swipe right - previous image
                    const prevImageIndex = selectedImageIndex.imageIndex === 0 
                      ? sample.images.length - 1 
                      : selectedImageIndex.imageIndex - 1;
                    setSelectedImageIndex({ ...selectedImageIndex, imageIndex: prevImageIndex });
                  }
                }
              }
              
              setTouchStart(null);
              setTouchEnd(null);
            }}
          >
            {(() => {
              const currentImage = samples[selectedImageIndex.sampleIndex].images![selectedImageIndex.imageIndex];
              const isPreviewUrl = currentImage.startsWith('blob:');
              const sampleId = samples[selectedImageIndex.sampleIndex]._id;
              const uploadingSet = uploadingImagesRef.current.get(sampleId);
              const isUploading = uploadingSet?.has(currentImage);
              
              return (
                <>
                  <img
                    src={currentImage}
                    alt={`${samples[selectedImageIndex.sampleIndex].qualityName} ${selectedImageIndex.imageIndex + 1}`}
                    className="max-w-full max-h-full object-contain animate-fade-in select-none"
                    onClick={(e) => e.stopPropagation()}
                    draggable={false}
                    onError={(e) => {
                      // Show placeholder on error
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'flex flex-col items-center justify-center text-white';
                        placeholder.innerHTML = `
                          <svg class="w-24 h-24 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <p class="text-lg opacity-75">Image not available</p>
                        `;
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-full h-full skeleton-shimmer opacity-50"></div>
                    </div>
                  )}
                </>
              );
            })()}
            
            {samples[selectedImageIndex.sampleIndex].images!.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const sample = samples[selectedImageIndex.sampleIndex];
                    const prevImageIndex = selectedImageIndex.imageIndex === 0 
                      ? sample.images!.length - 1 
                      : selectedImageIndex.imageIndex - 1;
                    setSelectedImageIndex({ ...selectedImageIndex, imageIndex: prevImageIndex });
                  }}
                  className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <ChevronLeftIcon className="h-8 w-8" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const sample = samples[selectedImageIndex.sampleIndex];
                    const nextImageIndex = (selectedImageIndex.imageIndex + 1) % sample.images!.length;
                    setSelectedImageIndex({ ...selectedImageIndex, imageIndex: nextImageIndex });
                  }}
                  className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <ChevronRightIcon className="h-8 w-8" />
                </button>
              </>
            )}
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-sm">
              {selectedImageIndex.imageIndex + 1} / {samples[selectedImageIndex.sampleIndex].images!.length}
            </div>
          </div>
        </div>
      )}

      {/* Sticker PDF Preview Modal */}
      {showStickerPreview && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in backdrop-blur-sm"
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
          <div 
            className={`relative w-full max-w-4xl h-[90vh] rounded-xl overflow-hidden shadow-2xl animate-scale-in ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Sticker Preview
              </h3>
              <div className="flex items-center space-x-2">
                {stickerPreviewUrl && !isLoadingStickerPreview && (
                  <button
                    onClick={handleFinalStickerDownload}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md flex items-center space-x-2 ${
                      isDarkMode
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
                    if (stickerPreviewUrl && stickerPreviewUrl.startsWith('blob:')) {
                      URL.revokeObjectURL(stickerPreviewUrl);
                    }
                    setShowStickerPreview(false);
                    setStickerPreviewUrl(null);
                    setCurrentStickerSample(null);
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 ${
                    isDarkMode
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
                  <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${
                    isDarkMode ? 'border-blue-400' : 'border-blue-600'
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

      {/* Sample Form Modal */}
      {showSampleForm && weaver && (
        <SampleForm
          weaver={{
            _id: weaver._id,
            name: weaver.name,
            phone: weaver.phone,
            address: weaver.address
          }}
          sample={editingSample ? {
            ...editingSample,
            content: editingSample.content || '',
            danier: editingSample.danier || '',
            label: editingSample.label || '',
            images: editingSample.images || []
          } : null}
          onClose={() => {
            setShowSampleForm(false);
            setEditingSample(null);
          }}
          onSave={(wasEdit) => handleSampleSaved(wasEdit)}
          onOptimisticSave={handleOptimisticSampleSave}
          onDelete={(sampleId) => {
            const sample = samples.find(s => s._id === sampleId);
            handleDeleteSample(sampleId, sample?.qualityName);
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeleteConfirmation(null);
            }
          }}
        >
          <div 
            className={`w-full max-w-md rounded-xl shadow-2xl border animate-scale-in ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Confirm Delete
                </h3>
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  disabled={isDeleting}
                  className={`p-1.5 rounded-lg transition-all duration-200 hover:rotate-90 active:scale-95 ${
                    isDarkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <p className={`mb-6 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Are you sure you want to delete <strong className={isDarkMode ? 'text-white' : 'text-gray-900'}>{deleteConfirmation.name || 'this sample'}</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSample}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg ${
                    isDeleting
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    isDarkMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="flex items-center space-x-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      <span>Deleting...</span>
                    </span>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Samples Confirmation Modal */}
      {deleteAllConfirmation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingAll) {
              setDeleteAllConfirmation(null);
            }
          }}
        >
          <div 
            className={`w-full max-w-md rounded-xl shadow-2xl border animate-scale-in ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Confirm Delete All
                </h3>
                <button
                  onClick={() => setDeleteAllConfirmation(null)}
                  disabled={isDeletingAll}
                  className={`p-1.5 rounded-lg transition-all duration-200 hover:rotate-90 active:scale-95 ${
                    isDarkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className={`text-base mb-4 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Are you sure you want to delete all samples?
                </p>
                <div className={`p-4 rounded-lg border-2 ${
                  isDarkMode 
                    ? 'bg-red-900/20 border-red-500/50' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`font-bold mb-2 ${
                    isDarkMode ? 'text-red-400' : 'text-red-700'
                  }`}>
                    Warning: This will delete {deleteAllConfirmation.sampleCount} sample{deleteAllConfirmation.sampleCount !== 1 ? 's' : ''}
                  </p>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-red-300' : 'text-red-600'
                  }`}>
                    All samples, images, and associated data will be permanently deleted. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setDeleteAllConfirmation(null)}
                  disabled={isDeletingAll}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAllSamples}
                  disabled={isDeletingAll}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg flex items-center space-x-2 ${
                    isDeletingAll
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    isDarkMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isDeletingAll ? (
                    <span className="flex items-center space-x-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      <span>Deleting...</span>
                    </span>
                  ) : (
                    'Delete All Samples'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-40 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 scroll-to-top-btn ${
            isDarkMode
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
