'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  TableCellsIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowUpIcon,
  ListBulletIcon,
  TagIcon,
  ScaleIcon,
  HashtagIcon,
  Cog8ToothIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSession } from '../hooks/useSession';
import CameraModal from '../components/CameraModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { useRealtimeSync } from '@/app/hooks/useRealtimeSync';
import { generateFinishLotStickerPDF, downloadFinishLotStickerPDFDirect } from '@/lib/pdfGenerator';
import QRCode from 'qrcode';

interface FinishLotStock {
  _id: string;
  qualityName: string;
  lotType: 'RFD' | 'OTHER';
  sequence: string;
  weaverName?: string;
  weaverQuality?: string;
  millName?: string;
  processInMill?: string;
  images: string[];
  meter: number;
  piece: number;
  createdAt: string;
  updatedAt: string;
}

interface QualityItem {
  _id: string;
  name: string;
}

export default function FinishLotStockPage() {
  const router = useRouter();
  const { isDarkMode, mounted } = useDarkMode();
  const { isMaster } = useSession();
  const [isPending, startTransition] = useTransition();

  // Core Stock State
  const [stocks, setStocks] = useState<FinishLotStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minMeter, setMinMeter] = useState('');
  const [maxMeter, setMaxMeter] = useState('');
  const [minPiece, setMinPiece] = useState('');
  const [maxPiece, setMaxPiece] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals & Popups
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  // Selected Item / Form Data
  const [selectedStock, setSelectedStock] = useState<FinishLotStock | null>(null);
  const [formData, setFormData] = useState({
    qualityName: '',
    lotType: 'RFD' as 'RFD' | 'OTHER',
    weaverName: '',
    weaverQuality: '',
    millName: '',
    processInMill: '',
    images: [] as string[],
    meter: '' as string | number,
    piece: '' as string | number
  });

  // Validation & Form Error States (for Shake Animations)
  const [formErrors, setFormErrors] = useState<{
    qualityName?: boolean;
    meter?: boolean;
    piece?: boolean;
  }>({});

  // Pending and drag image states
  const [pendingImageFiles, setPendingImageFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [submitting, setSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<{ urls: string[]; index: number } | null>(null);
  
  // Sticker Preview State
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(null);
  const [currentStickerItem, setCurrentStickerItem] = useState<FinishLotStock | null>(null);
  const [isLoadingStickerPreview, setIsLoadingStickerPreview] = useState(false);
  const stickerBlobUrlRef = useRef<string | null>(null);

  // QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [currentQrStock, setCurrentQrStock] = useState<FinishLotStock | null>(null);

  // Animation Triggers matching sampling page
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [sortFlipDirection, setSortFlipDirection] = useState<'top-to-bottom' | 'bottom-to-top' | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(12);

  // Grand summary stats returned from backend
  const [summaryStats, setSummaryStats] = useState({
    totalPieces: 0,
    totalMeters: 0,
    uniqueQualities: 0
  });

  const [filterLotType, setFilterLotType] = useState<'ALL' | 'RFD' | 'OTHER'>('ALL');
  const [showLotTypeDropdown, setShowLotTypeDropdown] = useState(false);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const limitDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search trigger (matches 500ms sampling page patterns)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm);
        setCurrentPage(1);
      });
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  // View mode persistence in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('finishLotStocksViewMode');
      if (savedMode === 'cards' || savedMode === 'table') {
        setViewMode(savedMode);
      } else {
        const isMobile = window.innerWidth < 768;
        setViewMode(isMobile ? 'cards' : 'table');
      }

      const savedSortBy = localStorage.getItem('finishLotStocksSortBy');
      if (savedSortBy) {
        setSortBy(savedSortBy);
      }
      const savedSortOrder = localStorage.getItem('finishLotStocksSortOrder');
      if (savedSortOrder === 'asc' || savedSortOrder === 'desc') {
        setSortOrder(savedSortOrder);
      }
    }
  }, []);

  // Save sort configuration to cache when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finishLotStocksSortBy', sortBy);
      localStorage.setItem('finishLotStocksSortOrder', sortOrder);
    }
  }, [sortBy, sortOrder]);

  // Screen resize listener to auto-switch viewMode if user has no saved preference
  useEffect(() => {
    const handleResize = () => {
      const savedMode = localStorage.getItem('finishLotStocksViewMode');
      if (savedMode === 'cards' || savedMode === 'table') {
        return; // Respect user preference
      }
      const isMobile = window.innerWidth < 768;
      setViewMode(isMobile ? 'cards' : 'table');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('finishLotStocksViewMode', mode);
    }
  };

  // Scroll visibility logic
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for Escape key to close form / image preview / camera / dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showImagePreview) {
          setShowImagePreview(null);
        } else if (showCamera) {
          setShowCamera(false);
        } else if (showFormModal) {
          setShowFormModal(false);
        } else {
          setShowSortDropdown(false);
          setShowLimitDropdown(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImagePreview, showCamera, showFormModal]);

  // Click outside elements helpers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target as unknown as Node)) {
        setShowSortDropdown(false);
      }
      if (limitDropdownRef.current && !limitDropdownRef.current.contains(target as unknown as Node)) {
        setShowLimitDropdown(false);
      }
      if (target && target.closest && !target.closest('.lottype-dropdown')) {
        setShowLotTypeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch stocks list
  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Build url parameters
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      params.append('search', debouncedSearch);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      if (filterLotType !== 'ALL') {
        params.append('lotType', filterLotType);
      }

      if (minMeter) params.append('minMeter', minMeter);
      if (maxMeter) params.append('maxMeter', maxMeter);
      if (minPiece) params.append('minPiece', minPiece);
      if (maxPiece) params.append('maxPiece', maxPiece);

      const res = await fetch(`/api/finish-lot-stocks?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setStocks(data.data || []);
        if (data.summary) {
          setSummaryStats(data.summary);
        }
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
        }
      } else {
        showToast('error', data.message || 'Failed to load stock data');
      }
    } catch (error) {
      showToast('error', 'Error connecting to the server');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, debouncedSearch, minMeter, maxMeter, minPiece, maxPiece, sortBy, sortOrder, filterLotType]);

  // Fetch qualities for autocomplete
  useEffect(() => {
    if (mounted) {
      fetchStocks();
    }
  }, [fetchStocks, mounted]);

  // Toast message helper
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Drag and Drop handlers
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
    try {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(Array.from(files));
      }
    } catch (err: any) {
      console.error("Error in handleFileInput:", err);
    } finally {
      e.target.value = '';
    }
  };

  const handleFiles = (files: File[]) => {
    const newFiles: Array<{ file: File; previewUrl: string }> = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type || '';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = fileType.startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg'].includes(ext);

      if (!isImage) {
        errors.push(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 10MB limit`);
        continue;
      }
      try {
        const previewUrl = URL.createObjectURL(file);
        newFiles.push({ file, previewUrl });
      } catch (err: any) {
        console.error('Failed to create object URL:', err);
        errors.push(`${file.name} failed to process preview`);
      }
    }

    if (errors.length > 0) {
      showToast('error', errors.join('; '));
    }

    if (newFiles.length > 0) {
      setPendingImageFiles(prev => [...prev, ...newFiles]);
      showToast('success', `Added ${newFiles.length} image(s) to previews`);
    }
  };

  const handleCameraCapture = (file: File) => {
    handleFiles([file]);
    setShowCamera(false);
  };

  const removePendingImage = (imageIndex: number) => {
    const fileToRemove = pendingImageFiles[imageIndex];
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setPendingImageFiles(prev => prev.filter((_, i) => i !== imageIndex));
  };

  const removeUploadedImage = (imageIndex: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== imageIndex)
    }));
  };

  const cleanupStickerUrl = useCallback(() => {
    if (stickerBlobUrlRef.current) {
      URL.revokeObjectURL(stickerBlobUrlRef.current);
      stickerBlobUrlRef.current = null;
    }
  }, []);

  const handleOpenQrModal = async (stock: FinishLotStock) => {
    try {
      const qrPayload = `Quality: ${stock.qualityName || '-'}\nSeq: ${stock.sequence || '-'}\nType: ${stock.lotType || '-'}\nWeaver: ${stock.weaverName || '-'}\nW.Qual: ${stock.weaverQuality || '-'}\nMill: ${stock.millName || '-'}\nProc: ${stock.processInMill || '-'}\nMeter: ${stock.meter || '-'}\nPiece: ${stock.piece || '-'}`;
      const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 300 });
      setQrModalUrl(dataUrl);
      setCurrentQrStock(stock);
      setShowQrModal(true);
    } catch (err) {
      console.error("Error generating QR code:", err);
      showToast('error', 'Failed to generate QR code');
    }
  };

  const handleStickerDownload = async (stock: FinishLotStock) => {
    try {
      setIsLoadingStickerPreview(true);
      setCurrentStickerItem(stock);
      setShowStickerPreview(true);
      cleanupStickerUrl();
      const dataUrl = await generateFinishLotStickerPDF({
        qualityName: stock.qualityName,
        sequence: stock.sequence,
        lotType: stock.lotType,
        weaverName: stock.weaverName,
        weaverQuality: stock.weaverQuality,
        millName: stock.millName,
        processInMill: stock.processInMill,
        meter: stock.meter,
        piece: stock.piece
      });

      stickerBlobUrlRef.current = dataUrl;
      setStickerPreviewUrl(dataUrl);
      setTimeout(() => setIsLoadingStickerPreview(false), 500);
    } catch (error) {
      console.error('Error generating sticker preview:', error);
      showToast('error', 'Failed to generate sticker preview');
      setShowStickerPreview(false);
    } finally {
      setIsLoadingStickerPreview(false);
    }
  };

  const cleanupPreviews = () => {
    pendingImageFiles.forEach(item => {
      URL.revokeObjectURL(item.previewUrl);
    });
    setPendingImageFiles([]);
  };

  // Handle Form Open (Create/Edit)
  const handleOpenForm = (mode: 'create' | 'edit', stock?: FinishLotStock) => {
    cleanupPreviews();
    setFormMode(mode);
    setFormErrors({});
    if (mode === 'edit' && stock) {
      setSelectedStock(stock);
      setFormData({
        qualityName: stock.qualityName,
        lotType: stock.lotType || 'OTHER',
        weaverName: stock.weaverName || '',
        weaverQuality: stock.weaverQuality || '',
        millName: stock.millName || '',
        processInMill: stock.processInMill || '',
        images: stock.images || [],
        meter: stock.meter,
        piece: stock.piece
      });
    } else {
      setSelectedStock(null);
      setFormData({
        qualityName: '',
        lotType: 'RFD',
        weaverName: '',
        weaverQuality: '',
        millName: '',
        processInMill: '',
        images: [],
        meter: '',
        piece: ''
      });
    }
    setShowFormModal(true);
  };

  const uploadFileToS3 = async (file: File): Promise<string> => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('folder', 'finish-lot-stocks');

    const token = localStorage.getItem('token');
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: uploadFormData
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Upload failed with status: ${res.status}`);
    }

    const data = await res.json();
    if (data.success && (data.url || data.imageUrl)) {
      return data.url || data.imageUrl;
    } else {
      throw new Error(data.message || 'Upload failed: no URL returned');
    }
  };

  // Validation and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict Client Validation
    const errors = {
      qualityName: !formData.qualityName.trim(),
      meter: formData.meter !== '' && (Number(formData.meter) < 0 || isNaN(Number(formData.meter))),
      piece: formData.piece !== '' && (Number(formData.piece) < 0 || !Number.isInteger(Number(formData.piece)))
    };

    setFormErrors(errors);

    if (errors.qualityName || errors.meter || errors.piece) {
      showToast('error', 'Please correct the invalid fields highlighted in red');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Upload pending image files in parallel
      const uploadedUrls: string[] = [];
      if (pendingImageFiles.length > 0) {
        showToast('info', `Uploading ${pendingImageFiles.length} image(s)...`);
        const uploadPromises = pendingImageFiles.map(async (pendingFile) => {
          try {
            const url = await uploadFileToS3(pendingFile.file);
            return { success: true, url };
          } catch (uploadErr: any) {
            console.error('Error uploading image:', uploadErr);
            return { success: false, error: uploadErr.message || 'Upload failed' };
          }
        });

        const uploadResults = await Promise.all(uploadPromises);
        const failures = uploadResults.filter(r => !r.success);

        if (failures.length > 0) {
          showToast('error', `Failed to upload ${failures.length} image(s). Please try again.`);
          setSubmitting(false);
          return;
        }

        uploadResults.forEach(r => {
          if (r.success && r.url) {
            uploadedUrls.push(r.url);
          }
        });
      }

      // Merge uploaded urls with existing ones
      const allImages = [...formData.images, ...uploadedUrls];

      const token = localStorage.getItem('token');
      const payload = {
        qualityName: formData.qualityName.trim(),
        lotType: formData.lotType,
        weaverName: formData.weaverName.trim(),
        weaverQuality: formData.weaverQuality.trim(),
        millName: formData.millName.trim(),
        processInMill: formData.processInMill.trim(),
        images: allImages,
        meter: formData.meter === '' ? 0 : Number(formData.meter),
        piece: formData.piece === '' ? 0 : Number(formData.piece)
      };

      const url = formMode === 'edit' && selectedStock
        ? `/api/finish-lot-stocks/${selectedStock._id}`
        : '/api/finish-lot-stocks';

      const method = formMode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        const id = data.data?._id;
        if (id) {
          if (formMode === 'create') {
            setNewlyAddedIds(prev => new Set(prev).add(id));
            setTimeout(() => setNewlyAddedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            }), 2000);
          } else {
            setEditedIds(prev => new Set(prev).add(id));
            setTimeout(() => setEditedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            }), 2000);
          }
        }

        showToast('success', formMode === 'edit' ? 'Stock updated successfully' : 'Stock created successfully');
        setShowFormModal(false);
        fetchStocks();
      } else {
        showToast('error', data.message || 'Action failed');
      }
    } catch (error) {
      showToast('error', 'Failed to save stock item');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Individual Item
  const handleDeleteItem = async () => {
    if (!selectedStock) return;
    setIsDeleting(true);
    const id = selectedStock._id;

    // Add to deletingIds for row/card fade out animation
    setDeletingIds(prev => new Set(prev).add(id));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/finish-lot-stocks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Stock item deleted successfully');
        setShowDeleteModal(false);
        setSelectedStock(null);
        // Delay to allow fade out animation to finish
        setTimeout(() => {
          setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          fetchStocks();
        }, 400);
      } else {
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast('error', data.message || 'Delete failed');
      }
    } catch (error) {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast('error', 'Error connecting to the server');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sort change handler with directional flip animation
  const handleSortChange = (field: string) => {
    let order = 'desc';
    if (sortBy === field) {
      order = sortOrder === 'desc' ? 'asc' : 'desc';
    }

    // Set flip direction based on order
    const direction = order === 'asc' ? 'bottom-to-top' : 'top-to-bottom';
    setSortFlipDirection(direction);

    // Reset flip animation class after it completes
    setTimeout(() => setSortFlipDirection(null), 800);

    startTransition(() => {
      setSortBy(field);
      setSortOrder(order);
      setCurrentPage(1);
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    startTransition(() => {
      setSearchTerm('');
      setMinMeter('');
      setMaxMeter('');
      setMinPiece('');
      setMaxPiece('');
      setSortBy('createdAt');
      setSortOrder('desc');
      setCurrentPage(1);
    });
  };


  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🌟 REAL-TIME SYNC
  useRealtimeSync(
    () => fetchStocks(), 
    showFormModal || showDeleteModal
  );

  if (!mounted) return null;

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[10000] min-w-80 max-w-md p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm transform transition-all duration-300 animate-fade-in ${toast.type === 'success'
          ? isDarkMode ? 'bg-green-900/90 border-green-500 text-green-100' : 'bg-green-50 border-green-500 text-green-800'
          : toast.type === 'info'
            ? isDarkMode ? 'bg-blue-900/90 border-blue-500 text-blue-100' : 'bg-blue-50 border-blue-500 text-blue-800'
            : isDarkMode ? 'bg-red-900/90 border-red-500 text-red-100' : 'bg-red-50 border-red-500 text-red-800'
          }`}>
          <div className="flex items-center space-x-3">
            {toast.type === 'success' ? (
              <CheckIcon className={`h-6 w-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            ) : toast.type === 'info' ? (
              <InformationCircleIcon className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            ) : (
              <XMarkIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            )}
            <p className="font-medium flex-1">{toast.message}</p>
            <button onClick={() => setToast(null)} className="shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full pb-6">
        <div className={`border-2 shadow-xl overflow-hidden ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-white'}`}>
          {/* ─── TOOLBAR CONTAINER ─── */}
          <div className={`mb-4 sm:mb-6 flex flex-col gap-3 p-3 sm:p-4 rounded-2xl border shadow-lg transition-all duration-200 ${isDarkMode ? 'bg-[#1E2938] border-gray-700' : 'bg-white border-gray-200'}`}>
            
            {/* ROW 1: SEARCH BAR + ADD BUTTON */}
            <div className="flex flex-row items-center justify-between gap-2.5">
              <div className={`relative flex-1 flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-slate-50 focus-within:bg-white'
              }`}>
                <MagnifyingGlassIcon className={`absolute left-3 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder="Search by quality name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm bg-transparent outline-none ${
                    isDarkMode ? 'text-white placeholder-gray-400' : 'text-slate-900 placeholder-slate-500 font-medium'
                  }`}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <XMarkIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>

              <button
                onClick={() => handleOpenForm('create')}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] shrink-0"
                title="Add Stock Item"
              >
                <PlusIcon className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Add Stock</span>
              </button>
            </div>

            {searchTerm && (
              <div className={`text-xs -mt-1 font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                Found {totalCount} result{totalCount !== 1 ? 's' : ''} for "{searchTerm}"
              </div>
            )}

            {/* ROW 2: FILTERS + VIEW MODES */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 w-full">
              
              {/* Left Side: Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Sort Pill */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                      (sortBy === 'createdAt' && sortOrder === 'desc')
                        ? (isDarkMode ? 'bg-gray-700/80 border-gray-600 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                        : 'bg-blue-600 text-white border-blue-600'
                    }`}
                  >
                    <span>{sortOrder === 'desc' ? 'Latest' : 'Oldest'}</span>
                    <ChevronDownIcon className="w-3 h-3 opacity-60" />
                  </button>
                  {showSortDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowSortDropdown(false)} />
                      <div className={`absolute left-0 top-full mt-1 w-32 rounded-xl border shadow-xl z-40 py-1 ${isDarkMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <button
                          onClick={() => { handleSortChange('createdAt'); setSortOrder('desc'); setShowSortDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 ${sortOrder === 'desc' ? 'text-blue-500 font-bold' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}
                        >
                          Latest First
                        </button>
                        <button
                          onClick={() => { handleSortChange('createdAt'); setSortOrder('asc'); setShowSortDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 ${sortOrder === 'asc' ? 'text-blue-500 font-bold' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}
                        >
                          Oldest First
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Type Pill */}
                <div className="relative lottype-dropdown">
                  <button
                    onClick={() => setShowLotTypeDropdown(!showLotTypeDropdown)}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                      filterLotType !== 'ALL'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : isDarkMode ? 'bg-gray-700/80 border-gray-600 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'
                    }`}
                  >
                    <span>{filterLotType === 'ALL' ? 'Type' : filterLotType}</span>
                    <ChevronDownIcon className="w-3 h-3 opacity-60" />
                  </button>
                  {showLotTypeDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowLotTypeDropdown(false)} />
                      <div className={`absolute left-0 top-full mt-1 w-28 rounded-xl border shadow-xl z-40 py-1 ${isDarkMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        {['ALL', 'RFD', 'OTHER'].map(type => (
                          <button
                            key={type}
                            onClick={() => { setFilterLotType(type as any); setShowLotTypeDropdown(false); setCurrentPage(1); }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 ${filterLotType === type ? 'text-blue-500 font-bold' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}
                          >
                            {type === 'ALL' ? 'All Types' : type}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Side: View Mode & Refresh */}
              <div className="flex items-center gap-2">
                <div className={`flex rounded-lg border overflow-hidden ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}>
                  <button
                    onClick={() => handleViewModeChange('table')}
                    className={`p-1.5 sm:px-2.5 sm:py-1.5 text-xs transition-colors ${viewMode === 'table' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-white shadow text-blue-600') : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700')}`}
                    title="Table View"
                  >
                    <ListBulletIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleViewModeChange('cards')}
                    className={`p-1.5 sm:px-2.5 sm:py-1.5 text-xs transition-colors ${viewMode === 'cards' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-white shadow text-blue-600') : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700')}`}
                    title="Card View"
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={fetchStocks}
                  disabled={loading}
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border transition-all hover:bg-gray-50 dark:hover:bg-gray-700 ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'}`}
                  title="Refresh"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Pagination Row */}
            <div className={`mt-2 pt-3 border-t flex flex-row items-center justify-between gap-2 text-xs sm:text-sm ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {totalCount > 0 && (
                  <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} whitespace-nowrap`}>
                    <span className="hidden sm:inline">
                      Showing {Math.min((currentPage - 1) * limit + 1, totalCount)} to {Math.min(currentPage * limit, totalCount)} of {totalCount} items
                    </span>
                    <span className="sm:hidden text-[10px]">
                      {Math.min((currentPage - 1) * limit + 1, totalCount)}-{Math.min(currentPage * limit, totalCount)} of {totalCount}
                    </span>
                  </span>
                )}

                {/* Items per page dropdown */}
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className={`text-[10px] xs:text-xs sm:text-sm hidden xs:inline ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className={`px-1.5 sm:px-2 py-0.5 rounded-lg border text-[10px] xs:text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 hover:scale-[1.02] focus:scale-[1.02] input-focus ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white hover:border-blue-400' 
                        : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {[10, 20, 50, 100].map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Top Page Navigation */}
              {totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                    className={`px-2 py-1 rounded-lg text-xs transition-all duration-150 hover:scale-105 active:scale-95 hover-lift shadow-sm hover:shadow-md ${currentPage === 1 || loading
                        ? isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                      }`}
                  >
                    <span className="hidden xs:inline">Previous</span>
                    <span className="xs:hidden">&larr;</span>
                  </button>

                  {/* Smart Page numbers */}
                  <div className="flex items-center space-x-0.5">
                    {(() => {
                      const pages = [];
                      if (totalPages <= 5) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              disabled={loading}
                              className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md text-[10px] sm:text-xs font-semibold transition-colors duration-150 ${currentPage === i
                                  ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                  : isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                              {i}
                            </button>
                          );
                        }
                      } else {
                        // Complex pagination logic (same as Orders/Fabrics)
                        if (currentPage > 2) {
                          pages.push(
                            <button key={1} onClick={() => setCurrentPage(1)} className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md text-[10px] sm:text-xs font-semibold transition-colors duration-150 ${isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'}`}>1</button>
                          );
                          if (currentPage > 3) pages.push(<span key="dots1" className="px-1 text-[10px] sm:text-xs text-gray-500">...</span>);
                        }

                        for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
                          if (i === 1 && currentPage > 2) continue;
                          if (i === totalPages && currentPage < totalPages - 1) continue;
                          
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              disabled={loading}
                              className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md text-[10px] sm:text-xs font-semibold transition-colors duration-150 ${currentPage === i
                                  ? isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                                  : isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                              {i}
                            </button>
                          );
                        }

                        if (currentPage < totalPages - 1) {
                          if (currentPage < totalPages - 2) pages.push(<span key="dots2" className="px-1 text-[10px] sm:text-xs text-gray-500">...</span>);
                          pages.push(
                            <button key={totalPages} onClick={() => setCurrentPage(totalPages)} className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md text-[10px] sm:text-xs font-semibold transition-colors duration-150 ${isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'}`}>{totalPages}</button>
                          );
                        }
                      }
                      return pages;
                    })()}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || loading}
                    className={`px-2 py-1 rounded-lg text-xs transition-all duration-150 hover:scale-105 active:scale-95 hover-lift shadow-sm hover:shadow-md ${currentPage === totalPages || loading
                        ? isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
                      }`}
                  >
                    <span className="hidden xs:inline">Next</span>
                    <span className="xs:hidden">&rarr;</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`min-h-[400px] ${viewMode === 'cards' || loading || stocks.length === 0 ? 'p-4' : ''}`}>
            {/* Main Content Area */}
            {loading ? (
              viewMode === 'cards' ? (
                /* Skeleton Grid Loader for Cards */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: limit }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-4 flex flex-col h-72 animate-pulse ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                        }`}
                    >
                      <div className={`w-full h-36 rounded-xl mb-4 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`h-5 w-3/4 rounded-md mb-2 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className="mt-auto flex justify-between">
                        <div className={`h-4 w-1/3 rounded-md ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                        <div className={`h-4 w-1/3 rounded-md ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Skeleton Table Loader for Table View */
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/80">
                    <thead className={`${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'
                      }`}
                      style={{
                        borderBottom: isDarkMode
                          ? '2px solid rgba(75, 85, 99, 0.6)'
                          : '2px solid rgba(209, 213, 219, 1)'
                      }}
                    >
                      <tr>
                        <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <div className="flex items-center space-x-2">
                            <PhotoIcon className="h-4 w-4" />
                            <span>Preview</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <div className="flex items-center space-x-2">
                            <TagIcon className="h-4 w-4" />
                            <span>Quality Name</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <div className="flex items-center justify-end space-x-2 w-full">
                            <ScaleIcon className="h-4 w-4" />
                            <span>Meter</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <div className="flex items-center justify-end space-x-2 w-full">
                            <HashtagIcon className="h-4 w-4" />
                            <span>Piece</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <div className="flex items-center justify-center space-x-2 w-full">
                            <Cog8ToothIcon className="h-4 w-4" />
                            <span>Actions</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                      {Array.from({ length: limit }).map((_, index) => (
                        <tr
                          key={`skeleton-${index}`}
                          className="animate-pulse"
                          style={{
                            borderBottom: index < limit - 1
                              ? isDarkMode
                                ? '2px solid rgba(75, 85, 99, 0.6)'
                                : '2px solid rgba(209, 213, 219, 1)'
                              : 'none'
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className={`w-40 h-24 rounded-lg border ${isDarkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-gray-200 border-gray-300'
                              }`}></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                              }`}></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <div className={`h-4 rounded w-16 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <div className={`h-4 rounded w-12 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <div className={`h-8 w-16 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                              <div className={`h-8 w-16 rounded-lg ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : stocks.length === 0 ? (
              /* Empty State */
              <div className={`py-16 px-4 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-800/20 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                <div className="p-4 rounded-full bg-blue-500/10 text-blue-500 mb-4 animate-pulse">
                  <PhotoIcon className="h-12 w-12" />
                </div>
                <h3 className="text-xl font-bold">No finish lot stock items found</h3>
                <p className={`mt-2 max-w-sm text-sm mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {searchTerm || minMeter || maxMeter || minPiece || maxPiece
                    ? 'Try refining your search text or filter options.'
                    : 'Get started by creating your first finish lot stock item right now.'}
                </p>
                {!searchTerm && !minMeter && !maxMeter && !minPiece && !maxPiece && (
                  <button
                    onClick={() => handleOpenForm('create')}
                    className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all"
                  >
                    Add Stock Item
                  </button>
                )}
              </div>
            ) : viewMode === 'cards' ? (
              /* Grid Layout Mode */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {stocks.map((stock) => {
                  const isNewlyAdded = newlyAddedIds.has(stock._id);
                  const isEdited = editedIds.has(stock._id);
                  const isDeletingItem = deletingIds.has(stock._id);

                  return (
                    <div
                      key={stock._id}
                      className={`relative rounded-2xl border overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:translate-y-[-4px] ${isDeletingItem
                        ? 'animate-weaver-card-delete-fade-out scale-90 opacity-0'
                        : isNewlyAdded
                          ? 'animate-weaver-card-slide-in'
                          : isEdited
                            ? 'animate-weaver-edit-pulse border-blue-500 ring-2 ring-blue-500/30'
                            : isDarkMode ? 'bg-slate-800 border-slate-700/60 hover:bg-slate-800/80 hover:border-gray-500' : 'bg-white border-slate-200 hover:bg-slate-50/50 hover:border-gray-400'
                        } ${sortFlipDirection === 'top-to-bottom'
                          ? 'animate-flip-card-top-to-bottom'
                          : sortFlipDirection === 'bottom-to-top'
                            ? 'animate-flip-card-bottom-to-top'
                            : ''
                        }`}
                    >
                      {/* Stock Image Block */}
                      <div className="h-44 w-full bg-slate-900 overflow-hidden relative border-b dark:border-slate-700">
                        {stock.images && stock.images.length > 0 ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={stock.images[0]}
                              alt={stock.qualityName}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
                              onClick={() => setShowImagePreview({ urls: stock.images, index: 0 })}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                            {stock.images.length > 1 && (
                              <div className="absolute bottom-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/40 shadow-lg z-10">
                                {stock.images.length} Images
                              </div>
                            )}
                            <div className="hidden fallback-icon w-full h-full items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-gray-500" style={{ display: 'none' }}>
                              <PhotoIcon className="h-10 w-10 text-slate-750" />
                              <span className="text-xs text-slate-600 mt-2 font-medium">Image Failed to Load</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-gray-500">
                            <PhotoIcon className="h-10 w-10 text-slate-750" />
                            <span className="text-xs text-slate-600 mt-2 font-medium">No Image Uploaded</span>
                          </div>
                        )}
                      </div>

                      {/* Card Details */}
                      <div className="p-4 flex flex-col flex-grow">
                        <h3 className="font-bold text-lg line-clamp-1 group-hover:text-blue-500 transition-colors" title={stock.qualityName}>
                          {stock.qualityName}
                        </h3>

                        <div className="flex justify-between items-center mt-1">
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {stock.sequence || '-'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${stock.lotType === 'RFD' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                            {stock.lotType === 'RFD' ? 'RFD' : 'OTHER'}
                          </span>
                        </div>

                        {(stock.weaverName || stock.millName) && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
                            {stock.weaverName && <span className="line-clamp-1"><span className="font-semibold text-gray-700 dark:text-gray-300">Weaver:</span> {stock.weaverName} {stock.weaverQuality ? `(${stock.weaverQuality})` : ''}</span>}
                            {stock.millName && <span className="line-clamp-1"><span className="font-semibold text-gray-700 dark:text-gray-300">Mill:</span> {stock.millName}</span>}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-dashed dark:border-slate-700/80 border-slate-200">
                          <div className="text-left">
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Meters
                            </span>
                            <p className="font-extrabold text-base text-blue-500 mt-0.5">
                              {stock.meter} M
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Pieces
                            </span>
                            <p className="font-extrabold text-base text-purple-500 mt-0.5">
                              {stock.piece}
                            </p>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => handleOpenForm('edit', stock)}
                            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${isDarkMode
                              ? 'border-gray-700 hover:bg-slate-750 text-gray-300'
                              : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                              }`}
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          {isMaster && (
                            <button
                              onClick={() => handleStickerDownload(stock)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer ${isDarkMode ? 'border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/40' : 'border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400'}`}
                              title="Download Sticker"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </button>
                          )}
                          {isMaster && (
                            <button
                              onClick={() => {
                                setSelectedStock(stock);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all cursor-pointer"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table Layout Mode */
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/80">
                  <thead className={`${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'
                    }`}
                    style={{
                      borderBottom: isDarkMode
                        ? '2px solid rgba(75, 85, 99, 0.6)'
                        : '2px solid rgba(209, 213, 219, 1)'
                    }}
                  >
                    <tr>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <PhotoIcon className="h-4 w-4" />
                          <span>Preview</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <HashtagIcon className="h-4 w-4" />
                          <span>Sequence</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <TagIcon className="h-4 w-4" />
                          <span>Type</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <TagIcon className="h-4 w-4" />
                          <span>Quality Name</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <HashtagIcon className="h-4 w-4" />
                          <span>Weaver Name</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <HashtagIcon className="h-4 w-4" />
                          <span>Mill Name</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center justify-end space-x-2 w-full">
                          <ScaleIcon className="h-4 w-4" />
                          <span>Meter</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center justify-end space-x-2 w-full">
                          <HashtagIcon className="h-4 w-4" />
                          <span>Piece</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <div className="flex items-center justify-center space-x-2 w-full">
                          <Cog8ToothIcon className="h-4 w-4" />
                          <span>Actions</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {stocks.map((stock, index) => {
                      const isNewlyAdded = newlyAddedIds.has(stock._id);
                      const isEdited = editedIds.has(stock._id);
                      const isDeletingItem = deletingIds.has(stock._id);

                      return (
                        <tr
                          key={stock._id}
                          className={`transition-all duration-300 border-l-4 border-transparent hover:shadow-md ${isDeletingItem
                            ? 'animate-weaver-delete-fade-out opacity-0'
                            : isNewlyAdded
                              ? 'animate-weaver-slide-in'
                              : isEdited
                                ? 'animate-weaver-edit-pulse bg-blue-500/10'
                                : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'
                            } ${isDarkMode
                              ? 'hover:bg-white/5 hover:border-l-blue-600'
                              : 'hover:bg-gray-100/50 hover:border-l-blue-500'
                            } ${sortFlipDirection === 'top-to-bottom'
                              ? 'animate-flip-top-to-bottom'
                              : sortFlipDirection === 'bottom-to-top'
                                ? 'animate-flip-bottom-to-top'
                                : ''
                            }`}
                          style={{
                            borderBottom: index < stocks.length - 1
                              ? isDarkMode
                                ? '2px solid rgba(75, 85, 99, 0.6)'
                                : '2px solid rgba(209, 213, 219, 1)'
                              : 'none'
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-24 w-40 rounded-lg bg-slate-950 border border-slate-700/60 overflow-hidden relative shadow-md">
                              {stock.images && stock.images.length > 0 ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={stock.images[0]}
                                    alt=""
                                    className="object-contain h-full w-full cursor-pointer hover:scale-105 transition-transform duration-300"
                                    onClick={() => setShowImagePreview({ urls: stock.images, index: 0 })}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                      if (fallback) {
                                        fallback.style.display = 'flex';
                                      }
                                    }}
                                  />
                                  {stock.images.length > 1 && (
                                    <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-[10px] font-extrabold h-5 min-w-5 px-1 flex items-center justify-center rounded-full border border-blue-400/40 shadow-lg pointer-events-none z-10">
                                      {stock.images.length}
                                    </div>
                                  )}
                                  <div className="hidden fallback-icon w-full h-full items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950" style={{ display: 'none' }}>
                                    <PhotoIcon className="h-8 w-8 text-slate-500" />
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-gray-500">
                                  <PhotoIcon className="h-8 w-8 text-slate-500" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            <span className="font-bold text-emerald-500">{stock.sequence || '-'}</span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${stock.lotType === 'RFD' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                              {stock.lotType === 'RFD' ? 'RFD' : 'OTHER'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            <span className="font-semibold break-words min-w-0">{stock.qualityName}</span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            <span className="font-medium text-sm">{stock.weaverName || '-'}</span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            <span className="font-medium text-sm">{stock.millName || '-'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-blue-500">{stock.meter} M</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-purple-500">{stock.piece}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleOpenForm('edit', stock)}
                                className="p-1.5 rounded-lg hover:bg-slate-700/10 dark:hover:bg-slate-200/10 text-blue-500 transition-colors"
                                title="Edit Stock"
                              >
                                <PencilIcon className="h-4.5 w-4.5" />
                              </button>
                              {isMaster && (
                                <button
                                  onClick={() => handleStickerDownload(stock)}
                                  className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}
                                  title="Download Sticker"
                                >
                                  <ArrowDownTrayIcon className="h-4.5 w-4.5" />
                                </button>
                              )}
                              {isMaster && (
                                <button
                                  onClick={() => handleOpenQrModal(stock)}
                                  className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-indigo-400 hover:bg-indigo-500/20' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                  title="View QR Code"
                                >
                                  <QrCodeIcon className="h-4.5 w-4.5" />
                                </button>
                              )}
                              {isMaster && (
                                <button
                                  onClick={() => {
                                    setSelectedStock(stock);
                                    setShowDeleteModal(true);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-700/10 dark:hover:bg-slate-200/10 text-red-500 transition-colors"
                                  title="Delete Stock"
                                >
                                  <TrashIcon className="h-4.5 w-4.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {!loading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t dark:border-slate-800">
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Showing page {currentPage} of {totalPages} ({totalCount} items)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${currentPage === 1
                      ? 'opacity-40 cursor-not-allowed border-transparent'
                      : isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1;
                    const isActive = currentPage === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`h-9 w-9 rounded-xl text-sm font-bold transition-all ${isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${currentPage === totalPages
                      ? 'opacity-40 cursor-not-allowed border-transparent'
                      : isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Form Modal (Create/Edit Drawer with Validation Shake Animations) */}
      {showFormModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border transform transition-all animate-scale-up ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-gray-900'
            }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-100 bg-slate-50'
              }`}>
              <h2 className="text-xl font-bold">
                {formMode === 'edit' ? 'Edit Stock Item' : 'Add Finish Lot Stock'}
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className={`p-1.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-slate-200 text-gray-500'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Lot Type */}
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Lot Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lotType"
                      value="RFD"
                      checked={formData.lotType === 'RFD'}
                      onChange={() => setFormData(prev => ({ ...prev, lotType: 'RFD' }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>RFD Fabric</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lotType"
                      value="OTHER"
                      checked={formData.lotType === 'OTHER'}
                      onChange={() => setFormData(prev => ({ ...prev, lotType: 'OTHER' }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Other Finish Fabric</span>
                  </label>
                </div>
              </div>

              {/* Quality Name */}
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Quality Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter quality name..."
                  value={formData.qualityName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, qualityName: e.target.value }));
                    setFormErrors(prev => ({ ...prev, qualityName: false }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${formErrors.qualityName
                    ? 'border-red-500 bg-red-500/5 animate-shake focus:ring-red-500/30'
                    : isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                      : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                    }`}
                />
              </div>

              {/* Weaver and Mill Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Weaver Name
                  </label>
                  <input
                    type="text"
                    placeholder="Weaver name..."
                    value={formData.weaverName}
                    onChange={(e) => setFormData(prev => ({ ...prev, weaverName: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                        : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                      }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Weaver Quality
                  </label>
                  <input
                    type="text"
                    placeholder="Weaver quality..."
                    value={formData.weaverQuality}
                    onChange={(e) => setFormData(prev => ({ ...prev, weaverQuality: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                        : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                      }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Mill Name
                  </label>
                  <input
                    type="text"
                    placeholder="Mill name..."
                    value={formData.millName}
                    onChange={(e) => setFormData(prev => ({ ...prev, millName: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                        : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                      }`}
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Process in Mill
                </label>
                <textarea
                  placeholder="Enter process details..."
                  rows={2}
                  value={formData.processInMill}
                  onChange={(e) => setFormData(prev => ({ ...prev, processInMill: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none ${isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                      : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                    }`}
                />
              </div>

              {/* Meter and Piece inline layout */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Meter (Length)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.meter}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, meter: e.target.value }));
                      setFormErrors(prev => ({ ...prev, meter: false }));
                    }}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${formErrors.meter
                      ? 'border-red-500 bg-red-500/5 animate-shake focus:ring-red-500/30'
                      : isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                        : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                      }`}
                  />
                  {formErrors.meter && (
                    <span className="text-[10px] text-red-500 font-semibold mt-1 block">Must be positive</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Piece (Qty)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.piece}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, piece: e.target.value }));
                      setFormErrors(prev => ({ ...prev, piece: false }));
                    }}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${formErrors.piece
                      ? 'border-red-500 bg-red-500/5 animate-shake focus:ring-red-500/30'
                      : isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                        : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'
                      }`}
                  />
                  {formErrors.piece && (
                    <span className="text-[10px] text-red-500 font-semibold mt-1 block">Must be positive integer</span>
                  )}
                </div>
              </div>

              {/* Image Upload Area */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                    Images
                  </label>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDarkMode ? 'bg-slate-900 text-gray-400' : 'bg-slate-100 text-gray-600'
                    }`}>
                    {formData.images.length + pendingImageFiles.length} image(s)
                  </span>
                </div>

                {/* Drag & Drop File Container */}
                <div
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 transition-all ${dragActive
                    ? 'border-blue-500 bg-blue-500/5'
                    : isDarkMode ? 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex gap-2">
                    <div
                      className={`relative px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${isDarkMode
                        ? 'border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-gray-300'
                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-200 text-gray-700 shadow-sm'
                        }`}
                    >
                      <ArrowUpTrayIcon className="w-4 h-4 text-blue-500 animate-bounce" />
                      Upload Image
                      <input
                        type="file"
                        id="finish-image-upload"
                        multiple={true}
                        accept="image/*"
                        onChange={handleFileInput}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 ${isDarkMode
                        ? 'border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-gray-300'
                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-200 text-gray-700 shadow-sm'
                        }`}
                    >
                      <PhotoIcon className="w-4 h-4 text-emerald-500" />
                      Camera
                    </button>
                  </div>

                  <span className={`text-xs ml-auto hidden md:inline ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Drag & drop images here
                  </span>
                </div>

                {/* Previews */}
                {(formData.images.length > 0 || pendingImageFiles.length > 0) && (
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {/* Pending Local Previews */}
                    {pendingImageFiles.map((pImg, idx) => (
                      <div key={`pending-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-blue-500/30 shadow-md">
                        <img
                          src={pImg.previewUrl}
                          alt="Pending upload"
                          className="w-full h-full object-cover animate-pulse cursor-pointer"
                          onClick={() => setShowImagePreview({ urls: pendingImageFiles.map(p => p.previewUrl), index: idx })}
                        />
                        <button
                          type="button"
                          onClick={() => removePendingImage(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-lg p-1 shadow-md transition-all z-10 active:scale-90 hover:scale-110 cursor-pointer"
                          title="Remove image"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-0 inset-x-0 text-[8px] text-center bg-blue-600 text-white font-semibold py-0.5">
                          PENDING
                        </span>
                      </div>
                    ))}

                    {/* Already Uploaded Images */}
                    {formData.images.map((img, idx) => (
                      <div key={`uploaded-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 group">
                        <img
                          src={img}
                          alt="Uploaded stock"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setShowImagePreview({ urls: formData.images, index: idx })}
                        />
                        <button
                          type="button"
                          onClick={() => removeUploadedImage(idx)}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-lg p-1 shadow-md transition-all active:scale-90 hover:scale-110 cursor-pointer"
                          title="Remove image"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center space-x-3 pt-4 border-t dark:border-slate-700/80 border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  disabled={submitting}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-all ${isDarkMode
                    ? 'border-gray-700 hover:bg-slate-750 text-gray-300'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
                >
                  {submitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  )}
                  <span>{formMode === 'edit' ? 'Save Changes' : 'Create Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-xl border shadow-2xl p-6 transform transition-all animate-scale-up ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-gray-900'
            }`}>
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Delete stock item?</h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedStock(null);
                }}
                disabled={isDeleting}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${isDarkMode
                  ? 'border-gray-700 hover:bg-slate-750 text-gray-300'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="flex-1 py-2 text-sm font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all flex items-center justify-center space-x-2"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Scroll To Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-90 cursor-pointer"
          title="Scroll to Top"
        >
          <ArrowUpIcon className="h-5 w-5" />
        </button>
      )}
      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={showImagePreview !== null}
        onClose={() => setShowImagePreview(null)}
        images={showImagePreview ? showImagePreview.urls : []}
        initialIndex={showImagePreview ? showImagePreview.index : 0}
        isDarkMode={isDarkMode}
      />

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        isDarkMode={isDarkMode}
      />

      {/* Sticker Preview Modal */}
      {showStickerPreview && currentStickerItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-3xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border transform transition-all animate-scale-up ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <TagIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Sticker Preview: {currentStickerItem.qualityName}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Sequence: {currentStickerItem.sequence || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (stickerPreviewUrl) {
                      const link = document.createElement('a');
                      link.href = stickerPreviewUrl;
                      link.download = `Finish_Lot_Sticker_${currentStickerItem.sequence || currentStickerItem.qualityName}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  disabled={!stickerPreviewUrl || isLoadingStickerPreview}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setShowStickerPreview(false)}
                  className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-slate-200 text-gray-500'}`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className={`flex-1 relative ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
              {isLoadingStickerPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent mb-4" />
                  <p className={`font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Generating Sticker PDF...</p>
                </div>
              ) : stickerPreviewUrl ? (
                <iframe
                  src={`${stickerPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="w-full h-full border-none"
                  title="Sticker PDF Preview"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                  <ExclamationTriangleIcon className="h-10 w-10 mb-4" />
                  <p className="font-semibold">Failed to load preview.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && currentQrStock && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-sm flex flex-col rounded-2xl shadow-2xl overflow-hidden border transform transition-all animate-scale-up ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg">
                  <QrCodeIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    QR Code
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {currentQrStock.qualityName}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowQrModal(false)}
                  className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-slate-200 text-gray-500'}`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className={`p-6 flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
              {qrModalUrl ? (
                <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrModalUrl} alt="QR Code" className="w-64 h-64 object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-red-500">
                  <ExclamationTriangleIcon className="h-10 w-10 mb-4" />
                  <p className="font-semibold">Failed to generate QR Code.</p>
                </div>
              )}
              
              <div className="mt-6 text-center">
                <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Scan this code to view all detail info.
                </p>
                {qrModalUrl && (
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = qrModalUrl;
                      link.download = `QR_${currentQrStock.sequence || currentQrStock.qualityName}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md hover:shadow-lg"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    <span>Download QR Image</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
