'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  XMarkIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  InformationCircleIcon,
  CalendarIcon,
  EyeIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { Order, Party, Quality, OrderFormData, OrderItem } from '@/types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useSession } from '../../hooks/useSession';
import QualityModal from './QualityModal';
import PartyModal from './PartyModal';
import CameraModal from '../../components/CameraModal';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import { getDisplayOrderId } from '@/utils/orders';

interface OrderFormProps {
  order?: Order | null;
  parties: Party[];
  qualities: Quality[];
  onClose: () => void;
  onSuccess: (updatedData?: any) => void;
  onError?: () => void;
  onStart?: () => void;
  onFormOpen?: () => void;
  onAddParty: () => void;
  onRefreshParties: (forceRefresh?: boolean) => Promise<void>;
  onAddQuality: (newQualityData?: any) => void;
  onRefreshQualities?: (forceRefresh?: boolean) => Promise<void>;
  onRemoveParty?: (partyId: string) => void;
  onRemoveQuality?: (qualityId: string) => void;
  onSetRecentlyAddedParty?: (partyId: string | null) => void;
  onSetRecentlyAddedQuality?: (qualityId: string | null) => void;
  readOnly?: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

// Helper function to safely convert date to YYYY-MM-DD format without timezone issues
const formatDateToYYYYMMDD = (date: string | Date | null | undefined): string => {
  if (!date) return '';

  // If it's already a YYYY-MM-DD string, return it directly
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }

  // If it's a Date object or date string, extract components in local timezone
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  // Use local date components to avoid timezone shifts
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Helper function to parse dates from various formats
const parseDateFromInput = (displayValue: string) => {
  if (!displayValue) return '';

  // Handle dd/mm/yyyy format specifically (most common)
  const ddMmYyyyMatch = displayValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddMmYyyyMatch) {
    const [, dayStr, monthStr, yearStr] = ddMmYyyyMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    // Validate date components properly
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      try {
        const date = new Date(year, month - 1, day);
        // Check if the date is valid (handles leap years, etc.)
        if (date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year) {
          // Format directly without timezone conversion
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      } catch (e) {
        // Invalid date
      }
    }
  }

  // Handle yyyy-mm-dd format
  const yyyyMmDdMatch = displayValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyyMmDdMatch) {
    const [, yearStr, monthStr, dayStr] = yyyyMmDdMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      try {
        const date = new Date(year, month - 1, day);
        if (date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year) {
          // Format directly without timezone conversion
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      } catch (e) {
        // Invalid date
      }
    }
  }

  // Handle partial dd/mm/yyyy (for typing)
  const partialMatch = displayValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{1,4})$/);
  if (partialMatch) {
    const [, dayStr, monthStr, yearStr] = partialMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    // Allow partial years (2 digits) and convert to 4 digits
    let fullYear = year;
    if (year < 100) {
      fullYear = year < 50 ? 2000 + year : 1900 + year;
    }

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && fullYear >= 1900 && fullYear <= 2100) {
      try {
        const date = new Date(fullYear, month - 1, day);
        if (date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === fullYear) {
          // Format directly without timezone conversion
          return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      } catch (e) {
        // Invalid date
      }
    }
  }

  // If no valid format found, return empty string to avoid validation errors
  return '';
};

