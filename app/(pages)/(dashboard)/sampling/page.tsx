'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
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
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ListBulletIcon,
  CloudArrowUpIcon,
  EyeIcon,
  TagIcon,
  DocumentTextIcon,
  ScaleIcon,
  Cog6ToothIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';
import CameraModal from '../components/CameraModal';
import ImagePreviewModal from '../components/ImagePreviewModal';

interface Sampling {
  _id: string;
  qualityName: string;
  whereToPut?: string;
  images: string[];
  notes: string;
  meter: number;
  piece: number;
  createdAt: string;
  updatedAt: string;
}

export default function SamplingPage() {
  const router = useRouter();
  const { isDarkMode, mounted } = useDarkMode();
  const [isPending, startTransition] = useTransition();

  // Core State
  const [samplings, setSamplings] = useState<Sampling[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Advanced Filters
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
  const [selectedItem, setSelectedItem] = useState<Sampling | null>(null);
  const [formData, setFormData] = useState({
    qualityName: '',
    whereToPut: '',
    images: [] as string[],
    notes: '',
    meter: '' as string | number,
    piece: '' as string | number
  });

  // Validation & Form Error States
  const [formErrors, setFormErrors] = useState<{
    qualityName?: boolean;
    meter?: boolean;
    piece?: boolean;
  }>({});

  // UI & UX State
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<{ urls: string[]; index: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ file?: File; url: string }[]>([]);

  // Animation Triggers
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [sortFlipDirection, setSortFlipDirection] = useState<'top-to-bottom' | 'bottom-to-top' | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(12);

  const [summaryStats, setSummaryStats] = useState({
    totalPieces: 0,
    totalMeters: 0,
    uniqueQualities: 0
  });

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const limitDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('samplingViewMode');
      if (savedMode === 'cards' || savedMode === 'table') {
        setViewMode(savedMode);
      }
    }
  }, []);

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('samplingViewMode', mode);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setShowSortDropdown(false);
      }
      if (limitDropdownRef.current && !limitDropdownRef.current.contains(target)) {
        setShowLimitDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for Escape key to close modals and dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showImagePreview) {
          setShowImagePreview(null);
        } else if (showCamera) {
          setShowCamera(false);
        } else if (showFormModal) {
          setShowFormModal(false);
        } else if (showSortDropdown) {
          setShowSortDropdown(false);
        } else if (showLimitDropdown) {
          setShowLimitDropdown(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImagePreview, showCamera, showFormModal, showSortDropdown, showLimitDropdown]);

  const fetchSamplings = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      params.append('search', debouncedSearch);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      if (minMeter) params.append('minMeter', minMeter);
      if (maxMeter) params.append('maxMeter', maxMeter);
      if (minPiece) params.append('minPiece', minPiece);
      if (maxPiece) params.append('maxPiece', maxPiece);

      const res = await fetch(`/api/sampling?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setSamplings(data.data || []);
        if (data.summary) {
          setSummaryStats(data.summary);
        }
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
        }
      } else {
        showToast('error', data.message || 'Failed to load sampling data');
      }
    } catch (error) {
      showToast('error', 'Error connecting to the server');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, debouncedSearch, minMeter, maxMeter, minPiece, maxPiece, sortBy, sortOrder]);

  useEffect(() => {
    if (mounted) {
      fetchSamplings();
    }
  }, [fetchSamplings, mounted]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    // Validate sizes (10MB limit per file)
    const validFiles = filesArray.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        showToast('error', `Image ${file.name} must be less than 10MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newPending = validFiles.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));

    setPendingImages(prev => [...prev, ...newPending]);
    showToast('success', `Added ${validFiles.length} image(s) locally`);
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const syntheticEvent = {
        target: { files: e.dataTransfer.files }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleImageUpload(syntheticEvent);
    }
  };

  const handleCameraCapture = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', `Image must be less than 10MB`);
      return;
    }

    const newPending = {
      file,
      url: URL.createObjectURL(file)
    };

    setPendingImages(prev => [...prev, newPending]);
    showToast('success', 'Camera image added locally');
    setShowCamera(false);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setPendingImages(prev => {
      const target = prev[indexToRemove];
      if (target && target.file) {
        try {
          URL.revokeObjectURL(target.url);
        } catch (err) {
          console.error(err);
        }
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const handleOpenForm = (mode: 'create' | 'edit', item?: Sampling) => {
    setFormMode(mode);
    setFormErrors({});
    if (mode === 'edit' && item) {
      setSelectedItem(item);
      setFormData({
        qualityName: item.qualityName,
        whereToPut: item.whereToPut || '',
        images: item.images || [],
        notes: item.notes || '',
        meter: item.meter,
        piece: item.piece
      });
      setPendingImages((item.images || []).map(img => ({ url: img })));
    } else {
      setSelectedItem(null);
      setFormData({
        qualityName: '',
        whereToPut: '',
        images: [],
        notes: '',
        meter: '',
        piece: ''
      });
      setPendingImages([]);
    }
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const token = localStorage.getItem('token');

      // Upload any pending new images
      const uploadPromises = pendingImages.map(async (img) => {
        if (img.file) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', img.file);
          uploadFormData.append('folder', 'sampling');

          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: uploadFormData
          });

          const data = await res.json();
          if (data.success) {
            return data.url || data.imageUrl;
          } else {
            throw new Error(data.message || `Failed to upload image`);
          }
        }
        return img.url; // Already uploaded url
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      const payload = {
        qualityName: formData.qualityName.trim(),
        whereToPut: formData.whereToPut.trim(),
        images: uploadedUrls,
        notes: formData.notes.trim(),
        meter: formData.meter === '' ? 0 : Number(formData.meter),
        piece: formData.piece === '' ? 0 : Number(formData.piece)
      };

      const url = formMode === 'edit' && selectedItem
        ? `/api/sampling/${selectedItem._id}`
        : '/api/sampling';

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

        showToast('success', formMode === 'edit' ? 'Sampling updated successfully' : 'Sampling created successfully');
        setShowFormModal(false);
        fetchSamplings();
      } else {
        showToast('error', data.message || 'Action failed');
      }
    } catch (error) {
      showToast('error', 'Failed to save sampling item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    setIsDeleting(true);
    const id = selectedItem._id;

    setDeletingIds(prev => new Set(prev).add(id));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/sampling/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Sampling deleted successfully');
        setShowDeleteModal(false);
        setSelectedItem(null);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setTimeout(() => {
          setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          fetchSamplings();
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} item(s)?`)) return;

    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    setDeletingIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sampling', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Successfully deleted ${data.deletedCount || selectedIds.size} item(s)`);
        setSelectedIds(new Set());
        setTimeout(() => {
          setDeletingIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.delete(id));
            return next;
          });
          fetchSamplings();
        }, 400);
      } else {
        setDeletingIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.delete(id));
          return next;
        });
        showToast('error', data.message || 'Bulk delete failed');
      }
    } catch (error) {
      setDeletingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      showToast('error', 'Error connecting to the server');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSortChange = (field: string) => {
    let order = 'desc';
    if (sortBy === field) {
      order = sortOrder === 'desc' ? 'asc' : 'desc';
    }

    const direction = order === 'asc' ? 'bottom-to-top' : 'top-to-bottom';
    setSortFlipDirection(direction);

    setTimeout(() => setSortFlipDirection(null), 800);

    startTransition(() => {
      setSortBy(field);
      setSortOrder(order);
      setCurrentPage(1);
    });
  };

  const handleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === samplings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(samplings.map(s => s._id)));
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
      {toast && (
        <div className={`fixed top-4 right-4 z-[10000] min-w-80 max-w-md p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm transform transition-all duration-300 animate-fade-in ${toast.type === 'success'
          ? isDarkMode ? 'bg-green-900/90 border-green-500 text-green-100' : 'bg-green-50 border-green-500 text-green-800'
          : isDarkMode ? 'bg-red-900/90 border-red-500 text-red-100' : 'bg-red-50 border-red-500 text-red-800'
          }`}>
          <div className="flex items-center space-x-3">
            {toast.type === 'success' ? (
              <CheckIcon className={`h-6 w-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            ) : (
              <XMarkIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            )}
            <p className="font-medium flex-1">{toast.message}</p>
            <button onClick={() => setToast(null)} className="shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      <div className="w-full pb-6">
        <div className={`border-2 shadow-xl overflow-hidden ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-white'}`}>
          <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-col gap-2 max-[900px]:gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-3 ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex flex-row items-center gap-2 min-[900px]:flex-1 min-[900px]:gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
                  <MagnifyingGlassIcon className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <input
                  type="text"
                  placeholder="Search by quality name or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 relative flex-shrink-0 z-[40]">
                <span className={`text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sort:</span>
                <div className="relative sort-dropdown-container z-[40]" ref={sortDropdownRef}>
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className={`px-2 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border-2 transition-all duration-200 flex items-center gap-1.5 min-w-[70px] ${isDarkMode ? 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/40' : 'bg-gray-50 border-gray-400 text-gray-600 hover:bg-gray-100 hover:border-gray-500'
                      }`}
                  >
                    {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                    <ChevronDownIcon className={`h-3 w-3 transition-transform duration-300 ${showSortDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showSortDropdown && (
                    <div className={`absolute top-full left-0 mt-1 w-32 rounded-lg border shadow-xl z-[40] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                      <button onClick={() => { handleSortChange('createdAt'); setSortOrder('desc'); setShowSortDropdown(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors duration-200 first:rounded-t-lg ${sortOrder === 'desc' ? (isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700') : (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100')}`}>Newest</button>
                      <button onClick={() => { handleSortChange('createdAt'); setSortOrder('asc'); setShowSortDropdown(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors duration-200 last:rounded-b-lg ${sortOrder === 'asc' ? (isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700') : (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100')}`}>Oldest</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 max-[900px]:justify-between min-[900px]:flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>View:</span>
                <div className={`flex rounded-lg border-2 overflow-hidden shadow-sm ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                  <button onClick={() => handleViewModeChange('table')} className={`px-2 py-1.5 sm:py-2 text-xs font-medium flex items-center justify-center space-x-1 ${viewMode === 'table' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-gray-700 text-gray-300 border-r border-gray-600' : 'bg-white text-gray-700 border-r border-gray-300')}`}>
                    <ListBulletIcon className="h-4 w-4" />
                    <span className="hidden min-[400px]:inline">Table</span>
                  </button>
                  <button onClick={() => handleViewModeChange('cards')} className={`px-2 py-1.5 sm:py-2 text-xs font-medium flex items-center justify-center space-x-1 ${viewMode === 'cards' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700')}`}>
                    <Squares2X2Icon className="h-4 w-4" />
                    <span className="hidden min-[400px]:inline">Cards</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={fetchSamplings} disabled={loading} className={`px-2.5 py-2 rounded-lg font-semibold flex items-center justify-center space-x-2 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'} border`}>
                  <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden min-[430px]:inline text-sm">Refresh</span>
                </button>
                <button onClick={() => handleOpenForm('create')} className={`px-4 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2`}>
                  <PlusIcon className="h-5 w-5" />
                  <span className="text-sm">Add Sampling</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-col gap-2 max-[900px]:gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between ${isDarkMode ? 'border-gray-700 bg-[#1E2938]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex flex-row items-center justify-between min-[900px]:items-center min-[900px]:space-x-3 lg:space-x-4">
              <span className={`text-[10px] xs:text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Showing {Math.min((currentPage - 1) * limit + 1, totalCount)} to {Math.min(currentPage * limit, totalCount)} of {totalCount} items
              </span>
              <div className="flex items-center gap-2 relative flex-shrink-0 z-[40]" ref={limitDropdownRef}>
                <span className={`text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
                <div className="relative">
                  <button onClick={() => setShowLimitDropdown(!showLimitDropdown)} className={`px-2 py-1.5 text-xs font-medium rounded-lg border-2 flex items-center justify-between min-w-[70px] ${isDarkMode ? 'bg-white/10 border-white/30 text-gray-300' : 'bg-gray-50 border-gray-400 text-gray-600'}`}>
                    <span>{limit}</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                  {showLimitDropdown && (
                    <div className={`absolute top-full left-0 mt-1 w-28 rounded-lg border shadow-xl z-[40] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                      {[10, 20, 50, 100].map(option => (
                        <button key={option} onClick={() => { setLimit(option); setCurrentPage(1); setShowLimitDropdown(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg ${limit === option ? (isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700') : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700')}`}>{option}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(totalPages > 1 || samplings.length > 0) && (
              <div className="flex items-center justify-between w-full max-[900px]:w-full min-[900px]:justify-end min-[900px]:w-auto space-x-2 sm:space-x-3">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || loading} className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 ${currentPage === 1 || loading ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300')}`}>
                  Previous
                </button>
                <div className="flex items-center space-x-1 flex-1 justify-center max-[900px]:overflow-x-auto max-[900px]:scrollbar-hide">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                    Math.max(0, Math.min(currentPage - 3, totalPages - 5)),
                    Math.min(totalPages, Math.max(5, currentPage + 2))
                  ).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)} disabled={loading} className={`px-2 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${currentPage === page ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300')}`}>
                      {page}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || loading} className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 ${currentPage === totalPages || loading ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300')}`}>
                  Next
                </button>
              </div>
            )}
          </div>

          <div className={`min-h-[400px] ${viewMode === 'cards' || loading || samplings.length === 0 ? 'p-4' : ''}`}>
            {loading ? (
              viewMode === 'cards' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: limit }).map((_, idx) => (
                    <div key={idx} className={`rounded-2xl border p-4 flex flex-col h-72 animate-pulse ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`w-full h-36 rounded-xl mb-4 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`h-5 w-3/4 rounded-md mb-2 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className={`h-4.5 w-1/4 rounded-md mb-2 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                      <div className="mt-auto flex justify-between">
                        <div className={`h-4 w-1/3 rounded-md ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                        <div className={`h-4 w-1/3 rounded-md ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/80">
                    <thead className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`} style={{ borderBottom: isDarkMode ? '2px solid rgba(75, 85, 99, 0.6)' : '2px solid rgba(209, 213, 219, 1)' }}>
                      <tr>
                        <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center space-x-2">
                            <PhotoIcon className="h-4 w-4" />
                            <span>Preview</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center space-x-2">
                            <TagIcon className="h-4 w-4" />
                            <span>Quality Name</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center space-x-2">
                            <MapPinIcon className="h-4 w-4" />
                            <span>Where to Put</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center space-x-2">
                            <DocumentTextIcon className="h-4 w-4" />
                            <span>Notes</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center justify-end space-x-2">
                            <ScaleIcon className="h-4 w-4" />
                            <span>Meter</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center justify-end space-x-2">
                            <Squares2X2Icon className="h-4 w-4" />
                            <span>Piece</span>
                          </div>
                        </th>
                        <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div className="flex items-center justify-center space-x-2">
                            <Cog6ToothIcon className="h-4 w-4" />
                            <span>Actions</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                      {Array.from({ length: limit }).map((_, index) => (
                        <tr key={`skeleton-${index}`} className="animate-pulse">
                          <td className="px-6 py-4">
                            <div className={`w-40 h-24 rounded-lg ${isDarkMode ? 'bg-slate-700/60' : 'bg-slate-200'}`} />
                          </td>
                          <td className="px-6 py-4">
                            <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                          </td>
                          <td className="px-6 py-4">
                            <div className={`h-4 rounded w-24 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                          </td>
                          <td className="px-6 py-4">
                            <div className={`h-4 rounded w-48 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <div className={`h-4 rounded w-16 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <div className={`h-4 rounded w-12 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div className={`h-8 rounded w-16 ${isDarkMode ? 'bg-slate-750' : 'bg-slate-200'}`} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : samplings.length === 0 ? (
              <div className={`py-16 px-4 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-800/20 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="p-4 rounded-full bg-blue-500/10 text-blue-500 mb-4 animate-pulse">
                  <PhotoIcon className="h-12 w-12" />
                </div>
                <h3 className="text-xl font-bold">No sampling items found</h3>
                <p className={`mt-2 max-w-sm text-sm mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {searchTerm || minMeter || maxMeter || minPiece || maxPiece ? 'Try refining your search text or filter options.' : 'Get started by creating your first sampling item right now.'}
                </p>
                {!searchTerm && !minMeter && !maxMeter && !minPiece && !maxPiece && (
                  <button onClick={() => handleOpenForm('create')} className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all">
                    Add Sampling
                  </button>
                )}
              </div>
            ) : viewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {samplings.map((item) => {
                  const isSelected = selectedIds.has(item._id);
                  const isNewlyAdded = newlyAddedIds.has(item._id);
                  const isEdited = editedIds.has(item._id);
                  const isDeletingItem = deletingIds.has(item._id);

                  return (
                    <div key={item._id} className={`relative rounded-2xl border overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:translate-y-[-4px] ${isDeletingItem ? 'animate-weaver-card-delete-fade-out scale-90 opacity-0' : isNewlyAdded ? 'animate-weaver-card-slide-in' : isEdited ? 'animate-weaver-edit-pulse border-blue-500 ring-2 ring-blue-500/30' : isSelected ? 'ring-2 ring-blue-500 border-transparent bg-blue-500/5' : isDarkMode ? 'bg-slate-800 border-slate-700/60 hover:bg-slate-800/80 hover:border-gray-500' : 'bg-white border-slate-200 hover:bg-slate-50/50 hover:border-gray-400'} ${sortFlipDirection === 'top-to-bottom' ? 'animate-flip-card-top-to-bottom' : sortFlipDirection === 'bottom-to-top' ? 'animate-flip-card-bottom-to-top' : ''}`}>
                      <button type="button" onClick={() => handleSelectId(item._id)} className={`absolute top-3 left-3 z-10 p-1.5 rounded-lg border transition-all ${isSelected ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500' : 'bg-black/40 border-white/20 text-transparent hover:text-white/60 hover:bg-black/60'}`}>
                        <CheckIcon className="h-4.5 w-4.5" />
                      </button>
                      <div className="h-44 w-full bg-slate-900 overflow-hidden relative border-b dark:border-slate-700">
                        {item.images && item.images.length > 0 ? (
                          <>
                            <img src={item.images[0]} alt={item.qualityName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer" onClick={() => setShowImagePreview({ urls: item.images, index: 0 })} />
                            {item.images.length > 1 && (
                              <div className="absolute bottom-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/40 shadow-lg z-10">
                                {item.images.length} Images
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-gray-500">
                            <PhotoIcon className="h-10 w-10 text-slate-750" />
                            <span className="text-xs text-slate-600 mt-2 font-medium">No Image Uploaded</span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-black/65 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white tracking-wider border border-white/10 z-10">
                          {item.piece} Pcs
                        </div>
                      </div>
                      <div className="p-4 flex flex-col flex-grow">
                        <h3 className="font-bold text-lg line-clamp-1 group-hover:text-blue-500 transition-colors" title={item.qualityName}>{item.qualityName}</h3>
                        {item.whereToPut && (
                          <div className="flex items-center space-x-1 mt-1 text-xs text-blue-500 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-md w-fit">
                            <span>Loc:</span>
                            <span className="truncate max-w-[150px]" title={item.whereToPut}>{item.whereToPut}</span>
                          </div>
                        )}
                        {item.notes && <p className="text-sm mt-2 line-clamp-2 text-gray-500 dark:text-gray-400" title={item.notes}>{item.notes}</p>}
                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-dashed dark:border-slate-700/80 border-slate-200">
                          <div className="text-left">
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Meters</span>
                            <p className="font-extrabold text-base text-blue-500 mt-0.5">{item.meter} M</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Pieces</span>
                            <p className="font-extrabold text-base text-purple-500 mt-0.5">{item.piece}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button onClick={() => handleOpenForm('edit', item)} className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${isDarkMode ? 'border-gray-700 hover:bg-slate-750 text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}>
                            <PencilIcon className="h-3.5 w-3.5" /><span>Edit</span>
                          </button>
                          <button onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }} className="p-2 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all cursor-pointer">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/80">
                  <thead className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`} style={{ borderBottom: isDarkMode ? '2px solid rgba(75, 85, 99, 0.6)' : '2px solid rgba(209, 213, 219, 1)' }}>
                    <tr>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center space-x-2">
                          <PhotoIcon className="h-4 w-4" />
                          <span>Preview</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center space-x-2">
                          <TagIcon className="h-4 w-4" />
                          <span>Quality Name</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center space-x-2">
                          <MapPinIcon className="h-4 w-4" />
                          <span>Where to Put</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center space-x-2">
                          <DocumentTextIcon className="h-4 w-4" />
                          <span>Notes</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center justify-end space-x-2">
                          <ScaleIcon className="h-4 w-4" />
                          <span>Meter</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-right text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center justify-end space-x-2">
                          <Squares2X2Icon className="h-4 w-4" />
                          <span>Piece</span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center justify-center space-x-2">
                          <Cog6ToothIcon className="h-4 w-4" />
                          <span>Actions</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {samplings.map((item) => {
                      const isSelected = selectedIds.has(item._id);
                      const isNewlyAdded = newlyAddedIds.has(item._id);
                      const isEdited = editedIds.has(item._id);
                      const isDeletingItem = deletingIds.has(item._id);

                      return (
                        <tr key={item._id} className={`transition-all duration-300 ${isDeletingItem ? 'animate-weaver-delete-fade-out opacity-0' : isNewlyAdded ? 'animate-weaver-slide-in' : isEdited ? 'animate-weaver-edit-pulse bg-blue-500/10' : isSelected ? 'bg-blue-500/5 dark:bg-blue-500/10' : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'} ${sortFlipDirection === 'top-to-bottom' ? 'animate-flip-top-to-bottom' : sortFlipDirection === 'bottom-to-top' ? 'animate-flip-bottom-to-top' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="h-24 w-40 rounded-lg bg-slate-950 border border-slate-700/60 overflow-hidden relative">
                              {item.images && item.images.length > 0 ? (
                                <>
                                  <img src={item.images[0]} alt="" className="object-contain h-full w-full cursor-pointer hover:scale-105 transition-transform duration-300" onClick={() => setShowImagePreview({ urls: item.images, index: 0 })} />
                                  {item.images.length > 1 && (
                                    <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-[10px] font-extrabold h-5 min-w-5 px-1 flex items-center justify-center rounded-full border border-blue-400/40 shadow-lg pointer-events-none z-10">
                                      {item.images.length}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <PhotoIcon className="h-8 w-8 text-slate-500 absolute inset-0 m-auto" />
                              )}
                            </div>
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap font-semibold">{item.qualityName}</td>
                           <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-500 dark:text-slate-400">{item.whereToPut || '-'}</td>
                           <td className="px-6 py-4 font-medium max-w-[200px] truncate" title={item.notes}>{item.notes || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-blue-500">{item.meter} M</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-purple-500">{item.piece}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button onClick={() => handleOpenForm('edit', item)} className="p-1.5 rounded-lg hover:bg-slate-700/10 dark:hover:bg-slate-200/10 text-blue-500 transition-colors" title="Edit Item">
                                <PencilIcon className="h-4.5 w-4.5" />
                              </button>
                              <button onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-700/10 dark:hover:bg-slate-200/10 text-red-500 transition-colors" title="Delete Item">
                                <TrashIcon className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t dark:border-slate-800">
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Showing page {currentPage} of {totalPages} ({totalCount} items)
                </span>
                <div className="flex items-center space-x-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${currentPage === 1 ? 'opacity-40 cursor-not-allowed border-transparent' : isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                    Previous
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1;
                    const isActive = currentPage === p;
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)} className={`h-9 w-9 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-md' : isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed border-transparent' : isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[90%] max-w-lg animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900/90 dark:bg-slate-800/95 border dark:border-slate-700 border-slate-800 backdrop-blur-lg px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between text-white animate-pulse-glow">
            <span className="font-medium text-sm">
              <span className="bg-blue-600 px-2 py-0.5 rounded-full text-xs font-bold mr-2">{selectedIds.size}</span>
              item(s) selected
            </span>
            <div className="flex items-center space-x-3">
              <button onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer">
                Clear
              </button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-500 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md hover:shadow-red-500/25 active:scale-95 flex items-center space-x-1.5 cursor-pointer">
                <TrashIcon className="h-4 w-4" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border transform transition-all animate-scale-up ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-gray-900'}`}>
            <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-100 bg-slate-50'}`}>
              <h2 className="text-xl font-bold">{formMode === 'edit' ? 'Edit Sampling' : 'Add Sampling'}</h2>
              <button onClick={() => setShowFormModal(false)} className={`p-1.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-slate-200 text-gray-500'}`}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Quality Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Enter quality name..."
                  value={formData.qualityName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, qualityName: e.target.value }));
                    setFormErrors(prev => ({ ...prev, qualityName: false }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${formErrors.qualityName ? 'border-red-500 bg-red-500/5 animate-shake focus:ring-red-500/30' : isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Where to put</label>
                <input
                  type="text"
                  placeholder="Enter storage location..."
                  value={formData.whereToPut}
                  onChange={(e) => setFormData(prev => ({ ...prev, whereToPut: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Notes</label>
                <textarea
                  placeholder="Enter notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none h-24 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Meter (Length)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.meter}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, meter: e.target.value }));
                      setFormErrors(prev => ({ ...prev, meter: false }));
                    }}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${formErrors.meter ? 'border-red-500 bg-red-500/5 animate-shake focus:ring-red-500/30' : isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'}`}
                  />
                  {formErrors.meter && <span className="text-[10px] text-red-500 font-semibold mt-1 block">Must be positive</span>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Piece (Qty)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.piece}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, piece: e.target.value }));
                      setFormErrors(prev => ({ ...prev, piece: false }));
                    }}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${formErrors.piece ? 'border-red-500 bg-red-500/5 animate-shake focus:ring-red-500/30' : isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-gray-900 placeholder-gray-400'}`}
                  />
                  {formErrors.piece && <span className="text-[10px] text-red-500 font-semibold mt-1 block">Must be positive integer</span>}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Images
                  </label>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {pendingImages.length} image(s)
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
                        ? 'border-slate-700 bg-slate-900/50'
                        : 'border-slate-200 bg-slate-50'
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
                    onChange={handleImageUpload}
                    className="hidden"
                    id="sampling-image-upload"
                    disabled={submitting}
                  />
                  <label
                    htmlFor="sampling-image-upload"
                    className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                      isDarkMode 
                        ? 'border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400' 
                        : 'border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600'
                    }`}
                  >
                    <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                    Upload Image
                  </label>
                  
                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                      isDarkMode 
                        ? 'border-gray-600 hover:border-green-500 text-gray-300 hover:text-green-400' 
                        : 'border-gray-300 hover:border-green-400 text-gray-600 hover:text-green-600'
                    }`}
                  >
                    <PhotoIcon className="h-5 w-5 mr-2" />
                    Camera
                  </button>
                  
                  {submitting && (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span className={`text-sm hidden sm:inline ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>Processing...</span>
                    </div>
                  )}
                  
                  {/* Drag & Drop Hint */}
                  {!submitting && !dragActive && (
                    <span className={`text-xs ml-auto hidden md:inline ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      Drag & drop images here
                    </span>
                  )}
                  {dragActive && (
                    <span className={`text-xs ml-auto hidden md:inline font-semibold animate-pulse ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      Drop images here
                    </span>
                  )}
                </div>

                {pendingImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                    {pendingImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <div className={`aspect-square rounded-xl overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-105 animate-fade-in-scale ${
                          isDarkMode 
                            ? 'border-gray-600 bg-gray-700' 
                            : 'border-gray-200 bg-gray-100'
                        }`}>
                           <img 
                            src={img.url} 
                            alt="" 
                            className="object-cover h-full w-full cursor-pointer" 
                            onClick={() => setShowImagePreview({ urls: pendingImages.map(p => p.url), index: idx })}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          {/* Preview Button */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <button
                              type="button"
                              onClick={() => setShowImagePreview({ urls: pendingImages.map(p => p.url), index: idx })}
                              className="bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
                              title="Preview Image"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveImage(idx)} 
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all duration-200 z-10 hover:scale-110 active:scale-95 shadow-md"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t dark:border-slate-700/80 border-slate-100">
                <button type="button" onClick={() => setShowFormModal(false)} disabled={submitting} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-all ${isDarkMode ? 'border-gray-700 hover:bg-slate-750 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center space-x-2">
                  {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                  <span>{formMode === 'edit' ? 'Save Changes' : 'Create Sampling'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-xl border shadow-2xl p-6 transform transition-all animate-scale-up ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-gray-900'}`}>
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Delete sampling item?</h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>This action cannot be undone.</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button type="button" onClick={() => { setShowDeleteModal(false); setSelectedItem(null); }} disabled={isDeleting} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${isDarkMode ? 'border-gray-700 hover:bg-slate-750 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>Cancel</button>
              <button type="button" onClick={handleDeleteItem} disabled={isDeleting} className="flex-1 py-2 text-sm font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all flex items-center justify-center space-x-2">
                {isDeleting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showScrollToTop && (
        <button onClick={scrollToTop} className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-90 cursor-pointer" title="Scroll to Top">
          <ArrowUpIcon className="h-5 w-5" />
        </button>
      )}
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
        images={showImagePreview ? showImagePreview.urls : []}
        initialIndex={showImagePreview ? showImagePreview.index : 0}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
