'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  XMarkIcon, 
  PlusIcon, 
  TrashIcon, 
  PhotoIcon, 
  CloudArrowUpIcon,
  HashtagIcon,
  TagIcon,
  Squares2X2Icon,
  UserIcon,
  DocumentTextIcon,
  ScaleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import ToastNotification, { useToast } from '../../components/ToastNotification';
import CameraModal from '../../components/CameraModal';
import ImagePreviewModal from '../../components/ImagePreviewModal';

export default function GreyMaterialForm(props: any) {
  const { isDarkMode, onClose, onSave } = props;
  const item = props.item || props.greyMaterial;
  const isEditMode = !!item;
  const { toasts, showToast, removeToast } = useToast();
  
  const [formData, setFormData] = useState(() => {
    let initialWeavers = [{
      _id: item?._id || '',
      name: item?.weaver || '',
      challanNumber: item?.challanNumber || '',
      piece: item?.piece || 0,
      meter: item?.meter || 0
    }];

    if (item?.weaversList && Array.isArray(item.weaversList)) {
      initialWeavers = item.weaversList.map((w: any) => ({
        _id: w._id || '',
        name: w.weaver || '',
        challanNumber: w.challanNumber || '',
        piece: w.piece || 0,
        meter: w.meter || 0
      }));
    }

    return {
      qualityCode: item?.qualityCode || '',
      qualityName: item?.qualityName || '',
      type: item?.type || '',
      images: item?.images || [],
      weavers: initialWeavers
    };
  });

  const [deletedWeaverIds, setDeletedWeaverIds] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<{ url: string; index: number } | null>(null);

  // Type Dropdown State and Refs
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    function handleClickOutside(event: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (dropdownBlurTimeoutRef.current) {
        clearTimeout(dropdownBlurTimeoutRef.current);
      }
    };
  }, []);

  // Focus lock and overflow hidden
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const [loadingData, setLoadingData] = useState(false);

  // Fetch complete group data from the database in edit mode to prevent accidental deletion of other weavers
  useEffect(() => {
    if (!isEditMode || !item?._id) return;

    const loadCompleteData = async () => {
      try {
        setLoadingData(true);
        const response = await fetch(`/api/grey-materials/${item._id}`);
        const result = await response.json();
        if (result.success && result.data) {
          const allItems = Array.isArray(result.data) ? result.data : [result.data];
          
          let weaversToLoad = allItems;
          const selectedWeaverIds = item._selectedWeaverIds;
          if (selectedWeaverIds && Array.isArray(selectedWeaverIds) && selectedWeaverIds.length >= 2) {
            weaversToLoad = allItems.filter((w: any) => 
              selectedWeaverIds.includes(String(w._id))
            );
          }

          const formattedWeavers = weaversToLoad.map((w: any) => ({
            _id: w._id || '',
            name: w.weaver || '',
            challanNumber: w.challanNumber || '',
            piece: w.piece || 0,
            meter: w.meter || 0
          }));
          
          setFormData({
            qualityCode: allItems[0]?.qualityCode || item.qualityCode || '',
            qualityName: allItems[0]?.qualityName || item.qualityName || '',
            type: allItems[0]?.type || item.type || '',
            images: allItems[0]?.images || item.images || [],
            weavers: formattedWeavers
          });
        }
      } catch (err) {
        console.error('Error loading complete grey material data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadCompleteData();
  }, [isEditMode, item?._id]);

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
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, showImagePreview, showCamera, showTypeDropdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWeaverChange = (index: number, field: string, value: string | number) => {
    const newWeavers = [...formData.weavers];
    newWeavers[index] = { ...newWeavers[index], [field]: value };
    setFormData(prev => ({ ...prev, weavers: newWeavers }));
  };

  const addWeaver = () => {
    setFormData(prev => ({
      ...prev,
      weavers: [...prev.weavers, { _id: '', name: '', challanNumber: '', piece: 0, meter: 0 }]
    }));
  };

  const removeWeaver = (index: number) => {
    if (formData.weavers.length > 1) {
      const weaverToRemove = formData.weavers[index];
      if (weaverToRemove?._id) {
        setDeletedWeaverIds(prev => [...prev, String(weaverToRemove._id)]);
      }
      const newWeavers = [...formData.weavers];
      newWeavers.splice(index, 1);
      setFormData(prev => ({ ...prev, weavers: newWeavers }));
    }
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
      console.log("handleFileInput called with files:", files);
      if (!files) {
        showToast('error', 'No files object found');
        return;
      }
      showToast('info', `Received ${files.length} file(s) from system`);
      if (files.length > 0) {
        const filesArray: File[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file) {
            filesArray.push(file);
          }
        }
        handleFiles(filesArray);
      }
    } catch (err: any) {
      console.error("Error in handleFileInput:", err);
      showToast('error', `Error reading files: ${err.message || err}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleFiles = (files: File[]) => {
    console.log("handleFiles called with:", files);
    const newFiles: Array<{ file: File; previewUrl: string }> = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type || '';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = fileType.startsWith('image/') || 
                      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg'].includes(ext);

      console.log(`File ${i}: name=${file.name}, type=${file.type}, size=${file.size}, isImage=${isImage}`);

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
        errors.push(`${file.name} failed to process preview: ${err.message || err}`);
      }
    }
    
    if (errors.length > 0) {
      showToast('error', errors.join('; '));
    }
    
    if (newFiles.length > 0) {
      setPendingImageFiles(prev => {
        console.log("Updating pendingImageFiles. Prev length:", prev.length, "Adding:", newFiles.length);
        return [...prev, ...newFiles];
      });
      showToast('success', `Added ${newFiles.length} image(s) to previews`);
    } else {
      showToast('warning', 'No valid images were added to previews');
    }
  };

  const handleCameraCapture = (file: File) => {
    handleFiles([file]);
    setShowCamera(false);
  };

  const removePendingImage = (imageIndex: number) => {
    const fileToRemove = pendingImageFiles[imageIndex];
    URL.revokeObjectURL(fileToRemove.previewUrl);
    setPendingImageFiles(prev => prev.filter((_: any, i: number) => i !== imageIndex));
  };

  const removeUploadedImage = (imageIndex: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== imageIndex)
    }));
  };

  const uploadFileToS3 = async (file: File, folder: string = 'grey-materials'): Promise<string> => {
    const formDataPayload = new FormData();
    formDataPayload.append('file', file);
    formDataPayload.append('folder', folder);

    const token = localStorage.getItem('token');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formDataPayload
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Upload failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && (data.url || data.imageUrl)) {
      return data.url || data.imageUrl;
    } else {
      throw new Error(data.message || 'Upload failed: No URL received');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.qualityCode || !formData.qualityName) {
      showToast('error', 'Quality Code and Quality Name are required');
      return;
    }

    try {
      setIsSubmitting(true);

      // STEP 1: Upload pending images in parallel
      const uploadedUrls: string[] = [];
      if (pendingImageFiles.length > 0) {
        setUploadingImages(true);
        try {
          const uploadPromises = pendingImageFiles.map(async (pendingFile) => {
            try {
              const url = await uploadFileToS3(pendingFile.file);
              return { success: true, url, previewUrl: pendingFile.previewUrl, file: pendingFile.file };
            } catch (error: any) {
              console.error('Error uploading image:', error);
              return { success: false, error: error.message || 'Upload failed', file: pendingFile.file };
            }
          });
          
          const results = await Promise.all(uploadPromises);
          const failures = results.filter((r): r is { success: false; error: string; file: File } => !r.success);
          const successes = results.filter((r): r is { success: true; url: string; previewUrl: string; file: File } => r.success);
          
          // Revoke preview URLs for successful uploads
          successes.forEach(s => {
            URL.revokeObjectURL(s.previewUrl);
          });
          
          // Add successful URLs to uploadedUrls
          uploadedUrls.push(...successes.map(s => s.url));
          
          if (failures.length > 0) {
            // Show toast for failed uploads
            failures.forEach(f => {
              showToast('error', `Failed to upload ${f.file.name}: ${f.error}`);
            });
            
            // Keep ONLY the failed files in pending list
            const failedFiles = failures.map(f => f.file);
            setPendingImageFiles(prev => prev.filter(p => failedFiles.includes(p.file)));
            
            // Abort submission so they can try again
            setIsSubmitting(false);
            setUploadingImages(false);
            return;
          }
          
          // Clear pending images if all succeeded
          setPendingImageFiles([]);
        } catch (uploadErr: any) {
          showToast('error', uploadErr.message || 'Failed to upload images');
          setIsSubmitting(false);
          setUploadingImages(false);
          return;
        }
        setUploadingImages(false);
      }

      const allImages = [...formData.images, ...uploadedUrls];
      
      const url = '/api/grey-materials';
      const method = isEditMode ? 'PUT' : 'POST';
      
      let payload: any = { 
        ...formData,
        images: allImages
      };
      
      if (isEditMode) {
        payload = {
          qualityCode: formData.qualityCode.trim(),
          qualityName: formData.qualityName.trim(),
          type: formData.type?.trim() || '',
          images: allImages,
          originalQualityCode: item.qualityCode,
          deletedWeaverIds: deletedWeaverIds,
          weavers: formData.weavers.map((w: any) => ({
            _id: w._id,
            name: w.name?.trim() || '',
            challanNumber: w.challanNumber?.trim() || '',
            piece: Number(w.piece) || 0,
            meter: Number(w.meter) || 0,
          }))
        };
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast('success', data.message);
        onSave(isEditMode, data.data);
      } else {
        showToast('error', data.message || 'Error saving grey material');
      }
    } catch (err) {
      showToast('error', 'Failed to save grey material');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className={`w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col border transition-all ${
          isDarkMode 
            ? 'bg-gray-900 border-gray-800 text-white shadow-slate-950/50' 
            : 'bg-white border-gray-200 text-gray-900 shadow-gray-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 border-b flex justify-between items-center sticky top-0 z-10 backdrop-blur-md ${
          isDarkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-100'
        }`}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isEditMode ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            {isEditMode ? 'Edit Grey Material' : 'Create New Grey Material'}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${
            isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
          }`}>
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 relative min-h-[300px]">
          {loadingData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 dark:bg-black/40 backdrop-blur-[2px] z-30">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent border-blue-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Loading group weavers...</span>
            </div>
          )}
          <form id="grey-material-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Quality Information Card */}
            <div className={`p-5 rounded-xl border ${
              isDarkMode ? 'bg-gray-800/30 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-base font-semibold mb-4 flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <Squares2X2Icon className="w-4.5 h-4.5 text-blue-500" /> Quality Information
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Quality Code */}
                <div>
                  <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <HashtagIcon className="h-4 w-4" /> Quality Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="qualityCode"
                    value={formData.qualityCode}
                    onChange={handleChange}
                    placeholder="e.g., 1001-WL"
                    required
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 shadow-sm'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    You can reuse quality codes to add items.
                  </span>
                </div>

                {/* Quality Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <TagIcon className="h-4 w-4" /> Quality Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="qualityName"
                    value={formData.qualityName}
                    onChange={handleChange}
                    placeholder="Enter quality name"
                    required
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 shadow-sm'
                    }`}
                  />
                </div>
                
                {/* Type */}
                <div ref={typeDropdownRef} className="relative">
                  <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Squares2X2Icon className="h-4 w-4" /> Type
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="type"
                      value={showTypeDropdown ? typeSearch : formData.type}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTypeSearch(value);
                        setFormData(prev => ({ ...prev, type: value }));
                        if (!showTypeDropdown) {
                          setShowTypeDropdown(true);
                        }
                      }}
                      onFocus={() => {
                        setShowTypeDropdown(true);
                        setTypeSearch(formData.type || '');
                      }}
                      onBlur={() => {
                        if (dropdownBlurTimeoutRef.current) {
                          clearTimeout(dropdownBlurTimeoutRef.current);
                        }
                        dropdownBlurTimeoutRef.current = setTimeout(() => {
                          setShowTypeDropdown(false);
                          dropdownBlurTimeoutRef.current = null;
                        }, 200);
                      }}
                      placeholder="Search or select type..."
                      className={`w-full px-4 py-2.5 pr-10 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 shadow-sm'
                      }`}
                    />
                    
                    {/* Clear button for Type */}
                    {(formData.type || (showTypeDropdown && typeSearch)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, type: '' }));
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
                    {!formData.type && !(showTypeDropdown && typeSearch) && (
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
                      className={`absolute w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-auto transition-all ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-gray-300' 
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      style={{ zIndex: 50 }}
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
                              setFormData(prev => ({ ...prev, type: option }));
                              setTypeSearch('');
                              setShowTypeDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors ${
                              isDarkMode 
                                ? 'hover:bg-blue-750 text-gray-300' 
                                : 'text-gray-900'
                            } ${formData.type === option ? 'bg-blue-500 text-white font-semibold' : ''}`}
                          >
                            {option}
                          </button>
                        ))}
                      {typeOptions.filter(option => 
                        option.toLowerCase().includes(typeSearch.toLowerCase())
                      ).length === 0 && (
                        <div className={`px-4 py-2 text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          No types found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quality Images Sub-section */}
              <div className="mt-5">
                <div className="flex justify-between items-center mb-2">
                  <label className={`block text-sm font-medium flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <PhotoIcon className="w-4 h-4" /> Quality Images
                  </label>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {formData.images.length + pendingImageFiles.length} image(s)
                  </span>
                </div>

                {/* Drag & Drop File Container */}
                <div 
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 transition-all ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-500/5' 
                      : isDarkMode ? 'border-gray-700 bg-gray-800/10' : 'border-gray-300 bg-slate-50/20'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex gap-2">
                    <div 
                      className={`relative px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                        isDarkMode 
                          ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-gray-300' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-750 shadow-sm'
                      }`}
                    >
                      <CloudArrowUpIcon className="w-4 h-4 text-blue-500" />
                      Upload Image
                      <input
                        type="file"
                        id="quality-image-upload"
                        multiple={true}
                        accept="image/*"
                        onChange={handleFileInput}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 ${
                        isDarkMode 
                          ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-gray-300' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-750 shadow-sm'
                      }`}
                    >
                      <PhotoIcon className="w-4 h-4 text-emerald-500" />
                      Camera
                    </button>
                  </div>

                  {uploadingImages && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 animate-pulse">
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Uploading images...
                    </div>
                  )}

                  <span className={`text-xs ml-auto hidden md:inline ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
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
                          onClick={() => setShowImagePreview({ url: pImg.previewUrl, index: idx })}
                        />
                        <button
                          type="button"
                          onClick={() => removePendingImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-lg p-1 shadow-md transition-all z-10 active:scale-90 hover:scale-110"
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
                    {formData.images.map((imgUrl: string, idx: number) => (
                      <div key={`uploaded-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 group shadow-md">
                        <img 
                          src={imgUrl} 
                          alt="Uploaded Quality" 
                          className="w-full h-full object-cover cursor-pointer" 
                          onClick={() => setShowImagePreview({ url: imgUrl, index: pendingImageFiles.length + idx })}
                        />
                        <button
                          type="button"
                          onClick={() => removeUploadedImage(idx)}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-lg p-1 shadow-md transition-all z-10 active:scale-90 hover:scale-110"
                          title="Remove image"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Weaver Information Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className={`text-base font-semibold flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <UserIcon className="w-4.5 h-4.5 text-blue-500" /> Weaver Information
                </h3>
              </div>

              <div className="space-y-4">
                {formData.weavers.map((weaver, index) => (
                  <div key={index} className={`p-5 rounded-xl border relative transition-all ${
                    isDarkMode 
                      ? 'bg-gray-800/10 border-gray-700 hover:border-gray-600' 
                      : 'bg-white border-gray-200 shadow-sm hover:shadow'
                  }`}>
                    {/* Header bar inside card */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-gray-500">WEAVER {index + 1}</span>
                      
                      {formData.weavers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWeaver(index)}
                          className="p-1 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          title="Remove weaver"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* Name */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <UserIcon className="w-3.5 h-3.5 text-gray-400" /> Weaver Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={weaver.name}
                          onChange={(e) => handleWeaverChange(index, 'name', e.target.value)}
                          placeholder="Enter weaver name"
                          className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                            isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                      </div>

                      {/* Challan Number */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <DocumentTextIcon className="w-3.5 h-3.5 text-gray-400" /> Challan Number
                        </label>
                        <input
                          type="text"
                          value={weaver.challanNumber}
                          onChange={(e) => handleWeaverChange(index, 'challanNumber', e.target.value)}
                          placeholder="e.g., CH-1234"
                          className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                            isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                      </div>

                      {/* Piece */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <HashtagIcon className="w-3.5 h-3.5 text-gray-400" /> Piece (Number)
                        </label>
                        <input
                          type="number"
                          value={weaver.piece || ''}
                          onChange={(e) => handleWeaverChange(index, 'piece', Number(e.target.value))}
                          placeholder="0"
                          min="0"
                          className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                            isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                      </div>

                      {/* Meter */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <ScaleIcon className="w-3.5 h-3.5 text-gray-400" /> Meter (Number)
                        </label>
                        <input
                          type="number"
                          value={weaver.meter || ''}
                          onChange={(e) => handleWeaverChange(index, 'meter', Number(e.target.value))}
                          placeholder="0"
                          min="0"
                          step="0.01"
                          className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                            isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Another Weaver Dotted Card Button */}
              <button
                type="button"
                onClick={addWeaver}
                className={`w-full py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-sm font-semibold tracking-wide transition-all active:scale-98 ${
                  isDarkMode 
                    ? 'border-gray-700 hover:border-gray-600 bg-gray-800/10 hover:bg-gray-800/20 text-blue-400' 
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50/20 hover:bg-gray-50/60 text-blue-650 shadow-sm'
                }`}
              >
                <PlusIcon className="w-4 h-4" /> Add Another Weaver
              </button>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-end gap-3 sticky bottom-0 z-10 backdrop-blur-md ${
          isDarkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-100'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${
              isDarkMode 
                ? 'border-gray-700 text-gray-300 hover:bg-gray-800' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="grey-material-form"
            disabled={isSubmitting || loadingData}
            className={`px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 ${
              (isSubmitting || loadingData) 
                ? 'bg-blue-500/50 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {(isSubmitting || loadingData) && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {isSubmitting ? 'Saving...' : loadingData ? 'Loading...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Camera Capture Modal */}
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
        images={[...pendingImageFiles.map(p => p.previewUrl), ...formData.images]}
        initialIndex={showImagePreview ? showImagePreview.index : 0}
        isDarkMode={isDarkMode}
      />

      {/* Toast notifications inside the form context */}
      <ToastNotification toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
