'use client';

import { useState } from 'react';
import { 
  XMarkIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';

interface MillModalProps {
  onClose: () => void;
  onSuccess: (newMillData?: any) => void;
}

interface MillFormData {
  name: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function MillModal({ onClose, onSuccess }: MillModalProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const [formData, setFormData] = useState<MillFormData>({
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const validateForm = (): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Mill name is required';
    }

    return newErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      setValidationMessage({ type: 'error', text: 'Please fix the errors below' });
      return;
    }

    setLoading(true);
    setValidationMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/mills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim()
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        const newMill = responseData.data;
        
        if (!newMill || !newMill._id || !newMill.name) {
          setValidationMessage({ 
            type: 'error', 
            text: 'Invalid mill data received from server' 
          });
          return;
        }
        
        setValidationMessage({ type: 'success', text: 'Mill created successfully!' });
        setTimeout(() => {
          onSuccess(newMill);
        }, 1500);
      } else {
        const errorData = await response.json();
        setValidationMessage({ 
          type: 'error', 
          text: errorData.message || errorData.error || 'Failed to create mill' 
        });
      }
    } catch (error: any) {
      console.error('Error creating mill:', error);
      setValidationMessage({ 
        type: 'error', 
        text: error.message || 'Failed to create mill. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}
          onClick={handleClose}
        ></div>

        <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${isClosing ? 'modal-exit' : 'modal-enter'} ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h2 className={`text-xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Add New Mill
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className={`p-1 rounded-md hover:bg-opacity-80 ${
                isDarkMode 
                  ? 'text-gray-400 hover:bg-gray-700' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Validation Message */}
            {validationMessage && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                validationMessage.type === 'success'
                  ? isDarkMode ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                  : isDarkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
              }`}>
                {validationMessage.type === 'success' ? (
                  <CheckIcon className={`h-5 w-5 ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`} />
                ) : (
                  <ExclamationTriangleIcon className={`h-5 w-5 ${
                    isDarkMode ? 'text-red-400' : 'text-red-600'
                  }`} />
                )}
                <p className={`font-medium ${
                  validationMessage.type === 'success'
                    ? isDarkMode ? 'text-green-200' : 'text-green-800'
                    : isDarkMode ? 'text-red-200' : 'text-red-800'
                }`}>
                  {validationMessage.text}
                </p>
              </div>
            )}

            {/* Mill Name */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Mill Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Enter mill name"
                className={`w-full px-4 py-3 rounded-lg border-2 ${
                  errors.name
                    ? 'border-red-500'
                    : isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-medium text-white transition-all ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? 'Adding...' : 'Add Mill'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}