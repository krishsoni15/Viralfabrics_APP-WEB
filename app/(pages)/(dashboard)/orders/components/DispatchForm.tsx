'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  XMarkIcon,
  PlusIcon,
  CalendarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  TrashIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { FileText } from 'lucide-react';
import { Order } from '@/types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { createPortal } from 'react-dom';
import { getDisplayOrderId } from '@/utils/orders';

// Enhanced Dropdown Component (copied from MillOutputForm)
interface EnhancedDropdownProps {
  options: any[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onSelect: (option: any) => void;
  isDarkMode: boolean;
  error?: string;
  recentlyAddedId?: string;
  qualities?: any[];
}

const EnhancedDropdown: React.FC<EnhancedDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder,
  searchValue,
  onSearchChange,
  showDropdown,
  onToggleDropdown,
  onSelect,
  isDarkMode,
  error,
  recentlyAddedId,
  qualities
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest('.calendar-container') || target.closest('.date-picker')) {
          return;
        }
        if (showDropdown) {
          onToggleDropdown();
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, onToggleDropdown]);

  // Helper function to get quality ID
  const getQualityId = (quality: any) => {
    return quality?._id || quality?.id || quality;
  };
  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={searchValue || (value && qualities ? qualities.find(q => getQualityId(q) === value)?.name || '' : '')}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onToggleDropdown}
          placeholder={placeholder}
          className={`w-full px-4 py-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${error
            ? isDarkMode
              ? 'border-red-500 bg-gray-800 text-white'
              : 'border-red-500 bg-white text-gray-900'
            : isDarkMode
              ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
              : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
            }`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {/* Clear button */}
          {(searchValue || (value && qualities ? qualities.find(q => getQualityId(q) === value)?.name : '')) && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSearchChange('');
                onChange('');
                // Close dropdown when clearing
                if (showDropdown) {
                  onToggleDropdown();
                }
              }}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          {/* Dropdown toggle button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleDropdown();
            }}
            className={`p-1 rounded transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <svg className={`w-5 h-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {showDropdown && (
        <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-y-auto dropdown-enter ${isDarkMode
          ? 'bg-gray-800 border-gray-600'
          : 'bg-white border-gray-300'
          }`}>
          {Array.isArray(options) && options.length > 0 ? (
            options.map((option) => (
              <div
                key={option._id || option.id}
                onClick={() => onSelect(option)}
                className={`px-4 py-3 cursor-pointer transition-colors border-b ${isDarkMode
                  ? 'border-gray-700 hover:bg-gray-700'
                  : 'border-gray-200 hover:bg-gray-50'
                  } ${recentlyAddedId === (option._id || option.id)
                    ? isDarkMode
                      ? 'bg-blue-900/30 text-blue-300'
                      : 'bg-blue-50 text-blue-700'
                    : isDarkMode
                      ? 'text-white'
                      : 'text-gray-900'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{option.name}</span>
                  {recentlyAddedId === (option._id || option.id) && (
                    <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode
                      ? 'bg-blue-700 text-blue-200'
                      : 'bg-blue-100 text-blue-600'
                      }`}>
                      New
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={`px-4 py-3 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
              No options found. Try adjusting your search.
            </div>
          )}
        </div>
      )}

      {error && (
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
          }`}>
          {error}
        </p>
      )}
    </div>
  );
};

interface DispatchSubItem {
  id: string;
  _id?: string; // Database ID for existing records
  finishMtr: string;
  quality: string;
}

interface DispatchFormData {
  orderId: string;
  dispatchItems: DispatchItem[];
}

interface DispatchItem {
  id: string;
  dispatchDate: string;
  billNo: string;
  transportNo?: string;
  lrNo?: string;
  finishMtr: string;
  quality: string;
  subItems?: DispatchSubItem[];
}

interface DispatchFormProps {
  order: Order | null;
  onClose: () => void;
  onSuccess: (operationType?: 'add' | 'edit' | 'delete') => void;
  onRefreshQualities?: () => void; // Add quality refresh function
  isOpen?: boolean; // Add isOpen prop like LabDataModal
  isEditing?: boolean;
  existingDispatches?: any[];
  qualities?: any[];
}

interface ValidationErrors {
  [key: string]: string;
}

// Custom Date Picker Component (from LabDataModal)
function CustomDatePicker({
  value,
  onChange,
  placeholder,
  isDarkMode
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDarkMode: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [inputValue, setInputValue] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Format date for display (dd/mm/yyyy)
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';

    // Handle YYYY-MM-DD format directly to avoid timezone issues
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy format
  };

  // Use the shared date parsing function
  const parseDateFromDisplay = (inputValue: string) => {
    if (!inputValue) return '';

    // Handle dd/mm/yyyy format
    const parts = inputValue.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);

      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          // Fix timezone issue by using local date instead of UTC
          const yearStr = String(date.getFullYear());
          const monthStr = String(date.getMonth() + 1).padStart(2, '0');
          const dayStr = String(date.getDate()).padStart(2, '0');
          return `${yearStr}-${monthStr}-${dayStr}`;
        }
      }
    }

    return '';
  };

  const handleDateSelect = (date: Date) => {
    // Fix timezone issue by using local date instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

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
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
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
          onFocus={() => setShowCalendar(true)}
          required
          className={`w-full p-3 pr-12 rounded-lg border ${isDarkMode
            ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {value && (
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
            onClick={() => setShowCalendar(!showCalendar)}
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
          className={`fixed z-9999999 p-2 rounded-lg border shadow-2xl calendar-container date-picker max-w-xs ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
            }`}
          style={{
            top: dateInputRef.current ? dateInputRef.current.getBoundingClientRect().bottom - 0 : '50%',
            left: dateInputRef.current ? dateInputRef.current.getBoundingClientRect().left : '50%',
            transform: dateInputRef.current ? 'translateY(0)' : 'translate(-50%, -50%)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
              }}
              className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}
            >
              <ChevronDownIcon className="h-4 w-4 transform rotate-90" />
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMonthPicker(!showMonthPicker);
                }}
                className={`px-3 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}
              >
                {monthNames[currentDate.getMonth()]}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowYearPicker(!showYearPicker);
                }}
                className={`px-3 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
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
              }}
              className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}
            >
              <ChevronDownIcon className="h-4 w-4 transform -rotate-90" />
            </button>
          </div>

          {/* Quick Navigation Buttons */}
          <div className="flex items-center justify-center gap-1 mb-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentDate(new Date());
              }}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${isDarkMode
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
            >
              Today
            </button>
          </div>

          {/* Month Picker */}
          {showMonthPicker && (
            <div className={`mb-4 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
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
                    className={`p-2 text-sm rounded-lg transition-colors ${index === currentDate.getMonth()
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
            <div className={`mb-4 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
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
                    className={`p-2 text-sm rounded-lg transition-colors ${year === currentDate.getFullYear()
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

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`text-center text-xs font-medium p-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  day && handleDateSelect(day);
                }}
                disabled={!day}
                className={`p-1 text-xs rounded-lg transition-colors ${!day ? 'invisible' :
                  day.toDateString() === new Date().toDateString()
                    ? 'bg-blue-500 text-white' :
                    value === day.toISOString().split('T')[0]
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      `hover:bg-gray-200 dark:hover:bg-white/10 ${isDarkMode ? 'text-white' : 'text-gray-900'
                      }`
                  }`}
              >
                {day?.getDate()}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function DispatchForm({
  order,
  onClose,
  onSuccess,
  onRefreshQualities,
  isOpen = true, // Default to true for backward compatibility
  isEditing = false,
  existingDispatches = [],
  qualities = []
}: DispatchFormProps) {
  const { isDarkMode, mounted } = useDarkMode();

  // Refresh qualities when form is opened
  useEffect(() => {
    if (isOpen && onRefreshQualities) {
      console.log('DispatchForm: Refreshing qualities on form open');
      onRefreshQualities();
    }
  }, [isOpen, onRefreshQualities]);

  // ⚡ FIX: Initialize localQualities from qualities prop when form opens
  useEffect(() => {
    if (isOpen && qualities && Array.isArray(qualities) && qualities.length > 0) {
      setLocalQualities(prev => {
        // Only initialize if localQualities is empty
        if (prev.length === 0) {
          console.log('🔄 DispatchForm: Initializing localQualities from prop on form open:', qualities.length, 'qualities');
          return qualities;
        }
        return prev;
      });
    }
  }, [isOpen, qualities]);

  const [formData, setFormData] = useState<DispatchFormData>({
    orderId: order?.orderId || '',
    dispatchItems: [{
      id: '1',
      dispatchDate: '',
      billNo: '',
      transportNo: '',
      lrNo: '',
      finishMtr: '',
      quality: '',
      subItems: [{
        id: '1_1',
        finishMtr: '',
        quality: ''
      }]
    }]
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [loadingExistingData, setLoadingExistingData] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // ⚡ FIX: Prevent multiple simultaneous operations
  const operationInProgressRef = useRef(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // LabDataModal pattern states
  const [hasExistingData, setHasExistingData] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // ⚡ CRITICAL: Track if we just updated to prevent reloading deleted items
  const justUpdatedRef = useRef(false);

  // ⚡ 100% FIX: Track if data has been fetched to prevent multiple loads
  const hasFetchedRef = useRef(false);

  // Quality dropdown state
  const [activeQualityDropdown, setActiveQualityDropdown] = useState<{ itemId: string } | null>(null);
  const [qualitySearchStates, setQualitySearchStates] = useState<{ [key: string]: string }>({});
  const [currentQualitySearch, setCurrentQualitySearch] = useState('');
  const [recentlyAddedQuality, setRecentlyAddedQuality] = useState<string | null>(null);

  // ⚡ FIX: Local qualities state to include newly added qualities
  const [localQualities, setLocalQualities] = useState<any[]>([]);

  // Sync local qualities with prop qualities
  useEffect(() => {
    if (qualities && Array.isArray(qualities)) {
      if (qualities.length === 0) {
        // If qualities prop is empty array, clear localQualities (all deleted)
        setLocalQualities([]);
      } else {
        setLocalQualities(prev => {
          // Use a Map to ensure we keep the latest version of each quality
          const qualityMap = new Map();

          // First, add prop qualities (these are the source of truth after deletion)
          qualities.forEach(quality => {
            const id = quality._id || (quality as any).id;
            if (id) {
              qualityMap.set(String(id), quality);
            }
          });

          // Then, add any local qualities that aren't in props (for newly created ones)
          prev.forEach(q => {
            const id = q._id || (q as any).id;
            if (id && !qualityMap.has(String(id))) {
              qualityMap.set(String(id), q);
            }
          });

          // Convert map back to array
          const merged = Array.from(qualityMap.values());
          console.log('🔄 DispatchForm: Synced localQualities with prop qualities:', merged.length, 'qualities');
          return merged;
        });
      }
    }
  }, [qualities]);

  // ⚡ FIX: Listen for qualityAdded and qualitiesRefreshed events to immediately update localQualities
  useEffect(() => {
    const handleQualityAdded = (event: any) => {
      const newQuality = event.detail?.quality;
      if (newQuality) {
        console.log('🎉 DispatchForm: Received qualityAdded event:', newQuality.name);

        // Clear cache immediately
        if (typeof window !== 'undefined') {
          localStorage.removeItem('qualities_cache');
        }

        // Update localQualities immediately
        setLocalQualities(prev => {
          const qualityId = newQuality._id || (newQuality as any).id;
          if (!qualityId) return prev;

          // Check if already exists
          const exists = prev.some(q => {
            const qId = q._id || (q as any).id;
            return String(qId) === String(qualityId);
          });

          if (!exists) {
            console.log('✅ Adding new quality to DispatchForm localQualities:', newQuality.name);
            return [newQuality, ...prev];
          }
          return prev;
        });
      }
    };

    // Listen for qualitiesRefreshed event to fetch fresh data
    const handleQualitiesRefreshed = async () => {
      console.log('🔄 DispatchForm: Received qualitiesRefreshed event, fetching fresh data...');

      // Clear cache
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qualities_cache');
      }

      // Fetch fresh qualities
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const qualitiesResponse = await fetch(`/api/qualities?t=${Date.now()}&limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          });

          if (qualitiesResponse.ok) {
            const qualitiesData = await qualitiesResponse.json();
            if (qualitiesData.success && Array.isArray(qualitiesData.data)) {
              setLocalQualities(qualitiesData.data);
              console.log('✅ DispatchForm: Refreshed qualities from server:', qualitiesData.data.length, 'qualities');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching fresh qualities:', error);
      }

      // Also call parent's refresh function
      if (onRefreshQualities) {
        onRefreshQualities();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('qualityAdded', handleQualityAdded);
      window.addEventListener('qualitiesRefreshed', handleQualitiesRefreshed);
      return () => {
        window.removeEventListener('qualityAdded', handleQualityAdded);
        window.removeEventListener('qualitiesRefreshed', handleQualitiesRefreshed);
      };
    }
  }, [onRefreshQualities]);

  // Update quality search states when qualities are loaded and form data exists
  useEffect(() => {
    if (qualities && qualities.length > 0 && formData.dispatchItems.length > 0) {
      console.log('Updating quality search states for dispatch form...');
      const newQualitySearchStates: { [key: string]: string } = {};

      formData.dispatchItems.forEach((item) => {
        item.subItems?.forEach((subItem: any) => {
          if (subItem.quality) {
            const qualityObj = qualities.find(q => (q._id || q.id) === subItem.quality);
            if (qualityObj) {
              newQualitySearchStates[subItem.id] = qualityObj.name;
            }
          }
        });
      });

      setQualitySearchStates(prev => ({ ...prev, ...newQualitySearchStates }));
    }
  }, [qualities, formData.dispatchItems]);

  // Function to fetch qualities directly from API
  const fetchQualitiesDirectly = async () => {
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No authentication token found');
        return;
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout for faster response

      const response = await fetch('/api/qualities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          console.log('Fetched qualities directly from API:', data.data);
          // Note: We can't directly set qualities here as it's a prop, but we can trigger parent refresh
          // This will be handled by the parent component's onRefreshMills function
        } else {
          console.log('No qualities found in API response');
        }
      } else {
        console.log('Failed to fetch qualities from API, status:', response.status);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Qualities fetch was aborted due to timeout');
      } else {
        console.error('Error fetching qualities from API:', error);
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  // Function to load existing dispatches from API data (fixed logic)
  // ⚡ 100% FIXED: Load existing dispatches from API data (memoized to prevent unnecessary re-renders)
  // ⚡ 100% FIX: Use useRef to store stable reference and prevent re-creation
  const loadExistingDispatchesFromDataRef = useRef<((dispatchesData: any[]) => Promise<void>) | null>(null);

  const loadExistingDispatchesFromData = useCallback(async (dispatchesData: any[]) => {
    // ⚡ 100% CRITICAL FIX: Don't load if we just updated - form state is already correct
    if (justUpdatedRef.current) {
      console.log('⏭️ SKIPPING loadExistingDispatchesFromData - form was just updated, keeping current state');
      setLoadingExistingData(false);
      return;
    }

    if (!order || dispatchesData.length === 0) {
      setHasExistingData(false);
      setLoadingExistingData(false);
      return;
    }

    try {
      // ⚡ FIX: Sort dispatches by createdAt (oldest first) before grouping
      const sortedDispatches = [...dispatchesData].sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB; // Ascending order (oldest first)
      });

      // Group dispatches by dispatchDate and billNo to create dispatch items
      const groupedDispatches = sortedDispatches.reduce((groups: any, dispatch: any) => {
        const key = `${dispatch.dispatchDate}_${dispatch.billNo}`;
        if (!groups[key]) {
          groups[key] = {
            dispatchDate: dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toISOString().split('T')[0] : '',
            billNo: dispatch.billNo,
            transportNo: dispatch.transportNo || '',
            lrNo: dispatch.lrNo || '',
            createdAt: dispatch.createdAt, // Store createdAt for sorting
            subItems: []
          };
        }
        // Add sub-item with database ID
        groups[key].subItems.push({
          _id: dispatch._id, // Store database ID for updates
          id: '', // Will be set when creating form data
          finishMtr: (dispatch.finishMtr || 0).toString(),
          quality: dispatch.quality?._id || dispatch.quality || ''
        });
        return groups;
      }, {});

      // ⚡ FIX: Sort group entries by createdAt (oldest first) before converting to form data
      const groupEntries = Object.entries(groupedDispatches).sort(([, a]: [string, any], [, b]: [string, any]) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB; // Ascending order (oldest first)
      });
      const newFormData = {
        orderId: order.orderId,
        dispatchItems: groupEntries.map(([key, group]: [string, any], index: number) => {
          // Use the first sub-item's data for the main dispatch item
          const firstSubItem = group.subItems[0];
          // Regenerate sub-item IDs with proper item index, preserving database IDs
          const subItemsWithIds = group.subItems.map((subItem: any, subIndex: number) => ({
            ...subItem,
            id: `${index + 1}_${subIndex + 1}`,
            _id: subItem._id // Preserve database ID
          }));
          return {
            id: (index + 1).toString(),
            dispatchDate: group.dispatchDate,
            billNo: group.billNo,
            transportNo: group.transportNo || '',
            lrNo: group.lrNo || '',
            finishMtr: firstSubItem ? firstSubItem.finishMtr : '',
            quality: firstSubItem ? firstSubItem.quality : '',
            subItems: subItemsWithIds
          };
        })
      };

      // ⚡ 100% FIX: Set form data immediately - no delays
      setFormData(newFormData);
      setHasExistingData(true);
      // ⚡ 100% FIX: Clear loading immediately after setting form data
      setLoadingExistingData(false);

      // Set quality search states for proper display
      const newQualitySearchStates: { [key: string]: string } = {};
      newFormData.dispatchItems.forEach((item) => {
        // Set main item quality search state
        if (item.quality) {
          const qualityObj = qualities?.find(q => (q._id || q.id) === item.quality);
          if (qualityObj) {
            newQualitySearchStates[item.id] = qualityObj.name;
          }
        }

        // Set sub-item quality search states
        item.subItems?.forEach((subItem: any) => {
          if (subItem.quality) {
            const qualityObj = qualities?.find(q => (q._id || q.id) === subItem.quality);
            if (qualityObj) {
              newQualitySearchStates[subItem.id] = qualityObj.name;
            }
          }
        });
      });
      setQualitySearchStates(newQualitySearchStates);
    } catch (error) {
      console.error('Error loading existing dispatches from API:', error);
      setHasExistingData(false);
      setLoadingExistingData(false); // ⚡ 100% FIX: Always clear loading on error
      hasFetchedRef.current = false; // Reset flag on error
    }
  }, [order, qualities]); // ⚡ 100% FIX: Memoize to prevent unnecessary re-renders

  // Function to fetch existing dispatch data from API (optimized for immediate display - 100% FIXED)
  const fetchExistingDispatchData = useCallback(async () => {
    // ⚡ 100% CRITICAL FIX: Don't fetch if we just updated - form state is already correct
    if (justUpdatedRef.current) {
      console.log('⏭️ SKIPPING fetch - form was just updated, keeping current state');
      setLoadingExistingData(false);
      hasFetchedRef.current = false; // Reset flag
      return;
    }

    // ⚡ 100% FIX: Mark as fetching immediately to prevent duplicate calls
    // This must be set BEFORE any early returns
    hasFetchedRef.current = true;

    if (!order?.orderId) {
      console.log('No order ID available for fetching dispatches');
      setHasExistingData(false);
      setLoadingExistingData(false);
      hasFetchedRef.current = false; // Reset flag
      return;
    }

    // Fetching dispatch data for order
    setLoadingExistingData(true);

    // Show form immediately with loading state
    setHasExistingData(false);

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No authentication token available');
        setHasExistingData(false);
        setLoadingExistingData(false);
        return;
      }

      console.log('📡 Fetching dispatches for order:', order.orderId);
      console.log('🌐 API URL:', `/api/dispatch?orderId=${order.orderId}`);

      // Create AbortController for timeout - reasonable timeout for API calls
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for reliable API calls

      // ⚡ FIX: Clear cache and add cache-busting parameter to ensure fresh data
      const cacheBuster = Date.now();
      const apiUrl = `/api/dispatch?orderId=${order.orderId}&t=${cacheBuster}&_nocache=${cacheBuster}`;
      console.log('🚀 Making fetch request to:', apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        signal: controller.signal,
        cache: 'no-store' // Force no cache
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.data && data.data.dispatches && data.data.dispatches.length > 0) {
          setHasExistingData(true);
          // ⚡ 100% FIX: Load data immediately - loading cleared inside loadExistingDispatchesFromData
          try {
            await loadExistingDispatchesFromData(data.data.dispatches);
            // Loading is already cleared in loadExistingDispatchesFromData
          } catch (loadError) {
            console.error('❌ Error loading dispatch data:', loadError);
            setHasExistingData(false);
            setLoadingExistingData(false);
            hasFetchedRef.current = false; // Reset flag on error
            return;
          }
        } else {
          // No existing dispatches - show empty form immediately
          setHasExistingData(false);
          setLoadingExistingData(false);

          // Set empty form data when no existing data
          const emptyFormData = {
            orderId: order.orderId || '',
            dispatchItems: [{
              id: '1',
              dispatchDate: '',
              billNo: '',
              transportNo: '',
              lrNo: '',
              finishMtr: '',
              quality: '',
              subItems: [{
                id: '1_1',
                finishMtr: '',
                quality: ''
              }]
            }]
          };

          setFormData(emptyFormData);
          console.log('✅ Empty form data set - ready for new dispatch entry');
        }
      } else {
        // API error - show empty form immediately
        setHasExistingData(false);
        setLoadingExistingData(false);

        // Set empty form data when API fails
        const errorFormData = {
          orderId: order.orderId || '',
          dispatchItems: [{
            id: '1',
            dispatchDate: '',
            billNo: '',
            transportNo: '',
            lrNo: '',
            finishMtr: '',
            quality: '',
            subItems: [{
              id: '1_1',
              finishMtr: '',
              quality: ''
            }]
          }]
        };

        setFormData(errorFormData);
        console.log('✅ Error form data set - ready for new dispatch entry');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('❌ Dispatches fetch was aborted due to timeout');
      } else {
        console.error('❌ Error fetching dispatches from API:', error);
      }
      setHasExistingData(false);
      setLoadingExistingData(false);
      // ⚡ FIX: Reset flag on error so user can retry
      hasFetchedRef.current = false;

      // Set empty form data when error occurs
      const catchFormData = {
        orderId: order.orderId || '',
        dispatchItems: [{
          id: '1',
          dispatchDate: '',
          billNo: '',
          transportNo: '',
          lrNo: '',
          finishMtr: '',
          quality: '',
          subItems: [{
            id: '1_1',
            finishMtr: '',
            quality: ''
          }]
        }]
      };

      setFormData(catchFormData);
      console.log('✅ Catch form data set - ready for new dispatch entry');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // ⚡ 100% FIX: Always stop loading when fetch completes (success or error)
      // Clear immediately - don't use setTimeout as it can cause delays
      setLoadingExistingData(false);
    }
  }, [order?.orderId]); // ⚡ 100% FIX: Remove loadExistingDispatchesFromData from deps to prevent multiple triggers

  // Load existing dispatch data when form opens (smart logic - 100% FIXED)
  useEffect(() => {
    console.log('🔄 DispatchForm useEffect triggered:', { isOpen, orderId: order?.orderId, existingDispatchesLength: existingDispatches?.length, justUpdated: justUpdatedRef.current, operationInProgress: operationInProgressRef.current, hasFetched: hasFetchedRef.current });

    // ⚡ 100% CRITICAL FIX: Skip ALL reloading if we just updated - form state already has correct data
    // This prevents deleted items from reappearing
    if (justUpdatedRef.current) {
      console.log('⏭️ SKIPPING data reload - form was just updated, keeping current state (deletions preserved)');
      setLoadingExistingData(false);
      return;
    }

    // ⚡ 100% CRITICAL FIX: Skip reloading if operation is in progress
    if (operationInProgressRef.current) {
      console.log('⏭️ SKIPPING data reload - operation in progress');
      return;
    }

    // ⚡ 100% FIX: Reset fetch flag when form closes
    if (!isOpen) {
      hasFetchedRef.current = false;
      setLoadingExistingData(false);
      return;
    }

    if (isOpen && order?.orderId) {
      // ⚡ 100% FIX: Prevent multiple fetches - only fetch once per form open
      if (hasFetchedRef.current) {
        console.log('⏭️ SKIPPING data fetch - already fetched for this form open');
        return;
      }

      console.log('📋 Form opened, starting data loading process...');

      // Smart logic: Use isEditing prop to determine if we should fetch data
      console.log('🔍 Dispatch Smart Logic:', {
        isEditing,
        willFetchData: isEditing,
        orderId: order.orderId
      });

      // Reset states but don't reset form data yet - let API call determine what to show
      setErrors({});
      setSuccessMessage('');
      setShowDeleteConfirm(false);
      setItemToDelete(null);

      // ⚡ 100% FIX: Only set loading state when actually fetching data (edit mode)
      // This prevents flickering in add mode - modal opens immediately without loading overlay
      setHasExistingData(false);

      // Smart API logic:
      // - If isEditing is true → Fetch API (edit mode) - show loading
      // - If isEditing is false → Skip API call (add mode) - no loading
      // ⚡ 100% CRITICAL: Also check if update is in progress - don't reload during update
      // ⚡ 100% FIX: Also check hasFetchedRef to prevent multiple calls
      if (isEditing && !operationInProgressRef.current && !justUpdatedRef.current && !hasFetchedRef.current) {
        console.log('📊 Edit mode detected - fetching existing dispatch data');
        // ⚡ FIX: Only set loading when actually fetching
        setLoadingExistingData(true);
        // ⚡ 100% FIX: Call fetchExistingDispatchData - flag is set inside the function
        // Don't set hasFetchedRef here - let the function handle it
        fetchExistingDispatchData().catch((error) => {
          console.error('Error in fetchExistingDispatchData:', error);
          setLoadingExistingData(false);
          hasFetchedRef.current = false; // Reset on error
        });
      } else {
        if (operationInProgressRef.current || justUpdatedRef.current) {
          console.log('⏭️ Skipping data fetch - update in progress or just completed');
        } else {
          console.log('⚡ Add mode detected - skipping API call (no loading overlay)');
        }
        // ⚡ FIX: Ensure loading is false in add mode - no flickering
        setLoadingExistingData(false);
      }
    }
  }, [isOpen, order?.orderId, isEditing]); // ⚡ 100% FIX: Remove fetchExistingDispatchData from dependencies to prevent multiple triggers

  // Also fetch qualities directly if not available (non-blocking)
  useEffect(() => {
    if (order?.orderId && (!qualities || qualities.length === 0)) {
      console.log('Qualities not available, fetching directly...');
      // Use a shorter timeout for faster loading
      const timeout = setTimeout(() => {
        fetchQualitiesDirectly();
      }, 100); // 100ms delay for faster loading

      return () => clearTimeout(timeout);
    }
  }, [order?.orderId, qualities]);

  // Update quality search states when qualities are loaded and form data exists
  useEffect(() => {
    if (qualities && qualities.length > 0 && formData.dispatchItems.length > 0 && hasExistingData) {
      console.log('Updating quality search states with loaded qualities');
      const newQualitySearchStates: { [key: string]: string } = {};

      formData.dispatchItems.forEach((item) => {
        // Set sub-item quality search states
        item.subItems?.forEach((subItem: any) => {
          if (subItem.quality) {
            const qualityObj = qualities.find(q => (q._id || q.id) === subItem.quality);
            if (qualityObj) {
              newQualitySearchStates[subItem.id] = qualityObj.name;
            }
          }
        });
      });

      setQualitySearchStates(prev => ({ ...prev, ...newQualitySearchStates }));
    }
  }, [qualities, formData.dispatchItems, hasExistingData]);

  // Note: Removed dependency on isEditing and existingDispatches props
  // Form now fetches data independently from API like LabDataModal

  // Reset form when order changes (but not when editing or when there's existing data)
  useEffect(() => {
    if (order && !isEditing && !hasExistingData) {
      setFormData({
        orderId: order.orderId,
        dispatchItems: [{
          id: '1',
          dispatchDate: '',
          billNo: '',
          transportNo: '',
          lrNo: '',
          finishMtr: '',
          quality: '',
          subItems: [{
            id: '1_1',
            finishMtr: '',
            quality: ''
          }]
        }]
      });
      setErrors({});
    }
  }, [order?.orderId, isEditing, hasExistingData]);

  // Function to load existing dispatches from props (fixed logic)
  const loadExistingDispatches = async () => {
    console.log('Loading existing dispatches from props:', { order: order?.orderId, existingDispatches });

    if (!order || existingDispatches.length === 0) {
      setHasExistingData(false);
      return;
    }

    // Load immediately for smooth experience
    try {
      // ⚡ FIX: Sort dispatches by createdAt (oldest first) before grouping
      const sortedDispatches = [...existingDispatches].sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB; // Ascending order (oldest first)
      });

      // Group dispatches by dispatchDate and billNo to create dispatch items
      const groupedDispatches = sortedDispatches.reduce((groups: any, dispatch: any) => {
        const key = `${dispatch.dispatchDate}_${dispatch.billNo}`;
        if (!groups[key]) {
          groups[key] = {
            dispatchDate: dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toISOString().split('T')[0] : '',
            billNo: dispatch.billNo,
            transportNo: dispatch.transportNo || '',
            lrNo: dispatch.lrNo || '',
            createdAt: dispatch.createdAt, // Store createdAt for sorting
            subItems: []
          };
        }
        // Add sub-item with database ID
        groups[key].subItems.push({
          _id: dispatch._id, // Store database ID for updates
          id: '', // Will be set when creating form data
          finishMtr: (dispatch.finishMtr || 0).toString(),
          quality: dispatch.quality?._id || dispatch.quality || ''
        });
        return groups;
      }, {});

      // ⚡ FIX: Sort group entries by createdAt (oldest first) before converting to form data
      const groupEntries = Object.entries(groupedDispatches).sort(([, a]: [string, any], [, b]: [string, any]) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB; // Ascending order (oldest first)
      });
      const newFormData = {
        orderId: order.orderId,
        dispatchItems: groupEntries.map(([key, group]: [string, any], index: number) => {
          // Regenerate sub-item IDs with proper item index, preserving database IDs
          const subItemsWithIds = group.subItems.map((subItem: any, subIndex: number) => ({
            ...subItem,
            id: `${index + 1}_${subIndex + 1}`,
            _id: subItem._id // Preserve database ID
          }));
          return {
            id: (index + 1).toString(),
            dispatchDate: group.dispatchDate,
            billNo: group.billNo,
            transportNo: group.transportNo || '',
            lrNo: group.lrNo || '',
            finishMtr: '',
            quality: '',
            subItems: subItemsWithIds
          };
        })
      };

      console.log('Setting form data from props:', newFormData);
      setFormData(newFormData);
      setHasExistingData(true);

      // Set quality search states for proper display
      const newQualitySearchStates: { [key: string]: string } = {};
      newFormData.dispatchItems.forEach((item) => {
        // Set sub-item quality search states
        item.subItems?.forEach((subItem: any) => {
          if (subItem.quality) {
            const qualityObj = qualities?.find(q => (q._id || q.id) === subItem.quality);
            if (qualityObj) {
              newQualitySearchStates[subItem.id] = qualityObj.name;
            }
          }
        });
      });
      setQualitySearchStates(newQualitySearchStates);
    } catch (error) {
      console.error('Error loading existing dispatches from props:', error);
      setHasExistingData(false);
    }
  };

  // Add new dispatch item (100% FIXED - unique IDs, no duplicates)
  const addDispatchItem = () => {
    // ⚡ 100% FIX: Generate unique ID based on timestamp to avoid conflicts
    const newId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSubItemId = `${newId}_1_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setFormData(prevFormData => {
      const newItem = {
        id: newId,
        dispatchDate: '',
        billNo: '',
        transportNo: '',
        lrNo: '',
        finishMtr: '',
        quality: '', // ⚡ FIX: Empty quality - no auto-fill
        subItems: [{
          id: newSubItemId,
          finishMtr: '',
          quality: '' // ⚡ FIX: Empty quality - no auto-fill
        }]
      };

      console.log(`➕ Adding new dispatch item:`, {
        newId,
        newSubItemId,
        currentItemsCount: prevFormData.dispatchItems.length,
        newItemsCount: prevFormData.dispatchItems.length + 1
      });

      return {
        ...prevFormData,
        dispatchItems: [
          ...prevFormData.dispatchItems, // Keep ALL existing items first (oldest at top)
          newItem
        ]
      };
    });

    // ⚡ FIX: Clear quality search state for new item to prevent auto-fill
    setQualitySearchStates(prev => {
      const newStates = { ...prev };
      // Don't set any search state for the new item - it should be empty
      return newStates;
    });

    // ⚡ FIX: Clear active dropdown to prevent state leakage
    setActiveQualityDropdown(null);
    setCurrentQualitySearch('');

    // Scroll to the newly added item at the bottom after a short delay
    setTimeout(() => {
      const newItemElement = document.getElementById(`dispatch-item-${newId}`);
      if (newItemElement) {
        newItemElement.scrollIntoView({
          behavior: 'auto',
          block: 'end'
        });
      }
    }, 100);
  };

  // Remove dispatch item
  const removeDispatchItem = (itemId: string) => {
    if (formData.dispatchItems.length > 1) {
      // ⚡ FIX: Remove item and clean up all related quality search states
      const itemToRemove = formData.dispatchItems.find(item => item.id === itemId);

      setFormData({
        ...formData,
        dispatchItems: formData.dispatchItems.filter(item => item.id !== itemId)
      });

      // ⚡ FIX: Clean up quality search states for deleted item
      if (itemToRemove) {
        setQualitySearchStates(prev => {
          const newStates = { ...prev };
          // Remove main quality search state
          delete newStates[itemId];
          // Remove all sub-item quality search states
          itemToRemove.subItems?.forEach((subItem) => {
            delete newStates[subItem.id];
          });
          return newStates;
        });
      }

      // ⚡ FIX: Clear active dropdown if it was for the deleted item
      if (activeQualityDropdown?.itemId === itemId || itemToRemove?.subItems?.some(sub => sub.id === activeQualityDropdown?.itemId)) {
        setActiveQualityDropdown(null);
        setCurrentQualitySearch('');
      }
    }
  };

  // Update dispatch item
  const updateDispatchItem = (itemId: string, field: keyof DispatchItem, value: string) => {
    setFormData({
      ...formData,
      dispatchItems: formData.dispatchItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    });
  };

  // Add sub-item to dispatch item (100% FIXED - unique IDs, no duplicates)
  const addSubItem = (itemId: string) => {
    setFormData(prevFormData => {
      return {
        ...prevFormData,
        dispatchItems: prevFormData.dispatchItems.map(item => {
          if (item.id === itemId) {
            // ⚡ 100% FIX: Generate unique ID using timestamp to prevent duplicates
            const newSubId = `${itemId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newSubItem = {
              id: newSubId,
              finishMtr: '',
              quality: ''
            };

            console.log(`➕ Adding new sub-item to item ${itemId}:`, {
              newSubId,
              currentSubItemsCount: (item.subItems || []).length,
              newSubItemsCount: (item.subItems || []).length + 1
            });

            return {
              ...item,
              subItems: [
                ...(item.subItems || []),
                newSubItem
              ]
            };
          }
          return item;
        })
      };
    });
  };

  // Remove sub-item from dispatch item (M2, M3, etc.)
  // ⚡ 100% FIX: This function removes items from formData immediately
  // When user clicks update, the captured formData (with deletions) is used to update database
  // Deleted items are permanently removed - they won't come back after update
  const removeSubItem = (itemId: string, subItemId: string) => {
    console.log(`🗑️ Removing sub-item ${subItemId} from dispatch item ${itemId}`);

    // ⚡ FIX: Clean up quality search state for deleted sub-item
    setQualitySearchStates(prev => {
      const newStates = { ...prev };
      delete newStates[subItemId];
      return newStates;
    });

    // ⚡ FIX: Clear active dropdown if it was for the deleted sub-item
    if (activeQualityDropdown?.itemId === subItemId) {
      setActiveQualityDropdown(null);
      setCurrentQualitySearch('');
    }

    // ⚡ 100% FIX: Remove sub-item from form data - this ensures it won't be included in update
    // This is the key - deleted items are removed from formData, so they won't be saved to database
    setFormData(prevFormData => {
      const updatedItems = prevFormData.dispatchItems.map(item => {
        if (item.id === itemId) {
          const beforeCount = (item.subItems || []).length;
          const filteredSubItems = (item.subItems || []).filter(sub => sub.id !== subItemId);
          const deletedItem = (item.subItems || []).find(sub => sub.id === subItemId);

          console.log(`✅ Removed sub-item ${subItemId} from item ${itemId}:`, {
            beforeCount,
            afterCount: filteredSubItems.length,
            deletedItem: deletedItem ? {
              id: deletedItem.id,
              finishMtr: deletedItem.finishMtr,
              quality: deletedItem.quality
            } : null,
            remainingSubItems: filteredSubItems.map(s => ({
              id: s.id,
              finishMtr: s.finishMtr,
              quality: s.quality
            }))
          });

          return {
            ...item,
            subItems: filteredSubItems
          };
        }
        return item;
      });

      console.log(`📝 Updated form data after removing sub-item. Total dispatch items: ${updatedItems.length}`);

      return {
        ...prevFormData,
        dispatchItems: updatedItems
      };
    });
  };

  // Update sub-item
  const updateSubItem = (itemId: string, subItemId: string, field: keyof DispatchSubItem, value: string) => {
    setFormData(prevFormData => {
      const newFormData = {
        ...prevFormData,
        dispatchItems: prevFormData.dispatchItems.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              subItems: (item.subItems || []).map(sub =>
                sub.id === subItemId ? { ...sub, [field]: value } : sub
              )
            };
          }
          return item;
        })
      };
      return newFormData;
    });
  };

  // Quality helper functions
  const getQualityId = (quality: any) => {
    return quality?._id || quality?.id || quality;
  };

  const getFilteredQualities = (itemId: string) => {
    // ⚡ FIX: Always merge localQualities and qualities prop to ensure we have the latest data
    // This ensures newly added qualities appear immediately in the dropdown
    const qualityMap = new Map();

    // First, add qualities from prop (source of truth)
    if (qualities && Array.isArray(qualities)) {
      qualities.forEach(quality => {
        const id = quality._id || (quality as any).id;
        if (id) {
          qualityMap.set(String(id), quality);
        }
      });
    }

    // Then, add localQualities (may include newly added ones not yet in prop)
    if (localQualities && Array.isArray(localQualities)) {
      localQualities.forEach(quality => {
        const id = quality._id || (quality as any).id;
        if (id) {
          qualityMap.set(String(id), quality);
        }
      });
    }

    const allQualities = Array.from(qualityMap.values());

    const searchTerm = activeQualityDropdown?.itemId === itemId
      ? currentQualitySearch
      : (qualitySearchStates[itemId] || '');

    if (!searchTerm.trim()) {
      return allQualities;
    }
    return allQualities.filter(quality =>
      quality.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleQualitySelect = (itemId: string, quality: any) => {
    const qualityId = getQualityId(quality);
    updateDispatchItem(itemId, 'quality', qualityId);
    setQualitySearchStates(prev => ({ ...prev, [itemId]: quality.name }));

    // ⚡ FIX: Only update currentQualitySearch if this is the active dropdown
    if (activeQualityDropdown?.itemId === itemId) {
      setCurrentQualitySearch(quality.name);
    }

    setActiveQualityDropdown(null);
  };

  // Handle quality select for sub-items
  const handleSubItemQualitySelect = (itemId: string, subItemId: string, quality: any) => {
    const qualityId = getQualityId(quality);
    updateSubItem(itemId, subItemId, 'quality', qualityId);
    setQualitySearchStates(prev => ({ ...prev, [subItemId]: quality.name }));

    // ⚡ FIX: Only update currentQualitySearch if this is the active dropdown
    if (activeQualityDropdown?.itemId === subItemId) {
      setCurrentQualitySearch(quality.name);
    }

    setActiveQualityDropdown(null);

    // Debug: Check if the quality was actually set
    setTimeout(() => {
      const currentFormData = formData;
      const currentItem = currentFormData.dispatchItems.find(item => item.id === itemId);
      const currentSubItem = currentItem?.subItems?.find(sub => sub.id === subItemId);
    }, 100);
  };

  // Clear quality search when dropdown is closed
  const handleQualityDropdownToggle = async (itemId: string) => {
    if (activeQualityDropdown?.itemId === itemId) {
      setActiveQualityDropdown(null);
      setCurrentQualitySearch('');
    } else {
      // ⚡ FIX: Clear cache and refresh qualities when opening dropdown
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qualities_cache');
      }

      // ⚡ FIX: Fetch fresh qualities directly and update localQualities immediately
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('No token found for qualities fetch');
          return;
        }

        const qualitiesResponse = await fetch(`/api/qualities?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store'
        });

        if (qualitiesResponse.ok) {
          const qualitiesData = await qualitiesResponse.json();
          if (qualitiesData.success && Array.isArray(qualitiesData.data)) {
            // Update local qualities immediately with fresh data
            setLocalQualities(qualitiesData.data);
          }
        } else if (qualitiesResponse.status === 401) {
          // Handle unauthorized - redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching fresh qualities:', error);
        }
      }

      // Also call parent's refresh function for consistency
      if (onRefreshQualities) {
        onRefreshQualities();
      }

      setActiveQualityDropdown({ itemId });
      setCurrentQualitySearch(qualitySearchStates[itemId] || '');
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    formData.dispatchItems.forEach((item, itemIndex) => {
      // Validate dispatch item fields
      if (!item.dispatchDate || item.dispatchDate.trim() === '') {
        newErrors[`dispatchDate_${item.id}`] = 'Dispatch date is required';
      }

      if (!item.billNo || item.billNo.trim() === '') {
        newErrors[`billNo_${item.id}`] = 'Bill number is required';
      }

      // Validate sub-items (main quality & finish items)
      (item.subItems || []).forEach((subItem, subIndex) => {
        if (!subItem.finishMtr || subItem.finishMtr.trim() === '' || parseFloat(subItem.finishMtr) <= 0) {
          newErrors[`finishMtr_${subItem.id}`] = 'Valid finish meters is required';
        }


        if (!subItem.quality || subItem.quality.trim() === '') {
          newErrors[`quality_${subItem.id}`] = 'Quality is required';
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission (clean professional pattern - same as mill output)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚡ CLEAN: Prevent multiple simultaneous submissions
    if (operationInProgressRef.current || saving) {
      console.warn('⚠️ Operation already in progress, ignoring duplicate submission');
      return;
    }

    // ⚡ 100% FIX: Capture current formData at submission time to prevent stale closure issues
    const currentFormData = formData;

    // ⚡ CLEAN: Allow submission even if form is empty (user deleted all items)
    if (currentFormData.dispatchItems.length === 0) {
      console.log('⚠️ Form is empty - user deleted all items, proceeding with update to clear all data');
    } else if (!validateForm()) {
      return;
    }

    // ⚡ CLEAN: Set operation flag immediately
    operationInProgressRef.current = true;
    setSaving(true);
    setSuccessMessage('');
    setErrors({});

    try {
      if (hasExistingData) {
        // Update existing dispatches (delete-then-create pattern)
        console.log('🔄 Updating existing dispatches...');
        // ⚡ 100% FIX: Use captured formData to ensure we use the exact state at submission time
        await updateExistingDispatchesWithData(currentFormData);
      } else {
        // Create new dispatches
        console.log('➕ Creating new dispatches...');
        await createNewDispatchesWithData(currentFormData);
      }

      setSuccessMessage('Dispatch data saved successfully!');

      // Determine operation type before updating hasExistingData
      const operationType = hasExistingData ? 'edit' : 'add';

      // ⚡ CLEAN: Mark that we just updated to prevent reloading deleted items
      justUpdatedRef.current = true;

      // ⚡ CLEAN: Immediately update local state for better UX (same as mill output)
      setHasExistingData(true);

      // ⚡ CLEAN: DON'T reload from API after update - keep current form state (deletions already applied)
      console.log('✅ Update completed - keeping current form state (deletions already applied)');
      console.log('📋 Final form state after update:', {
        dispatchItemsCount: currentFormData.dispatchItems.length,
        items: currentFormData.dispatchItems.map(item => ({
          id: item.id,
          mainEntry: { finishMtr: item.finishMtr, quality: item.quality },
          subItemsCount: item.subItems?.length || 0,
          subItems: item.subItems?.map(s => ({ id: s.id, finishMtr: s.finishMtr, quality: s.quality })) || []
        }))
      });

      // ⚡ 100% FIX: Close immediately after showing success (no artificial delay)
      // ⚡ CRITICAL: Keep justUpdatedRef true for longer to prevent reload on quick reopen
      onSuccess(operationType);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
        // ⚡ 100% FIX: Reset the flag after longer delay to prevent reload on quick reopen
        // This ensures deleted items stay deleted even if user quickly reopens form
        setTimeout(() => {
          justUpdatedRef.current = false;
          console.log('🔄 Reset justUpdatedRef flag - form can now reload data if reopened (after 5 seconds)');
        }, 5000); // Increased to 5 seconds to ensure update is fully processed and prevent reload
      }, 500);
    } catch (error) {
      console.error('Dispatch save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to handle dispatch';
      setErrors({ submit: errorMessage });
    } finally {
      setSaving(false);
      // ⚡ CLEAN: Clear operation flag
      operationInProgressRef.current = false;
    }
  };

  // ⚡ FIX: Function to create new dispatches (with deduplication and sequential processing)
  const createNewDispatches = async () => {
    // ⚡ CRITICAL: Use helper function with current formData
    return await createNewDispatchesWithData(formData);
  };

  // ⚡ CLEAN: Helper function to create dispatches with specific formData
  const createNewDispatchesWithData = async (formDataToUse: DispatchFormData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // ⚡ FIX: Collect all dispatch items (main entry + sub-items) from provided formData
    const allDispatches: any[] = [];
    formDataToUse.dispatchItems.forEach((item, itemIndex) => {
      console.log(`📝 Processing dispatch item ${itemIndex + 1}:`, {
        itemId: item.id,
        mainEntry: { finishMtr: item.finishMtr, quality: item.quality },
        subItemsCount: item.subItems?.length || 0,
        subItems: item.subItems?.map(s => ({ id: s.id, finishMtr: s.finishMtr, quality: s.quality }))
      });

      // ⚡ FIX: Only save sub-items (M1, M2, M3, etc.) - main item is just for display/organization
      // The main item's finishMtr/quality are not saved separately to avoid duplicates
      // All actual data comes from subItems array

      // ⚡ FIX: Include sub-items (M1, M2, M3, etc.) - only include valid ones (deleted ones are already removed from array)
      // ⚡ CRITICAL: This array only contains items that are still in the form - deleted items are already filtered out by removeSubItem
      // ⚡ CRITICAL FIX: Filter out empty/invalid items first, then process valid ones
      // ⚡ 100% FIX: Deleted items are already removed from formData by removeSubItem, so they won't be in this array
      const validSubItems = (item.subItems || []).filter(subItem => {
        const hasFinishMtr = subItem.finishMtr && String(subItem.finishMtr).trim() !== '';
        const hasQuality = subItem.quality && String(subItem.quality).trim() !== '';
        const isValid = hasFinishMtr && hasQuality;
        if (!isValid) {
          console.log(`⚠️ Filtering out invalid sub-item ${subItem.id} from item ${itemIndex + 1}:`, {
            finishMtr: subItem.finishMtr,
            quality: subItem.quality,
            hasFinishMtr,
            hasQuality
          });
        }
        return isValid;
      });

      console.log(`📦 Processing ${validSubItems.length} valid sub-items (from ${(item.subItems || []).length} total) for item ${itemIndex + 1}`);

      validSubItems.forEach((subItem, validIndex) => {
        const originalIndex = (item.subItems || []).indexOf(subItem);
        console.log(`🔍 Processing valid sub-item ${validIndex + 1} (original index: ${originalIndex + 1}, id: ${subItem.id}):`, {
          finishMtr: subItem.finishMtr,
          quality: subItem.quality,
          hasFinishMtr: !!subItem.finishMtr && String(subItem.finishMtr).trim() !== '',
          hasQuality: !!subItem.quality && String(subItem.quality).trim() !== ''
        });

        // ⚡ CRITICAL: Parse and validate finishMtr
        const finishMtrValue = parseFloat(String(subItem.finishMtr));
        // ⚡ FIX: Only include if finishMtr is a valid positive number
        if (!isNaN(finishMtrValue) && finishMtrValue > 0) {
          const subDispatch = {
            orderId: formDataToUse.orderId,
            dispatchDate: item.dispatchDate,
            billNo: item.billNo.trim(),
            transportNo: (item.transportNo || '').trim(),
            lrNo: (item.lrNo || '').trim(),
            finishMtr: finishMtrValue,
            quality: String(subItem.quality).trim()
          };
          allDispatches.push(subDispatch);
          console.log(`✅ Added sub-item (M${validIndex + 1}) for item ${itemIndex + 1}:`, {
            id: subItem.id,
            originalIndex: originalIndex + 1,
            finishMtr: finishMtrValue,
            quality: subItem.quality,
            billNo: item.billNo.trim()
          });
        } else {
          console.warn(`⚠️ Skipping sub-item for item ${itemIndex + 1} - invalid finishMtr: ${subItem.finishMtr} (parsed as: ${finishMtrValue})`);
        }
      });
    });

    console.log(`📊 Total dispatches collected: ${allDispatches.length} (from ${formDataToUse.dispatchItems.length} dispatch items)`);
    console.log(`📋 All dispatches to save:`, allDispatches.map((d, idx) => ({
      index: idx + 1,
      finishMtr: d.finishMtr,
      quality: d.quality,
      billNo: d.billNo,
      dispatchDate: d.dispatchDate
    })));

    // ⚡ CRITICAL: NO DEDUPLICATION - User wants to allow exact duplicates
    // User can add same quality, same finishMtr multiple times (M1, M2, M3 all same)
    // All items in formData will be saved exactly as entered
    const dispatchesToSave = allDispatches;

    console.log('📝 All dispatches to create:', dispatchesToSave.length, 'items (no duplicates removed)');
    console.log('📋 Dispatches details (will be saved):', dispatchesToSave.map((d, idx) => ({
      index: idx + 1,
      finishMtr: d.finishMtr,
      quality: d.quality,
      billNo: d.billNo,
      dispatchDate: d.dispatchDate
    })));

    // ⚡ FIX: Handle case where all items are invalid - allow deletion of all items
    if (dispatchesToSave.length === 0) {
      console.log('⚠️ No valid dispatches to create - this is valid if user deleted all items');
      return []; // Return empty array instead of throwing error
    }

    // ⚡ FIX: Process sequentially to prevent race conditions
    const results = [];
    for (let index = 0; index < dispatchesToSave.length; index++) {
      const dispatch = dispatchesToSave[index];
      console.log(`📝 Processing dispatch ${index + 1}/${dispatchesToSave.length}:`, dispatch);

      const response = await fetch('/api/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(dispatch)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to create dispatch ${index + 1}`);
      }

      results.push(data);
    }

    console.log('✅ Successfully created', results.length, 'dispatches');
    return results;
  };

  // Delete dispatch data (LabDataModal pattern)
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    // ⚡ FIX: Prevent multiple simultaneous operations
    if (operationInProgressRef.current || saving) {
      console.warn('⚠️ Operation already in progress, ignoring duplicate delete');
      return;
    }

    operationInProgressRef.current = true;
    setSaving(true);
    setErrors({});
    setSuccessMessage('');
    setShowDeleteConfirm(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      // ⚡ FIX: Use bulk delete endpoint for better performance and reliability
      const response = await fetch(`/api/dispatch?orderId=${order?.orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccessMessage('Dispatch data deleted successfully!');
          setHasExistingData(false);

          // Reset form to initial state
          setFormData({
            orderId: order?.orderId || '',
            dispatchItems: [{
              id: '1',
              dispatchDate: '',
              billNo: '',
              transportNo: '',
              lrNo: '',
              finishMtr: '',
              quality: '',
              subItems: [{
                id: '1_1',
                finishMtr: '',
                quality: ''
              }]
            }]
          });

          console.log('🎯 Dispatch data deleted successfully, closing form and updating button state');

          // ⚡ OPTIMIZED: Close immediately (no artificial delay)
          onSuccess('delete');
          setTimeout(() => {
            setSuccessMessage('');
            onClose();
          }, 500);
        } else {
          setErrors({ submit: data.error || 'Failed to delete dispatch data' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setErrors({ submit: errorData.error || 'Failed to delete dispatch data' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setErrors({ submit: 'Failed to delete dispatch data' });
    } finally {
      setSaving(false);
      operationInProgressRef.current = false;
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // ⚡ 100% FIX: Helper function that accepts formData parameter to prevent stale closure issues
  // ⚡ CLEAN PROFESSIONAL: Function to update existing dispatches (sequential delete-then-create pattern - same as mill output)
  const updateExistingDispatchesWithData = async (formDataToUse: DispatchFormData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('🔄 Starting dispatch update process...');
    console.log('📝 Current form data items:', formDataToUse.dispatchItems.length);

    // ⚡ CLEAN: Delete first, then create (sequential to prevent duplicates) - same pattern as mill output
    const deleteResponse = await fetch(`/api/dispatch?orderId=${order?.orderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!deleteResponse.ok) {
      const deleteData = await deleteResponse.json().catch(() => ({}));
      console.warn('⚠️ Delete response not OK:', deleteResponse.status, deleteData);
      // Continue anyway - the create will handle it
    } else {
      const deleteData = await deleteResponse.json();
      console.log('✅ Deleted existing dispatches:', deleteData);
    }

    // ⚡ CLEAN: Wait a small moment to ensure delete is processed (same as mill output)
    await new Promise(resolve => setTimeout(resolve, 200));

    // ⚡ CLEAN: Now create new dispatches (handles empty form gracefully) - same as mill output
    // ⚡ 100% FIX: Use the captured formData to ensure we use the exact state at submission time
    const results = await createNewDispatchesWithData(formDataToUse);

    console.log('✅ Dispatch update completed - created', Array.isArray(results) ? results.length : 0, 'items');

    // ⚡ CLEAN: If no items were created (user deleted all), update hasExistingData to false
    if (!results || results.length === 0) {
      console.log('⚠️ No items created - user deleted all items');
      setHasExistingData(false);
    }

    return results;
  };

  // ⚡ CLEAN PROFESSIONAL: Wrapper function for backward compatibility
  const updateExistingDispatches = async () => {
    // ⚡ 100% FIX: Use current formData to prevent stale closure
    return await updateExistingDispatchesWithData(formData);
  };

  // Don't block form opening - show form even if order is not immediately available
  // if (!order) {
  //   return null;
  // }

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
  const modalContentRef = useRef<HTMLFormElement>(null);

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

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  console.log('🔄 DispatchForm render - formData:', {
    orderId: formData.orderId,
    dispatchItemsCount: formData.dispatchItems?.length || 0,
    hasExistingData,
    loadingExistingData,
    firstItem: formData.dispatchItems?.[0]
  });

  return (
    <>
      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDarkMode ? '#374151' : '#f3f4f6'};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#3b82f6' : '#60a5fa'};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#2563eb' : '#3b82f6'};
        }
      `}</style>

      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
        <div className={`relative w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-xl shadow-2xl ${isClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
          {/* Loading Overlay for Loading Data */}
          {loadingExistingData && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-3 text-sm font-medium">Loading dispatch data...</p>
                <p className="mt-1 text-xs text-gray-500">Please wait while we fetch your data</p>
              </div>
            </div>
          )}

          {/* Loading Overlay for Saving */}
          {saving && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-3 text-sm font-medium">Saving dispatch data...</p>
                <p className="mt-1 text-xs text-gray-500">Please wait while we process your data</p>
              </div>
            </div>
          )}

          {/* Header - Order ID badge with title and close button */}
          <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700 bg-blue-900/20' : 'border-gray-200 bg-blue-50'
            }`}>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-lg font-bold ${isDarkMode
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                {getDisplayOrderId(formData.orderId || order?.orderId) || '--'}
              </span>
              <span className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                Dispatch
              </span>
            </div>
            <button
              onClick={handleClose}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                }`}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form ref={modalContentRef} onSubmit={handleSubmit} className={`overflow-y-auto max-h-[calc(95vh-140px)] custom-scrollbar ${isDarkMode
            ? 'scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800'
            : 'scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-100'
            }`}>
            <div className="p-6 space-y-8 pb-24">
              {/* Success Message */}
              {successMessage && (
                <div className={`p-4 rounded-lg border ${isDarkMode
                  ? 'bg-green-900/20 border-green-500/30 text-green-400'
                  : 'bg-green-50 border-green-200 text-green-800'
                  }`}>
                  <div className="flex items-center">
                    <CheckIcon className="h-5 w-5 mr-2" />
                    {successMessage}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {errors.submit && (
                <div className={`p-4 rounded-lg border ${isDarkMode
                  ? 'bg-red-900/20 border-red-500/30 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    {errors.submit}
                  </div>
                </div>
              )}

              {/* Dispatch Items */}
              <div>

                <div className="space-y-6">
                  {formData.dispatchItems.map((item, itemIndex) => (
                    <div key={item.id} id={`dispatch-item-${item.id}`} className={`p-6 rounded-xl border transition-all duration-200 hover:shadow-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                      }`}>
                      <div className="mb-6">
                        {/* ⚡ FIX: Item header with number and delete button - only show if multiple items */}
                        {formData.dispatchItems.length > 1 && (
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-300 dark:border-gray-600">
                            <h4 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                              Dispatch Item {itemIndex + 1}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeDispatchItem(item.id);
                              }}
                              className={`px-3 py-2 rounded-lg border transition-all duration-150 flex items-center justify-center ${isDarkMode
                                ? 'border-red-600/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-300 bg-red-900/10'
                                : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 bg-red-50/50'
                                }`}
                              title="Delete this dispatch item"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        )}

                        {/* Date, Bill No, Transport No, LR No */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                          {/* Dispatch Date */}
                          <div>
                            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                              Dispatch Date <span className="text-red-500">*</span>
                            </label>
                            <CustomDatePicker
                              value={item.dispatchDate || ''}
                              onChange={(value) => updateDispatchItem(item.id, 'dispatchDate', value)}
                              placeholder="Select dispatch date"
                              isDarkMode={isDarkMode}
                            />
                            {errors[`dispatchDate_${item.id}`] && (
                              <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                                }`}>
                                {errors[`dispatchDate_${item.id}`]}
                              </p>
                            )}
                          </div>

                          {/* Bill Number */}
                          <div>
                            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                              Bill Number <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={item.billNo || ''}
                                onChange={(e) => updateDispatchItem(item.id, 'billNo', e.target.value)}
                                placeholder="Enter bill number"
                                required
                                className={`w-full px-4 py-3 pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`billNo_${item.id}`]
                                  ? isDarkMode
                                    ? 'border-red-500 bg-gray-800 text-white'
                                    : 'border-red-500 bg-white text-gray-900'
                                  : isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                  }`}
                              />
                              <DocumentTextIcon className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`} />
                            </div>
                            {errors[`billNo_${item.id}`] && (
                              <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                                }`}>
                                {errors[`billNo_${item.id}`]}
                              </p>
                            )}
                          </div>

                          {/* Transport */}
                          <div>
                            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                              Transport
                            </label>
                            <input
                              type="text"
                              value={item.transportNo || ''}
                              onChange={(e) => updateDispatchItem(item.id, 'transportNo', e.target.value)}
                              placeholder="Enter transport"
                              className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                }`}
                            />
                          </div>

                          {/* LR No */}
                          <div>
                            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                              LR No
                            </label>
                            <input
                              type="text"
                              value={item.lrNo || ''}
                              onChange={(e) => updateDispatchItem(item.id, 'lrNo', e.target.value)}
                              placeholder="Enter LR number"
                              className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                }`}
                            />
                          </div>

                        </div>

                      </div>

                      {/* Quality & Finish Items Section */}
                      <div className={`mt-6 p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-200'
                        }`}>
                        <h6 className={`text-sm font-semibold mb-4 flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Quality & Finish Items
                        </h6>

                        <div className="space-y-4">
                          {/* ⚡ FIX: Quality & Finish Items - 3 columns with delete button in same row (like Mill Output) */}
                          {(item.subItems || []).map((subItem, subIndex) => (
                            <div key={subItem.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Sub-item Quality */}
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Quality M{subIndex + 2} <span className="text-red-500">*</span>
                                </label>
                                <EnhancedDropdown
                                  options={getFilteredQualities(subItem.id)}
                                  value={subItem.quality || ''}
                                  onChange={(value) => {
                                    // ⚡ FIX: Only clear quality when explicitly cleared, don't update on typing
                                    if (value === '') {
                                      updateSubItem(item.id, subItem.id, 'quality', '');
                                    }
                                  }}
                                  placeholder="Search quality..."
                                  searchValue={activeQualityDropdown?.itemId === subItem.id
                                    ? currentQualitySearch
                                    : (qualitySearchStates[subItem.id] || '')}
                                  onSearchChange={(value) => {
                                    if (activeQualityDropdown?.itemId === subItem.id) {
                                      setCurrentQualitySearch(value);
                                    } else {
                                      setQualitySearchStates(prev => ({ ...prev, [subItem.id]: value }));
                                    }
                                  }}
                                  showDropdown={activeQualityDropdown?.itemId === subItem.id}
                                  onToggleDropdown={() => handleQualityDropdownToggle(subItem.id)}
                                  onSelect={(quality) => handleSubItemQualitySelect(item.id, subItem.id, quality)}
                                  isDarkMode={isDarkMode}
                                  error={errors[`quality_${subItem.id}`]}
                                  recentlyAddedId={recentlyAddedQuality || undefined}
                                  qualities={qualities}
                                />
                              </div>

                              {/* Sub-item Finish Meters */}
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Finish Meters M{subIndex + 2} <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={subItem.finishMtr || ''}
                                  onChange={(e) => updateSubItem(item.id, subItem.id, 'finishMtr', e.target.value)}
                                  placeholder="Enter finish meters"
                                  step="0.01"
                                  min="0"
                                  required
                                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`finishMtr_${subItem.id}`]
                                    ? isDarkMode
                                      ? 'border-red-500 bg-gray-800 text-white'
                                      : 'border-red-500 bg-white text-gray-900'
                                    : isDarkMode
                                      ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                      : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                    }`}
                                />
                                {errors[`finishMtr_${subItem.id}`] && (
                                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                                    }`}>
                                    {errors[`finishMtr_${subItem.id}`]}
                                  </p>
                                )}
                              </div>

                              {/* ⚡ FIX: Delete button in same row - disabled if only one sub-item - bigger and properly aligned */}
                              <div className="flex items-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Only allow deletion if there's more than one sub-item
                                    if ((item.subItems || []).length <= 1) {
                                      return;
                                    }

                                    removeSubItem(item.id, subItem.id);
                                  }}
                                  disabled={(item.subItems || []).length <= 1}
                                  className={`w-full px-3 py-3 rounded-lg border transition-all duration-150 flex items-center justify-center ${(item.subItems || []).length <= 1
                                    ? isDarkMode
                                      ? 'border-gray-600/50 text-gray-500 bg-gray-800/50 cursor-not-allowed opacity-60'
                                      : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'
                                    : isDarkMode
                                      ? 'border-red-600/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-300 bg-red-900/10'
                                      : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 bg-red-50/50'
                                    }`}
                                  title={(item.subItems || []).length <= 1 ? "Cannot delete - at least one quality & finish item required" : `Delete ${subIndex === 0 ? 'M1' : `M${subIndex + 1}`} row`}
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Add More Finished Meters Button - Full width horizontal design */}
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => addSubItem(item.id)}
                              className={`w-full flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-semibold ${isDarkMode
                                ? 'bg-gray-800/70 border-gray-600 hover:bg-gray-700 hover:border-gray-500 text-gray-200 hover:text-white'
                                : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-gray-400 text-gray-700 hover:text-gray-900'
                                }`}
                            >
                              <PlusIcon className="h-5 w-5 mr-2" />
                              <span>Add More Finished Meters</span>
                            </button>
                          </div>
                        </div>
                      </div>


                      {/* Remove Item Button - REMOVED (now in header) */}
                      {false && formData.dispatchItems.length > 1 && (
                        <div className="flex justify-end mt-4">
                          <button
                            type="button"
                            onClick={() => removeDispatchItem(item.id)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${isDarkMode
                              ? 'border-red-500 text-red-400 hover:bg-red-500 hover:text-white'
                              : 'border-red-300 text-red-600 hover:bg-red-500 hover:text-white'
                              }`}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Item Card */}
                  <div className={`p-4 rounded-xl border-2 border-dashed transition-all duration-200 hover:shadow-lg cursor-pointer ${isDarkMode
                    ? 'border-gray-600 bg-gray-800/50 hover:border-blue-500 hover:bg-gray-800'
                    : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-gray-50'
                    }`} onClick={addDispatchItem}>
                    <div className="flex items-center justify-center space-x-3 py-4">
                      <div className={`p-2 rounded-full ${isDarkMode
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-blue-100 text-blue-600'
                        }`}>
                        <PlusIcon className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                          Add New Dispatch Item
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Sticky Submit Button */}
          <div className={`sticky bottom-0 left-0 right-0 p-6 border-t shadow-lg bg-inherit ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleClose}
                className={`px-8 py-3 rounded-lg border transition-all duration-200 hover:scale-105 ${isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Cancel
              </button>

              {/* Delete Button - Show only when has existing data */}
              {hasExistingData && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={saving}
                  className={`px-6 py-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${saving
                    ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                    : isDarkMode
                      ? 'border-red-500 text-red-400 hover:bg-red-500 hover:text-white'
                      : 'border-red-300 text-red-600 hover:bg-red-500 hover:text-white'
                    }`}
                >
                  <TrashIcon className="h-5 w-5 inline mr-2" />
                  Delete
                </button>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit(e);
                }}
                className={`px-10 py-3 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105 ${saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                    : 'bg-blue-500 hover:bg-blue-600 shadow-lg'
                  }`}
              >
                {saving ? 'Saving...' : loadingExistingData ? 'Loading...' : (hasExistingData ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 p-4">
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
                    <TrashIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`} />
                  </div>
                  <h3 className="text-lg font-semibold">Delete Dispatch Data</h3>
                </div>
                <button
                  onClick={handleCancelDelete}
                  className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                    }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                    Are you sure you want to delete all dispatch data for this order? This action cannot be undone.
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
                        This will permanently remove all dispatch data for this order.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-6">
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${saving
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                      }`}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="h-4 w-4" />
                        Delete Dispatch Data
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    disabled={saving}
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
    </>
  );
}