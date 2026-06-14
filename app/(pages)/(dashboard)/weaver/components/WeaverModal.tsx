'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, UserIcon, DevicePhoneMobileIcon, BuildingOfficeIcon, UserPlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';
import type { Weaver } from '../types';

interface WeaverModalProps {
  weaver: Weaver | null;
  onClose: () => void;
  onSave: () => void;
  isDarkMode: boolean;
  onMessage?: (type: 'success' | 'error', text: string) => void;
  onOptimisticSave?: (formData: { name: string; phone: string; address: string }) => Promise<void>;
}

export default function WeaverModal({ weaver, onClose, onSave, isDarkMode, onMessage, onOptimisticSave }: WeaverModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (weaver) {
      setFormData({
        name: weaver.name || '',
        phone: weaver.phone || '',
        address: weaver.address || ''
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        address: ''
      });
    }
    setErrors({});
  }, [weaver]);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleChange = (field: string, value: string) => {
    // For phone field, only allow numbers in real-time
    if (field === 'phone') {
      // Check if user tried to input non-numeric characters
      const hasNonNumeric = /[^0-9]/.test(value);
      
      // Remove all non-numeric characters
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [field]: numericValue }));
      
      // Real-time validation for phone
      const newErrors: { [key: string]: string } = { ...errors };
      
      // Show error if user tried to type non-numeric characters
      if (hasNonNumeric && value.length > 0) {
        newErrors.phone = 'Phone number must contain only numbers';
      } else if (numericValue.length > 20) {
        newErrors.phone = 'Phone must be 20 digits or less';
      } else {
        delete newErrors.phone;
      }
      setErrors(newErrors);
      return;
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
    // Real-time validation
    const newErrors: { [key: string]: string } = { ...errors };
    
    if (field === 'name') {
      if (!value.trim()) {
        newErrors.name = 'Name is required';
      } else if (value.trim().length > 100) {
        newErrors.name = 'Name must be 100 characters or less';
      } else {
        delete newErrors.name;
      }
    } else if (field === 'address') {
      if (value.trim().length > 500) {
        newErrors.address = 'Address must be 500 characters or less';
      } else {
        delete newErrors.address;
      }
    }
    
    setErrors(newErrors);
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }
    if (formData.phone && formData.phone.length > 20) {
      newErrors.phone = 'Phone must be 20 digits or less';
    }
    if (formData.phone && !/^\d+$/.test(formData.phone)) {
      newErrors.phone = 'Phone must contain only numbers';
    }
    if (formData.address && formData.address.trim().length > 500) {
      newErrors.address = 'Address must be 500 characters or less';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    // If optimistic save handler is provided, use optimistic update pattern
    if (onOptimisticSave) {
      // Close modal immediately and update UI optimistically
      onClose();
      // Call optimistic save which will update UI and make API call in background
      onOptimisticSave(formData).catch((error) => {
        // Error handling is done in the parent component
        logger.error('Optimistic save error', error instanceof Error ? error : new Error(String(error)), {
          component: 'WeaverModal',
          action: 'optimisticSave'
        });
      });
      return;
    }
    
    // Fallback to original behavior if no optimistic handler
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = weaver?._id 
        ? `/api/weaver/weavers/${weaver._id}`
        : '/api/weaver/weavers';
      const method = weaver?._id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (data.success) {
        if (onMessage) {
          onMessage('success', weaver?._id ? 'Weaver updated successfully' : 'Weaver created successfully');
        }
        onSave();
      } else {
        const errorMsg = data.message || 'Failed to save weaver';
        setErrors({ submit: errorMsg });
        if (onMessage) {
          onMessage('error', errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = 'Error saving weaver';
      setErrors({ submit: errorMsg });
      if (onMessage) {
        onMessage('error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10200] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`w-full max-w-2xl mx-auto rounded-xl shadow-2xl border animate-scale-in my-4 sm:my-8 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 'min(90vw, 600px)', maxWidth: 'min(90vw, 700px)' }}
      >
        <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg sm:text-xl font-semibold flex items-center space-x-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {weaver ? (
              <>
                <PencilSquareIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>Edit Weaver</span>
              </>
            ) : (
              <>
                <UserPlusIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>Add Weaver</span>
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <UserIcon className={`h-4 w-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <span>Name <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-4 p-3 sm:p-3.5 rounded-lg border transition-all text-sm sm:text-base ${
                errors.name
                  ? 'border-red-500'
                  : isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Enter weaver name"
            />
            {errors.name && (
              <p className={`text-sm mt-1 animate-in fade-in slide-in-from-top-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className={`block text-sm font-medium mb-2 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <DevicePhoneMobileIcon className={`h-4 w-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={`w-full px-4 p-3 sm:p-3.5 rounded-lg border-2 transition-all text-sm sm:text-base ${
                errors.phone
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                  : isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
              placeholder="Enter phone number"
            />
            {errors.phone && (
              <p className={`text-sm mt-1 animate-in fade-in slide-in-from-top-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.phone}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className={`block text-sm font-medium mb-2 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <BuildingOfficeIcon className={`h-4 w-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <span>Address</span>
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={3}
              className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border transition-all text-sm sm:text-base resize-none ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Enter address"
            />
            {errors.address && (
              <p className={`text-sm mt-1 animate-in fade-in slide-in-from-top-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{errors.address}</p>
            )}
          </div>

          {errors.submit && (
            <div className={`p-3 rounded-lg ${
              isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              {errors.submit}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-all ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Object.keys(errors).length > 0 || !formData.name.trim()}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                loading || Object.keys(errors).length > 0 || !formData.name.trim()
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105 active:scale-95'
              } ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

