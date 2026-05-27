'use client';

import { useState } from 'react';
import { 
  XMarkIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';

interface PartyModalProps {
  onClose: () => void;
  onSuccess: (newPartyData?: any) => void;
}

interface PartyFormData {
  name: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function PartyModal({ onClose, onSuccess }: PartyModalProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const [formData, setFormData] = useState<PartyFormData>({
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
      newErrors.name = 'Party name is required';
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
      
      // ⚡ FIX: Ensure token exists before making request
      if (!token) {
        setValidationMessage({ 
          type: 'error', 
          text: 'Session expired. Please log in again.' 
        });
        setLoading(false);
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 1500);
        return;
      }

      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const responseData = await response.json();
        const newParty = responseData.data; // Extract the party data from the response
        
        // Debug logging
        // Party creation response
        // Extracted party data
        
        if (!newParty || !newParty._id || !newParty.name) {
          setValidationMessage({ 
            type: 'error', 
            text: 'Invalid party data received from server' 
          });
          return;
        }
        
        setValidationMessage({ type: 'success', text: 'Party created successfully!' });
        setTimeout(() => {
          onSuccess(newParty);
        }, 1500);
      } else {
        // Handle unauthorized errors
        if (response.status === 401) {
          setValidationMessage({ 
            type: 'error', 
            text: 'Session expired. Please log in again.' 
          });
          setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }, 1500);
          return;
        }
        
        const errorData = await response.json().catch(() => ({ message: 'Failed to create party' }));
        setValidationMessage({ 
          type: 'error', 
          text: errorData.message || 'Failed to create party' 
        });
      }
    } catch (error) {
      setValidationMessage({ 
        type: 'error', 
        text: 'An error occurred while creating the party' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getFieldError = (field: string) => {
    return errors[field] || '';
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl shadow-2xl bg-white border border-gray-200 max-h-[98vh] overflow-hidden flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl ${isClosing ? 'modal-exit' : 'modal-enter'} ${
        isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
      } max-h-[98vh] overflow-hidden`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${
          isDarkMode ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isDarkMode 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                : 'bg-gradient-to-br from-green-600 to-emerald-700'
            }`}>
              <BuildingOfficeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Add New Party
              </h2>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Create a new party
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-all duration-300 ${
              isDarkMode
                ? 'text-gray-400 hover:bg-white/10 hover:text-gray-300'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Validation Message */}
        {validationMessage && (
          <div className={`mx-6 mt-4 p-4 rounded-lg border ${
            validationMessage.type === 'success'
              ? isDarkMode
                ? 'bg-green-900/20 border-green-500/30 text-green-400'
                : 'bg-green-50 border-green-200 text-green-800'
              : isDarkMode
                ? 'bg-red-900/20 border-red-500/30 text-red-400'
                : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {validationMessage.type === 'success' ? (
                <CheckIcon className="h-4 w-4 mr-2" />
              ) : (
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              )}
              {validationMessage.text}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Party Name - Only Field */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Party Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                getFieldError('name')
                  ? 'border-red-500'
                  : isDarkMode
                    ? 'bg-white/10 border-white/20 text-white focus:border-green-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
              }`}
              placeholder="Enter party name"
            />
            {getFieldError('name') && (
              <p className="mt-1 text-sm text-red-500">{getFieldError('name')}</p>
            )}
          </div>

          {/* Footer */}
          <div className={`flex justify-end space-x-3 pt-4 border-t ${
            isDarkMode ? 'border-slate-700' : 'border-gray-200'
          }`}>
            <button
              type="button"
              onClick={handleClose}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                isDarkMode
                  ? 'text-gray-300 hover:bg-white/10'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                loading
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105 active:scale-95'
              } ${
                isDarkMode
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </div>
              ) : (
                'Create Party'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