// Custom Date Picker Component
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
  const parseDateFromDisplay = parseDateFromInput;

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
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value;

            // Allow any characters for free typing
            setInputValue(value);

            // Only try to parse if it looks like a complete date
            if (value.length >= 8) {
              const parsedDate = parseDateFromDisplay(value);
              onChange(parsedDate);
            } else {
              // Don't trigger validation for incomplete dates
              onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="dd/mm/yyyy"
          onFocus={() => !disabled && setShowCalendar(true)}
          className={`w-full p-3 pr-12 rounded-lg border ${isDarkMode
              ? 'bg-white/10 border-white/20 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {!disabled && value && (
            <button
              type="button"
              onClick={clearDate}
              className={`p-1.5 rounded-lg transition-all duration-200 ${isDarkMode
                  ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700/50'
                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                }`}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setShowCalendar(!showCalendar)}
            className={`p-1.5 rounded-lg transition-all duration-200 ${isDarkMode
                ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700/50'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>

      </div>

      {showCalendar && (
        <div
          ref={calendarRef}
          onClick={handleCalendarClick}
          className={`absolute z-50 mt-1 p-4 rounded-lg border shadow-xl calendar-container date-picker ${isDarkMode ? 'bg-[#1D293D] border-white/20' : 'bg-white border-gray-300 shadow-2xl'
            }`}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
              }}
              className={`p-2 rounded-lg transition-all duration-200 ${isDarkMode
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
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
                className={`px-3 py-1 rounded-lg transition-all duration-200 font-semibold ${isDarkMode
                    ? 'text-white hover:bg-gray-700'
                    : 'text-gray-900 hover:bg-blue-50 hover:text-blue-600'
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
                className={`px-3 py-1 rounded-lg transition-all duration-200 font-semibold ${isDarkMode
                    ? 'text-white hover:bg-gray-700'
                    : 'text-gray-900 hover:bg-blue-50 hover:text-blue-600'
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
              className={`p-2 rounded-lg transition-all duration-200 ${isDarkMode
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
            >
              <ChevronDownIcon className="h-4 w-4 transform -rotate-90" />
            </button>
          </div>

          {/* Month Picker */}
          {showMonthPicker && (
            <div className={`mb-4 p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'
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
                    className={`p-2 text-sm rounded-lg transition-all duration-200 ${index === currentDate.getMonth()
                        ? 'bg-blue-500 text-white shadow-md'
                        : isDarkMode
                          ? 'hover:bg-white/10 text-white hover:scale-105'
                          : 'hover:bg-blue-50 text-gray-900 hover:text-blue-600 hover:scale-105'
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
            <div className={`mb-4 p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'
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
                    className={`p-2 text-sm rounded-lg transition-all duration-200 ${year === currentDate.getFullYear()
                        ? 'bg-blue-500 text-white shadow-md'
                        : isDarkMode
                          ? 'hover:bg-white/10 text-white hover:scale-105'
                          : 'hover:bg-blue-50 text-gray-900 hover:text-blue-600 hover:scale-105'
                      }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`text-center text-sm font-medium p-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
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
                className={`p-2 text-sm rounded-lg transition-all duration-200 ${!day ? 'invisible' :
                    day.toDateString() === new Date().toDateString()
                      ? 'bg-blue-500 text-white shadow-md font-semibold' :
                      value === formatDateToYYYYMMDD(day)
                        ? isDarkMode
                          ? 'bg-blue-900 text-blue-300 font-semibold shadow-md'
                          : 'bg-blue-100 text-blue-700 font-semibold shadow-md' :
                        isDarkMode
                          ? 'text-white hover:bg-white/10 hover:scale-110'
                          : 'text-gray-900 hover:bg-blue-50 hover:text-blue-600 hover:scale-110'
                  }`}
              >
                {day?.getDate()}
              </button>
            ))}
          </div>
        </div>
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
  onAddNew,
  onDelete,
  itemIndex,
  recentlyAddedId,
  isLoading,
  deletingItems,
  disabled = false
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
  onAddNew?: () => void;
  onDelete?: (item: any) => void;
  itemIndex?: number;
  recentlyAddedId?: string | null;
  isLoading?: boolean;
  deletingItems?: string[];
  disabled?: boolean;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isMaster } = useSession();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Don't auto-close if clicking on calendar or other important elements
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
  const selectedItem = options.find(option => (option._id || (option as any).id) === value);
  const displayValue = selectedItem ? selectedItem.name : searchValue;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={placeholder}
            value={displayValue}
            disabled={disabled}
            onChange={(e) => {
              const newValue = e.target.value;
              onSearchChange(newValue);
              // Clear selection if user is typing something different
              if (selectedItem && newValue !== selectedItem.name) {
                onChange('');
              }
            }}
            onFocus={() => {
              // Always allow dropdown to open, even if loading
              if (!disabled) onToggleDropdown();
            }}
            className={`w-full p-3 rounded-lg border ${isDarkMode
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } ${error ? 'border-red-500' : ''} focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            {!disabled && searchValue && (
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
        {!disabled && onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className={`px-3 py-3 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 ${isDarkMode
                ? 'border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400'
                : 'border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600'
              }`}
            title="Add New"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl max-h-60 overflow-y-auto dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
          }`}>
          {isLoading && options.length === 0 ? (
            <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
              <div className="flex items-center justify-center space-x-2">
                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'
                  }`}></div>
                <span>Loading...</span>
              </div>
            </div>
          ) : options.length > 0 ? (
            // Sort options: recently added items last (at bottom), then alphabetically
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
                  } ${value === (option._id || (option as any).id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${recentlyAddedId === (option._id || (option as any).id) ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 animate-pulse' : ''
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
                    {(option.contactName || option.contactPhone) && (
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {option.contactName && <span>{option.contactName}</span>}
                        {option.contactName && option.contactPhone && <span> • </span>}
                        {option.contactPhone && <span>{option.contactPhone}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {value === (option._id || (option as any).id) && (
                      <CheckIcon className="h-4 w-4 text-blue-500" />
                    )}
                    {!disabled && isMaster && onDelete && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const itemId = option._id || option.id;
                          if (deletingItems?.includes(itemId)) {
                            return; // Prevent clicks while deleting
                          }
                          onDelete(option);
                        }}
                        className={`p-2 rounded-lg transition-colors ${deletingItems?.includes(option._id || option.id)
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20'
                          } ${isDarkMode
                            ? 'text-gray-400 hover:text-red-400'
                            : 'text-gray-500 hover:text-red-600'
                          }`}
                        title={deletingItems?.includes(option._id || option.id) ? "Deleting..." : "Delete"}
                      >
                        {deletingItems?.includes(option._id || option.id) ? (
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </div>
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
                <p className="font-medium">No options found</p>
                <p className="text-sm">Try adjusting your search or add a new one</p>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={onAddNew}
                    className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${isDarkMode
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    <PlusIcon className="h-3 w-3 inline mr-1" />
                    Add New
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

// Image Upload Component
function ImageUploadSection({
  itemIndex,
  imageUrls,
  onImageUpload,
  onRemoveImage,
  onPreviewImage,
  isDarkMode,
  imageUploading,
  pendingImageFiles,
  readOnly = false
}: {
  itemIndex: number;
  imageUrls: string[];
  onImageUpload: (file: File, index: number) => void;
  onRemoveImage: (itemIndex: number, imageIndex: number) => void;
  onPreviewImage: (url: string, index: number, itemIndex: number) => void;
  isDarkMode: boolean;
  imageUploading: { [key: number]: boolean };
  pendingImageFiles?: Array<{ file: File; previewUrl: string }>;
  readOnly?: boolean;
}) {
  // Combine pending files (with preview URLs) and uploaded URLs for display
  const allImages: Array<{ url: string; isPending: boolean }> = [
    ...(pendingImageFiles || []).map(p => ({ url: p.previewUrl, isPending: true })),
    ...imageUrls.map(url => ({ url, isPending: false }))
  ];
  const [showCamera, setShowCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  // Handle camera capture
  const handleCameraCapture = (file: File) => {
    onImageUpload(file, itemIndex);
    setCameraLoading(false);
  };

  // Start camera function
  const startCamera = async () => {
    setCameraLoading(true);
    // Brief delay to show loading state, then open modal
    setTimeout(() => {
      setShowCamera(true);
      setCameraLoading(false);
    }, 100);
  };

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium mb-3">Images</label>

      {/* Upload Area */}
      {!readOnly && (
        <div className="flex items-center space-x-4 mb-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file, itemIndex);
            }}
            className="hidden"
            id={`image-upload-${itemIndex}`}
          />
          <label
            htmlFor={`image-upload-${itemIndex}`}
            className={`px-6 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 hover:scale-105 ${isDarkMode
                ? 'border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400'
                : 'border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600'
              }`}
          >
            <CloudArrowUpIcon className="h-5 w-5 inline mr-2" />
            Upload Image
          </label>

          {/* Camera Button */}
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            onTouchStart={(e) => {
              // Prevent double-tap zoom on mobile
              e.preventDefault();
            }}
            className={`px-6 py-3 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 active:scale-95 ${isDarkMode
                ? 'border-gray-600 hover:border-green-500 text-gray-300 hover:text-green-400'
                : 'border-gray-300 hover:border-green-400 text-gray-600 hover:text-green-600'
              }`}
          >
            <PhotoIcon className="h-5 w-5 inline mr-2" />
            Camera
          </button>

          {imageUploading[itemIndex] && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>Uploading...</span>
            </div>
          )}
        </div>
      )}

      {/* Image Previews - Show both pending and uploaded images */}
      {allImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {allImages.map((image, imgIndex) => {
            return (
              <div key={`${itemIndex}-${imgIndex}-${image.url}`} className="relative group">
                <div className={`aspect-square rounded-lg overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all duration-200 bg-gray-100 dark:bg-gray-700 ${image.isPending
                    ? 'border-yellow-400 dark:border-yellow-500'
                    : 'border-gray-200 dark:border-gray-600'
                  }`}>
                  <img
                    src={image.url}
                    alt={`Item ${itemIndex + 1} image ${imgIndex + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => onPreviewImage(image.url, imgIndex, itemIndex)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                    onLoad={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target) {
                        target.style.opacity = '1';
                      }
                    }}
                    style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-bold">Click to view</span>
                  </div>
                </div>

                {/* Remove Button */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveImage(itemIndex, imgIndex)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all duration-200 opacity-100 z-10 hover:scale-110"
                    title="Remove Image"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Camera Modal - Using Shared Component */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => {
          setShowCamera(false);
          setCameraLoading(false);
        }}
        onCapture={handleCameraCapture}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default function OrderForm({ order, parties, qualities, onClose, onSuccess, onError, onStart, onFormOpen, onAddParty, onRefreshParties, onAddQuality, onRefreshQualities, onRemoveParty, onRemoveQuality, onSetRecentlyAddedParty, onSetRecentlyAddedQuality, readOnly = false }: OrderFormProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const { isMaster } = useSession();
  const [formData, setFormData] = useState<OrderFormData>({
    orderType: undefined,
    arrivalDate: '',
    party: '',
    contactName: '',
    contactPhone: '',
    poNumber: '',
    styleNo: '',
    poDate: '',
    deliveryDate: '',

    items: [{
      quality: '',
      quantity: '', // Always initialize as empty string, never null
      imageUrls: [],
      description: '',
      weaverSupplierName: '',
      purchaseRate: '',
      millRate: '',
      salesRate: ''
    }]
  });

  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [qualitySearch, setQualitySearch] = useState('');
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [showOrderTypeDropdown, setShowOrderTypeDropdown] = useState(false);
  const [activeQualityDropdown, setActiveQualityDropdown] = useState<number | null>(null);
  const [selectedPartyName, setSelectedPartyName] = useState('');
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [imageUploading, setImageUploading] = useState<{ [key: number]: boolean }>({});
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  // Store pending files (not yet uploaded to S3) - itemIndex -> array of {file: File, previewUrl: string}
  const [pendingImageFiles, setPendingImageFiles] = useState<{ [key: number]: Array<{ file: File; previewUrl: string }> }>({});
  const [showImagePreview, setShowImagePreview] = useState<{ url: string; index: number; itemIndex: number } | null>(null);
  const [pendingNewParty, setPendingNewParty] = useState<Party | null>(null);
  // ⚡ FIX: Local parties state to immediately show newly created parties
  const [localParties, setLocalParties] = useState<Party[]>([]);
  // ⚡ FIX: Local qualities state to immediately show newly created qualities and hide deleted ones
  const [localQualities, setLocalQualities] = useState<Quality[]>([]);
  const [qualitySearchStates, setQualitySearchStates] = useState<{ [key: number]: string }>({});
  const [recentlyAddedQuality, setRecentlyAddedQuality] = useState<string | null>(null);
  // ⚡ FIX: Track which quality fields have been manually cleared to prevent re-auto-selection
  const [manuallyClearedQualities, setManuallyClearedQualities] = useState<Set<string>>(new Set());
  const [recentlyAddedParty, setRecentlyAddedParty] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [currentQualitySearch, setCurrentQualitySearch] = useState('');
  const [deletingParty, setDeletingParty] = useState<string | null>(null);
  const [deletingQuality, setDeletingQuality] = useState<string | null>(null);
  const [deleteCounter, setDeleteCounter] = useState(0);
  // ⚡ FIX: Track deleted quality IDs to prevent them from being re-added
  // Persist across form opens using sessionStorage
  const getInitialDeletedQualityIds = (): Set<string> => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('deletedQualityIds');
        if (stored) {
          return new Set(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error loading deleted quality IDs:', e);
      }
    }
    return new Set();
  };

  const deletedQualityIdsRef = useRef<Set<string>>(getInitialDeletedQualityIds());

  // ⚡ FIX: Track deleted party IDs to prevent them from being re-added
  // Persist across form opens using sessionStorage
  const getInitialDeletedPartyIds = (): Set<string> => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('deletedPartyIds');
        if (stored) {
          return new Set(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error loading deleted party IDs:', e);
      }
    }
    return new Set();
  };

  const deletedPartyIdsRef = useRef<Set<string>>(getInitialDeletedPartyIds());

  // ⚡ FIX: Save deleted IDs to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('deletedQualityIds', JSON.stringify(Array.from(deletedQualityIdsRef.current)));
        sessionStorage.setItem('deletedPartyIds', JSON.stringify(Array.from(deletedPartyIdsRef.current)));
      } catch (e) {
        console.error('Error saving deleted IDs:', e);
      }
    }
  }, [deleteCounter]); // Use deleteCounter to trigger save when deletions happen
  const formRef = useRef<HTMLFormElement>(null);
  const hasCalledOnFormOpenRef = useRef<boolean>(false);

  // ⚡ FIX: localStorage persistence for form data to prevent data loss on tab switch
  const FORM_DATA_STORAGE_KEY = 'orderFormDraftData';
  const saveTimeoutRef = useRef<any>(null);
  const hasRestoredDataRef = useRef<boolean>(false);
  const lastSavedDataRef = useRef<string>('');

  // ⚡ CRITICAL: Immediate save function that can be called synchronously
  const saveFormDataImmediately = useCallback(() => {
    // Only save if we're creating a new order (not editing)
    if (order) return;

    if (typeof window !== 'undefined') {
      try {
        const dataToSave = {
          ...formData,
          selectedPartyName,
          qualitySearchStates
        };
        const dataString = JSON.stringify(dataToSave);

        // Only save if data actually changed
        if (dataString !== lastSavedDataRef.current) {
          localStorage.setItem(FORM_DATA_STORAGE_KEY, dataString);
          lastSavedDataRef.current = dataString;
          console.log('💾 Saved form data to localStorage (immediate)');
        }
      } catch (e) {
        console.error('Error saving form data to localStorage:', e);
      }
    }
  }, [formData, selectedPartyName, qualitySearchStates, order]);

  // Load saved form data from localStorage when form opens (only for new orders, not editing)
  // ⚡ CRITICAL: Run this immediately on mount and whenever order changes
  useEffect(() => {
    if (!order && typeof window !== 'undefined' && !hasRestoredDataRef.current) {
      try {
        const savedData = localStorage.getItem(FORM_DATA_STORAGE_KEY);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          // Restore if we have saved data (even if form not initialized yet)
          // Check for any meaningful data, not just items
          const hasData = parsed && (
            (parsed.items && parsed.items.length > 0) ||
            parsed.orderType ||
            parsed.party ||
            parsed.poNumber ||
            parsed.styleNo ||
            parsed.contactName ||
            parsed.arrivalDate
          );

          if (hasData) {
            console.log('💾 Restoring form data from localStorage');
            setFormData(prev => ({
              ...prev,
              ...parsed,
              items: parsed.items && parsed.items.length > 0 ? parsed.items : prev.items
            }));
            // Restore party name if available
            if (parsed.selectedPartyName) {
              setSelectedPartyName(parsed.selectedPartyName);
              setPartySearch(parsed.selectedPartyName);
            }
            // Restore quality search states if available
            if (parsed.qualitySearchStates) {
              setQualitySearchStates(parsed.qualitySearchStates);
            }
            hasRestoredDataRef.current = true;
            lastSavedDataRef.current = savedData;
            // Mark form as initialized since we restored data
            setFormInitialized(true);
          }
        }
      } catch (e) {
        console.error('Error loading form data from localStorage:', e);
      }
    }

    // Reset restore flag when form closes (order becomes null/undefined from a value)
    if (order === null || order === undefined) {
      // Keep the flag if we're still in the form (for new orders)
      // Only reset when form actually closes
    } else {
      // Form is editing an order, reset restore flag
      hasRestoredDataRef.current = false;
    }
  }, [order]); // Only run when order changes (form opens/closes)

  // ⚡ ADDITIONAL: Try to restore on component mount as well (in case order prop is null initially)
  useEffect(() => {
    if (!order && typeof window !== 'undefined' && !hasRestoredDataRef.current) {
      try {
        const savedData = localStorage.getItem(FORM_DATA_STORAGE_KEY);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          const hasData = parsed && (
            (parsed.items && parsed.items.length > 0) ||
            parsed.orderType ||
            parsed.party ||
            parsed.poNumber ||
            parsed.styleNo ||
            parsed.contactName ||
            parsed.arrivalDate
          );

          if (hasData) {
            console.log('💾 Restoring form data from localStorage (on mount)');
            setFormData(prev => ({
              ...prev,
              ...parsed,
              items: parsed.items && parsed.items.length > 0 ? parsed.items : prev.items
            }));
            if (parsed.selectedPartyName) {
              setSelectedPartyName(parsed.selectedPartyName);
              setPartySearch(parsed.selectedPartyName);
            }
            if (parsed.qualitySearchStates) {
              setQualitySearchStates(parsed.qualitySearchStates);
            }
            hasRestoredDataRef.current = true;
            lastSavedDataRef.current = savedData;
            setFormInitialized(true);
          }
        }
      } catch (e) {
        console.error('Error loading form data from localStorage on mount:', e);
      }
    }
  }, []); // Run once on mount

  // ⚡ CRITICAL: Save data immediately before page unloads (browser refresh, tab close, etc.)
  useEffect(() => {
    if (!order && typeof window !== 'undefined') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Save data immediately before page unloads
        saveFormDataImmediately();
      };

      const handleVisibilityChange = () => {
        // Save data when tab becomes hidden (user switches tabs)
        if (document.visibilityState === 'hidden') {
          saveFormDataImmediately();
        }
      };

      const handlePageHide = () => {
        // Save data when page is being hidden (browser navigation, refresh, etc.)
        saveFormDataImmediately();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pagehide', handlePageHide);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pagehide', handlePageHide);
      };
    }
  }, [order, saveFormDataImmediately]);

  // Save form data to localStorage whenever it changes (debounced, but more frequent)
  useEffect(() => {
    // Only save if we're creating a new order (not editing)
    if (order) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // ⚡ FIX: Reduced debounce to 200ms for faster saves
    saveTimeoutRef.current = setTimeout(() => {
      saveFormDataImmediately();
    }, 200); // Save 200ms after last change (faster than before)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, selectedPartyName, qualitySearchStates, order, saveFormDataImmediately]);

  // Clear saved form data when form is successfully submitted or closed
  const clearSavedFormData = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(FORM_DATA_STORAGE_KEY);
        hasRestoredDataRef.current = false;
        console.log('🗑️ Cleared saved form data from localStorage');
      } catch (e) {
        console.error('Error clearing form data from localStorage:', e);
      }
    }
  }, []);

  // Clear saved data when form closes without submitting (user clicks X or Cancel)
  useEffect(() => {
    // This will run when component unmounts or when order changes to indicate form closed
    return () => {
      // Don't clear on unmount if we're just switching tabs - only clear when form actually closes
      // The form closing is handled by the parent component calling onClose
    };
  }, []);

  // ⚡ FIX: Load deleted IDs from sessionStorage on mount and whenever form opens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedDeletedQualities = sessionStorage.getItem('deletedQualityIds');
        const storedDeletedParties = sessionStorage.getItem('deletedPartyIds');

        if (storedDeletedQualities) {
          const parsed = JSON.parse(storedDeletedQualities);
          deletedQualityIdsRef.current = new Set(parsed);
          console.log('📦 Loaded deleted quality IDs from sessionStorage:', parsed.length);
        }

        if (storedDeletedParties) {
          const parsed = JSON.parse(storedDeletedParties);
          deletedPartyIdsRef.current = new Set(parsed);
          console.log('📦 Loaded deleted party IDs from sessionStorage:', parsed.length);
        }
      } catch (e) {
        console.error('Error loading deleted IDs from sessionStorage:', e);
      }
    }
  }, []); // Run once on mount

  // Reset ref when form closes
  useEffect(() => {
    return () => {
      // Reset when component unmounts (form closes)
      hasCalledOnFormOpenRef.current = false;
    };
  }, []);

  // Call onFormOpen only once when form first opens
  useEffect(() => {
    if (!hasCalledOnFormOpenRef.current) {
      hasCalledOnFormOpenRef.current = true;
      onFormOpen?.();
    }
  }, [onFormOpen]);

  // ⚡ FIX: Sync local parties with prop parties, merging with any pending new parties
  // ⚡ CRITICAL: Re-run when deleteCounter changes to ensure deleted items are filtered
  useEffect(() => {
    if (Array.isArray(parties)) {
      setLocalParties(prev => {
        // Start with prop parties (which should be the source of truth after refresh)
        // ⚡ CRITICAL: Filter out deleted parties first
        const merged = parties.filter(party => {
          const partyId = party._id || (party as any).id || '';
          const isDeleted = deletedPartyIdsRef.current.has(String(partyId));
          if (isDeleted) {
            console.log('🚫 Filtering out deleted party during sync:', partyId, party.name);
          }
          return !isDeleted;
        });

        // Only add local parties that aren't in prop parties AND aren't deleted (newly created, not yet in backend)
        prev.forEach(localParty => {
          const localId = localParty._id || (localParty as any).id;
          if (localId) {
            // Skip if this party was deleted
            if (deletedPartyIdsRef.current.has(String(localId))) {
              return;
            }
            // Only add if it doesn't exist in merged (newly created, not deleted)
            if (!merged.some(p => {
              const pId = p._id || (p as any).id;
              return String(pId) === String(localId);
            })) {
              merged.unshift(localParty); // Add at beginning
            }
          }
        });
        return merged;
      });
    }
  }, [parties, deleteCounter]); // Re-run when deleteCounter changes

  // ⚡ FIX: Sync local qualities with prop qualities, replacing deleted items and merging newly created ones
  // ⚡ CRITICAL: Re-run when deleteCounter changes to ensure deleted items are filtered
  // ⚡ FIX: Also sync when recentlyAddedQuality changes to ensure new qualities are included
  useEffect(() => {
    if (Array.isArray(qualities)) {
      setLocalQualities(prev => {
        // ⚡ CRITICAL: Start fresh with prop qualities (source of truth from server)
        // ⚡ CRITICAL: Filter out deleted qualities first
        const merged = qualities.filter(quality => {
          const qualityId = quality._id || (quality as any).id || '';
          const isDeleted = deletedQualityIdsRef.current.has(String(qualityId));
          if (isDeleted) {
            console.log('🚫 Filtering out deleted quality during sync:', qualityId, quality.name);
          }
          return !isDeleted;
        });

        // ⚡ FIX: Create a Set of existing IDs for faster lookup
        const existingIds = new Set(merged.map(q => {
          const qId = q._id || (q as any).id;
          return qId ? String(qId) : null;
        }).filter(Boolean));

        // Only add local qualities that aren't in prop qualities AND aren't deleted (newly created, not yet in backend)
        // This preserves newly created items that haven't been saved to backend yet
        prev.forEach(localQuality => {
          const localId = localQuality._id || (localQuality as any).id;
          if (localId) {
            const localIdStr = String(localId);
            // ⚡ CRITICAL: Skip if this quality was deleted
            if (deletedQualityIdsRef.current.has(localIdStr)) {
              return;
            }

            // ⚡ FIX: Check if this quality exists in the merged list (faster lookup)
            if (!existingIds.has(localIdStr)) {
              merged.unshift(localQuality); // Add at beginning
              existingIds.add(localIdStr); // Track it to avoid duplicates
            }
          }
        });

        console.log('🔄 Synced localQualities:', merged.length, 'qualities (from props:', qualities.length, ', deleted:', deletedQualityIdsRef.current.size, ')');
        return merged;
      });
    } else {
      // If qualities prop is empty or invalid, clear localQualities except newly created ones
      setLocalQualities(prev => {
        // Keep only items that don't have _id (newly created, not yet saved) AND aren't deleted
        return prev.filter(q => {
          const qId = q._id || (q as any).id;
          return (!qId || !deletedQualityIdsRef.current.has(String(qId)));
        });
      });
    }
  }, [qualities, deleteCounter, recentlyAddedQuality]); // Re-run when deleteCounter or recentlyAddedQuality changes

  // Load parties and qualities when form opens - separate effect for loading states
  useEffect(() => {
    // Always clear loading states when data is available
    if (Array.isArray(parties) && parties.length > 0) {
      setPartiesLoading(false);
    } else {
      setPartiesLoading(true);
    }

    if (Array.isArray(qualities) && qualities.length > 0) {
      setQualitiesLoading(false);
    } else {
      setQualitiesLoading(true);
    }
  }, [Array.isArray(parties) ? parties.length : 0, Array.isArray(qualities) ? qualities.length : 0]);

  // ⚡ FIX: Handle newly added parties - check both localParties and parties prop
  useEffect(() => {
    if (recentlyAddedParty) {
      // Check localParties first (includes newly created), then parties prop
      const allParties = localParties.length > 0 ? localParties : (Array.isArray(parties) ? parties : []);
      const newParty = allParties.find(party => party._id === recentlyAddedParty);
      if (newParty) {
        // Auto-select the newly added party
        handleFieldChange('party', newParty._id);
        setSelectedPartyName(newParty.name);
        setPartySearch(newParty.name);
        setRecentlyAddedParty(null); // Clear the flag
        onSetRecentlyAddedParty?.(null); // Clear the parent state
      }
    }
  }, [localParties, parties, recentlyAddedParty, onSetRecentlyAddedParty]);

  // ⚡ FIX: Handle newly added qualities - auto-select and highlight (fallback for when no active dropdown)
  // Only auto-select if the quality hasn't been manually cleared
  useEffect(() => {
    // Only run if there's no active dropdown (meaning direct selection already happened)
    // This is a fallback to find first empty field if quality was added without active dropdown
    if (Array.isArray(qualities) && qualities.length > 0 && recentlyAddedQuality && activeQualityDropdown === null) {
      // ⚡ FIX: Don't auto-select if this quality was manually cleared
      if (manuallyClearedQualities.has(recentlyAddedQuality)) {
        console.log('🚫 Skipping auto-selection - quality was manually cleared:', recentlyAddedQuality);
        return;
      }

      const newQuality = qualities.find(quality => {
        const qualityId = quality._id || (quality as any).id || '';
        return qualityId === recentlyAddedQuality;
      });

      if (newQuality) {
        // Find the first empty quality field and auto-fill it
        const emptyItemIndex = formData.items.findIndex(item => !item.quality);
        if (emptyItemIndex !== -1) {
          const qualityId = getQualityId(newQuality);
          console.log('🔍 Auto-filling empty quality field (fallback):', { emptyItemIndex, qualityId, qualityName: newQuality.name });

          handleItemChange(emptyItemIndex, 'quality', qualityId);
          setQualitySearchStates(prev => ({ ...prev, [emptyItemIndex]: newQuality.name }));

          console.log('✅ Quality auto-filled in empty field:', emptyItemIndex);
        }
      }
    }
  }, [qualities, recentlyAddedQuality, activeQualityDropdown, formData.items, manuallyClearedQualities]);

  // Clear loading state when parties are loaded or after timeout
  useEffect(() => {
    if (Array.isArray(parties) && parties.length > 0) {
      setPartiesLoading(false);
    } else {
      // Set a timeout to clear loading state even if no data is loaded
      const timeout = setTimeout(() => {
        setPartiesLoading(false);
      }, 200); // 0.2 second timeout - very fast response

      return () => clearTimeout(timeout);
    }
  }, [Array.isArray(parties) ? parties.length : 0]);

  // Clear loading state when qualities are loaded or after timeout
  useEffect(() => {
    if (Array.isArray(qualities) && qualities.length > 0) {
      setQualitiesLoading(false);
    } else {
      // Set a timeout to clear loading state even if no data is loaded
      const timeout = setTimeout(() => {
        setQualitiesLoading(false);
      }, 200); // 0.2 second timeout - very fast response

      return () => clearTimeout(timeout);
    }
  }, [qualities.length]);

  // Helper function to get quality ID (handles both _id and id from API)
  const getQualityId = (quality: any) => {
    if (!quality) {
      console.error('❌ getQualityId: quality is null/undefined');
      return '';
    }

    // Handle case where quality might be a string (already an ID)
    if (typeof quality === 'string') {
      console.log('🔍 getQualityId: quality is already a string ID:', quality);
      return quality;
    }

    // Handle case where quality is an object
    if (typeof quality === 'object') {
      // Check for both _id and id (MongoDB uses _id, but toJSON transform converts to id)
      const id = quality._id || quality.id || '';
      console.log('🔍 getQualityId:', {
        quality,
        extractedId: id,
        has_id: !!quality._id,
        has_id_field: !!quality.id,
        qualityKeys: Object.keys(quality)
      });

      if (!id) {
        console.error('❌ getQualityId: No valid ID found in quality object:', quality);
        return '';
      }

      // Ensure the ID is a string
      const stringId = String(id);
      if (stringId === 'undefined' || stringId === 'null' || stringId === '') {
        console.error('❌ getQualityId: Invalid ID value:', { id, stringId });
        return '';
      }

      return stringId;
    }

    console.error('❌ getQualityId: Unexpected quality type:', typeof quality, quality);
    return '';
  };

  // Helper function to get party ID (handles both _id and id from API)
  const getPartyId = (party: any) => {
    return party._id || party.id || '';
  };

  // ⚡ FIX: Helper function to validate if a party still exists - check both localParties and parties prop
  const validatePartyExists = (partyId: string) => {
    // Check localParties first (includes newly created parties)
    const allParties = localParties.length > 0 ? localParties : (Array.isArray(parties) ? parties : []);
    return allParties.some(party => {
      const partyIdFromList = party._id || (party as any).id || '';
      return partyIdFromList === partyId || partyIdFromList?.toString() === partyId?.toString();
    });
  };

  // Helper function to validate if a quality still exists
  const validateQualityExists = (qualityId: string) => {
    // ⚡ FIX: Check localQualities first (includes newly created qualities)
    const existsInLocal = localQualities.some(quality => {
      const qualityIdFromLocal = quality._id || (quality as any).id || '';
      return String(qualityIdFromLocal) === String(qualityId);
    });

    // Also check if quality exists in the qualities prop (handle both _id and id fields)
    const existsInProps = qualities.some(quality => {
      const qualityIdFromProps = quality._id || (quality as any).id || '';
      return String(qualityIdFromProps) === String(qualityId);
    });

    // Also check if it's a recently added quality (might not be in props yet)
    const isRecentlyAdded = recentlyAddedQuality === qualityId || String(recentlyAddedQuality) === String(qualityId);

    // ⚡ FIX: Don't validate against deleted qualities
    const isDeleted = deletedQualityIdsRef.current.has(String(qualityId));

    console.log('🔍 validateQualityExists:', {
      qualityId,
      existsInLocal,
      existsInProps,
      isRecentlyAdded,
      isDeleted,
      localQualitiesCount: localQualities.length,
      qualitiesCount: qualities.length,
      recentlyAddedQuality
    });

    // Return true if exists in local or props, is recently added, and is not deleted
    return (existsInLocal || existsInProps || isRecentlyAdded) && !isDeleted;
  };

  // Delete functions
  const handleDeleteParty = async (party: Party) => {
    const partyId = getPartyId(party);
    if (!partyId) {
      setValidationMessage({ type: 'error', text: 'Invalid party ID' });
      return;
    }

    // Prevent multiple clicks
    if (deletingParty === partyId) {
      return;
    }

    setDeletingParty(partyId);

    try {
      const response = await fetch(`/api/parties/${partyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('🗑️ Party delete response:', data);

      if (data.success) {
        console.log('✅ Party deleted successfully, updating UI...');

        // If the deleted party was selected, clear the selection FIRST
        if (formData.party === partyId || String(formData.party) === String(partyId)) {
          console.log('🧹 Clearing selected party');
          handleFieldChange('party', '');
          setSelectedPartyName('');
          setPartySearch('');
        }

        // ⚡ FIX: Track deleted party ID to prevent re-adding
        deletedPartyIdsRef.current.add(String(partyId));

        // ⚡ FIX: Save to sessionStorage immediately
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('deletedPartyIds', JSON.stringify(Array.from(deletedPartyIdsRef.current)));
            console.log('💾 Saved deleted party IDs to sessionStorage');
          } catch (e) {
            console.error('Error saving deleted party IDs:', e);
          }
        }

        // ⚡ FIX: Immediately remove from localParties state for instant UI update
        setLocalParties(prev => {
          const filtered = prev.filter(party => {
            const partyIdFromItem = party._id || (party as any).id || '';
            return String(partyIdFromItem) !== String(partyId);
          });
          console.log('🔄 Removed party from localParties:', filtered.length, 'remaining');
          return filtered;
        });

        // Immediately remove from parent state for instant UI update
        onRemoveParty?.(partyId);
        console.log('🔄 Called onRemoveParty with ID:', partyId);

        // Increment delete counter to force re-render
        setDeleteCounter(prev => {
          const newCount = prev + 1;
          console.log('🔢 Delete counter incremented to:', newCount);
          return newCount;
        });

        setValidationMessage({ type: 'success', text: 'Party deleted successfully!' });

        // Close dropdown and clear search to show the change immediately
        setShowPartyDropdown(false);
        setPartySearch('');

        // ⚡ FIX: Clear localStorage cache before refreshing
        try {
          localStorage.removeItem('parties_cache');
          console.log('🗑️ Cleared parties_cache from localStorage');
        } catch (e) {
          console.error('Failed to clear parties cache:', e);
        }

        // Refresh parties list from server (non-blocking) with force refresh
        console.log('🔄 Refreshing parties from server...');
        if (onRefreshParties) {
          // Call with force refresh if the function supports it
          (onRefreshParties as any)(true)?.then(() => {
            console.log('✅ Party refresh completed');
          }).catch((error: any) => {
            console.error('❌ Failed to refresh parties:', error);
            // Fallback to regular refresh if force refresh fails
            onRefreshParties().catch((e: any) => console.error('Fallback refresh failed:', e));
          });
        }
      } else {
        console.log('❌ Party delete failed:', data.message);
        setValidationMessage({ type: 'error', text: data.message || 'Failed to delete party' });
      }
    } catch (error) {
      setValidationMessage({ type: 'error', text: 'Failed to delete party' });
    } finally {
      setDeletingParty(null);
    }
  };

  const handleDeleteQuality = async (quality: Quality) => {
    const qualityId = getQualityId(quality);
    if (!qualityId) {
      setValidationMessage({ type: 'error', text: 'Invalid quality ID' });
      return;
    }

    // Prevent multiple clicks
    if (deletingQuality === qualityId) {
      return;
    }

    console.log('🗑️ Starting quality deletion for:', { qualityId, qualityName: quality.name });

    setDeletingQuality(qualityId);

    // ⚡ FIX: Make API call FIRST before removing from UI
    // This ensures we don't remove the quality if deletion fails
    try {
      const response = await fetch(`/api/qualities/${qualityId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('🗑️ Quality delete response:', data);

      // ⚡ CRITICAL: Only proceed with UI updates if deletion was successful
      if (data.success && response.ok) {
        console.log('✅ Quality deleted successfully on server');

        // ⚡ CRITICAL: Track deleted quality ID AFTER successful deletion
        deletedQualityIdsRef.current.add(String(qualityId));
        console.log('🚫 Tracked deleted quality ID:', qualityId);

        // ⚡ FIX: Save to sessionStorage after successful deletion
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('deletedQualityIds', JSON.stringify(Array.from(deletedQualityIdsRef.current)));
            console.log('💾 Saved deleted quality IDs to sessionStorage');
          } catch (e) {
            console.error('Error saving deleted quality IDs:', e);
          }
        }

        // ⚡ CRITICAL: Remove from localQualities AFTER successful deletion
        setLocalQualities(prev => {
          const filtered = prev.filter(q => {
            const qId = q._id || (q as any).id || '';
            return String(qId) !== String(qualityId);
          });
          console.log('🔄 Removed quality from localQualities:', filtered.length, 'remaining (was:', prev.length, ')');
          return filtered;
        });

        // ⚡ CRITICAL: Remove from parent state AFTER successful deletion
        onRemoveQuality?.(qualityId);
        console.log('🔄 Called onRemoveQuality with ID:', qualityId);

        // Close dropdown after successful deletion
        setActiveQualityDropdown(null);
        setCurrentQualitySearch('');

        // If the deleted quality was selected in any item, clear those selections
        const updatedItems = formData.items.map(item => {
          if (String(item.quality) === String(qualityId)) {
            console.log('🔍 Clearing quality selection for item:', item);
            return { ...item, quality: '' };
          }
          return item;
        });
        if (updatedItems.some((item, idx) => item.quality !== formData.items[idx].quality)) {
          setFormData(prev => ({ ...prev, items: updatedItems }));
        }

        // Clear quality search states for items that had this quality
        setQualitySearchStates(prev => {
          const newStates: { [key: number]: string } = { ...prev };
          Object.keys(newStates).forEach(key => {
            const index = parseInt(key);
            if (!isNaN(index) && newStates[index] === quality.name) {
              console.log('🔍 Clearing quality search state for index:', index);
              newStates[index] = '';
            }
          });
          return newStates;
        });

        // Increment delete counter to force re-render
        setDeleteCounter(prev => {
          const newCount = prev + 1;
          console.log('🔢 Delete counter incremented to:', newCount);
          return newCount;
        });

        setValidationMessage({ type: 'success', text: 'Quality deleted successfully!' });

        // ⚡ FIX: Clear localStorage cache before refreshing (same as party)
        try {
          localStorage.removeItem('qualities_cache');
          console.log('🗑️ Cleared qualities_cache from localStorage');
        } catch (e) {
          console.error('Failed to clear qualities cache:', e);
        }

        // ⚡ CRITICAL: Force another immediate removal to ensure it's gone
        // This handles any edge cases where the quality might have been re-added
        setTimeout(() => {
          setLocalQualities(prev => {
            const filtered = prev.filter(q => {
              const qId = q._id || (q as any).id || '';
              const shouldKeep = String(qId) !== String(qualityId) && !deletedQualityIdsRef.current.has(String(qId));
              if (!shouldKeep) {
                console.log('🚫 Removing quality again (safety check):', qId);
              }
              return shouldKeep;
            });
            if (filtered.length !== prev.length) {
              console.log('🔄 Safety check: Removed', prev.length - filtered.length, 'more deleted qualities');
            }
            return filtered;
          });
        }, 10);

        // Refresh qualities list from server (non-blocking) - same pattern as party
        console.log('🔄 Refreshing qualities from server...');
        if (onRefreshQualities) {
          // Call with force refresh if the function supports it
          (onRefreshQualities as any)(true)?.then(() => {
            console.log('✅ Quality refresh completed');
            // ⚡ CRITICAL: Final safety check after refresh to ensure deleted quality is not in the list
            setTimeout(() => {
              setLocalQualities(prev => {
                const filtered = prev.filter(q => {
                  const qId = q._id || (q as any).id || '';
                  return !deletedQualityIdsRef.current.has(String(qId));
                });
                if (filtered.length !== prev.length) {
                  console.log('🔄 Post-refresh safety check: Removed', prev.length - filtered.length, 'deleted qualities');
                }
                return filtered;
              });
            }, 50);
          }).catch((error: any) => {
            console.error('❌ Failed to refresh qualities:', error);
            // Fallback to regular refresh if force refresh fails
            onRefreshQualities().catch((e: any) => console.error('Fallback refresh failed:', e));
          });
        }
      } else {
        setValidationMessage({ type: 'error', text: data.message || 'Failed to delete quality' });
      }
    } catch (error) {
      console.error('❌ Error deleting quality:', error);
      setValidationMessage({ type: 'error', text: 'Failed to delete quality. Please try again.' });
    } finally {
      setDeletingQuality(null);
    }
  };

  // Auto-dismiss validation message after 3 seconds
  useEffect(() => {
    if (validationMessage) {
      const timer = setTimeout(() => {
        setValidationMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [validationMessage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(e as any);
      }
      // Alt + N to add new item (avoid browser conflicts)
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        addItem();
      }
      // Escape to close
      if (e.key === 'Escape') {
        if (showOrderTypeDropdown) {
          setShowOrderTypeDropdown(false);
        } else {
          setIsClosing(true);
          setTimeout(() => {
            onClose();
            setIsClosing(false);
          }, 200);
        }
      }
      // F1 to show keyboard shortcuts
      if (e.key === 'F1') {
        e.preventDefault();
        setShowKeyboardShortcuts(!showKeyboardShortcuts);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showKeyboardShortcuts, showOrderTypeDropdown]);

  // Auto-select newly added party
  useEffect(() => {
    if (pendingNewParty) {
      handleFieldChange('party', pendingNewParty._id || '');
      setSelectedPartyName(pendingNewParty.name);
      setPartySearch(pendingNewParty.name);
      setRecentlyAddedParty(pendingNewParty._id || '');
      setPendingNewParty(null);

      // Clear the "recently added" indicator after 3 seconds
      setTimeout(() => {
        setRecentlyAddedParty(null);
      }, 3000);
    }
  }, [pendingNewParty]);

  // Update quality search states when qualities change
  useEffect(() => {
    formData.items.forEach((item, index) => {
      if (item.quality) {
        // ⚡ FIX: Check localQualities first (includes newly created), then qualities prop
        const allQualities = localQualities.length > 0 ? localQualities : (Array.isArray(qualities) ? qualities : []);
        const selectedQuality = allQualities.find(q => {
          const qId = q._id || (q as any).id || '';
          return String(qId) === String(item.quality);
        });
        if (selectedQuality) {
          setQualitySearchStates(prev => ({
            ...prev,
            [index]: selectedQuality.name
          }));
        }
      }
    });
  }, [formData.items, qualities, localQualities]);

  // Initialize form data from existing order
  // Track the order ID and a hash of key data to detect when order actually changes (not just qualities)
  const orderIdRef = useRef<string | undefined>(order?._id);
  const orderDataHashRef = useRef<string>('');

  // ⚡ FIX: Separate useEffect for initializing formData (only when order changes)
  useEffect(() => {
    // Only initialize formData when order actually changes, not when qualities change
    // This prevents newly added items from disappearing when quality dropdown refreshes
    const currentOrderId = order?._id;
    const orderIdChanged = orderIdRef.current !== currentOrderId;

    // Create a hash of key order data to detect when order data structure changes
    // (e.g., when party changes from ID to object, or when items are updated)
    const orderDataHash = order ? JSON.stringify({
      id: order._id,
      party: typeof order.party === 'object' ? order.party?._id : order.party,
      itemsCount: order.items?.length || 0,
      items: order.items?.map(item => ({
        quality: typeof item.quality === 'object' ? item.quality?._id : item.quality,
        quantity: item.quantity
      })) || []
    }) : '';
    const orderDataChanged = orderDataHashRef.current !== orderDataHash;

    // Re-initialize if order ID changed OR if order data structure changed
    const orderChanged = orderIdChanged || (order && orderDataChanged);

    if (order && orderChanged) {
      orderIdRef.current = currentOrderId;
      orderDataHashRef.current = orderDataHash;

      const partyId = typeof order.party === 'string' ? order.party : order.party?._id || '';
      const partyName = typeof order.party === 'string' ? '' : order.party?.name || '';

      const initializedItems = order.items.length > 0 ? order.items.map(item => ({
        _id: item._id || (item as any)._id?.toString() || undefined, // ⚡ CRITICAL: Preserve _id to maintain lab data associations
        quality: typeof item.quality === 'string' ? item.quality : item.quality?._id || '',
        quantity: item.quantity !== undefined && item.quantity !== null && item.quantity !== '' ? String(item.quantity) : '',
        imageUrls: item.imageUrls || [],
        description: item.description || '',
        weaverSupplierName: item.weaverSupplierName || '',
        purchaseRate: item.purchaseRate ? String(item.purchaseRate) : '',
        millRate: item.millRate ? String(item.millRate) : '',
        salesRate: item.salesRate ? String(item.salesRate) : ''
      })) : [{
        quality: '',
        quantity: '', // Always empty string, never null
        imageUrls: [],
        description: '',
        weaverSupplierName: '',
        purchaseRate: '',
        millRate: '',
        salesRate: ''
      }];

      setFormData({
        orderType: order.orderType,
        arrivalDate: formatDateToYYYYMMDD(order.arrivalDate),
        party: partyId,
        contactName: order.contactName || '',
        contactPhone: order.contactPhone || '',
        poNumber: order.poNumber || '',
        styleNo: order.styleNo || '',
        poDate: formatDateToYYYYMMDD(order.poDate),
        deliveryDate: formatDateToYYYYMMDD(order.deliveryDate),
        items: initializedItems
      });

      setSelectedPartyName(partyName);
      setPartySearch(partyName);

      // Initialize quality search states for all items
      const qualitySearchStatesMap: { [key: number]: string } = {};
      initializedItems.forEach((item, index) => {
        if (item.quality) {
          // Try to find quality name from qualities prop
          const qualityObj = typeof order.items[index]?.quality === 'object'
            ? order.items[index].quality
            : null;
          const qualityName = qualityObj?.name || '';

          // If we have a quality ID but no name yet, try to find it in qualities prop
          if (!qualityName && item.quality && Array.isArray(qualities)) {
            const foundQuality = qualities.find(q => {
              const qId = q._id || (q as any).id || '';
              return qId === item.quality || qId?.toString() === item.quality?.toString();
            });
            if (foundQuality) {
              qualitySearchStatesMap[index] = foundQuality.name || '';
            }
          } else if (qualityName) {
            qualitySearchStatesMap[index] = qualityName;
          }
        }
      });
      setQualitySearchStates(qualitySearchStatesMap);

      setFormInitialized(true);
    } else if (!order) {
      // Reset refs when order is null (creating new order)
      orderIdRef.current = undefined;
      orderDataHashRef.current = '';
      setFormInitialized(true);
    }
  }, [order, qualities]); // Keep qualities here for initial quality name lookup

  // ⚡ FIX: Separate useEffect to update quality search states when qualities change
  // This updates quality names without resetting formData.items
  useEffect(() => {
    if (order && Array.isArray(qualities) && formInitialized) {
      // Update quality search states for existing items when qualities prop changes
      // This ensures quality names are updated without resetting formData.items
      setQualitySearchStates(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        formData.items.forEach((item, index) => {
          if (item.quality) {
            // Only update if we don't have a name yet or if quality name might have changed
            const currentName = updated[index] || '';
            const foundQuality = qualities.find(q => {
              const qId = q._id || (q as any).id || '';
              return qId === item.quality || qId?.toString() === item.quality?.toString();
            });

            if (foundQuality && foundQuality.name !== currentName) {
              updated[index] = foundQuality.name || '';
              hasChanges = true;
            }
          }
        });

        return hasChanges ? updated : prev;
      });
    }
  }, [qualities, formInitialized]); // Only depend on qualities and formInitialized, not formData.items

  // Validation function
  const validateForm = useCallback((): ValidationErrors => {
    const newErrors: ValidationErrors = {};
    if (!formInitialized) return newErrors;

    if (!formData.orderType) {
      newErrors.orderType = 'Please fill required fields';
    }

    formData.items.forEach((item, index) => {
      if (!item.quality) {
        newErrors[`items.${index}.quality`] = 'Please fill required fields';
      }

      // Better quantity validation - handle null, undefined, and empty values safely
      const quantityValue = item.quantity;
      if (quantityValue === null || quantityValue === undefined || quantityValue === '') {
        newErrors[`items.${index}.quantity`] = 'Please fill required fields';
      } else {
        const quantityStr = String(quantityValue).trim();
        if (!quantityStr) {
          newErrors[`items.${index}.quantity`] = 'Please fill required fields';
        } else {
          const quantityNum = parseFloat(quantityStr);
          if (isNaN(quantityNum) || quantityNum <= 0 || !Number.isInteger(quantityNum)) {
            newErrors[`items.${index}.quantity`] = 'Must be a positive whole number';
          }
        }
      }
    });

    return newErrors;
  }, [formData, formInitialized]);

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // ⚡ FIX: Save immediately on critical field changes (no debounce for important fields)
    if (!order && (field === 'orderType' || field === 'party' || field === 'arrivalDate')) {
      // Save immediately for critical fields
      setTimeout(() => saveFormDataImmediately(), 50);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    // ⚡ FIX: Track when a recently added quality is manually cleared
    if (field === 'quality') {
      const currentItem = formData.items[index];
      const currentQualityId = currentItem?.quality;

      // If clearing a quality (value is empty) and it was recently added, mark it as manually cleared
      if ((!value || value === '') && currentQualityId && currentQualityId === recentlyAddedQuality) {
        console.log('🚫 Quality manually cleared, preventing re-auto-selection:', currentQualityId);
        setManuallyClearedQualities(prev => new Set(prev).add(currentQualityId));
        // Clear the recently added flag since user manually removed it
        setRecentlyAddedQuality(null);
        onSetRecentlyAddedQuality?.(null);
      }
    }

    setFormData(prev => {
      const updatedItems = [...prev.items];
      if (!updatedItems[index]) {
        updatedItems[index] = { quality: '', quantity: '', imageUrls: [], description: '', weaverSupplierName: '', purchaseRate: '' };
      }
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...prev, items: updatedItems };
    });

    const errorKey = `items.${index}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }

    // ⚡ FIX: Save immediately on critical item field changes (quality, quantity are most important)
    if (!order && (field === 'quality' || field === 'quantity')) {
      // Save immediately for critical item fields
      setTimeout(() => saveFormDataImmediately(), 50);
    }
  };

  // Add/Remove items
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { quality: '', quantity: '', imageUrls: [], description: '', weaverSupplierName: '', purchaseRate: '', millRate: '', salesRate: '' }] // Always empty string for quantity
    }));

    // Scroll to bottom after adding item with smooth animation
    setTimeout(() => {
      if (formRef.current) {
        // Smooth scroll to the very bottom
        formRef.current.scrollTo({ top: formRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 300);
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Image upload - Store locally, upload on save
  const handleImageUpload = (file: File, itemIndex: number) => {
    // Create preview URL for immediate display
    const previewUrl = URL.createObjectURL(file);

    // Store file locally (will upload on save)
    setPendingImageFiles(prev => ({
      ...prev,
      [itemIndex]: [...(prev[itemIndex] || []), { file, previewUrl }]
    }));

    setValidationMessage({ type: 'success', text: 'Image added! Click Save to upload to AWS.' });
  };

  // Upload single file to S3
  const uploadFileToS3 = async (file: File, folder: string = 'general'): Promise<string> => {
    // Validate file before upload
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file object provided');
    }

    if (file.size === 0) {
      throw new Error('Cannot upload empty file');
    }

    // Log file details for debugging
    console.log('Uploading file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: file.name.split('.').pop()
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: formData
      });

      if (!response.ok) {
        let errorData: any = {};
        let responseText = '';

        try {
          // Try to get response as text first to see what we're dealing with
          responseText = await response.text();
          console.error('Upload error response text:', responseText);

          // Try to parse as JSON
          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
            } catch (parseError) {
              // If not JSON, use the text as the message
              errorData = { message: responseText || `Upload failed with status ${response.status}` };
            }
          } else {
            errorData = { message: `Upload failed with status ${response.status} ${response.statusText}` };
          }
        } catch (e) {
          console.error('Error reading response:', e);
          errorData = { message: `Upload failed with status ${response.status} ${response.statusText}` };
        }

        console.error('Upload error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          responseText: responseText,
          errorMessage: errorData?.message || errorData?.error || responseText
        });

        const errorMessage = errorData?.message || errorData?.error || responseText || `Upload failed: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success && (data.url || data.imageUrl)) {
        return data.url || data.imageUrl;
      } else {
        throw new Error(data.message || 'Upload failed: No URL received');
      }
    } catch (error: any) {
      // Re-throw with more context if it's not already an Error with message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  };

  // Remove image - handles both pending files and uploaded URLs
  const removeImage = (itemIndex: number, imageIndex: number) => {
    // Check if it's a pending file (in pendingImageFiles)
    const pendingFiles = pendingImageFiles[itemIndex] || [];
    if (imageIndex < pendingFiles.length) {
      // Remove pending file
      const fileToRemove = pendingFiles[imageIndex];
      URL.revokeObjectURL(fileToRemove.previewUrl); // Clean up preview URL

      setPendingImageFiles(prev => ({
        ...prev,
        [itemIndex]: prev[itemIndex]?.filter((_, i) => i !== imageIndex) || []
      }));
    } else {
      // Remove uploaded URL (adjust index for pending files)
      const uploadedIndex = imageIndex - pendingFiles.length;
      setFormData(prev => {
        const updatedItems = [...prev.items];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          imageUrls: updatedItems[itemIndex].imageUrls?.filter((_, i) => i !== uploadedIndex) || []
        };
        return { ...prev, items: updatedItems };
      });
    }
  };

  // ⚡ FIX: Add ref to prevent multiple simultaneous submits
  const submittingRef = useRef(false);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚡ FIX: Prevent multiple simultaneous submits
    if (submittingRef.current || loading) {
      console.log('⚠️ Submit already in progress, ignoring duplicate request');
      return;
    }

    // ⚡ FIX: Remove frontend validation - let backend handle it
    // Only basic checks to prevent unnecessary API calls
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setValidationMessage({ type: 'error', text: 'Please fill all required fields' });
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    onStart?.(); // Notify parent that order creation/update has started
    try {
      // STEP 1: Upload all pending images to S3 first
      setValidationMessage({ type: 'success', text: 'Uploading images to AWS...' });

      const uploadedUrls: { [key: number]: string[] } = {};

      // Upload all pending files for each item
      for (const itemIndex in pendingImageFiles) {
        const pendingFiles = pendingImageFiles[itemIndex] || [];
        if (pendingFiles.length > 0) {
          setImageUploading(prev => ({ ...prev, [parseInt(itemIndex)]: true }));
          try {
            const urls: string[] = [];
            for (const { file } of pendingFiles) {
              const url = await uploadFileToS3(file, 'general');
              urls.push(url);
              // Clean up preview URL
              URL.revokeObjectURL(pendingFiles.find(p => p.file === file)?.previewUrl || '');
            }
            uploadedUrls[parseInt(itemIndex)] = urls;
          } catch (error: any) {
            setImageUploading(prev => ({ ...prev, [parseInt(itemIndex)]: false }));
            throw new Error(`Failed to upload images for item ${parseInt(itemIndex) + 1}: ${error.message}`);
          }
          setImageUploading(prev => ({ ...prev, [parseInt(itemIndex)]: false }));
        }
      }

      // STEP 2: Merge uploaded URLs with existing imageUrls
      const updatedFormData = { ...formData };
      for (const itemIndex in uploadedUrls) {
        const idx = parseInt(itemIndex);
        if (!updatedFormData.items[idx]) continue;
        updatedFormData.items[idx] = {
          ...updatedFormData.items[idx],
          imageUrls: [...(updatedFormData.items[idx].imageUrls || []), ...uploadedUrls[idx]]
        };
      }

      // ⚡ FIX: Update formData state immediately so images show in the form right away
      setFormData(updatedFormData);

      // STEP 3: Clean up pending files state
      setPendingImageFiles({});

      // Clean and validate dates before submission
      const cleanDate = (dateStr: string | undefined) => {
        if (!dateStr || dateStr.trim() === '') return undefined;
        // If already in YYYY-MM-DD format, return it directly
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateStr;
        }
        // Try to parse any date format and convert to YYYY-MM-DD
        const parsed = parseDateFromInput(dateStr);
        return parsed || undefined;
      };

      // Clean and prepare form data - ONLY send fields that have actually changed
      const cleanedFormData: any = {};

      // For new orders, include all required fields
      if (!order) {
        cleanedFormData.orderType = updatedFormData.orderType;
        cleanedFormData.arrivalDate = cleanDate(updatedFormData.arrivalDate);
        cleanedFormData.party = updatedFormData.party;
        cleanedFormData.contactName = updatedFormData.contactName;
        cleanedFormData.contactPhone = updatedFormData.contactPhone;
        cleanedFormData.poNumber = updatedFormData.poNumber;
        cleanedFormData.styleNo = updatedFormData.styleNo;
        cleanedFormData.poDate = cleanDate(updatedFormData.poDate);
        cleanedFormData.deliveryDate = cleanDate(updatedFormData.deliveryDate);

        cleanedFormData.items = updatedFormData.items.map((item, idx) => {
          // ⚡ CRITICAL: For new orders, don't include _id (MongoDB will generate it)
          // Only include _id for existing orders being updated
          const itemData: any = {
            quality: item.quality || undefined,
            quantity: item.quantity === '' || item.quantity === null || item.quantity === undefined ? 1 : Number(item.quantity),
            description: item.description || '',
            weaverSupplierName: item.weaverSupplierName || '',
            purchaseRate: item.purchaseRate && item.purchaseRate !== '' ? parseFloat(String(item.purchaseRate)) : undefined,
            millRate: item.millRate && item.millRate !== '' ? parseFloat(String(item.millRate)) : undefined,
            salesRate: item.salesRate && item.salesRate !== '' ? parseFloat(String(item.salesRate)) : undefined,
            imageUrls: item.imageUrls || []
          };

          // Only include _id if it exists (for existing items in updates)
          if (item._id) {
            itemData._id = item._id;
          }

          return itemData;
        });
      } else {
        // For existing orders - ONLY include fields that have actually changed
        const changedFields: string[] = [];

        // Compare each field individually
        if (formData.orderType !== order.orderType) {
          cleanedFormData.orderType = formData.orderType;
          changedFields.push('orderType');
        }

        // Compare dates properly by normalizing them to YYYY-MM-DD format
        const normalizeDateForComparison = (dateStr: string | undefined) => {
          if (!dateStr) return null;
          try {
            return formatDateToYYYYMMDD(dateStr) || dateStr;
          } catch {
            return dateStr;
          }
        };

        const existingArrivalDate = normalizeDateForComparison(order.arrivalDate);
        const newArrivalDate = normalizeDateForComparison(formData.arrivalDate);

        if (existingArrivalDate !== newArrivalDate) {
          cleanedFormData.arrivalDate = cleanDate(formData.arrivalDate);
          changedFields.push('arrivalDate');
        }

        if (formData.party !== order.party) {
          cleanedFormData.party = formData.party;
          changedFields.push('party');
        }

        if (formData.contactName !== order.contactName) {
          cleanedFormData.contactName = formData.contactName;
          changedFields.push('contactName');
        }

        if (formData.contactPhone !== order.contactPhone) {
          cleanedFormData.contactPhone = formData.contactPhone;
          changedFields.push('contactPhone');
        }

        if (formData.poNumber !== order.poNumber) {
          cleanedFormData.poNumber = formData.poNumber;
          changedFields.push('poNumber');
        }

        if (formData.styleNo !== order.styleNo) {
          cleanedFormData.styleNo = formData.styleNo;
          changedFields.push('styleNo');
        }

        const existingPoDate = normalizeDateForComparison(order.poDate);
        const newPoDate = normalizeDateForComparison(formData.poDate);

        if (existingPoDate !== newPoDate) {
          cleanedFormData.poDate = cleanDate(formData.poDate);
          changedFields.push('poDate');
        }

        const existingDeliveryDate = normalizeDateForComparison(order.deliveryDate);
        const newDeliveryDate = normalizeDateForComparison(formData.deliveryDate);

        if (existingDeliveryDate !== newDeliveryDate) {
          cleanedFormData.deliveryDate = cleanDate(formData.deliveryDate);
          changedFields.push('deliveryDate');
        }

        // Check if items have changed - more accurate comparison
        const currentItems = order.items || [];
        const newItems = updatedFormData.items.map((item, index) => {
          // ⚡ CRITICAL: Preserve _id from formData or match with existing order items by index
          // This ensures lab data associations are maintained when updating orders
          const existingItem = currentItems[index];
          const itemId = item._id || existingItem?._id || (existingItem as any)?._id?.toString();

          return {
            _id: itemId, // ⚡ CRITICAL: Include _id to preserve item identity and lab data associations
            quality: item.quality || undefined,
            quantity: item.quantity === '' || item.quantity === null || item.quantity === undefined ? 1 : Number(item.quantity),
            description: item.description || '',
            weaverSupplierName: item.weaverSupplierName || '',
            purchaseRate: item.purchaseRate && item.purchaseRate !== '' ? parseFloat(String(item.purchaseRate)) : undefined,
            millRate: item.millRate && item.millRate !== '' ? parseFloat(String(item.millRate)) : undefined,
            salesRate: item.salesRate && item.salesRate !== '' ? parseFloat(String(item.salesRate)) : undefined,
            imageUrls: item.imageUrls || []
          };
        });

        // More accurate items comparison
        const itemsChanged = currentItems.length !== newItems.length ||
          currentItems.some((currentItem, index) => {
            const newItem = newItems[index];
            if (!newItem) return true; // Different number of items

            const itemChanged = (
              currentItem.quality?.toString() !== newItem.quality?.toString() ||
              currentItem.quantity !== newItem.quantity ||
              currentItem.description !== newItem.description ||
              currentItem.weaverSupplierName !== newItem.weaverSupplierName ||
              currentItem.purchaseRate !== newItem.purchaseRate ||
              currentItem.millRate !== newItem.millRate ||
              currentItem.salesRate !== newItem.salesRate ||
              JSON.stringify(currentItem.imageUrls || []) !== JSON.stringify(newItem.imageUrls || [])
            );

            if (itemChanged) {
            }

            return itemChanged;
          });

        if (itemsChanged) {
          cleanedFormData.items = newItems;
          changedFields.push('items');
        }

        // If no fields changed, don't send update
        if (changedFields.length === 0) {
          setValidationMessage({ type: 'success', text: 'No changes detected' });
          setTimeout(() => {
            setIsClosing(true);
            setTimeout(() => {
              onClose();
              setIsClosing(false);
            }, 200);
          }, 1000);
          return;
        }
      }

      const token = localStorage.getItem('token');
      const url = order ? `/api/orders/${order._id}` : '/api/orders';
      const method = order ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cleanedFormData)
      });

      const data = await response.json();
      if (data.success) {
        setValidationMessage({ type: 'success', text: order ? 'Order updated successfully!' : 'Order created successfully!' });

        // ⚡ FIX: Ensure response data has populated quality/party data
        let responseData = data.data;
        if (responseData) {
          // If party is populated, ensure it's properly structured
          if (responseData.party && typeof responseData.party === 'object') {
            // Party is already populated
          } else if (responseData.party && typeof responseData.party === 'string') {
            // Party is just an ID, try to find it in parties prop
            const foundParty = Array.isArray(parties) ? parties.find(p => {
              const pId = p._id || (p as any).id || '';
              return pId === responseData.party || pId?.toString() === responseData.party?.toString();
            }) : null;
            if (foundParty) {
              responseData.party = foundParty;
            }
          }

          // If items have quality IDs but not populated, populate them
          if (responseData.items && Array.isArray(responseData.items)) {
            responseData.items = responseData.items.map((item: any) => {
              if (item.quality && typeof item.quality === 'string') {
                // Quality is just an ID, try to find it in qualities prop
                const foundQuality = Array.isArray(qualities) ? qualities.find(q => {
                  const qId = q._id || (q as any).id || '';
                  return qId === item.quality || qId?.toString() === item.quality?.toString();
                }) : null;
                if (foundQuality) {
                  item.quality = foundQuality;
                }
              }
              return item;
            });
          }
        }

        // ⚡ FIX: Update formData with the response data to ensure images are included
        if (responseData && responseData.items) {
          setFormData(prev => ({
            ...prev,
            items: responseData.items.map((item: any, idx: number) => ({
              ...prev.items[idx],
              imageUrls: item.imageUrls || prev.items[idx]?.imageUrls || []
            }))
          }));
        }

        // Trigger real-time update for Order Activity Log
        if (order?._id) {
          // For order updates
          const event = new CustomEvent('orderUpdated', {
            detail: {
              orderId: order._id,
              action: 'order_update',
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(event);
        } else if (responseData?._id) {
          // For new order creation
          const event = new CustomEvent('orderUpdated', {
            detail: {
              orderId: responseData._id,
              action: 'order_create',
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(event);
        }

        // ⚡ OPTIMIZED: Close form immediately and pass updated data to parent
        // Parent will update UI immediately with response data
        // Clear saved form data from localStorage on successful submit
        clearSavedFormData();
        // ⚡ IMMEDIATE: Close modal first for instant feedback with animation
        setIsClosing(true);
        setTimeout(() => {
          onClose();
          setIsClosing(false);
          // Then trigger success callback (which shows animation)
          onSuccess(responseData);
        }, 200);
      } else {
        setValidationMessage({ type: 'error', text: data.message || 'Operation failed' });
        onError?.(); // Notify parent that order creation/update failed
      }
    } catch (error) {
      console.error('Order form submit error:', error);
      setValidationMessage({ type: 'error', text: 'An error occurred' });
      onError?.(); // Notify parent that order creation/update failed
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // ⚡ FIX: Use localParties (which includes newly created parties) instead of just parties prop
  // ⚡ CRITICAL: Filter out deleted parties
  const filteredParties = (localParties.length > 0 ? localParties : (Array.isArray(parties) ? parties : []))
    .filter(party => {
      // Skip if party was deleted
      const partyId = party._id || (party as any).id || '';
      if (deletedPartyIdsRef.current.has(String(partyId))) {
        console.log('🚫 Filtering out deleted party:', partyId, party.name);
        return false;
      }
      if (!party?.name) return false;
      if (!partySearch || partySearch.trim() === '') return true; // Show all if no search
      return party.name.toLowerCase().includes(partySearch.toLowerCase());
    })
    .sort((a, b) => {
      // Sort by createdAt in descending order (newest first)
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });








  const getFilteredQualities = (itemIndex: number) => {
    // Use the current quality search for the active dropdown, otherwise use the stored search state
    const searchTerm = activeQualityDropdown === itemIndex ? currentQualitySearch : (qualitySearchStates[itemIndex] || '');

    // ⚡ CRITICAL: Always use localQualities which is synced with server data
    // If localQualities is empty, fall back to qualities prop
    // This ensures deleted items are never shown
    const qualitiesToUse = localQualities.length > 0 ? localQualities : (Array.isArray(qualities) ? qualities : []);

    // ⚡ ADDITIONAL SAFETY: Double-check and filter out deleted items and items that don't exist in qualities prop
    // This prevents deleted items from showing even if they somehow got into localQualities
    const safeQualities = qualitiesToUse.filter(quality => {
      const qualityId = quality._id || (quality as any).id;
      if (!qualityId) return false; // Skip items without ID

      // ⚡ CRITICAL: Skip if this quality was deleted
      if (deletedQualityIdsRef.current.has(String(qualityId))) {
        console.log('🚫 Filtering out deleted quality:', qualityId, quality.name);
        return false;
      }

      // Check if this quality exists in the prop qualities (server data)
      // If it doesn't exist in props, it might be newly created (has _id) or deleted (shouldn't have _id)
      // For safety, only show if it exists in props OR if it's a newly created item (has _id but not in props yet)
      const existsInProps = Array.isArray(qualities) && qualities.some(q => {
        const qId = q._id || (q as any).id;
        return String(qId) === String(qualityId);
      });

      // Show if it exists in props (from server) OR if it's a newly created item
      return existsInProps || (quality._id || (quality as any).id);
    });

    const filtered = safeQualities.filter(quality => {
      if (!quality?.name) return false;
      if (!searchTerm || searchTerm.trim() === '') return true; // Show all if no search
      return quality.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Sort by createdAt in ascending order (oldest first)
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateA.getTime() - dateB.getTime(); // Oldest first
    });


    return sorted;
  };

  // Lock body scroll when form is rendered (always open when component is mounted)
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Handle scroll prevention on form content
  useEffect(() => {
    const formElement = formRef.current;
    if (!formElement) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = formElement;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // If scrolling up at top or down at bottom, prevent default to stop background scroll
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
      }
    };

    formElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      formElement.removeEventListener('wheel', handleWheel);
    };
  }, []);

  if (!mounted) return null;

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
        
        /* Validation Message Animations */
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.5s ease-out forwards;
        }
      `}</style>

      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
        <div className={`relative w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-xl shadow-2xl ${isClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
          {/* Header */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="flex items-center space-x-2 sm:space-x-3">
                {order ? (
                  <PencilIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
                ) : (
                  <PlusIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
                )}
                <div className="flex items-center gap-3">
                  {order && (
                    <span className={`px-3 py-1 rounded-lg text-lg font-bold ${isDarkMode
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-blue-100 text-blue-700'
                      }`}>
                      {getDisplayOrderId(order.orderId)}
                    </span>
                  )}
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{order ? 'Edit Order' : 'Create New Order'}</h2>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs sm:text-sm px-2 py-1 rounded-full whitespace-nowrap ${isDarkMode
                    ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                  {formData.items.length} Item{formData.items.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                  className={`hidden sm:block px-3 py-1 text-xs rounded-full border transition-all duration-200 hover:scale-105 ${isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400'
                      : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  title="Keyboard Shortcuts (F1)"
                >
                  ⌨️ Shortcuts
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  onClose();
                  setIsClosing(false);
                }, 200);
              }}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 flex-shrink-0 self-end sm:self-auto close-button-hover active:scale-95 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                }`}
              title="Close (Esc)"
            >
              <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} className={`overflow-y-auto max-h-[calc(95vh-140px)] custom-scrollbar ${isDarkMode
              ? 'scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800'
              : 'scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-100'
            }`}>
            <fieldset disabled={readOnly} className="space-y-8 contents">
              <div className="p-6 space-y-8 pb-24">
              {/* Basic Information - Enhanced Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Order Type */}
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Order Type <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && setShowOrderTypeDropdown(!showOrderTypeDropdown)}
                      className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left ${isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                        } ${errors.orderType ? 'border-red-500' : ''} ${showOrderTypeDropdown ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                    >
                      <span className={formData.orderType ? '' : 'text-gray-500'}>
                        {formData.orderType || 'Select Type'}
                      </span>
                      <ChevronDownIcon className={`absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-transform duration-200 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} ${showOrderTypeDropdown ? 'rotate-180' : ''} pointer-events-none`} />
                    </button>

                    {showOrderTypeDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowOrderTypeDropdown(false)}
                        />
                        <div className={`absolute z-[100] mt-1 w-full rounded-lg border shadow-xl dropdown-enter overflow-hidden ${isDarkMode
                            ? 'bg-gray-800 border-gray-600'
                            : 'bg-white border-gray-200'
                          }`}>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange('orderType', '');
                              setShowOrderTypeDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${!formData.orderType
                                ? isDarkMode
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-blue-50 text-blue-700 font-bold'
                                : isDarkMode
                                  ? 'hover:bg-gray-700 text-white'
                                  : 'hover:bg-blue-50 text-gray-700'
                              }`}
                          >
                            Select Type
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange('orderType', 'Dying');
                              setShowOrderTypeDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors border-t ${formData.orderType === 'Dying'
                                ? isDarkMode
                                  ? 'bg-blue-600 text-white font-bold border-gray-600'
                                  : 'bg-blue-50 text-blue-700 font-bold border-gray-200'
                                : isDarkMode
                                  ? 'hover:bg-gray-700 text-white border-gray-600'
                                  : 'hover:bg-blue-50 text-gray-700 border-gray-200'
                              }`}
                          >
                            Dying
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange('orderType', 'Printing');
                              setShowOrderTypeDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors border-t ${formData.orderType === 'Printing'
                                ? isDarkMode
                                  ? 'bg-blue-600 text-white font-bold border-gray-600'
                                  : 'bg-blue-50 text-blue-700 font-bold border-gray-200'
                                : isDarkMode
                                  ? 'hover:bg-gray-700 text-white border-gray-600'
                                  : 'hover:bg-blue-50 text-gray-700 border-gray-200'
                              }`}
                          >
                            Printing
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {errors.orderType && <p className="text-red-500 text-sm mt-2">{errors.orderType}</p>}
                </div>

                {/* Arrival Date */}
                <div>
                  <label className="block text-sm font-medium mb-3">Arrival Date</label>
                  <CustomDatePicker
                    value={formData.arrivalDate || ''}
                    onChange={(value) => handleFieldChange('arrivalDate', value)}
                    placeholder="Select arrival date"
                    isDarkMode={isDarkMode}
                    disabled={readOnly}
                  />
                </div>

                {/* PO Date */}
                <div>
                  <label className="block text-sm font-medium mb-3">PO Date</label>
                  <CustomDatePicker
                    value={formData.poDate || ''}
                    onChange={(value) => handleFieldChange('poDate', value)}
                    placeholder="Select PO date"
                    isDarkMode={isDarkMode}
                    disabled={readOnly}
                  />
                </div>

                {/* Delivery Date */}
                <div>
                  <label className="block text-sm font-medium mb-3">Delivery Date</label>
                  <CustomDatePicker
                    value={formData.deliveryDate || ''}
                    onChange={(value) => handleFieldChange('deliveryDate', value)}
                    placeholder="Select delivery date"
                    isDarkMode={isDarkMode}
                    disabled={readOnly}
                  />
                </div>

                {/* Party */}
                <div>
                  <label className="block text-sm font-medium mb-3">Party</label>
                  <EnhancedDropdown
                    key={`party-dropdown-${Array.isArray(parties) ? parties.length : 0}-${deleteCounter}`}
                    options={filteredParties}
                    value={formData.party || ''}
                    onChange={(value) => handleFieldChange('party', value)}
                    placeholder={partiesLoading ? "Loading parties..." : "Search parties..."}
                    searchValue={partySearch}
                    onSearchChange={setPartySearch}
                    showDropdown={showPartyDropdown}
                    onToggleDropdown={() => {
                      if (showPartyDropdown) {
                        setShowPartyDropdown(false);
                      } else {
                        // Refresh parties when opening dropdown to ensure latest data
                        onRefreshParties(true).catch(err => console.error('Error refreshing parties:', err));
                        setShowPartyDropdown(true);
                      }
                    }}
                    isLoading={partiesLoading}
                    onSelect={(party) => {
                      const partyId = party._id || (party as any).id || '';
                      // ⚡ FIX: Skip validation for newly created parties or validate against localParties
                      // The party is already in the dropdown, so it's valid
                      if (partyId) {
                        handleFieldChange('party', partyId);
                        setSelectedPartyName(party.name);
                        setPartySearch(party.name);
                        setShowPartyDropdown(false);
                      } else {
                        setValidationMessage({ type: 'error', text: 'Invalid party selected' });
                      }
                    }}
                    isDarkMode={isDarkMode}
                    onAddNew={() => setShowPartyModal(true)}
                    onDelete={(party) => handleDeleteParty(party)}
                    recentlyAddedId={recentlyAddedParty}
                    deletingItems={deletingParty ? [deletingParty] : []}
                    disabled={readOnly}
                  />
                </div>

                {/* Contact Name */}
                <div>
                  <label className="block text-sm font-medium mb-3">Contact Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => handleFieldChange('contactName', e.target.value)}
                      placeholder="Enter contact name"
                      className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                    />
                    {!readOnly && formData.contactName && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('contactName', '')}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 ${isDarkMode
                            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                          }`}
                        title="Clear contact name"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm font-medium mb-3">Contact Phone</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
                      placeholder="Enter phone number"
                      className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                    />
                    {!readOnly && formData.contactPhone && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('contactPhone', '')}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 ${isDarkMode
                            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                          }`}
                        title="Clear contact phone"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* PO Number */}
                <div>
                  <label className="block text-sm font-medium mb-3">PO Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.poNumber}
                      onChange={(e) => handleFieldChange('poNumber', e.target.value)}
                      placeholder="Enter PO number"
                      className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                    />
                    {!readOnly && formData.poNumber && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('poNumber', '')}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 ${isDarkMode
                            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                          }`}
                        title="Clear PO number"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Style */}
                <div>
                  <label className="block text-sm font-medium mb-3">Style</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.styleNo}
                      onChange={(e) => handleFieldChange('styleNo', e.target.value)}
                      placeholder="Enter style"
                      className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                    />
                    {!readOnly && formData.styleNo && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('styleNo', '')}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 ${isDarkMode
                            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                          }`}
                        title="Clear style"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Order Items</h3>
                </div>

                <div className="space-y-6">
                  {formData.items.map((item, index) => (
                    <div key={index} className={`p-6 rounded-xl border transition-all duration-200 hover:shadow-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                      }`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        {/* Quality */}
                        <div>
                          <label className="block text-sm font-medium mb-3">
                            Quality <span className="text-red-500">*</span>
                          </label>
                          <EnhancedDropdown
                            key={`quality-dropdown-${index}-${qualities.length}-${deleteCounter}-${recentlyAddedQuality || 'none'}`}
                            options={getFilteredQualities(index)}
                            value={item.quality as string}
                            onChange={(value) => handleItemChange(index, 'quality', value)}
                            placeholder={qualitiesLoading ? "Loading qualities..." : "Search quality..."}
                            searchValue={activeQualityDropdown === index ? currentQualitySearch : (qualitySearchStates[index] || '')}
                            onSearchChange={(value) => {
                              if (activeQualityDropdown === index) {
                                setCurrentQualitySearch(value);
                              } else {
                                setQualitySearchStates(prev => ({ ...prev, [index]: value }));
                              }
                            }}
                            showDropdown={activeQualityDropdown === index}
                            onToggleDropdown={async () => {
                              if (activeQualityDropdown === index) {
                                setActiveQualityDropdown(null);
                                setCurrentQualitySearch('');
                              } else {
                                // ⚡ FIX: ALWAYS refresh qualities when opening dropdown to get latest data
                                // This ensures the dropdown always shows the most up-to-date list
                                if (onRefreshQualities) {
                                  try {
                                    console.log('🔄 Refreshing qualities before opening dropdown...');
                                    // Clear cache first to force fresh fetch
                                    if (typeof window !== 'undefined') {
                                      try {
                                        localStorage.removeItem('qualities_cache');
                                      } catch (e) {
                                        console.error('Failed to clear cache:', e);
                                      }
                                    }
                                    // Call with forceRefresh=true to bypass cache and get latest data
                                    await onRefreshQualities(true);
                                    console.log('✅ Qualities refreshed, opening dropdown');

                                    // ⚡ CRITICAL: Force a small delay to ensure state updates propagate
                                    // This ensures the dropdown shows the latest data including newly created qualities
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                  } catch (err) {
                                    console.error('Error refreshing qualities:', err);
                                  }
                                }
                                setActiveQualityDropdown(index);
                                setCurrentQualitySearch(qualitySearchStates[index] || '');
                              }
                            }}
                            isLoading={qualitiesLoading}
                            onSelect={(quality) => {
                              console.log('🔍 onSelect called with quality:', quality);
                              console.log('🔍 Quality type:', typeof quality);
                              console.log('🔍 Quality keys:', quality ? Object.keys(quality) : 'null/undefined');

                              const qualityId = getQualityId(quality);
                              console.log('🔍 Quality selected:', { qualityId, qualityName: quality?.name, index });
                              console.log('🔍 Current qualities count:', qualities.length);
                              console.log('🔍 Recently added quality:', recentlyAddedQuality);

                              if (!qualityId || qualityId === '') {
                                console.error('❌ No quality ID found:', { quality, qualityId });
                                setValidationMessage({ type: 'error', text: 'Invalid quality data. Please try again.' });
                                return;
                              }

                              // Additional safety check - ensure qualityId is a string
                              if (typeof qualityId !== 'string') {
                                console.error('❌ Quality ID is not a string:', { quality, qualityId, type: typeof qualityId });
                                setValidationMessage({ type: 'error', text: 'Invalid quality ID format. Please try again.' });
                                return;
                              }

                              // ⚡ FIX: If quality is in the dropdown options, it's valid (no need to validate further)
                              // This handles newly created qualities that might not be in props yet
                              const qualityInDropdown = getFilteredQualities(index).some(q => {
                                const qId = getQualityId(q);
                                return String(qId) === String(qualityId);
                              });

                              if (!qualityInDropdown && !validateQualityExists(qualityId)) {
                                console.error('❌ Quality validation failed:', { qualityId, qualityName: quality?.name });
                                setValidationMessage({ type: 'error', text: 'Quality not found. Please try refreshing the page.' });
                                return;
                              }

                              console.log('✅ Quality validation passed, updating form data');
                              handleItemChange(index, 'quality', qualityId);
                              setQualitySearchStates(prev => ({ ...prev, [index]: quality?.name || '' }));
                              setCurrentQualitySearch(quality?.name || '');
                              setActiveQualityDropdown(null);
                            }}
                            isDarkMode={isDarkMode}
                            error={errors[`items.${index}.quality`]}
                            onAddNew={() => {
                              console.log('🔍 Opening quality modal for dropdown:', index);
                              setActiveQualityDropdown(index);
                              setShowQualityModal(true);
                            }}
                            onDelete={(quality) => handleDeleteQuality(quality)}
                            itemIndex={index}
                            recentlyAddedId={recentlyAddedQuality}
                            deletingItems={deletingQuality ? [deletingQuality] : []}
                            disabled={readOnly}
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-sm font-medium mb-3">
                            Quantity <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow empty string or positive whole numbers (no decimals)
                                if (value === '' || (/^\d+$/.test(value) && parseInt(value) > 0)) {
                                  handleItemChange(index, 'quantity', value);
                                }
                              }}
                              onKeyPress={(e) => {
                                // Block all non-numeric keys including decimal point
                                if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                  e.preventDefault();
                                }
                                // Specifically block decimal point for whole numbers only
                                if (e.key === '.') {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="Enter quantity"
                              className={`w-full p-3 pr-16 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                } ${errors[`items.${index}.quantity`] ? 'border-red-500' : ''}`}
                            />
                            {/* Custom Increment/Decrement Buttons */}
                            {!readOnly && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseInt(String(item.quantity || '0')) || 0;
                                    handleItemChange(index, 'quantity', String(currentValue + 1));
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-t-sm border-b border-gray-300 transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Increase quantity"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseInt(String(item.quantity || '0')) || 0;
                                    if (currentValue > 1) {
                                      handleItemChange(index, 'quantity', String(currentValue - 1));
                                    } else if (currentValue === 1) {
                                      handleItemChange(index, 'quantity', ''); // Clear if 1 and decremented
                                    }
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-b-sm transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Decrease quantity"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                          {errors[`items.${index}.quantity`] && (
                            <p className="text-red-500 text-sm mt-2">{errors[`items.${index}.quantity`]}</p>
                          )}
                        </div>



                        {/* Weaver / Supplier Name */}
                        <div>
                          <label className="block text-sm font-medium mb-3">Weaver Name</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={item.weaverSupplierName || ''}
                              onChange={(e) => handleItemChange(index, 'weaverSupplierName', e.target.value)}
                              placeholder="Enter weaver or supplier name"
                              className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                            />
                            {!readOnly && item.weaverSupplierName && (
                              <button
                                type="button"
                                onClick={() => handleItemChange(index, 'weaverSupplierName', '')}
                                className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 ${isDarkMode
                                    ? 'text-gray-400 hover:text-white hover:bg-gray-600'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                                  }`}
                                title="Clear weaver supplier name"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Description */}
                        <div>
                          <label className="block text-sm font-medium mb-3">Description</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              placeholder="Enter description"
                              className={`w-full p-3 pr-10 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                            />
                            {!readOnly && item.description && (
                              <button
                                type="button"
                                onClick={() => handleItemChange(index, 'description', '')}
                                className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-all duration-200 hover:scale-110 ${isDarkMode
                                    ? 'text-gray-400 hover:text-white hover:bg-gray-600'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                                  }`}
                                title="Clear description"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Purchase Rate */}
                        <div>
                          <label className="block text-sm font-medium mb-3">Purchase Rate</label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.purchaseRate || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string, valid numbers, and decimal numbers with up to 2 decimal places
                                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                  const numValue = parseFloat(value);
                                  if (value === '' || (!isNaN(numValue) && numValue >= 0)) {
                                    handleItemChange(index, 'purchaseRate', value);
                                  }
                                }
                              }}
                              onKeyPress={(e) => {
                                // Allow numbers, decimal point, backspace, delete, arrow keys
                                if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                  e.preventDefault();
                                }
                                // Prevent multiple decimal points
                                if (e.key === '.' && (e.target as HTMLInputElement).value.includes('.')) {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="Enter purchase rate"
                              className={`w-full p-3 pr-16 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                            />
                            {/* Custom Increment/Decrement Buttons */}
                            {!readOnly && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseFloat(String(item.purchaseRate || '0')) || 0;
                                    const newValue = currentValue + 0.01;
                                    // Format to 2 decimal places
                                    const formattedValue = newValue.toFixed(2);
                                    handleItemChange(index, 'purchaseRate', formattedValue);
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-t-sm border-b border-gray-300 transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Increase purchase rate by 0.01"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseFloat(String(item.purchaseRate || '0')) || 0;
                                    if (currentValue > 0) {
                                      const newValue = Math.max(0, currentValue - 0.01);
                                      // Format to 2 decimal places
                                      const formattedValue = newValue.toFixed(2);
                                      handleItemChange(index, 'purchaseRate', formattedValue);
                                    }
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-b-sm transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Decrease purchase rate by 0.01"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mill Rate */}
                        <div>
                          <label className="block text-sm font-medium mb-3">Mill Rate</label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.millRate || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string, valid numbers, and decimal numbers with up to 2 decimal places
                                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                  const numValue = parseFloat(value);
                                  if (value === '' || (!isNaN(numValue) && numValue >= 0)) {
                                    handleItemChange(index, 'millRate', value);
                                  }
                                }
                              }}
                              onKeyPress={(e) => {
                                // Allow numbers, decimal point, backspace, delete, arrow keys
                                if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                  e.preventDefault();
                                }
                                // Prevent multiple decimal points
                                if (e.key === '.' && (e.target as HTMLInputElement).value.includes('.')) {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="Enter mill rate"
                              className={`w-full p-3 pr-16 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                            />
                            {/* Custom Increment/Decrement Buttons */}
                            {!readOnly && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseFloat(String(item.millRate || '0')) || 0;
                                    const newValue = currentValue + 0.01;
                                    // Format to 2 decimal places
                                    const formattedValue = newValue.toFixed(2);
                                    handleItemChange(index, 'millRate', formattedValue);
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-t-sm border-b border-gray-300 transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Increase mill rate by 0.01"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseFloat(String(item.millRate || '0')) || 0;
                                    if (currentValue > 0) {
                                      const newValue = Math.max(0, currentValue - 0.01);
                                      // Format to 2 decimal places
                                      const formattedValue = newValue.toFixed(2);
                                      handleItemChange(index, 'millRate', formattedValue);
                                    }
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-b-sm transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Decrease mill rate by 0.01"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sales Rate */}
                        <div>
                          <label className="block text-sm font-medium mb-3">Sales Rate</label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.salesRate || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string, valid numbers, and decimal numbers with up to 2 decimal places
                                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                  const numValue = parseFloat(value);
                                  if (value === '' || (!isNaN(numValue) && numValue >= 0)) {
                                    handleItemChange(index, 'salesRate', value);
                                  }
                                }
                              }}
                              onKeyPress={(e) => {
                                // Allow numbers, decimal point, backspace, delete, arrow keys
                                if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                  e.preventDefault();
                                }
                                // Prevent multiple decimal points
                                if (e.key === '.' && (e.target as HTMLInputElement).value.includes('.')) {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="Enter sales rate"
                              className={`w-full p-3 pr-16 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode
                                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                            />
                            {/* Custom Increment/Decrement Buttons */}
                            {!readOnly && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseFloat(String(item.salesRate || '0')) || 0;
                                    const newValue = currentValue + 0.01;
                                    // Format to 2 decimal places
                                    const formattedValue = newValue.toFixed(2);
                                    handleItemChange(index, 'salesRate', formattedValue);
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-t-sm border-b border-gray-300 transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Increase sales rate by 0.01"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValue = parseFloat(String(item.salesRate || '0')) || 0;
                                    if (currentValue > 0) {
                                      const newValue = Math.max(0, currentValue - 0.01);
                                      // Format to 2 decimal places
                                      const formattedValue = newValue.toFixed(2);
                                      handleItemChange(index, 'salesRate', formattedValue);
                                    }
                                  }}
                                  className={`w-6 h-6 flex items-center justify-center rounded-b-sm transition-all duration-200 hover:scale-110 ${isDarkMode
                                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                    }`}
                                  title="Decrease sales rate by 0.01"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-end justify-end">
                          {!readOnly && (!order || !(formData.items[index] as any)?._id || (formData.items[index] as any)?._id?.startsWith('temp-') || isMaster) && (
                            <button
                              type="button"
                              onClick={() => {
                                // ⚡ CRITICAL: Prevent deletion if only one item remains
                                if (formData.items.length <= 1) {
                                  return;
                                }
                                removeItem(index);
                              }}
                              disabled={formData.items.length <= 1}
                              className={`p-3 rounded-lg border-2 transition-all duration-200 ${formData.items.length <= 1
                                  ? // Disabled state
                                  isDarkMode
                                    ? 'border-gray-600 text-gray-500 cursor-not-allowed opacity-50'
                                    : 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                                  : // Enabled state
                                  isDarkMode
                                    ? 'border-red-500 text-red-400 hover:bg-red-500 hover:text-white hover:scale-110'
                                    : 'border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:scale-110'
                                }`}
                              title={formData.items.length <= 1 ? "At least one item is required" : "Remove Item"}
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Images */}
                      <ImageUploadSection
                        itemIndex={index}
                        imageUrls={item.imageUrls || []}
                        onImageUpload={handleImageUpload}
                        onRemoveImage={removeImage}
                        onPreviewImage={(url, imgIndex) => setShowImagePreview({ url, index: imgIndex, itemIndex: index })}
                        isDarkMode={isDarkMode}
                        imageUploading={imageUploading}
                        pendingImageFiles={pendingImageFiles[index]}
                        readOnly={readOnly}
                      />
                    </div>
                  ))}

                  {/* Add Item Card */}
                  {!readOnly && (
                    <div className={`p-4 rounded-xl border-2 border-dashed transition-all duration-200 hover:shadow-lg cursor-pointer ${isDarkMode
                        ? 'border-gray-600 bg-gray-800/50 hover:border-blue-500 hover:bg-gray-800'
                        : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-gray-50'
                      }`} onClick={addItem}>
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
                            Add New Item
                          </h4>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Validation Message */}
              {validationMessage && (
                <div className={`fixed top-6 right-6 z-50 max-w-md transform transition-all duration-500 ease-in-out ${validationMessage.type === 'success'
                    ? 'animate-slide-in-right'
                    : 'animate-slide-in-right'
                  }`}>
                  <div className={`relative p-6 rounded-2xl border-2 shadow-2xl backdrop-blur-sm ${validationMessage.type === 'success'
                      ? isDarkMode
                        ? 'bg-gradient-to-r from-green-900/90 to-emerald-900/90 border-green-500/50 text-green-100 shadow-green-500/20'
                        : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-green-800 shadow-green-200/50'
                      : isDarkMode
                        ? 'bg-gradient-to-r from-red-900/90 to-rose-900/90 border-red-500/50 text-red-100 shadow-red-500/20'
                        : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300 text-red-800 shadow-red-200/50'
                    }`}>
                    {/* Background Pattern */}
                    <div className={`absolute inset-0 rounded-2xl opacity-10 ${validationMessage.type === 'success'
                        ? 'bg-gradient-to-br from-green-400 to-emerald-400'
                        : 'bg-gradient-to-br from-red-400 to-rose-400'
                      }`}></div>

                    <div className="relative flex items-start space-x-4">
                      {/* Icon Container */}
                      <div className={`flex-shrink-0 p-3 rounded-xl ${validationMessage.type === 'success'
                          ? isDarkMode
                            ? 'bg-green-500/20 border border-green-400/30'
                            : 'bg-green-100 border border-green-200'
                          : isDarkMode
                            ? 'bg-red-500/20 border border-red-400/30'
                            : 'bg-red-100 border border-red-200'
                        }`}>
                        {validationMessage.type === 'success' ? (
                          <CheckIcon className={`h-6 w-6 ${isDarkMode ? 'text-green-300' : 'text-green-600'
                            }`} />
                        ) : (
                          <ExclamationTriangleIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-300' : 'text-red-600'
                            }`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                          {validationMessage.type === 'success' ? 'Success!' : 'Error'}
                        </h3>
                        <p className={`text-sm leading-relaxed ${isDarkMode
                            ? validationMessage.type === 'success' ? 'text-green-200' : 'text-red-200'
                            : validationMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                          }`}>
                          {validationMessage.text}
                        </p>
                      </div>

                      {/* Close Button */}
                      <button
                        onClick={() => setValidationMessage(null)}
                        className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 hover:scale-110 ${validationMessage.type === 'success'
                            ? isDarkMode
                              ? 'text-green-300 hover:bg-green-500/20 hover:text-green-200'
                              : 'text-green-600 hover:bg-green-100 hover:text-green-700'
                            : isDarkMode
                              ? 'text-red-300 hover:bg-red-500/20 hover:text-red-200'
                              : 'text-red-600 hover:bg-red-100 hover:text-red-700'
                          }`}
                        title="Close notification"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className={`absolute bottom-0 left-0 h-1 rounded-b-2xl transition-all duration-300 ${validationMessage.type === 'success'
                        ? isDarkMode ? 'bg-green-400' : 'bg-green-500'
                        : isDarkMode ? 'bg-red-400' : 'bg-red-500'
                      }`} style={{ width: '100%' }}></div>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className={`px-8 py-3 rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={loading}
                className={`px-10 py-3 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105 ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                      : 'bg-blue-500 hover:bg-blue-600 shadow-lg'
                  }`}
              >
                {loading ? 'Saving...' : (order ? 'Update Order' : 'Create Order')}
              </button>
            )}
          </div>
        </form>

          {/* Image Preview Modal */}
          <ImagePreviewModal
            isOpen={showImagePreview !== null}
            onClose={() => setShowImagePreview(null)}
            images={showImagePreview ? [
              ...(pendingImageFiles[showImagePreview.itemIndex] || []).map((p: any) => p.previewUrl),
              ...(formData.items[showImagePreview.itemIndex]?.imageUrls || [])
            ] : []}
            initialIndex={showImagePreview ? showImagePreview.index : 0}
            isDarkMode={isDarkMode}
          />

          {/* Modals */}
          {showQualityModal && (
            <QualityModal
              onClose={() => setShowQualityModal(false)}
              onSuccess={async (newQualityName, newQualityData) => {
                console.log('🎉 Quality modal success:', { newQualityName, newQualityData, activeQualityDropdown });

                // Close modal first
                setShowQualityModal(false);

                // ⚡ FIX: Clear cache immediately when creating new quality
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.removeItem('qualities_cache');
                    console.log('🗑️ Cleared qualities_cache from localStorage after creating quality');
                  } catch (e) {
                    console.error('Failed to clear qualities cache:', e);
                  }
                }

                // ⚡ FIX: Immediately add to localQualities state for instant UI update
                if (newQualityData) {
                  setLocalQualities(prev => {
                    // Check if already exists to avoid duplicates
                    const qualityId = getQualityId(newQualityData);
                    const exists = prev.some(q => {
                      const qId = q._id || (q as any).id || '';
                      return String(qId) === String(qualityId);
                    });
                    if (!exists) {
                      console.log('🔄 Adding new quality to localQualities:', newQualityData.name);
                      return [newQualityData, ...prev]; // Add at beginning
                    }
                    return prev;
                  });
                }

                // Call the parent's onAddQuality function to update the qualities list
                // This will immediately update the qualities prop
                onAddQuality(newQualityData);

                // ⚡ FIX: Refresh qualities from server to ensure everything is synced
                // This ensures the dropdown always has the latest data
                if (onRefreshQualities) {
                  try {
                    console.log('🔄 Refreshing qualities after creation...');
                    await onRefreshQualities(true); // Force refresh to get latest data
                    console.log('✅ Qualities refreshed successfully');
                  } catch (err) {
                    console.error('Error refreshing qualities after creation:', err);
                  }
                }

                // ⚡ FIX: Clear any previous manually cleared flags for this quality
                if (newQualityData) {
                  const qualityId = getQualityId(newQualityData);
                  // Remove from manually cleared set if it was there (in case user creates same quality again)
                  setManuallyClearedQualities(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(qualityId);
                    return newSet;
                  });
                }

                // Auto-select the newly added quality immediately (like party does)
                if (newQualityData && activeQualityDropdown !== null) {
                  const qualityId = getQualityId(newQualityData);
                  const qualityName = newQualityData.name || newQualityName || '';

                  console.log('🔍 Auto-selecting quality immediately:', { qualityId, qualityName, dropdownIndex: activeQualityDropdown });

                  // ⚡ FIX: Set recently added quality FIRST before selecting (so validation passes)
                  setRecentlyAddedQuality(qualityId);
                  onSetRecentlyAddedQuality?.(qualityId);

                  // Small delay to ensure state is updated before selection
                  setTimeout(() => {
                    // Directly set the quality value and search state (same as party)
                    handleItemChange(activeQualityDropdown, 'quality', qualityId);
                    setQualitySearchStates(prev => ({
                      ...prev,
                      [activeQualityDropdown]: qualityName
                    }));
                    setCurrentQualitySearch(qualityName);

                    // Close the dropdown after selection
                    setActiveQualityDropdown(null);

                    // Show success message
                    setValidationMessage({ type: 'success', text: 'New quality added and selected automatically!' });

                    console.log('✅ Quality auto-selected in field:', activeQualityDropdown);
                  }, 50);

                  // Clear the recently added indicator after a delay
                  // Note: If user manually clears it, handleItemChange will clear it immediately
                  setTimeout(() => {
                    setRecentlyAddedQuality(prev => {
                      // Only clear if it's still the same quality (not manually cleared)
                      if (prev === qualityId) {
                        onSetRecentlyAddedQuality?.(null);
                        return null;
                      }
                      return prev;
                    });
                  }, 3000);
                } else if (newQualityData) {
                  // If no active dropdown, set the flag so useEffect can find first empty field
                  const qualityId = getQualityId(newQualityData);
                  setRecentlyAddedQuality(qualityId);
                  onSetRecentlyAddedQuality?.(qualityId);
                  setValidationMessage({ type: 'success', text: 'New quality added successfully!' });
                } else {
                  setValidationMessage({ type: 'success', text: 'New quality added successfully!' });
                }
              }}
            />
          )}
          {showPartyModal && (
            <PartyModal
              onClose={() => setShowPartyModal(false)}
              onSuccess={async (newPartyData) => {
                if (newPartyData) {
                  // ⚡ FIX: Immediately add to local parties for instant dropdown update
                  setLocalParties(prev => {
                    // Check if already exists (avoid duplicates)
                    const exists = prev.some(p => p._id === newPartyData._id);
                    if (exists) {
                      return prev.map(p => p._id === newPartyData._id ? newPartyData : p);
                    }
                    // Add at beginning for immediate visibility
                    return [newPartyData, ...prev];
                  });

                  // Auto-select the new party immediately
                  handleFieldChange('party', newPartyData._id || '');
                  setSelectedPartyName(newPartyData.name);
                  setPartySearch(newPartyData.name);
                  setRecentlyAddedParty(newPartyData._id || '');
                  onSetRecentlyAddedParty?.(newPartyData._id || '');

                  // Show success message
                  setValidationMessage({ type: 'success', text: 'New party added and selected successfully!' });
                }
                setShowPartyModal(false);

                // Refresh parties from API in background to ensure consistency (with force refresh)
                onRefreshParties(true).catch(err => {
                  console.error('Error refreshing parties:', err);
                });
              }}
            />
          )}

          {/* Keyboard Shortcuts Modal */}
          {showKeyboardShortcuts && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 p-4">
              <div className={`relative max-w-md w-full rounded-xl shadow-2xl modal-enter ${isDarkMode ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
                }`}>
                <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'
                  }`}>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    ⌨️ Keyboard Shortcuts
                  </h3>
                  <button
                    onClick={() => setShowKeyboardShortcuts(false)}
                    className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                      }`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Submit Form
                    </span>
                    <kbd className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}>
                      Ctrl + Enter
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Add New Item
                    </span>
                    <kbd className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}>
                      Alt + N
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Close Form
                    </span>
                    <kbd className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}>
                      Esc
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Show Shortcuts
                    </span>
                    <kbd className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}>
                      F1
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}