'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Hash, CheckCircle, Trash2, Plus, Edit3, BeakerIcon, Clock, FileText } from 'lucide-react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useSession } from '../../hooks/useSession';
import { OrderItem } from '@/types';
import { ChevronDownIcon, CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getDisplayOrderId } from '@/utils/orders';

// Utility function to format date as dd/mm/yyyy
const formatDateDisplay = (dateString: string | undefined | null): string => {
  if (!dateString) return 'Not provided';

  // Handle YYYY-MM-DD format directly (avoid timezone issues)
  const yyyyMmDdMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch;
    return `${day}/${month}/${year}`;
  }

  // Handle ISO strings with time
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  // Fallback: parse as date
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // Invalid date
  }

  return dateString;
};

interface LabData {
  color?: string;
  shade?: string;
  notes?: string;
  imageUrl?: string;
  labSendDate?: string;
  approvalDate?: string;
  sampleNumber?: string;
  labSendNumber?: string;
  status?: string;
  remarks?: string;
}

interface LabDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    _id: string;
    orderId: string;
    orderType?: string;
    items: OrderItem[];
  };
  onLabDataUpdate: (operationType?: 'add' | 'edit' | 'delete' | 'deleteAll') => void;
  readOnly?: boolean;
}

// Custom Date Picker Component (from OrderForm)
function CustomDatePicker({
  value,
  onChange,
  placeholder,
  isDarkMode,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDarkMode: boolean;
  disabled?: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [inputValue, setInputValue] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Format date for display (dd/mm/yyyy) - properly handle YYYY-MM-DD format
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';

    // Handle YYYY-MM-DD format directly (avoid timezone issues)
    const yyyyMmDdMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyyMmDdMatch) {
      const [, year, month, day] = yyyyMmDdMatch;
      return `${day}/${month}/${year}`;
    }

    // Handle ISO strings with time - extract only the date part
    const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }

    // Fallback: try to parse as date
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      // Invalid date
    }

    return dateString;
  };

  // Parse date from display format (dd/mm/yyyy) to YYYY-MM-DD
  const parseDateFromDisplay = (inputValue: string) => {
    if (!inputValue) return '';

    // Handle dd/mm/yyyy format
    const parts = inputValue.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      // Validate ranges
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) &&
        day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        // Create date in local timezone (month is 0-indexed in Date constructor)
        const date = new Date(year, month - 1, day);

        // Validate the date is correct (handles invalid dates like 31/02/2024)
        if (date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year) {
          // Format as YYYY-MM-DD without timezone conversion
          const yearStr = String(year);
          const monthStr = String(month).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          return `${yearStr}-${monthStr}-${dayStr}`;
        }
      }
    }

    return '';
  };

  // Format date to YYYY-MM-DD for comparison (no timezone issues)
  const formatDateForComparison = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (date: Date) => {
    // Format date as YYYY-MM-DD directly without timezone conversion
    const formattedDate = formatDateForComparison(date);

    onChange(formattedDate);
    setInputValue(formatDateForDisplay(formattedDate));
    setShowCalendar(false);
    setShowMonthPicker(false);
    setShowYearPicker(false);
  };

  const clearDate = () => {
    onChange('');
    setInputValue('');
    setShowCalendar(false);
  };

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(formatDateForDisplay(value));
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node) &&
        dateInputRef.current && !dateInputRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showCalendar) {
      setShowCalendar(false);
    } else if (e.key === 'Escape') {
      setShowCalendar(false);
    } else if (e.key === 'Tab') {
      setShowCalendar(false);
    }
  };

  // Prevent form validation when interacting with calendar
  const handleCalendarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      // Create date object with explicit year, month, day to avoid timezone issues
      const dayDate = new Date(year, month, i);
      days.push(dayDate);
    }
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={dateInputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value;
            setInputValue(value);
            // Only try to parse if it looks like a complete date
            if (value.length >= 8) {
              const parsedDate = parseDateFromDisplay(value);
              if (parsedDate) {
                onChange(parsedDate);
              }
            } else {
              onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="dd/mm/yyyy"
          onFocus={() => !disabled && setShowCalendar(true)}
          className={`w-full px-4 py-3 pr-12 text-base rounded-lg border-2 ${isDarkMode
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {!disabled && value && (
            <button
              type="button"
              onClick={clearDate}
              className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'
                }`}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setShowCalendar(!showCalendar)}
            className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'
              }`}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showCalendar && createPortal(
        <div
          ref={calendarRef}
          onClick={handleCalendarClick}
          className={`fixed z-[9999] p-3 rounded-lg border-2 shadow-xl calendar-container date-picker min-w-[260px] max-w-[260px] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
            }`}
          style={{
            top: dateInputRef.current ? `${dateInputRef.current.getBoundingClientRect().top - 8}px` : '50%',
            left: dateInputRef.current ? `${dateInputRef.current.getBoundingClientRect().left}px` : '50%',
            transform: dateInputRef.current ? 'translateY(-100%)' : 'translate(-50%, -50%)'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
                setShowMonthPicker(false);
                setShowYearPicker(false);
              }}
              className={`p-1.5 rounded-lg hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              <ChevronDownIcon className="h-4 w-4 transform rotate-90" />
            </button>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMonthPicker(!showMonthPicker);
                  setShowYearPicker(false);
                }}
                className={`px-2.5 py-1 rounded-lg hover:bg-opacity-80 transition-colors text-xs font-semibold ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
                  }`}
              >
                {monthNames[currentDate.getMonth()].slice(0, 3)}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowYearPicker(!showYearPicker);
                  setShowMonthPicker(false);
                }}
                className={`px-2.5 py-1 rounded-lg hover:bg-opacity-80 transition-colors text-xs font-semibold ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
                  }`}
              >
                {currentDate.getFullYear()}
              </button>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
                setShowMonthPicker(false);
                setShowYearPicker(false);
              }}
              className={`p-1.5 rounded-lg hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              <ChevronDownIcon className="h-4 w-4 transform -rotate-90" />
            </button>
          </div>

          {/* Month Picker */}
          {showMonthPicker && (
            <div className={`mb-3 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}>
              <div className="grid grid-cols-3 gap-1">
                {monthNames.map((month, index) => (
                  <button
                    key={month}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentDate(new Date(currentDate.getFullYear(), index));
                      setShowMonthPicker(false);
                      setShowYearPicker(false);
                    }}
                    className={`p-1.5 text-xs rounded transition-colors ${index === currentDate.getMonth()
                        ? 'bg-blue-500 text-white'
                        : isDarkMode
                          ? 'hover:bg-gray-600 text-white'
                          : 'hover:bg-gray-200 text-gray-900'
                      }`}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Year Picker */}
          {showYearPicker && (
            <div className={`mb-3 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => currentDate.getFullYear() - 5 + i).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentDate(new Date(year, currentDate.getMonth()));
                      setShowYearPicker(false);
                      setShowMonthPicker(false);
                    }}
                    className={`p-1.5 text-xs rounded transition-colors ${year === currentDate.getFullYear()
                        ? 'bg-blue-500 text-white'
                        : isDarkMode
                          ? 'hover:bg-gray-600 text-white'
                          : 'hover:bg-gray-200 text-gray-900'
                      }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-0.5 mb-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`text-center text-xs font-medium p-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                {day.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, index) => {
              if (!day) return <div key={index} />;

              const dayFormatted = formatDateForComparison(day);
              const todayFormatted = formatDateForComparison(new Date());
              const isToday = dayFormatted === todayFormatted;
              const isSelected = value === dayFormatted;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDateSelect(day);
                  }}
                  className={`p-1.5 text-xs rounded transition-colors ${isToday
                      ? 'bg-blue-500 text-white font-semibold' :
                      isSelected
                        ? isDarkMode
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-blue-100 text-blue-700 font-semibold' :
                        `hover:bg-opacity-80 ${isDarkMode
                          ? 'text-white hover:bg-gray-700'
                          : 'text-gray-900 hover:bg-gray-200'
                        }`
                    }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function LabDataModal({ isOpen, onClose, order, onLabDataUpdate, readOnly = false }: LabDataModalProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const { isMaster } = useSession();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [labData, setLabData] = useState<LabData>({
    labSendDate: '',
    approvalDate: '',
    sampleNumber: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [localItems, setLocalItems] = useState<OrderItem[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Memoize computed values for performance
  const hasLabData = useMemo(() =>
    localItems.some(item => item.labData?.labSendDate),
    [localItems]
  );

  // Cache invalidation function for instant updates
  const invalidateLabCache = useCallback(() => {
    const cacheKey = `lab_data_${order._id}`;
    localStorage.removeItem(cacheKey);
    console.log('🗑️ Lab cache invalidated for instant refresh');
  }, [order._id]);

  // Function to fetch existing lab data from API - ULTRA FAST
  const fetchExistingLabData = useCallback(async (forceRefresh = false) => {
    console.log('📡 Fetching existing lab data for order:', order._id, 'forceRefresh:', forceRefresh);
    setLoadingData(true);
    setError(''); // Clear any previous errors

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

      const response = await fetch(`/api/labs/by-order/${order._id}?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
          // ⚡ CRITICAL FIX: Update local items with fresh lab data from API
          // Match lab data to items by orderItemId to ensure all lab data is preserved
          const updatedItems = order.items.map(item => {
            const labData = data.data.find((lab: any) => {
              const labItemId = lab.orderItemId?.toString();
              const itemId = item._id?.toString();
              return labItemId === itemId;
            });

            if (labData) {
              return {
                ...item,
                labData: {
                  labSendDate: labData.labSendDate || null,
                  approvalDate: labData.labSendData?.approvalDate || null,
                  sampleNumber: labData.labSendData?.sampleNumber || '',
                  color: labData.labSendData?.color || '',
                  shade: labData.labSendData?.shade || '',
                  notes: labData.labSendData?.notes || '',
                  imageUrl: labData.labSendData?.imageUrl || '',
                  labSendNumber: labData.labSendNumber || '',
                  status: labData.status || 'sent',
                  remarks: labData.remarks || ''
                }
              };
            } else {
              // No lab data for this item - keep item but no lab data
              return {
                ...item,
                labData: undefined
              };
            }
          });
          console.log('✅ Lab data loaded successfully:', {
            itemsCount: updatedItems.length,
            itemsWithLabData: updatedItems.filter(item => item.labData?.labSendDate).length,
            labDataFromAPI: data.data.length
          });
          setLocalItems(updatedItems);
        } else {
          // No lab data found - initialize with clean items
          console.log('⚠️ No lab data found in API response');
          const updatedItems = order.items.map(item => ({
            ...item,
            labData: undefined
          }));
          setLocalItems(updatedItems);
        }
      } else if (response.status === 401) {
        throw new Error('Session expired. Please login again.');
      } else if (response.status === 404) {
        // No lab data found - this is normal for new orders
        console.log('⚠️ 404 - No lab data found (normal for new orders)');
        const updatedItems = order.items.map(item => ({
          ...item,
          labData: undefined
        }));
        setLocalItems(updatedItems);
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Error fetching lab data:', error);

      if (error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else if (error.message.includes('Session expired')) {
        setError('Session expired. Please login again.');
      } else if (error.message.includes('Server error')) {
        setError('Server error. Please try again later.');
      } else {
        setError('Failed to load lab data. Please try again.');
      }

      // Use existing order data as fallback
      setLocalItems(order.items);
    } finally {
      setLoadingData(false);
    }
  }, [order._id, order.items]);

  // Initialize local items when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 Lab Modal Opening:', {
        orderId: order._id,
        itemsCount: order.items.length,
        itemsWithLabData: order.items.filter(item => item.labData?.labSendDate).length
      });

      // ⚡ FIX: Always fetch lab data from API to ensure we have the latest data
      // This is especially important after order updates, as the order object
      // might not have lab data attached even though it exists in the database
      setLoadingData(true);

      // Start with order items (preserve any lab data that might be attached)
      setLocalItems(order.items);
      setEditingItemId(null);
      setLabData({
        labSendDate: '', // Empty by default
        approvalDate: '',
        sampleNumber: ''
      });
      setError('');
      setSuccessMessage('');
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      setShowDeleteAllConfirm(false);

      // ⚡ FIX: Always fetch from API to get the latest lab data
      // This ensures lab data is shown even after order updates
      console.log('📊 Fetching lab data from API to ensure latest data is shown');
      fetchExistingLabData(true).catch((error) => {
        console.error('Error fetching lab data on modal open:', error);
        // If fetch fails, still show the items (they might have lab data from order object)
        setLocalItems(order.items);
        setLoadingData(false);
      });
    }
  }, [isOpen, order._id, order.items.length, fetchExistingLabData]); // ⚡ FIX: Include fetchExistingLabData in dependencies

  // Load lab data when item is selected for editing
  const handleEditLabData = async (item: OrderItem) => {
    setEditingItemId(item._id || '');
    setError('');
    setSuccessMessage('');

    // Find the item in localItems (which has fresh data from API)
    const localItem = localItems.find(localItem => localItem._id === item._id);

    // Check if item already has lab data (check for labSendDate instead of sampleNumber)
    if (localItem?.labData?.labSendDate) {
      // Existing lab data found - load it
      setLabData({
        labSendDate: localItem.labData.labSendDate || '',
        approvalDate: localItem.labData.approvalDate || '',
        sampleNumber: localItem.labData.sampleNumber || ''
      });
    } else {
      // New lab data - initialize with empty values
      setLabData({
        labSendDate: '',
        approvalDate: '',
        sampleNumber: ''
      });
    }
  };

  // Save lab data with immediate UI update
  const handleSave = async () => {
    if (!editingItemId) {
      setError('No item selected for editing');
      return;
    }

    // Validate required fields
    if (!labData.labSendDate) {
      setError('Lab Send Date is required');
      return;
    }

    // Validate date format
    const labSendDate = new Date(labData.labSendDate);
    if (isNaN(labSendDate.getTime())) {
      setError('Invalid lab send date format');
      return;
    }

    // Validate approval date if provided
    if (labData.approvalDate) {
      const approvalDate = new Date(labData.approvalDate);
      if (isNaN(approvalDate.getTime())) {
        setError('Invalid approval date format');
        return;
      }
      if (approvalDate < labSendDate) {
        setError('Approval date cannot be before lab send date');
        return;
      }
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/labs/${order._id}/${editingItemId || 'item_0'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          labSendDate: labData.labSendDate,
          approvalDate: labData.approvalDate || null,
          sampleNumber: labData.sampleNumber?.trim() || ''
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please login again.');
        } else if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Invalid data provided');
        } else if (response.status === 404) {
          throw new Error('Order or item not found');
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const result = await response.json();

      if (result.success) {
        // ⚡ OPTIMIZED: Immediately update local state for instant UX
        setLocalItems(prevItems =>
          prevItems.map(item =>
            item._id === editingItemId
              ? {
                ...item,
                labData: {
                  labSendDate: labData.labSendDate,
                  approvalDate: labData.approvalDate,
                  sampleNumber: labData.sampleNumber,
                  color: '',
                  shade: '',
                  notes: '',
                  imageUrl: '',
                  labSendNumber: '',
                  status: 'sent',
                  remarks: ''
                }
              }
              : item
          )
        );

        // Show success message
        setSuccessMessage('Lab data saved successfully!');

        // Invalidate cache for instant refresh
        invalidateLabCache();

        // ⚡ OPTIMIZED: Refresh in background (non-blocking)
        fetchExistingLabData(true).catch(() => {
          // Silent fail - we already updated local state
        });

        // ⚡ OPTIMIZED: Close editing mode immediately (no delay)
        setEditingItemId(null);
        setLabData({
          labSendDate: '',
          approvalDate: '',
          sampleNumber: ''
        });

        // Clear success message after brief display
        setTimeout(() => {
          setSuccessMessage('');
        }, 1000);

        // Notify parent component
        onLabDataUpdate('edit');
      } else {
        setError(result.message || 'Failed to save lab data');
      }
    } catch (err: any) {
      console.error('Error saving lab data:', err);
      setError(err.message || 'Failed to save lab data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show delete confirmation modal
  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId);
    setShowDeleteConfirm(true);
  };

  // Delete lab data with immediate UI update
  const handleDelete = async () => {
    if (!itemToDelete) {
      setError('No item selected for deletion');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    setShowDeleteConfirm(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/labs/${order._id}/${itemToDelete || 'item_0'}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please login again.');
        } else if (response.status === 404) {
          throw new Error('Lab data not found');
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const result = await response.json();

      if (result.success) {
        // Invalidate cache for instant refresh
        invalidateLabCache();

        // Immediately update local state to show "Edit Lab Data" button
        setLocalItems(prevItems =>
          prevItems.map(item =>
            item._id === itemToDelete
              ? { ...item, labData: undefined }
              : item
          )
        );

        // Close editing if this was the item being edited
        if (editingItemId === itemToDelete) {
          setEditingItemId(null);
          setLabData({
            labSendDate: '',
            approvalDate: '',
            sampleNumber: ''
          });
        }

        // Show success message
        setSuccessMessage('Lab data deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);

        // Notify parent component
        onLabDataUpdate('delete');
      } else {
        setError(result.message || 'Failed to delete lab data');
      }
    } catch (err: any) {
      console.error('Error deleting lab data:', err);
      setError(err.message || 'Failed to delete lab data. Please try again.');
    } finally {
      setIsLoading(false);
      setItemToDelete(null);
    }
  };

  // Cancel delete confirmation
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  // Show delete all confirmation modal
  const handleDeleteAllClick = () => {
    setShowDeleteAllConfirm(true);
  };

  // Delete all lab data for the order
  const handleDeleteAll = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    setShowDeleteAllConfirm(false);

    try {
      const response = await fetch(`/api/labs/delete-by-order/${order._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Invalidate cache for instant refresh
        invalidateLabCache();

        // Immediately update local state - remove all lab data to show "Edit Lab Data" buttons
        setLocalItems(prevItems =>
          prevItems.map(item => ({ ...item, labData: undefined }))
        );

        // Close any editing mode
        setEditingItemId(null);
        setLabData({
          labSendDate: '',
          approvalDate: '',
          sampleNumber: ''
        });

        // Show success message
        setSuccessMessage('All lab data deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);

        // Notify parent component with force refresh
        onLabDataUpdate('deleteAll');
      } else {
        setError(result.message || 'Failed to delete all lab data');
      }
    } catch (err) {
      setError('Failed to delete all lab data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel delete all confirmation
  const handleCancelDeleteAll = () => {
    setShowDeleteAllConfirm(false);
  };

  // Clear date field
  const clearDate = (field: 'labSendDate' | 'approvalDate') => {
    setLabData(prev => ({
      ...prev,
      [field]: ''
    }));
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setLabData({
      labSendDate: '',
      approvalDate: '',
      sampleNumber: ''
    });
    setError('');
    setSuccessMessage('');
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Handle scroll prevention on modal content
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modalContent = modalContentRef.current;
    if (!modalContent || !isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = modalContent;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // If scrolling up at top or down at bottom, prevent default to stop background scroll
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
      }
    };

    modalContent.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      modalContent.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
      <div ref={modalContentRef} className={`relative w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-xl shadow-2xl ${isClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
        }`}>
        {/* ⚡ FIX: Better loading indicator with descriptive message */}
        {loadingData && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <div className="flex flex-col">
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Loading Lab Data...
                  </span>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Please wait while we fetch the lab information
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-lg font-bold ${isDarkMode
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-blue-100 text-blue-700'
              }`}>
              {getDisplayOrderId(order.orderId)}
            </span>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
              Lab Data
            </h2>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              }`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Global Success/Error Messages */}
        {successMessage && (
          <div className={`mx-6 mt-4 p-4 rounded-lg border ${isDarkMode
              ? 'bg-green-900/20 border-green-500/30 text-green-400'
              : 'bg-green-50 border-green-200 text-green-800'
            }`}>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              {successMessage}
            </div>
          </div>
        )}

        {error && (
          <div className={`mx-6 mt-4 p-4 rounded-lg border ${isDarkMode
              ? 'bg-red-900/20 border-red-500/30 text-red-400'
              : 'bg-red-50 border-red-200 text-red-800'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                {error}
              </div>
              {error.includes('Failed to load lab data') && (
                <button
                  onClick={() => fetchExistingLabData(true)}
                  disabled={loadingData}
                  className={`ml-4 px-3 py-1 rounded text-sm font-medium transition-colors ${isDarkMode
                      ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                    } disabled:opacity-50`}
                >
                  {loadingData ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className={`overflow-y-auto max-h-[calc(95vh-140px)] ${isDarkMode
            ? 'scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800'
            : 'scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-100'
          }`}>
          {/* <div className="p-6 space-y-6 pb-24"> */}
          {/* Items List */}
          <div className="space-y-4 p-4 pb-24">
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-800'
                }`}>
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Order Items ({localItems.length})
              </h3>


              {/* Delete All Lab Data Button */}
              {!readOnly && isMaster && hasLabData && (
                <button
                  onClick={handleDeleteAllClick}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                      ? 'bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 hover:border-red-500/50'
                      : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300'
                    }`}
                >
                  <Trash2 size={16} />
                  Delete All
                </button>
              )}
            </div>

            <div className="grid gap-4">
              {loadingData ? (
                // Simple loading state
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">Loading lab data...</span>
                  </div>
                </div>
              ) : (
                localItems.map((item, index) => (
                  <div key={item._id} className={`rounded-xl border overflow-hidden shadow-sm ${isDarkMode
                      ? 'bg-white/5 border-white/20'
                      : 'bg-white border-gray-200'
                    }`}>
                    {/* Item Header */}
                    <div className={`px-4 py-3 border-b ${isDarkMode
                        ? 'bg-white/10 border-white/20'
                        : 'bg-gray-50 border-gray-200'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'
                              }`}>
                              Item {index + 1}
                            </h4>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                              }`}>
                              {(typeof item.quality === 'object' ? item.quality?.name : item.quality) || 'No Quality'} • {item.quantity} pcs
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditLabData(item)}
                            disabled={isLoading || loadingData || (readOnly && !item.labData?.labSendDate)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isDarkMode
                                ? 'bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/30 hover:border-amber-500/50'
                                : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
                              }`}
                          >
                            {isLoading ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <BeakerIcon className="h-4 w-4" />
                            )}
                            {isLoading ? 'Loading Lab Data...' : item.labData?.labSendDate ? (readOnly ? 'View Lab' : 'Edit Lab') : (readOnly ? 'No Lab Data' : 'Add Lab')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Lab Data Display */}
                    {item.labData?.labSendDate && (
                      <div className={`p-4 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
                        }`}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>Sample:</span>
                            <p className={isDarkMode ? 'text-white' : 'text-gray-800'}>
                              {item.labData?.sampleNumber || 'Not provided'}
                            </p>
                          </div>
                          {item.labData?.labSendDate && (
                            <div>
                              <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>Send Date:</span>
                              <p className={isDarkMode ? 'text-white' : 'text-gray-800'}>
                                {formatDateDisplay(item.labData?.labSendDate)}
                              </p>
                            </div>
                          )}
                          {item.labData?.approvalDate && (
                            <div>
                              <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>Approval:</span>
                              <p className={isDarkMode ? 'text-white' : 'text-gray-800'}>
                                {formatDateDisplay(item.labData?.approvalDate)}
                              </p>
                            </div>
                          )}
                          {!readOnly && isMaster && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteClick(item._id || '')}
                                disabled={isLoading}
                                className="flex items-center gap-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Lab Data Form (Inline) */}
                    {editingItemId === item._id && (
                      <div className={`p-6 border-t ${isDarkMode
                          ? 'bg-yellow-900/10 border-yellow-700/30'
                          : 'bg-yellow-50 border-yellow-200'
                        }`}>
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h5 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'
                              }`}>
                              {localItems.find(li => li._id === item._id)?.labData?.labSendDate ? 'Edit Lab Data' : 'Add Lab Data'}
                            </h5>
                            <button
                              onClick={handleCancelEdit}
                              className={`p-2 rounded-lg transition-colors ${isDarkMode
                                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                              <X size={20} />
                            </button>
                          </div>

                          {/* Form Fields Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Lab Send Date */}
                            <div>
                              <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Lab Send Date <span className="text-red-500">*</span>
                              </label>
                              <CustomDatePicker
                                value={labData.labSendDate || ''}
                                onChange={(value) => setLabData(prev => ({ ...prev, labSendDate: value }))}
                                placeholder="Select lab send date"
                                isDarkMode={isDarkMode}
                                disabled={readOnly}
                              />
                            </div>

                            {/* Approval Date */}
                            <div>
                              <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Approval Date
                              </label>
                              <CustomDatePicker
                                value={labData.approvalDate || ''}
                                onChange={(value) => setLabData(prev => ({ ...prev, approvalDate: value }))}
                                placeholder="Select approval date"
                                isDarkMode={isDarkMode}
                                disabled={readOnly}
                              />
                            </div>

                            {/* Sample Number */}
                            <div>
                              <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Sample Number
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={labData.sampleNumber}
                                  onChange={(e) => setLabData(prev => ({ ...prev, sampleNumber: e.target.value }))}
                                  placeholder="Enter sample number"
                                  disabled={readOnly}
                                  className={`w-full px-4 py-3 pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                      ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                      : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                    }`}
                                />
                                <Hash size={20} className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`} />
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons - Right Aligned */}
                          <div className="flex gap-4 pt-4 justify-end">
                            <button
                              onClick={handleCancelEdit}
                              className={`px-6 py-3 border rounded-lg font-medium transition-all duration-200 hover:scale-105 ${isDarkMode
                                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              {readOnly ? 'Close' : 'Cancel'}
                            </button>
                            {!readOnly && (
                              <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${isLoading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : isDarkMode
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                                      : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
                                  }`}
                              >
                                {isLoading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle size={16} />
                                    {localItems.find(li => li._id === item._id)?.labData?.labSendDate ? 'Update Lab Data' : 'Save Lab Data'}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-lg border ${isDarkMode
                    ? 'bg-red-600/20 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                  }`}>
                  <Trash2 className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`} />
                </div>
                <h3 className="text-lg font-semibold">Delete Lab Data</h3>
              </div>
              <button
                onClick={handleCancelDelete}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                  }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                  Are you sure you want to delete this lab data? This action cannot be undone.
                </p>

                <div className={`p-4 rounded-lg border ${isDarkMode
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`} />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'
                      }`}>
                      This will permanently remove all lab data for this item.
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                    }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Lab Data
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelDelete}
                  disabled={isLoading}
                  className={`px-6 py-3 border rounded-lg font-medium transition-all duration-200 hover:scale-105 ${isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Lab Data Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-lg border ${isDarkMode
                    ? 'bg-red-600/20 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                  }`}>
                  <Trash2 className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`} />
                </div>
                <h3 className="text-lg font-semibold">Delete All</h3>
              </div>
              <button
                onClick={handleCancelDeleteAll}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                  }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                  Are you sure you want to delete ALL lab data for this order? This action cannot be undone and will remove lab data from all {localItems.length} item{localItems.length !== 1 ? 's' : ''}.
                </p>

                <div className={`p-4 rounded-lg border ${isDarkMode
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`} />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'
                      }`}>
                      This will permanently remove all lab data for this entire order.
                    </span>
                  </div>
                </div>

                {/* Items with lab data count */}
                <div className={`p-3 rounded-lg border ${isDarkMode
                    ? 'bg-amber-900/20 border-amber-500/30'
                    : 'bg-amber-50 border-amber-200'
                  }`}>
                  <div className="flex items-center">
                    <BeakerIcon className={`h-4 w-4 mr-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'
                      }`} />
                    <span className={`text-sm ${isDarkMode ? 'text-amber-400' : 'text-amber-800'
                      }`}>
                      {localItems.filter(item => item.labData?.labSendDate).length} item{localItems.filter(item => item.labData?.labSendDate).length !== 1 ? 's' : ''} with lab data will be affected
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  onClick={handleDeleteAll}
                  disabled={isLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                    }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting All...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete All
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelDeleteAll}
                  disabled={isLoading}
                  className={`px-6 py-3 border rounded-lg font-medium transition-all duration-200 hover:scale-105 ${isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
