'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  ChevronDownIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  DevicePhoneMobileIcon,
  PlusIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { useSession } from '../../hooks/useSession';
import CameraModal from '../../components/CameraModal';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import type { Weaver, Sample } from '../types';

interface SampleFormProps {
  weaver: Weaver | null;
  sample: Sample | null;
  onClose: () => void;
  onSave: (wasEdit: boolean) => void;
  onDelete?: (sampleId: string) => void;
  isDarkMode: boolean;
  onOptimisticSave?: (sampleData: any, wasEdit: boolean, filesToUpload?: Array<{ file: File; previewUrl: string }>) => Promise<void>; // For optimistic updates
}

const typeOptions = [
  'Polyester',
  'Blend',
  'Viscose',
  'Cotton',
  'Rayon',
  'Other'
];

export default function SampleForm({ weaver, sample, onClose, onSave, onDelete, isDarkMode, onOptimisticSave }: SampleFormProps) {
  const { isMaster } = useSession();
  const [formData, setFormData] = useState({
    qualityName: '',
    type: '',
    rack: '',
    greighWidth: '',
    finishWidth: '',
    weight: '',
    gsm: '',
    content: '',
    danier: '',
    reed: '',
    pick: '',
    greighRate: '',
    note: '',
    images: [] as string[]
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [dragActive, setDragActive] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingImageFiles, setPendingImageFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sample) {
      setFormData({
        qualityName: sample.qualityName || '',
        type: sample.type || '',
        rack: sample.rack || '',
        greighWidth: sample.greighWidth ? sample.greighWidth.toString() : '',
        finishWidth: sample.finishWidth ? sample.finishWidth.toString() : '',
        weight: sample.weight ? sample.weight.toString() : '',
        gsm: sample.gsm ? sample.gsm.toString() : '',
        content: sample.content || '',
        danier: sample.danier || '',
        reed: sample.reed ? sample.reed.toString() : '',
        pick: sample.pick ? sample.pick.toString() : '',
        greighRate: sample.greighRate ? sample.greighRate.toString() : '',
        note: sample.note || '',
        images: sample.images || []
      });
    } else {
      setFormData({
        qualityName: '',
        type: '',
        rack: '',
        greighWidth: '',
        finishWidth: '',
        weight: '',
        gsm: '',
        content: '',
        danier: '',
        reed: '',
        pick: '',
        greighRate: '',
        note: '',
        images: []
      });
    }
    setErrors({});
  }, [sample]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup blob URLs on unmount - use ref to track current pendingImageFiles
  const pendingImageFilesRef = useRef(pendingImageFiles);
  useEffect(() => {
    pendingImageFilesRef.current = pendingImageFiles;
  }, [pendingImageFiles]);

  useEffect(() => {
    return () => {
      // Cleanup all pending image preview URLs on unmount
      pendingImageFilesRef.current.forEach(file => {
        if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, []); // Only run on unmount

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (selectedImageIndex === null) return;

    const allImages = [
      ...pendingImageFiles.map(f => f.previewUrl),
      ...formData.images
    ];
    const totalImages = allImages.length;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        const nextIndex = (selectedImageIndex + 1) % totalImages;
        setSelectedImageIndex(nextIndex);
      } else if (e.key === 'ArrowLeft') {
        const prevIndex = selectedImageIndex === 0 
          ? totalImages - 1 
          : selectedImageIndex - 1;
        setSelectedImageIndex(prevIndex);
      } else if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedImageIndex, pendingImageFiles, formData.images]);

  // Listen for Escape key to close the form / camera modal / type dropdown (when lightbox is closed)
  useEffect(() => {
    if (selectedImageIndex !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCamera) {
          setShowCamera(false);
        } else if (showTypeDropdown) {
          setShowTypeDropdown(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedImageIndex, showCamera, showTypeDropdown]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (selectedImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedImageIndex]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Real-time validation
    const newErrors: { [key: string]: string } = { ...errors };
    
    if (field === 'qualityName') {
      if (!value.trim()) {
        newErrors.qualityName = 'Quality name is required';
      } else if (value.trim().length > 100) {
        newErrors.qualityName = 'Quality name must be 100 characters or less';
      } else {
        delete newErrors.qualityName;
      }
    } else if (field === 'type') {
      if (value && value.length > 50) {
        newErrors.type = 'Type must be 50 characters or less';
      } else if (value && !typeOptions.some(opt => opt.toLowerCase() === value.trim().toLowerCase())) {
        newErrors.type = `Type must be one of: ${typeOptions.join(', ')}`;
      } else {
        delete newErrors.type;
      }
    } else if (field === 'rack' && value && value.length > 100) {
      newErrors.rack = 'Rack must be 100 characters or less';
    } else if (field === 'content' && value && value.length > 100) {
      newErrors.content = 'Content must be 100 characters or less';
    } else if (field === 'danier' && value && value.length > 50) {
      newErrors.danier = 'Danier must be 50 characters or less';
    } else if (field === 'note' && value && value.length > 1000) {
      newErrors.note = 'Note must be 1000 characters or less';
    } else {
      // Numeric field validation
      const numericFields = ['greighWidth', 'finishWidth', 'weight', 'gsm', 'reed', 'pick', 'greighRate'];
      if (numericFields.includes(field) && value && value.trim()) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} must be a valid number`;
        } else if (numValue < 0) {
          newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} cannot be negative`;
        } else {
          delete newErrors[field];
        }
      } else if (errors[field]) {
        delete newErrors[field];
      }
    }
    
    setErrors(newErrors);
  };

  // Computed validation state - for disabling save button
  const isFormValid = useMemo(() => {
    // Quality name validation
    if (!formData.qualityName.trim()) {
      return false;
    }
    if (formData.qualityName.trim().length > 100) {
      return false;
    }
    
    // Weaver validation
    if (!weaver) {
      return false;
    }
    
    // Type validation (optional but if provided, check length and allowed list)
    if (formData.type) {
      if (formData.type.length > 50) {
        return false;
      }
      const matchesAllowed = typeOptions.some(opt => opt.toLowerCase() === formData.type.trim().toLowerCase());
      if (!matchesAllowed) {
        return false;
      }
    }
    
    // Rack validation (optional but if provided, check length)
    if (formData.rack && formData.rack.length > 100) {
      return false;
    }
    
    // Content validation (optional but if provided, check length)
    if (formData.content && formData.content.length > 100) {
      return false;
    }
    
    // Danier validation (optional but if provided, check length)
    if (formData.danier && formData.danier.length > 50) {
      return false;
    }
    
    // Note validation (optional but if provided, check length)
    if (formData.note && formData.note.length > 1000) {
      return false;
    }
    
    // Numeric field validations with max value checks
    const numericFields = [
      { key: 'greighWidth', max: 10000 },
      { key: 'finishWidth', max: 10000 },
      { key: 'weight', max: 100000 },
      { key: 'gsm', max: 10000 },
      { key: 'reed', max: 10000 },
      { key: 'pick', max: 10000 },
      { key: 'greighRate', max: 1000000 }
    ];
    
    for (const { key, max } of numericFields) {
      const value = formData[key as keyof typeof formData] as string;
      if (value && value.trim()) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0 || numValue > max) {
          return false;
        }
      }
    }
    
    return true;
  }, [formData, weaver]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    
    // Quality name validation
    if (!formData.qualityName.trim()) {
      newErrors.qualityName = 'Quality name is required';
    } else if (formData.qualityName.trim().length > 100) {
      newErrors.qualityName = 'Quality name must be 100 characters or less';
    }
    
    // Weaver validation
    if (!weaver) {
      newErrors.weaver = 'Weaver is required';
    }
    
    // Type validation (optional but if provided, check length)
    if (formData.type && formData.type.length > 50) {
      newErrors.type = 'Type must be 50 characters or less';
    }
    
    // Rack validation (optional but if provided, check length)
    if (formData.rack && formData.rack.length > 100) {
      newErrors.rack = 'Rack must be 100 characters or less';
    }
    
    // Content validation (optional but if provided, check length)
    if (formData.content && formData.content.length > 100) {
      newErrors.content = 'Content must be 100 characters or less';
    }
    
    // Danier validation (optional but if provided, check length)
    if (formData.danier && formData.danier.length > 50) {
      newErrors.danier = 'Danier must be 50 characters or less';
    }
    
    // Numeric field validations with max value checks
    const numericFields = [
      { key: 'greighWidth', label: 'Greigh Width', max: 10000 },
      { key: 'finishWidth', label: 'Finish Width', max: 10000 },
      { key: 'weight', label: 'Weight', max: 100000 },
      { key: 'gsm', label: 'GSM', max: 10000 },
      { key: 'reed', label: 'Reed', max: 10000 },
      { key: 'pick', label: 'Pick', max: 10000 },
      { key: 'greighRate', label: 'Greigh Rate', max: 1000000 }
    ];
    
    numericFields.forEach(({ key, label, max }) => {
      const value = formData[key as keyof typeof formData] as string;
      if (value && value.trim()) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          newErrors[key] = `${label} must be a valid number`;
        } else if (numValue < 0) {
          newErrors[key] = `${label} cannot be negative`;
        } else if (numValue > max) {
          newErrors[key] = `${label} must be less than ${max.toLocaleString()}`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFileToS3 = async (file: File, folder: string = 'weaver'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    // Add weaverId for proper folder structure: sample/{weaverId}/
    // All sample images for a weaver are stored in the same folder
    if (weaver?._id) {
      formData.append('weaverId', weaver._id);
    }

    const token = localStorage.getItem('token');
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

  const handleFiles = async (files: FileList | File[]) => {
    const newFiles: Array<{ file: File; previewUrl: string }> = [];
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not an image file`);
        continue;
      }
      
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errors.push(`${file.name}: File size (${sizeMB}MB) exceeds 10MB limit`);
        continue;
      }
      
      // Validate file format
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid format. Allowed: JPEG, PNG, WebP`);
        continue;
      }
      
      try {
        // Compress image if larger than 2MB
        let processedFile = file;
        if (file.size > 2 * 1024 * 1024) {
          // Import compression utility
          const { compressImage } = await import('@/lib/imageUtils');
          try {
            processedFile = await compressImage(file, {
              maxWidth: 2048,
              maxHeight: 2048,
              quality: 0.85,
              maxSizeMB: 5
            });
          } catch (compressError) {
            // If compression fails, use original file
            const error = compressError instanceof Error ? compressError : new Error(String(compressError));
            logger.warn('Image compression failed, using original', {
              error: {
                name: error.name,
                message: error.message,
                stack: error.stack
              }
            });
          }
        }
        
        const previewUrl = URL.createObjectURL(processedFile);
        newFiles.push({ file: processedFile, previewUrl });
      } catch (error) {
        errors.push(`${file.name}: Failed to process image`);
        logger.error('Error processing image', error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    if (errors.length > 0) {
      setErrors(prev => ({
        ...prev,
        images: errors.join('; ')
      }));
    }
    
    if (newFiles.length > 0) {
      setPendingImageFiles(prev => [...prev, ...newFiles]);
    }
  };

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
  };

  const handleCameraCapture = (file: File) => {
    handleFiles([file]);
  };

  const removeImage = (imageIndex: number) => {
    if (imageIndex < pendingImageFiles.length) {
      const fileToRemove = pendingImageFiles[imageIndex];
      URL.revokeObjectURL(fileToRemove.previewUrl);
      setPendingImageFiles(prev => prev.filter((_, i) => i !== imageIndex));
    } else {
      const uploadedIndex = imageIndex - pendingImageFiles.length;
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== uploadedIndex)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    if (!weaver) return;
    
    // If optimistic save handler is provided, use truly optimistic pattern
    if (onOptimisticSave) {
      // Close form immediately - super fast UI update
      onClose();
      
      // Prepare sample data (images will be uploaded in background)
      const sampleData = {
        weaverId: weaver._id,
        qualityName: formData.qualityName.trim(),
        type: formData.type || '',
        rack: formData.rack || '',
        greighWidth: formData.greighWidth ? parseFloat(formData.greighWidth) : 0,
        finishWidth: formData.finishWidth ? parseFloat(formData.finishWidth) : 0,
        weight: formData.weight ? parseFloat(formData.weight) : 0,
        gsm: formData.gsm ? parseFloat(formData.gsm) : 0,
        content: formData.content || '',
        danier: formData.danier || '',
        reed: formData.reed ? parseFloat(formData.reed) : 0,
        pick: formData.pick ? parseFloat(formData.pick) : 0,
        greighRate: formData.greighRate ? parseFloat(formData.greighRate) : 0,
        label: '',
        note: formData.note || '',
        images: formData.images // Start with existing images, upload new ones in background
      };
      
      // Clean up pending files
      const filesToUpload = [...pendingImageFiles];
      pendingImageFiles.forEach(file => URL.revokeObjectURL(file.previewUrl));
      setPendingImageFiles([]);
      
      // Call optimistic save immediately - UI updates right away
      // Images will be uploaded in background and API called
      onOptimisticSave(sampleData, !!sample, filesToUpload).catch((error) => {
        // Error popup is handled in parent component
        logger.error('Optimistic save error', error instanceof Error ? error : new Error(String(error)));
      });
      return;
    }
    
    // Fallback to regular save (if no optimistic handler)
    setLoading(true);
    try {
      // Upload pending images first - parallel processing for better performance
      const uploadedUrls: string[] = [];
      if (pendingImageFiles.length > 0) {
        setUploadingImages(true);
        try {
          // Upload all images in parallel
          const uploadPromises = pendingImageFiles.map(pendingFile => 
            uploadFileToS3(pendingFile.file).catch(error => {
              logger.error('Error uploading image', error instanceof Error ? error : new Error(String(error)));
              return null; // Return null for failed uploads
            })
          );
          const results = await Promise.all(uploadPromises);
          // Filter out failed uploads (null values)
          uploadedUrls.push(...results.filter((url): url is string => url !== null));
        } catch (error) {
          logger.error('Error during image uploads', error instanceof Error ? error : new Error(String(error)));
        } finally {
          setUploadingImages(false);
        }
      }
      
      const allImages = [...formData.images, ...uploadedUrls];
      
      const sampleData = {
        weaverId: weaver._id,
        qualityName: formData.qualityName.trim(),
        type: formData.type || '',
        rack: formData.rack || '',
        greighWidth: formData.greighWidth ? parseFloat(formData.greighWidth) : 0,
        finishWidth: formData.finishWidth ? parseFloat(formData.finishWidth) : 0,
        weight: formData.weight ? parseFloat(formData.weight) : 0,
        gsm: formData.gsm ? parseFloat(formData.gsm) : 0,
        content: formData.content || '',
        danier: formData.danier || '',
        reed: formData.reed ? parseFloat(formData.reed) : 0,
        pick: formData.pick ? parseFloat(formData.pick) : 0,
        greighRate: formData.greighRate ? parseFloat(formData.greighRate) : 0,
        label: '',
        note: formData.note || '',
        images: allImages
      };
      
      const token = localStorage.getItem('token');
      const url = sample?._id 
        ? `/api/weaver/samples/${sample._id}`
        : '/api/weaver/samples';
      const method = sample?._id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sampleData)
      });
      
      const data = await response.json();
      if (data.success) {
        // Clean up pending files
        pendingImageFiles.forEach(file => URL.revokeObjectURL(file.previewUrl));
        setPendingImageFiles([]);
        onSave(!!sample);
      } else {
        setErrors({ submit: data.message || 'Failed to save sample' });
      }
    } catch (error) {
      setErrors({ submit: 'Error saving sample' });
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`w-full max-w-7xl mx-auto rounded-xl shadow-2xl border my-4 sm:my-8 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          minWidth: 'min(95vw, 1200px)', 
          maxWidth: 'min(95vw, 1280px)',
          animation: 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-xl font-semibold flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {sample ? (
              <>
                <PencilIcon className="h-5 w-5 flex-shrink-0" />
                <span>Edit Sample</span>
              </>
            ) : (
              <>
                <PlusIcon className="h-5 w-5 flex-shrink-0" />
                <span>Create New Sample</span>
              </>
            )}
            {weaver && (
              <span className={`ml-2 text-sm font-normal ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                - {weaver.name}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 ${
              isDarkMode
                ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
          {/* Quality Information */}
          <div>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Quality Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Quality Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Quality Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.qualityName}
                  onChange={(e) => handleChange('qualityName', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.qualityName
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter quality name"
                />
                {errors.qualityName && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.qualityName}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Type
                </label>
                <div className="relative" ref={typeDropdownRef}>
                  <input
                    type="text"
                    value={showTypeDropdown ? typeSearch : formData.type}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTypeSearch(value);
                      handleChange('type', value);
                      if (!showTypeDropdown) setShowTypeDropdown(true);
                    }}
                    onFocus={() => {
                      setShowTypeDropdown(true);
                      setTypeSearch(formData.type);
                    }}
                    placeholder="Search or select type..."
                    className={`w-full p-3 pr-10 rounded-lg border transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  {/* Clear button */}
                  {(formData.type || (showTypeDropdown && typeSearch)) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleChange('type', '');
                        setTypeSearch('');
                        setShowTypeDropdown(false);
                      }}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all hover:scale-110 active:scale-95 z-10 ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                          : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                      }`}
                      title="Clear type"
                      aria-label="Clear type selection"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                  {/* Dropdown arrow */}
                  {!formData.type && !(showTypeDropdown && typeSearch) && (
                    <button
                      type="button"
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${
                        showTypeDropdown ? 'rotate-180' : ''
                      }`} />
                    </button>
                  )}
                  {showTypeDropdown && (
                    <div 
                      className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl max-h-60 overflow-auto ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-600'
                        : 'bg-white border-gray-300'
                      }`}
                      style={{
                        animation: 'slideDownFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                      }}
                    >
                      {typeOptions
                        .filter(option => option.toLowerCase().includes(typeSearch.toLowerCase()))
                        .map((option) => (
                          <button
                            key={option}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleChange('type', option);
                              setTypeSearch('');
                              setShowTypeDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-blue-500 hover:text-white transition-colors ${
                              formData.type === option
                                ? isDarkMode
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-500 text-white'
                                : isDarkMode
                                  ? 'text-gray-300 hover:bg-blue-600'
                                  : 'text-gray-900'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      {typeOptions.filter(option => 
                        option.toLowerCase().includes(typeSearch.toLowerCase())
                      ).length === 0 && (
                        <div className={`px-4 py-3 text-sm text-center ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          No types found
                        </div>
                      )}
                    </div>
                  )}
                  {errors.type && (
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.type}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quality Images */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className={`block text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Quality Images
              </label>
              <span className={`text-xs px-2 py-1 rounded ${
                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
              }`}>
                {(formData.images?.length || 0) + pendingImageFiles.length} image(s)
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                className="hidden"
                id="sample-image-upload"
                ref={fileInputRef}
              />
              <label
                htmlFor="sample-image-upload"
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm font-medium ${
                  isDarkMode
                    ? 'border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400 hover:bg-blue-500/5'
                    : 'border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <CloudArrowUpIcon className="h-5 w-5" />
                <span className="whitespace-nowrap">Upload</span>
              </label>
              
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl border-2 border-dashed transition-all text-sm font-medium ${
                  isDarkMode
                    ? 'border-gray-600 hover:border-green-500 text-gray-300 hover:text-green-400 hover:bg-green-500/5'
                    : 'border-gray-300 hover:border-green-400 text-gray-600 hover:text-green-600 hover:bg-green-50'
                }`}
              >
                <PhotoIcon className="h-5 w-5" />
                <span className="whitespace-nowrap">Camera</span>
              </button>
            </div>
            
            {/* Image Previews - Single row horizontal scroll */}
            {((pendingImageFiles.length > 0) || (formData.images && formData.images.length > 0)) && (
              <div className="flex gap-2 md:gap-3 mt-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
                {pendingImageFiles.map((pendingFile, idx) => (
                  <div key={`pending-${idx}`} className="relative group flex-shrink-0 snap-start">
                    <div 
                      className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                        isDarkMode ? 'border-yellow-500 hover:border-yellow-400' : 'border-yellow-400 hover:border-yellow-500'
                      }`}
                      onClick={() => setSelectedImageIndex(idx)}
                    >
                      <img src={pendingFile.previewUrl} alt={`Pending ${idx}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center rounded-xl">
                        <EyeIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(idx);
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all z-10 shadow-md text-xs"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {formData.images.map((img, idx) => {
                  const imageIndex = pendingImageFiles.length + idx;
                  return (
                    <div key={`uploaded-${idx}`} className="relative group flex-shrink-0 snap-start">
                      <div 
                        className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                          isDarkMode ? 'border-green-500 hover:border-green-400' : 'border-green-400 hover:border-green-500'
                        }`}
                        onClick={() => setSelectedImageIndex(imageIndex)}
                      >
                        <img src={img} alt={`Uploaded ${idx}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center rounded-xl">
                          <EyeIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(imageIndex);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all z-10 shadow-md text-xs"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weaver Information */}
          <div>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Weaver Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Greigh Width */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Greigh Width (inches)
                </label>
                <input
                  type="text"
                  value={formData.greighWidth}
                  onChange={(e) => handleChange('greighWidth', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.greighWidth
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 58.5"
                />
                {errors.greighWidth && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.greighWidth}</p>
                )}
              </div>

              {/* Finish Width */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Finish Width (inches)
                </label>
                <input
                  type="text"
                  value={formData.finishWidth}
                  onChange={(e) => handleChange('finishWidth', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.finishWidth
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 56.0"
                />
                {errors.finishWidth && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.finishWidth}</p>
                )}
              </div>

              {/* Weight */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Weight (KG)
                </label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.weight
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 8.0"
                />
                {errors.weight && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.weight}</p>
                )}
              </div>

              {/* GSM */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  GSM
                </label>
                <input
                  type="text"
                  value={formData.gsm}
                  onChange={(e) => handleChange('gsm', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.gsm
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 72.5"
                />
                {errors.gsm && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.gsm}</p>
                )}
              </div>

              {/* Content */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Content
                </label>
                <input
                  type="text"
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.content
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 100% Polyester"
                />
                {errors.content && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.content}</p>
                )}
              </div>

              {/* Danier */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Danier (Count)
                </label>
                <input
                  type="text"
                  value={formData.danier}
                  onChange={(e) => handleChange('danier', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.danier
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 55*22D"
                />
                {errors.danier && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.danier}</p>
                )}
              </div>

              {/* Reed */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Reed
                </label>
                <input
                  type="text"
                  value={formData.reed}
                  onChange={(e) => handleChange('reed', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.reed
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 120"
                />
                {errors.reed && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.reed}</p>
                )}
              </div>

              {/* Pick */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Pick
                </label>
                <input
                  type="text"
                  value={formData.pick}
                  onChange={(e) => handleChange('pick', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.pick
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 80"
                />
                {errors.pick && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.pick}</p>
                )}
              </div>

              {/* Greigh Rate */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Greigh Rate (₹)
                </label>
                <input
                  type="text"
                  value={formData.greighRate}
                  onChange={(e) => handleChange('greighRate', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.greighRate
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 150.00"
                />
                {errors.greighRate && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.greighRate}</p>
                )}
              </div>

              {/* Rack */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Rack
                </label>
                <input
                  type="text"
                  value={formData.rack}
                  onChange={(e) => handleChange('rack', e.target.value)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    errors.rack
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter rack"
                />
                {errors.rack && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.rack}</p>
                )}
              </div>

              {/* Note (single-row, compact, last) */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Note
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => handleChange('note', e.target.value)}
                  rows={1}
                  className={`w-full p-3 rounded-lg border transition-all resize-none leading-tight ${
                    errors.note
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Add a short note"
                />
                {errors.note && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.note}</p>
                )}
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className={`p-3 rounded-lg ${
              isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              {errors.submit}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            {isMaster && sample && sample._id && onDelete && (
              <button
                type="button"
                onClick={() => {
                  // Close form first, then trigger main delete confirmation (only one confirmation)
                  onClose();
                  // Small delay to ensure form closes before showing delete confirmation
                  setTimeout(() => {
                    onDelete(sample._id);
                  }, 150);
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Delete
              </button>
            )}
            <div className="flex items-center space-x-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                  !isFormValid
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105 active:scale-95 hover:shadow-lg'
                } ${
                  isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <CameraModal
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Image Lightbox Modal */}
      <ImagePreviewModal
        isOpen={selectedImageIndex !== null}
        onClose={() => setSelectedImageIndex(null)}
        images={[
          ...pendingImageFiles.map(f => f.previewUrl),
          ...formData.images
        ]}
        initialIndex={selectedImageIndex !== null ? selectedImageIndex : 0}
        isDarkMode={isDarkMode}
      />

    </div>
  );
}

