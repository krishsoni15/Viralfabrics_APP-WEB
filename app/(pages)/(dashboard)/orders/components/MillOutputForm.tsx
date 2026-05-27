'use client';

import { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  PlusIcon,
  CalendarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  TrashIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import { FileText } from 'lucide-react';
import { Order } from '@/types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { createPortal } from 'react-dom';
import { getDisplayOrderId } from '@/utils/orders';

interface MillOutputItem {
  id: string;
  _id?: string; // Database ID for existing records
  recdDate: string;
  millBillNo: string;
  finishedMtr: string;
  quality: string; // Add quality field
  additionalFinishedMtr: { meters: string; quality: string; _id?: string }[]; // Add quality and _id to additional fields
}

interface MillOutputFormData {
  orderId: string;
  millOutputItems: MillOutputItem[];
}

interface MillOutputFormProps {
  order: Order | null;
  qualities: any[]; // Add qualities prop
  onClose: () => void;
  onSuccess: (operationType?: 'add' | 'edit' | 'delete') => void;
  onRefreshQualities?: () => void; // Add quality refresh function
  isOpen?: boolean; // Add isOpen prop like LabDataModal
  isEditing?: boolean;
  existingMillOutputs?: any[];
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
          className={`fixed z-[9999999] p-2 rounded-lg border shadow-2xl calendar-container date-picker max-w-xs ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
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

// Enhanced Dropdown Component
function EnhancedDropdown({
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
  recentlyAddedId
}: {
  options: any[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onSelect: (item: any) => void;
  isDarkMode: boolean;
  error?: string;
  recentlyAddedId?: string | null;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest('.calendar-container') || target.closest('.date-picker')) {
          return;
        }
        onToggleDropdown();
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, onToggleDropdown]);

  // Get selected item name for display
  const selectedItem = Array.isArray(options) ? options.find(option => (option._id || (option as any).id) === value) : null;
  const displayValue = selectedItem ? selectedItem.name : searchValue;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex-1 relative">
        <input
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            const newValue = e.target.value;
            onSearchChange(newValue);
            // ⚡ FIX: Don't clear selection when typing - only clear when user explicitly clears or selects new item
            // This prevents quality from being cleared in other items when typing in one item
          }}
          onFocus={() => onToggleDropdown()}
          className={`w-full p-3 rounded-lg border ${isDarkMode
            ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } ${error ? 'border-red-500' : ''} focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {searchValue && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSearchChange('');
                onChange('');
              }}
              className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'
                }`}
              title="Clear"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''
            } ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        </div>
      </div>

      {showDropdown && (
        <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl max-h-60 overflow-y-auto dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
          }`}>
          {Array.isArray(options) && options.length > 0 ? (
            [...options].sort((a, b) => {
              const aIsRecent = recentlyAddedId === (a._id || (a as any).id);
              const bIsRecent = recentlyAddedId === (b._id || (b as any).id);
              if (aIsRecent && !bIsRecent) return 1;
              if (!aIsRecent && bIsRecent) return -1;
              return a.name.localeCompare(b.name);
            }).map((option, index) => (
              <button
                key={option._id || (option as any).id || `quality-${index}-${option.name}`}
                type="button"
                onClick={() => onSelect(option)}
                className={`w-full p-3 text-left transition-colors ${isDarkMode
                  ? 'text-white hover:bg-gray-700'
                  : 'text-gray-900 hover:bg-gray-50'
                  } ${value === (option._id || (option as any).id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${recentlyAddedId === (option._id || (option as any).id) ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500' : ''
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{option.name}</span>
                      {recentlyAddedId === (option._id || (option as any).id) && (
                        <span className={`px-2 py-1 text-xs rounded-full ${isDarkMode
                          ? 'bg-green-600 text-white'
                          : 'bg-green-100 text-green-800'
                          }`}>
                          New
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {value === (option._id || (option as any).id) && (
                      <CheckIcon className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
              <div className="flex flex-col items-center space-y-2">
                <MagnifyingGlassIcon className="h-8 w-8 opacity-50" />
                <p className="font-medium">No qualities found</p>
                <p className="text-sm">Try adjusting your search</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MillOutputForm({
  order,
  qualities,
  onClose,
  onSuccess,
  onRefreshQualities,
  isOpen = true, // Default to true for backward compatibility
  isEditing = false,
  existingMillOutputs = []
}: MillOutputFormProps) {
  const { isDarkMode, mounted } = useDarkMode();

  console.log('MillOutputForm props:', {
    order: order?.orderId,
    qualities: qualities?.length,
    isEditing,
    existingMillOutputs: existingMillOutputs?.length
  });

  // Refresh qualities when form is opened
  useEffect(() => {
    if (isOpen && onRefreshQualities) {
      console.log('MillOutputForm: Refreshing qualities on form open');
      onRefreshQualities();
    }
  }, [isOpen, onRefreshQualities]);

  // ⚡ FIX: Initialize localQualities from qualities prop when form opens
  useEffect(() => {
    if (isOpen && qualities && Array.isArray(qualities) && qualities.length > 0) {
      setLocalQualities(prev => {
        // Only initialize if localQualities is empty
        if (prev.length === 0) {
          console.log('🔄 MillOutputForm: Initializing localQualities from prop on form open:', qualities.length, 'qualities');
          return qualities;
        }
        return prev;
      });
    }
  }, [isOpen, qualities]);

  // Debug logging for qualities prop
  const [formData, setFormData] = useState<MillOutputFormData>({
    orderId: order?.orderId || '',
    millOutputItems: [{
      id: '1',
      recdDate: '',
      millBillNo: '',
      finishedMtr: '',
      quality: '', // Add quality field
      additionalFinishedMtr: []
    }]
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // ⚡ FIX: Prevent multiple simultaneous operations
  const operationInProgressRef = useRef(false);

  // LabDataModal pattern states
  const [hasExistingData, setHasExistingData] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // ⚡ CRITICAL: Track if we just updated to prevent reloading deleted items
  const justUpdatedRef = useRef(false);

  // Quality-related state
  const [activeQualityDropdown, setActiveQualityDropdown] = useState<{ itemId: string; type: 'main' | 'additional'; index?: number } | null>(null);
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
          console.log('🔄 MillOutputForm: Synced localQualities with prop qualities:', merged.length, 'qualities');
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
        console.log('🎉 MillOutputForm: Received qualityAdded event:', newQuality.name);

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
            console.log('✅ Adding new quality to MillOutputForm localQualities:', newQuality.name);
            return [newQuality, ...prev];
          }
          return prev;
        });
      }
    };

    // Listen for qualitiesRefreshed event to fetch fresh data
    const handleQualitiesRefreshed = async () => {
      console.log('🔄 MillOutputForm: Received qualitiesRefreshed event, fetching fresh data...');

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
              console.log('✅ MillOutputForm: Refreshed qualities from server:', qualitiesData.data.length, 'qualities');
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

  // Load existing mill output data when form opens (smart logic)
  useEffect(() => {
    console.log('🔄 MillOutputForm useEffect triggered:', { isOpen, orderId: order?.orderId, existingMillOutputsLength: existingMillOutputs?.length, justUpdated: justUpdatedRef.current });

    // ⚡ CRITICAL: Skip reloading if we just updated - form state already has correct data
    if (justUpdatedRef.current) {
      console.log('⏭️ Skipping data reload - form was just updated, keeping current state');
      return;
    }

    if (isOpen && order?.orderId) {
      console.log('📂 Form opened, loading existing mill output data...');

      // Smart logic: Use isEditing prop to determine if we should fetch data
      console.log('🔍 Mill Output Smart Logic:', {
        isEditing,
        willFetchData: isEditing,
        orderId: order.orderId
      });

      // Reset all states first to avoid showing stale data
      setHasExistingData(false);
      setLoadingData(true);
      setErrors({});
      setSuccessMessage('');
      setShowDeleteConfirm(false);
      setItemToDelete(null);

      // Reset form data to initial state
      setFormData({
        orderId: order.orderId || '',
        millOutputItems: [{
          id: '1',
          recdDate: '',
          millBillNo: '',
          finishedMtr: '',
          quality: '',
          additionalFinishedMtr: []
        }]
      });

      // Smart API logic:
      // - If isEditing is true → Fetch API (edit mode)
      // - If isEditing is false → Skip API call (add mode)
      // ⚡ CRITICAL: Also check if update is in progress - don't reload during update
      if (isEditing && !operationInProgressRef.current && !justUpdatedRef.current) {
        console.log('📊 Edit mode detected - fetching existing mill output data');
        setTimeout(() => {
          fetchExistingMillOutputData();
        }, 100);
      } else {
        if (operationInProgressRef.current || justUpdatedRef.current) {
          console.log('⏭️ Skipping data fetch - update in progress or just completed');
        } else {
          console.log('⚡ Add mode detected - skipping API call');
        }
        setLoadingData(false);
      }
    } else if (!isOpen) {
      // Reset loading state when form is closed
      setLoadingData(false);
      // Reset the flag when form closes (in case it was set)
      justUpdatedRef.current = false;
    }
  }, [isOpen, order?.orderId, isEditing]);

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

  // Function to fetch existing mill output data from API (smooth pattern)
  const fetchExistingMillOutputData = async () => {
    if (!order?.orderId) {
      console.log('No order ID available for fetching mill outputs');
      setHasExistingData(false);
      setLoadingData(false);
      return;
    }

    console.log('🔄 Starting to fetch mill output data for order:', order.orderId);
    setLoadingData(true);

    // Fetch in background for smooth experience
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No authentication token available');
        setHasExistingData(false);
        setLoadingData(false);
        return;
      }

      console.log('📡 Fetching mill outputs for order:', order.orderId);

      // Create AbortController for timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for reliable response

      const response = await fetch(`/api/mill-outputs?orderId=${order.orderId}&t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Full API response:', JSON.stringify(data, null, 2));

        if (data.success && data.data && data.data.millOutputs && data.data.millOutputs.length > 0) {
          console.log('✅ Found existing mill outputs:', data.data.millOutputs.length, 'records');
          console.log('Mill outputs data:', data.data.millOutputs);
          setHasExistingData(true);
          await loadExistingMillOutputsFromData(data.data.millOutputs);
          console.log('✅ Mill output data loaded successfully - form should now show data');
        } else {
          console.log('❌ No existing mill outputs found in API response');
          console.log('Response structure:', {
            success: data.success,
            hasData: !!data.data,
            hasMillOutputs: !!(data.data && data.data.millOutputs),
            millOutputsLength: data.data?.millOutputs?.length || 0
          });
          setHasExistingData(false);
          setLoadingData(false);

          // Set empty form data when no existing data
          const emptyFormData = {
            orderId: order.orderId || '',
            millOutputItems: [{
              id: '1',
              recdDate: '',
              millBillNo: '',
              finishedMtr: '',
              quality: '',
              additionalFinishedMtr: []
            }],
            _lastUpdated: Date.now()
          };

          setFormData(emptyFormData);
          console.log('✅ Empty form data set - ready for new mill output entry');
        }
      } else {
        console.log('❌ Failed to fetch mill outputs from API, status:', response.status);
        const errorText = await response.text();
        console.log('Error response:', errorText);
        setHasExistingData(false);
        setLoadingData(false);

        // Set empty form data when API fails
        const errorFormData = {
          orderId: order.orderId || '',
          millOutputItems: [{
            id: '1',
            recdDate: '',
            millBillNo: '',
            finishedMtr: '',
            quality: '',
            additionalFinishedMtr: []
          }],
          _lastUpdated: Date.now()
        };

        setFormData(errorFormData);
        console.log('✅ Error form data set - ready for new mill output entry');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('❌ Mill outputs fetch was aborted due to timeout');
      } else {
        console.error('❌ Error fetching mill outputs from API:', error);
      }
      setHasExistingData(false);
      setLoadingData(false);

      // Set empty form data when error occurs
      const catchFormData = {
        orderId: order.orderId || '',
        millOutputItems: [{
          id: '1',
          recdDate: '',
          millBillNo: '',
          finishedMtr: '',
          quality: '',
          additionalFinishedMtr: []
        }],
        _lastUpdated: Date.now()
      };

      setFormData(catchFormData);
      console.log('✅ Catch form data set - ready for new mill output entry');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoadingData(false);
      console.log('🔄 Mill output data fetch completed');
    }
  };

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
    if (qualities && qualities.length > 0 && formData.millOutputItems.length > 0 && hasExistingData) {
      console.log('Updating quality search states with loaded qualities');
      const newQualitySearchStates: { [key: string]: string } = {};

      formData.millOutputItems.forEach((item) => {
        // Set main quality search state
        if (item.quality) {
          const qualityObj = qualities.find(q => (q._id || q.id) === item.quality);
          if (qualityObj) {
            newQualitySearchStates[`${item.id}_main`] = qualityObj.name;
          }
        }

        // Set additional quality search states
        item.additionalFinishedMtr.forEach((additional: any, index: number) => {
          if (additional.quality) {
            const qualityObj = qualities.find(q => (q._id || q.id) === additional.quality);
            if (qualityObj) {
              newQualitySearchStates[`${item.id}_additional_${index}`] = qualityObj.name;
            }
          }
        });
      });

      setQualitySearchStates(prev => ({ ...prev, ...newQualitySearchStates }));
    }
  }, [qualities, formData.millOutputItems, hasExistingData]);

  // Note: Removed dependency on isEditing and existingMillOutputs props
  // Form now fetches data independently from API like LabDataModal

  // Reset form when order changes (but not when editing)
  useEffect(() => {
    if (order && !isEditing) {
      setFormData({
        orderId: order.orderId,
        millOutputItems: [{
          id: '1',
          recdDate: '',
          millBillNo: '',
          finishedMtr: '',
          quality: '', // Add quality field
          additionalFinishedMtr: []
        }]
      });
      setErrors({});
    }
  }, [order?.orderId, isEditing]);

  // Function to load existing mill outputs from API data (LabDataModal pattern)
  const loadExistingMillOutputsFromData = async (millOutputsData: any[]) => {
    console.log('🔄 Loading existing mill outputs from API data:', { order: order?.orderId, millOutputsData });

    if (!order || millOutputsData.length === 0) {
      console.log('❌ No order or existing mill outputs found');
      setHasExistingData(false);
      return;
    }

    try {
      // Group mill outputs by bill number and date
      const groupedOutputs = groupMillOutputsByBillAndDate(millOutputsData);
      console.log('Grouped outputs from API:', groupedOutputs);

      if (groupedOutputs.length > 0) {
        const newFormData = {
          orderId: order.orderId,
          millOutputItems: groupedOutputs.map((group, index) => ({
            id: (index + 1).toString(),
            recdDate: group.recdDate,
            millBillNo: group.millBillNo,
            finishedMtr: (group.mainOutput.finishedMtr || 0).toString(),
            quality: group.mainOutput.quality?._id || group.mainOutput.quality || '', // Extract quality ID
            additionalFinishedMtr: group.additionalOutputs.map((output: any) => ({
              meters: (output.finishedMtr || 0).toString(),
              quality: output.quality?._id || output.quality || '' // Extract quality ID
            }))
          }))
        };

        console.log('🔄 Setting form data from API:', newFormData);

        // Add a timestamp to force re-render
        const formDataWithTimestamp = {
          ...newFormData,
          _lastUpdated: Date.now()
        };

        setFormData(formDataWithTimestamp);
        setHasExistingData(true);
        setLoadingData(false); // Ensure loading state is cleared
        console.log('✅ Form data set successfully - form should now display the data');

        // Set quality search states for proper display
        const newQualitySearchStates: { [key: string]: string } = {};
        newFormData.millOutputItems.forEach((item) => {
          // Set main quality search state
          if (item.quality) {
            const qualityObj = qualities?.find(q => (q._id || q.id) === item.quality);
            if (qualityObj) {
              newQualitySearchStates[`${item.id}_main`] = qualityObj.name;
            }
          }

          // Set additional quality search states
          item.additionalFinishedMtr.forEach((additional: any, index: number) => {
            if (additional.quality) {
              const qualityObj = qualities?.find(q => (q._id || q.id) === additional.quality);
              if (qualityObj) {
                newQualitySearchStates[`${item.id}_additional_${index}`] = qualityObj.name;
              }
            }
          });
        });
        setQualitySearchStates(newQualitySearchStates);
      } else {
        console.log('No grouped outputs found from API');
        setHasExistingData(false);
      }
    } catch (error) {
      console.error('Error loading existing mill outputs from API:', error);
      setHasExistingData(false);
    }
  };

  // Function to load existing mill outputs from props (LabDataModal pattern)
  const loadExistingMillOutputs = async () => {
    console.log('Loading existing mill outputs from props:', { order: order?.orderId, existingMillOutputs });

    if (!order || existingMillOutputs.length === 0) {
      console.log('No order or existing mill outputs found');
      setHasExistingData(false);
      return;
    }

    // Removed loading state
    try {
      // Group mill outputs by bill number and date
      const groupedOutputs = groupMillOutputsByBillAndDate(existingMillOutputs);
      console.log('Grouped outputs from props:', groupedOutputs);

      if (groupedOutputs.length > 0) {
        const newFormData = {
          orderId: order.orderId,
          millOutputItems: groupedOutputs.map((group, index) => ({
            id: (index + 1).toString(),
            _id: group.mainOutput._id, // Store database ID for updates
            recdDate: group.recdDate instanceof Date
              ? group.recdDate.toISOString().split('T')[0]
              : (group.recdDate ? new Date(group.recdDate).toISOString().split('T')[0] : ''),
            millBillNo: group.millBillNo,
            finishedMtr: (group.mainOutput.finishedMtr || 0).toString(),
            quality: group.mainOutput.quality?._id || group.mainOutput.quality || '', // Extract quality ID
            additionalFinishedMtr: group.additionalOutputs.map((output: any) => ({
              _id: output._id, // Store database ID for updates
              meters: (output.finishedMtr || 0).toString(),
              quality: output.quality?._id || output.quality || '' // Extract quality ID
            }))
          }))
        };

        console.log('Setting form data from props:', newFormData);
        setFormData(newFormData);
        setHasExistingData(true);

        // Set quality search states for proper display
        const newQualitySearchStates: { [key: string]: string } = {};
        newFormData.millOutputItems.forEach((item) => {
          // Set main quality search state
          if (item.quality) {
            const qualityObj = qualities?.find(q => (q._id || q.id) === item.quality);
            if (qualityObj) {
              newQualitySearchStates[`${item.id}_main`] = qualityObj.name;
            }
          }

          // Set additional quality search states
          item.additionalFinishedMtr.forEach((additional: any, index: number) => {
            if (additional.quality) {
              const qualityObj = qualities?.find(q => (q._id || q.id) === additional.quality);
              if (qualityObj) {
                newQualitySearchStates[`${item.id}_additional_${index}`] = qualityObj.name;
              }
            }
          });
        });
        setQualitySearchStates(newQualitySearchStates);
      } else {
        console.log('No grouped outputs found from props');
        setHasExistingData(false);
      }
    } catch (error) {
      console.error('Error loading existing mill outputs from props:', error);
      setHasExistingData(false);
    } finally {
      // Removed loading state
    }
  };

  // Helper function to group mill outputs by bill and date
  const groupMillOutputsByBillAndDate = (millOutputs: any[]) => {
    const groups: any[] = [];

    // Sort outputs by creation date to ensure consistent ordering
    const sortedOutputs = [...millOutputs].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateA.getTime() - dateB.getTime();
    });

    sortedOutputs.forEach((output: any, index: number) => {
      const existingGroup = groups.find(group =>
        group.millBillNo === output.millBillNo && group.recdDate === output.recdDate
      );

      if (existingGroup) {
        // Add as additional output with ID
        existingGroup.additionalOutputs.push({
          _id: output._id,
          finishedMtr: output.finishedMtr,
          quality: output.quality || ''
        });
      } else {
        // Create new group with main output ID
        groups.push({
          recdDate: output.recdDate,
          millBillNo: output.millBillNo,
          mainOutput: {
            _id: output._id,
            finishedMtr: output.finishedMtr,
            quality: output.quality || ''
          },
          additionalOutputs: []
        });
      }
    });

    return groups;
  };

  // Add new mill output item
  const addMillOutputItem = () => {
    // ⚡ FIX: Generate unique ID based on timestamp to avoid conflicts
    const newId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setFormData({
      ...formData,
      millOutputItems: [
        ...formData.millOutputItems, // Keep ALL existing items first (oldest at top)
        {
          id: newId,
          recdDate: '',
          millBillNo: '',
          finishedMtr: '',
          quality: '', // ⚡ FIX: Empty quality - no auto-fill
          additionalFinishedMtr: []
        }
      ]
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
      const newItemElement = document.getElementById(`mill-output-item-${newId}`);
      if (newItemElement) {
        newItemElement.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, 100);
  };

  // Remove mill output item
  const removeMillOutputItem = (itemId: string) => {
    if (formData.millOutputItems.length > 1) {
      // ⚡ FIX: Remove item and clean up all related quality search states
      const itemToRemove = formData.millOutputItems.find(item => item.id === itemId);

      setFormData({
        ...formData,
        millOutputItems: formData.millOutputItems.filter(item => item.id !== itemId)
      });

      // ⚡ FIX: Clean up quality search states for deleted item
      if (itemToRemove) {
        setQualitySearchStates(prev => {
          const newStates = { ...prev };
          // Remove main quality search state
          delete newStates[`${itemId}_main`];
          // Remove all additional quality search states for this item
          itemToRemove.additionalFinishedMtr.forEach((_, index) => {
            delete newStates[`${itemId}_additional_${index}`];
          });
          return newStates;
        });
      }

      // ⚡ FIX: Clear active dropdown if it was for the deleted item
      if (activeQualityDropdown?.itemId === itemId) {
        setActiveQualityDropdown(null);
        setCurrentQualitySearch('');
      }
    }
  };

  // Update mill output item
  const updateMillOutputItem = (itemId: string, field: keyof MillOutputItem, value: string) => {
    setFormData({
      ...formData,
      millOutputItems: formData.millOutputItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    });
  };

  // Add additional finished meters
  const addAdditionalFinishedMtr = (itemId: string) => {
    setFormData({
      ...formData,
      millOutputItems: formData.millOutputItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            additionalFinishedMtr: [...item.additionalFinishedMtr, { meters: '', quality: '' }]
          }
          : item
      )
    });
  };

  // Remove additional finished meters
  const removeAdditionalFinishedMtr = (itemId: string, index: number) => {
    const item = formData.millOutputItems.find(item => item.id === itemId);
    const subItemToRemove = item?.additionalFinishedMtr[index];

    // ⚡ FIX: Clean up quality search state for deleted sub-item
    if (subItemToRemove) {
      setQualitySearchStates(prev => {
        const newStates = { ...prev };
        delete newStates[`${itemId}_additional_${index}`];
        // Also clean up states for items after the deleted one (indices shift)
        item.additionalFinishedMtr.forEach((_, i) => {
          if (i > index) {
            const oldKey = `${itemId}_additional_${i}`;
            const newKey = `${itemId}_additional_${i - 1}`;
            if (prev[oldKey]) {
              newStates[newKey] = prev[oldKey];
              delete newStates[oldKey];
            }
          }
        });
        return newStates;
      });
    }

    // ⚡ FIX: Clear active dropdown if it was for the deleted sub-item
    if (activeQualityDropdown?.itemId === itemId && activeQualityDropdown?.type === 'additional' && activeQualityDropdown?.index === index) {
      setActiveQualityDropdown(null);
      setCurrentQualitySearch('');
    }

    setFormData({
      ...formData,
      millOutputItems: formData.millOutputItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            additionalFinishedMtr: item.additionalFinishedMtr.filter((_, i) => i !== index)
          }
          : item
      )
    });
  };

  // ⚡ FIX: Remove only M1 (main entry) - if M2 exists, move it to M1
  const removeMainFinishedMtr = (itemId: string) => {
    setFormData({
      ...formData,
      millOutputItems: formData.millOutputItems.map(item => {
        if (item.id === itemId) {
          // If there are additional entries (M2, M3, etc.), move the first one (M2) to M1
          if (item.additionalFinishedMtr.length > 0) {
            const firstAdditional = item.additionalFinishedMtr[0];
            return {
              ...item,
              finishedMtr: firstAdditional.meters, // Move M2 to M1
              quality: firstAdditional.quality, // Move M2 quality to M1
              additionalFinishedMtr: item.additionalFinishedMtr.slice(1) // Remove M2 from additional list
            };
          } else {
            // No additional entries, just clear M1
            return {
              ...item,
              finishedMtr: '',
              quality: ''
            };
          }
        }
        return item;
      })
    });
  };

  // Update additional finished meters
  const updateAdditionalFinishedMtr = (itemId: string, index: number, field: 'meters' | 'quality', value: string) => {
    setFormData({
      ...formData,
      millOutputItems: formData.millOutputItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            additionalFinishedMtr: item.additionalFinishedMtr.map((additional, i) =>
              i === index ? { ...additional, [field]: value } : additional
            )
          }
          : item
      )
    });
  };

  // Quality helper functions
  const getQualityId = (quality: any) => {
    return quality?._id || quality?.id || quality;
  };

  const getFilteredQualities = (itemId: string, type: 'main' | 'additional', index?: number) => {
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

    // Debug logging
    console.log('MillOutputForm getFilteredQualities called:', { itemId, type, index, allQualities: allQualities.length, localQualities: localQualities.length, propQualities: qualities?.length });
    // Safety check for undefined qualities
    if (!allQualities || !Array.isArray(allQualities) || allQualities.length === 0) {
      console.log('MillOutputForm: No qualities available or not an array:', allQualities);
      return [];
    }

    const searchKey = `${itemId}_${type}${index !== undefined ? `_${index}` : ''}`;
    const searchTerm = activeQualityDropdown?.itemId === itemId && activeQualityDropdown?.type === type && activeQualityDropdown?.index === index
      ? currentQualitySearch
      : (qualitySearchStates[searchKey] || '');

    const filtered = allQualities.filter(quality =>
      quality?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const handleQualitySelect = (itemId: string, type: 'main' | 'additional', quality: any, index?: number) => {
    const qualityId = getQualityId(quality);
    const searchKey = `${itemId}_${type}${index !== undefined ? `_${index}` : ''}`;

    // ⚡ FIX: Only update the specific item's quality, not others
    if (type === 'main') {
      updateMillOutputItem(itemId, 'quality', qualityId);
    } else {
      updateAdditionalFinishedMtr(itemId, index!, 'quality', qualityId);
    }

    // ⚡ FIX: Update search state for this specific item only
    setQualitySearchStates(prev => ({ ...prev, [searchKey]: quality.name }));

    // ⚡ FIX: Only update currentQualitySearch if this is the active dropdown
    if (activeQualityDropdown?.itemId === itemId && activeQualityDropdown?.type === type && activeQualityDropdown?.index === index) {
      setCurrentQualitySearch(quality.name);
    }

    setActiveQualityDropdown(null);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    formData.millOutputItems.forEach((item, itemIndex) => {
      if (!item.recdDate || item.recdDate.trim() === '') {
        newErrors[`recdDate_${item.id}`] = 'Received date is required';
      }

      if (!item.millBillNo || item.millBillNo.trim() === '') {
        newErrors[`millBillNo_${item.id}`] = 'Mill bill number is required';
      }

      if (!item.finishedMtr || item.finishedMtr.trim() === '' || parseFloat(item.finishedMtr) <= 0) {
        newErrors[`finishedMtr_${item.id}`] = 'Valid finished meters is required';
      }

      // Mill rate is now optional - no validation required

      if (!item.quality || item.quality.trim() === '') {
        newErrors[`quality_${item.id}`] = 'Quality is required';
      }

      // Validate additional finished meters
      item.additionalFinishedMtr.forEach((additional, additionalIndex) => {
        if (!additional.meters || additional.meters.trim() === '' || parseFloat(additional.meters) <= 0) {
          newErrors[`additionalFinishedMtr_${item.id}_${additionalIndex}_meters`] = 'Valid additional finished meters is required';
        }
        if (!additional.quality || additional.quality.trim() === '') {
          newErrors[`additionalQuality_${item.id}_${additionalIndex}`] = 'Quality is required';
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission (LabDataModal pattern)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚡ FIX: Prevent multiple simultaneous submissions
    if (operationInProgressRef.current || saving) {
      console.warn('⚠️ Operation already in progress, ignoring duplicate submission');
      return;
    }

    // ⚡ FIX: Allow submission even if form is empty (user deleted all items)
    if (formData.millOutputItems.length === 0) {
      console.log('⚠️ Form is empty - user deleted all items, proceeding with update to clear all data');
    } else if (!validateForm()) {
      return;
    }

    // ⚡ FIX: Set operation flag immediately
    operationInProgressRef.current = true;
    setSaving(true);
    setSuccessMessage('');
    setErrors({});

    try {
      if (hasExistingData) {
        // Update existing mill outputs
        console.log('🔄 Updating existing mill outputs...');
        await updateExistingMillOutputs();
      } else {
        // Create new mill outputs
        console.log('➕ Creating new mill outputs...');
        await createNewMillOutputs();
      }

      setSuccessMessage('Mill output data saved successfully!');

      // Determine operation type before updating hasExistingData
      const operationType = hasExistingData ? 'edit' : 'add';

      // ⚡ CRITICAL: Mark that we just updated to prevent reloading deleted items
      justUpdatedRef.current = true;

      // ⚡ OPTIMIZED: Immediately update local state for better UX
      setHasExistingData(true);

      // ⚡ FIX: DON'T reload from API after update - keep current form state
      console.log('✅ Update completed - keeping current form state (deletions already applied)');
      console.log('📋 Final form state after update:', {
        millOutputItemsCount: formData.millOutputItems.length,
        items: formData.millOutputItems.map(item => ({
          id: item.id,
          millBillNo: item.millBillNo,
          finishedMtr: item.finishedMtr,
          quality: item.quality,
          additionalCount: item.additionalFinishedMtr?.length || 0
        }))
      });

      // ⚡ OPTIMIZED: Close immediately after showing success (no artificial delay)
      onSuccess(operationType);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
        // Reset the flag after form closes
        setTimeout(() => {
          justUpdatedRef.current = false;
        }, 1000);
      }, 500);
    } catch (error) {
      setErrors({ submit: 'Failed to handle mill output' });
    } finally {
      setSaving(false);
      // ⚡ FIX: Clear operation flag
      operationInProgressRef.current = false;
    }
  };

  // ⚡ FIX: Function to create new mill outputs (with deduplication and sequential processing)
  const createNewMillOutputs = async () => {
    // Get auth token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('📝 Creating mill outputs for items:', formData.millOutputItems.length, 'items');
    console.log('📝 Form data mill output items:', formData.millOutputItems);

    // ⚡ FIX: Handle empty form gracefully - allow deletion of all items
    if (formData.millOutputItems.length === 0) {
      console.log('⚠️ No mill output items to create - this is valid if user deleted all items');
      return []; // Return empty array instead of throwing error
    }

    // ⚡ FIX: Deduplicate items by recdDate + millBillNo to prevent duplicates
    // NOTE: Same quality is allowed - we only prevent duplicate date+bill combinations
    const seenItems = new Set<string>();
    const uniqueItems = formData.millOutputItems.filter(item => {
      const key = `${item.recdDate}-${item.millBillNo}`;
      if (seenItems.has(key)) {
        console.warn('⚠️ Skipping duplicate mill output item (same date+bill):', key);
        return false;
      }
      seenItems.add(key);
      return true;
    });

    console.log('📝 Valid unique items to create:', uniqueItems.length, '(filtered from', formData.millOutputItems.length, 'total)');

    // ⚡ FIX: Process sequentially to prevent race conditions
    const results = [];
    for (let index = 0; index < uniqueItems.length; index++) {
      const item = uniqueItems[index];
      console.log(`📝 Processing mill output item ${index + 1}:`, item);
      // Main mill output
      const millOutputData = {
        orderId: formData.orderId,
        recdDate: item.recdDate,
        millBillNo: item.millBillNo.trim(),
        finishedMtr: parseFloat(item.finishedMtr),
        quality: item.quality // Add quality field
      };

      console.log(`📤 Sending mill output request for item ${index + 1}/${uniqueItems.length}:`, millOutputData);

      // ⚡ FIX: Process main item sequentially
      const mainResponse = await fetch('/api/mill-outputs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(millOutputData)
      });

      const mainData = await mainResponse.json();
      console.log(`📥 Response for mill output item ${index + 1}:`, mainData);

      if (!mainResponse.ok || !mainData.success) {
        throw new Error(mainData.message || `Failed to create mill output item ${index + 1}`);
      }

      results.push(mainData);

      // ⚡ FIX: Process additional finished meters sequentially
      for (const additional of item.additionalFinishedMtr) {
        const additionalMillOutputData = {
          orderId: formData.orderId,
          recdDate: item.recdDate,
          millBillNo: item.millBillNo.trim(),
          finishedMtr: parseFloat(additional.meters),
          quality: additional.quality
        };

        const additionalResponse = await fetch('/api/mill-outputs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(additionalMillOutputData)
        });

        const additionalData = await additionalResponse.json();

        if (!additionalResponse.ok || !additionalData.success) {
          throw new Error(additionalData.message || 'Failed to create additional mill output');
        }

        results.push(additionalData);
      }
    }

    console.log('✅ Successfully created', results.length, 'mill outputs');
  };

  // Delete mill output data (LabDataModal pattern)
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
      const response = await fetch(`/api/mill-outputs?orderId=${order?.orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccessMessage('Mill output data deleted successfully!');
          setHasExistingData(false);

          // Reset form to initial state
          setFormData({
            orderId: order?.orderId || '',
            millOutputItems: [{
              id: '1',
              recdDate: '',
              millBillNo: '',
              finishedMtr: '',
              quality: '',
              additionalFinishedMtr: []
            }]
          });

          console.log('🎯 Mill output data deleted successfully, closing form and updating button state');

          // ⚡ OPTIMIZED: Close immediately (no artificial delay)
          onSuccess('delete');
          setTimeout(() => {
            setSuccessMessage('');
            onClose();
          }, 500);
        } else {
          setErrors({ submit: data.error || 'Failed to delete mill output data' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setErrors({ submit: errorData.error || 'Failed to delete mill output data' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setErrors({ submit: 'Failed to delete mill output data' });
    } finally {
      setSaving(false);
      operationInProgressRef.current = false;
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // ⚡ FIX: Function to update existing mill outputs (sequential delete-then-create to prevent race conditions)
  const updateExistingMillOutputs = async () => {
    // Get auth token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('🔄 Starting mill output update process...');
    console.log('📝 Current form data items:', formData.millOutputItems.length);

    // ⚡ FIX: Delete first, then create (sequential to prevent duplicates)
    const deleteResponse = await fetch(`/api/mill-outputs?orderId=${order?.orderId}`, {
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
      console.log('✅ Deleted existing mill outputs:', deleteData);
    }

    // ⚡ FIX: Wait a small moment to ensure delete is processed
    await new Promise(resolve => setTimeout(resolve, 200));

    // ⚡ FIX: Now create new outputs (handles empty form gracefully)
    const results = await createNewMillOutputs();

    console.log('✅ Mill output update completed - created', results?.length || 0, 'items');

    // ⚡ FIX: If no items were created (user deleted all), update hasExistingData to false
    if (!results || results.length === 0) {
      console.log('⚠️ No items created - user deleted all items');
      setHasExistingData(false);
    }
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
          {loadingData && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-3 text-sm font-medium">Loading mill output data...</p>
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
                <p className="mt-3 text-sm font-medium">Saving mill output data...</p>
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
                Mill Output
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

              {/* Mill Output Items */}
              <div>

                <div className="space-y-6">
                  {formData.millOutputItems.map((item, itemIndex) => (
                    <div key={item.id} id={`mill-output-item-${item.id}`} className={`p-6 rounded-xl border transition-all duration-200 hover:shadow-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                      }`}>
                      {/* ⚡ FIX: Item header with number and delete button - only show if multiple items */}
                      {formData.millOutputItems.length > 1 && (
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-300 dark:border-gray-600">
                          <h4 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            Mill Output Item {itemIndex + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeMillOutputItem(item.id)}
                            className={`p-2 rounded-lg transition-colors ${isDarkMode
                              ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                              : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                              }`}
                            title="Remove this mill output item"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}

                      {/* RECD DATE and Mill Bill No - Full Width Horizontal Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* RECD DATE */}
                        <div>
                          <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            RECD DATE <span className="text-red-500">*</span>
                          </label>
                          <CustomDatePicker
                            value={item.recdDate}
                            onChange={(value) => updateMillOutputItem(item.id, 'recdDate', value)}
                            placeholder="Select received date"
                            isDarkMode={isDarkMode}
                          />
                          {errors[`recdDate_${item.id}`] && (
                            <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                              }`}>
                              {errors[`recdDate_${item.id}`]}
                            </p>
                          )}
                        </div>

                        {/* Mill Bill No */}
                        <div>
                          <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            Mill Bill No <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={item.millBillNo || ''}
                              onChange={(e) => updateMillOutputItem(item.id, 'millBillNo', e.target.value)}
                              placeholder="Enter mill bill number"
                              required
                              className={`w-full px-4 py-3 pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`millBillNo_${item.id}`]
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
                          {errors[`millBillNo_${item.id}`] && (
                            <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                              }`}>
                              {errors[`millBillNo_${item.id}`]}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Finished Meters & Rates Section */}
                      <div className={`mt-6 p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-200'
                        }`}>
                        <h6 className={`text-sm font-semibold mb-4 flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Finished Meters & Rates
                        </h6>
                        <div className="space-y-4">
                          {/* M1 Fields (Always visible) - 3 columns with delete button - Full Width Horizontal Layout */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Quality for M1 */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Quality M1 <span className="text-red-500">*</span>
                              </label>
                              <EnhancedDropdown
                                options={getFilteredQualities(item.id, 'main')}
                                value={item.quality}
                                onChange={(value) => {
                                  // ⚡ FIX: Only clear quality when explicitly cleared, don't update on typing
                                  if (value === '') {
                                    updateMillOutputItem(item.id, 'quality', '');
                                  }
                                }}
                                placeholder="Search quality..."
                                searchValue={activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'main'
                                  ? currentQualitySearch
                                  : (qualitySearchStates[`${item.id}_main`] || '')}
                                onSearchChange={(value) => {
                                  if (activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'main') {
                                    setCurrentQualitySearch(value);
                                  } else {
                                    setQualitySearchStates(prev => ({ ...prev, [`${item.id}_main`]: value }));
                                  }
                                }}
                                showDropdown={activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'main'}
                                onToggleDropdown={async () => {
                                  if (activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'main') {
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

                                    setActiveQualityDropdown({ itemId: item.id, type: 'main' });
                                    setCurrentQualitySearch(qualitySearchStates[`${item.id}_main`] || '');
                                  }
                                }}
                                onSelect={(quality) => handleQualitySelect(item.id, 'main', quality)}
                                isDarkMode={isDarkMode}
                                error={errors[`quality_${item.id}`]}
                                recentlyAddedId={recentlyAddedQuality}
                              />
                            </div>
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Finished Mtr M1 <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                value={item.finishedMtr || ''}
                                onChange={(e) => updateMillOutputItem(item.id, 'finishedMtr', e.target.value)}
                                placeholder="Enter finished meters"
                                step="0.01"
                                min="0"
                                required
                                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[`finishedMtr_${item.id}`]
                                  ? isDarkMode
                                    ? 'border-red-500 bg-gray-800 text-white'
                                    : 'border-red-500 bg-white text-gray-900'
                                  : isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                  }`}
                              />
                              {errors[`finishedMtr_${item.id}`] && (
                                <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                                  }`}>
                                  {errors[`finishedMtr_${item.id}`]}
                                </p>
                              )}
                            </div>

                            {/* ⚡ FIX: Delete button for M1 only - disabled if only M1 exists (no M2) */}
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  // Only allow deletion if M2 exists (so M2 can move to M1)
                                  if (item.additionalFinishedMtr.length === 0) {
                                    return;
                                  }

                                  // Delete only M1 (main entry) - M2 will move to M1
                                  removeMainFinishedMtr(item.id);
                                }}
                                disabled={item.additionalFinishedMtr.length === 0}
                                className={`w-full px-3 py-3 rounded-lg border transition-all duration-150 flex items-center justify-center ${item.additionalFinishedMtr.length === 0
                                  ? isDarkMode
                                    ? 'border-gray-600/50 text-gray-500 bg-gray-800/50 cursor-not-allowed opacity-60'
                                    : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'
                                  : isDarkMode
                                    ? 'border-red-600/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-300 bg-red-900/10'
                                    : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 bg-red-50/50'
                                  }`}
                                title={item.additionalFinishedMtr.length === 0 ? "Cannot delete - at least one entry (M1) required" : "Delete M1 only (M2 will move to M1 if exists)"}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          {/* Additional Fields (M2, M3, M4, etc.) - 3 columns with delete button in same row - Full Width Horizontal Layout */}
                          {item.additionalFinishedMtr.map((additional, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Quality for Additional Meters */}
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Quality M{index + 2} <span className="text-red-500">*</span>
                                </label>
                                <EnhancedDropdown
                                  options={getFilteredQualities(item.id, 'additional', index)}
                                  value={additional.quality}
                                  onChange={(value) => {
                                    // ⚡ FIX: Only clear quality when explicitly cleared, don't update on typing
                                    if (value === '') {
                                      updateAdditionalFinishedMtr(item.id, index, 'quality', '');
                                    }
                                  }}
                                  placeholder="Search quality..."
                                  searchValue={activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'additional' && activeQualityDropdown?.index === index
                                    ? currentQualitySearch
                                    : (qualitySearchStates[`${item.id}_additional_${index}`] || '')}
                                  onSearchChange={(value) => {
                                    if (activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'additional' && activeQualityDropdown?.index === index) {
                                      setCurrentQualitySearch(value);
                                    } else {
                                      setQualitySearchStates(prev => ({ ...prev, [`${item.id}_additional_${index}`]: value }));
                                    }
                                  }}
                                  showDropdown={activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'additional' && activeQualityDropdown?.index === index}
                                  onToggleDropdown={async () => {
                                    if (activeQualityDropdown?.itemId === item.id && activeQualityDropdown?.type === 'additional' && activeQualityDropdown?.index === index) {
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
                                        if (token) {
                                          const qualitiesResponse = await fetch(`/api/qualities?t=${Date.now()}`, {
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
                                              // Update local qualities immediately with fresh data
                                              setLocalQualities(qualitiesData.data);
                                            }
                                          }
                                        }
                                      } catch (error) {
                                        console.error('Error fetching fresh qualities:', error);
                                      }

                                      // Also call parent's refresh function for consistency
                                      if (onRefreshQualities) {
                                        onRefreshQualities();
                                      }

                                      setActiveQualityDropdown({ itemId: item.id, type: 'additional', index });
                                      setCurrentQualitySearch(qualitySearchStates[`${item.id}_additional_${index}`] || '');
                                    }
                                  }}
                                  onSelect={(quality) => handleQualitySelect(item.id, 'additional', quality, index)}
                                  isDarkMode={isDarkMode}
                                  error={errors[`additionalQuality_${item.id}_${index}`]}
                                  recentlyAddedId={recentlyAddedQuality}
                                />
                              </div>
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Finished Mtr M{index + 2} <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={additional.meters}
                                  onChange={(e) => updateAdditionalFinishedMtr(item.id, index, 'meters', e.target.value)}
                                  placeholder="Enter finished meters"
                                  step="0.01"
                                  min="0"
                                  required
                                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                    }`}
                                />
                              </div>

                              {/* ⚡ FIX: Delete button in same row - enabled when multiple entries exist (like dispatch) */}
                              <div className="flex items-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Only allow deletion if there's more than one entry (M1 + at least one additional)
                                    const totalEntries = 1 + (item.additionalFinishedMtr.length || 0);
                                    if (totalEntries <= 1) {
                                      return;
                                    }

                                    // Remove additional meter (M2, M3, etc.)
                                    removeAdditionalFinishedMtr(item.id, index);
                                  }}
                                  disabled={1 + (item.additionalFinishedMtr.length || 0) <= 1}
                                  className={`w-full px-3 py-3 rounded-lg border transition-all duration-150 flex items-center justify-center ${1 + (item.additionalFinishedMtr.length || 0) <= 1
                                    ? isDarkMode
                                      ? 'border-gray-600/50 text-gray-500 bg-gray-800/50 cursor-not-allowed opacity-60'
                                      : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'
                                    : isDarkMode
                                      ? 'border-red-600/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-300 bg-red-900/10'
                                      : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 bg-red-50/50'
                                    }`}
                                  title={1 + (item.additionalFinishedMtr.length || 0) <= 1 ? "Cannot delete - at least one entry required" : `Delete M${index + 2} row`}
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Add More Finished Meters & Rates Button - Full width horizontal design */}
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => addAdditionalFinishedMtr(item.id)}
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
                  ))}

                  {/* Add Item Card */}
                  <div className={`p-4 rounded-xl border-2 border-dashed transition-all duration-200 hover:shadow-lg cursor-pointer ${isDarkMode
                    ? 'border-gray-600 bg-gray-800/50 hover:border-blue-500 hover:bg-gray-800'
                    : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-gray-50'
                    }`} onClick={addMillOutputItem}>
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
                          Add New Mill Output Item
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
                {saving ? 'Saving...' : (hasExistingData ? 'Update' : 'Add')}
              </button>
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
                    <TrashIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`} />
                  </div>
                  <h3 className="text-lg font-semibold">Delete Mill Output Data</h3>
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
                    Are you sure you want to delete all mill output data for this order? This action cannot be undone.
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
                        This will permanently remove all mill output data for this order.
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
                        Delete Mill Output Data
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
