'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  XMarkIcon,
  PlusIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { FileText } from 'lucide-react';
import { Order, Mill, Quality } from '@/types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { createPortal } from 'react-dom';
import { getDisplayOrderId } from '@/utils/orders';

interface MillItem {
  id: string;
  millDate: string;
  chalanNo: string;
  greighMtr: string;
  pcs: string;
  quality: string; // Add quality field
  process: string; // Add process field
  additionalMeters: { meters: string; pieces: string; quality: string; process: string }[]; // Add process to additional meters
}

interface MillInputFormData {
  orderId: string;
  mill: string;
  millItems: MillItem[];
}

interface MillInputFormProps {
  order: Order | null;
  mills: Mill[];
  qualities: Quality[];
  onClose: () => void;
  onSuccess: (operationType?: 'add' | 'edit' | 'delete') => void;
  onAddMill: (newMillData?: any) => void;
  onRemoveMill?: (millId: string) => void;
  onSetRecentlyAddedMill?: (millId: string | null) => void;
  onRefreshMills: () => void;
  onRefreshQualities?: () => void; // Add quality refresh function
  isOpen?: boolean; // Add isOpen prop like LabDataModal
  isEditing?: boolean;
  existingMillInputs?: any[];
}

interface ValidationErrors {
  [key: string]: string;
}

// Process options
const PROCESS_OPTIONS = [
  'Lot No Greigh',
  'Charkha',
  'Drum',
  'Soflina WR',
  'long jet',
  'setting',
  'In Dyeing',
  'jigar',
  'in printing',
  'loop',
  'washing',
  'Finish',
  'folding',
  'ready to dispatch',
  'In House',
  'FOB Send'
];

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
          className={`w-full p-2.5 sm:p-3 pr-10 sm:pr-12 rounded-lg border text-sm sm:text-base ${isDarkMode
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
            top: dateInputRef.current ? dateInputRef.current.getBoundingClientRect().top - 10 : '50%',
            left: dateInputRef.current ? dateInputRef.current.getBoundingClientRect().left : '50%',
            transform: dateInputRef.current ? 'translateY(-100%)' : 'translate(-50%, -50%)'
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
  onAddNew,
  onDelete,
  itemIndex,
  recentlyAddedId,
  deletingItems
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
  deletingItems?: string[];
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest('.calendar-container') || target.closest('.date-picker')) {
          return;
        }
        // Only close if dropdown is currently open
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

  // Get selected item name for display
  const selectedItem = Array.isArray(options) ? options.find(option => (option._id || (option as any).id) === value) : null;

  // Debug: Log quality selection details
  if (placeholder?.includes('quality')) {
  }
  const displayValue = selectedItem ? selectedItem.name : searchValue;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={placeholder}
            value={displayValue}
            onChange={(e) => {
              const newValue = e.target.value;
              onSearchChange(newValue);
              // Clear selection if user is typing something different
              if (selectedItem && newValue !== selectedItem.name) {
                onChange('');
              }
            }}
            onFocus={() => onToggleDropdown()}
            className={`w-full p-2.5 sm:p-3 rounded-lg border text-sm sm:text-base ${isDarkMode
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
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className={`px-3 py-3 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 ${isDarkMode
              ? 'border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400'
              : 'border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600'
              }`}
            title="Add New Mill"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl max-h-60 overflow-y-auto dropdown-enter ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
          }`}>
          {Array.isArray(options) && options.length > 0 ? (
            [...options].sort((a, b) => {
              const aIsRecent = recentlyAddedId === (a._id || (a as any).id);
              const bIsRecent = recentlyAddedId === (b._id || (b as any).id);
              // Recently added items should appear at the top (return -1 means a comes before b)
              if (aIsRecent && !bIsRecent) return -1;
              if (!aIsRecent && bIsRecent) return 1;

              // For process options, maintain the original order (don't sort alphabetically)
              if (placeholder?.toLowerCase().includes('process')) {
                return 0; // Keep original order
              }

              return a.name.localeCompare(b.name);
            }).map((option, index) => (
              <button
                key={option._id || (option as any).id || `mill-${index}-${option.name}`}
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
                  </div>
                  <div className="flex items-center space-x-2">
                    {value === (option._id || (option as any).id) && (
                      <CheckIcon className="h-4 w-4 text-blue-500" />
                    )}
                    {onDelete && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const itemId = option._id || option.id;
                          if (deletingItems?.includes(itemId)) {
                            return; // Prevent clicks while deleting
                          }
                          if (onDelete) {
                            onDelete(option);
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors ${deletingItems?.includes(option._id || option.id)
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20'
                          } ${isDarkMode
                            ? 'text-gray-400 hover:text-red-400'
                            : 'text-gray-500 hover:text-red-600'
                          }`}
                        title={deletingItems?.includes(option._id || option.id) ? "Deleting..." : "Delete mill"}
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
                <p className="font-medium">No mills found</p>
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
                    Add New Mill
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MillInputForm({
  order,
  mills,
  qualities,
  onClose,
  onSuccess,
  onAddMill,
  onRemoveMill,
  onSetRecentlyAddedMill,
  onRefreshMills,
  onRefreshQualities,
  isOpen = true, // Default to true for backward compatibility
  isEditing = false,
  existingMillInputs = []
}: MillInputFormProps) {
  const { isDarkMode, mounted } = useDarkMode();

  console.log('MillInputForm props:', {
    order: order?.orderId,
    mills: mills?.length,
    qualities: qualities?.length,
    isEditing,
    existingMillInputs: existingMillInputs?.length
  });

  // Refresh qualities when form is opened
  useEffect(() => {
    if (isOpen && onRefreshQualities) {
      console.log('MillInputForm: Refreshing qualities on form open');
      onRefreshQualities();
    }
  }, [isOpen, onRefreshQualities]);

  // ⚡ FIX: Initialize localQualities from qualities prop when form opens
  useEffect(() => {
    if (isOpen && qualities && Array.isArray(qualities) && qualities.length > 0) {
      setLocalQualities(prev => {
        // Only initialize if localQualities is empty
        if (prev.length === 0) {
          console.log('🔄 MillInputForm: Initializing localQualities from prop on form open:', qualities.length, 'qualities');
          return qualities;
        }
        return prev;
      });
    }
  }, [isOpen, qualities]);

  const [formData, setFormData] = useState<MillInputFormData>({
    orderId: order?.orderId || '',
    mill: '',
    millItems: [{
      id: '1',
      millDate: '',
      chalanNo: '',
      greighMtr: '',
      pcs: '',
      quality: '', // Add quality field
      process: '', // Add process field
      additionalMeters: []
    }],
  });

  // Debug logging
  // Additional debugging for empty mills
  if (mills.length === 0) {
  }
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState('');
  const [showAddMillModal, setShowAddMillModal] = useState(false);
  const [addMillForm, setAddMillForm] = useState({
    name: '',
    contactPerson: '',
    contactPhone: '',
    address: '',
    email: ''
  });
  // Loading states for better UX
  const [loadingExistingData, setLoadingExistingData] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [addingMill, setAddingMill] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };
  const [millsLoading, setMillsLoading] = useState(false);
  const [localMills, setLocalMills] = useState<Mill[]>([]);
  const [isFetchingMills, setIsFetchingMills] = useState(false);

  // ⚡ FIX: Prevent multiple simultaneous operations
  const operationInProgressRef = useRef(false);

  // LabDataModal pattern states
  const [hasExistingData, setHasExistingData] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [localMillInputs, setLocalMillInputs] = useState<any[]>([]);

  // Mill delete state (no confirmation modal - direct delete like quality)
  const [deletingMill, setDeletingMill] = useState<string | null>(null); // Track which mill is being deleted for loading state

  // ⚡ FIX: Persist deleted mill IDs across form opens using sessionStorage (like qualities)
  const getInitialDeletedMillIds = (): Set<string> => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('deletedMillIds');
        if (stored) {
          return new Set(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error loading deleted mill IDs:', e);
      }
    }
    return new Set();
  };

  const deletedMillIdsRef = useRef<Set<string>>(getInitialDeletedMillIds());
  const [deletedMillIds, setDeletedMillIds] = useState<Set<string>>(deletedMillIdsRef.current);

  // ⚡ FIX: Save deleted IDs to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('deletedMillIds', JSON.stringify(Array.from(deletedMillIdsRef.current)));
      } catch (e) {
        console.error('Error saving deleted mill IDs:', e);
      }
    }
  }, [deletedMillIds.size]); // Use size to trigger save when deletions happen

  // Mill-related state
  const [millSearch, setMillSearch] = useState('');
  const [showMillDropdown, setShowMillDropdown] = useState(false);
  const [recentlyAddedMill, setRecentlyAddedMill] = useState<string | null>(null);
  const [selectedMillName, setSelectedMillName] = useState('');
  const [dropdownKey, setDropdownKey] = useState(0); // Force re-render key
  const newMillRef = useRef<any>(null); // Store new mill temporarily
  // ⚡ FIX: Track recently added mill IDs (similar to qualities) to ensure they appear in dropdown
  const [recentlyAddedMillIds, setRecentlyAddedMillIds] = useState<Set<string>>(new Set());

  // Quality-related state
  const [activeQualityDropdown, setActiveQualityDropdown] = useState<{ itemId: string; type: 'main' | 'additional'; index?: number } | null>(null);
  const [qualitySearchStates, setQualitySearchStates] = useState<{ [key: string]: string }>({});
  const [currentQualitySearch, setCurrentQualitySearch] = useState('');
  const [recentlyAddedQuality, setRecentlyAddedQuality] = useState<string | null>(null);

  // ⚡ FIX: Local qualities state to include newly added qualities
  const [localQualities, setLocalQualities] = useState<Quality[]>([]);

  // Sync local mills with prop mills
  useEffect(() => {
    if (mills && Array.isArray(mills)) {
      if (mills.length === 0) {
        // If mills prop is empty array, clear localMills (all deleted)
        setLocalMills([]);
      } else {
        setLocalMills(prev => {
          // Use a Map to ensure we keep the latest version of each mill
          const millMap = new Map();

          // First, add prop mills (these are the source of truth after deletion)
          mills.forEach(mill => {
            const id = mill._id || (mill as any).id;
            if (id) {
              millMap.set(String(id), mill);
            }
          });

          // Then, add any local mills that aren't in props (for newly created ones)
          prev.forEach(m => {
            const id = m._id || (m as any).id;
            if (id && !millMap.has(String(id))) {
              millMap.set(String(id), m);
            }
          });

          // Convert map back to array
          const merged = Array.from(millMap.values());
          console.log('🔄 MillInputForm: Synced localMills with prop mills:', merged.length, 'mills');
          return merged;
        });
      }
    }
  }, [mills]);

  // ⚡ FIX: Listen for millAdded and millsRefreshed events to immediately update localMills
  useEffect(() => {
    const handleMillAdded = (event: any) => {
      const newMill = event.detail?.mill;
      if (newMill) {
        console.log('🎉 MillInputForm: Received millAdded event:', newMill.name);

        // ⚡ FIX: Clear ALL mill-related caches aggressively
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('mills_cache');
            // Clear all mill-related caches
            Object.keys(localStorage).forEach(key => {
              if (key.includes('mill') || key.includes('mills')) {
                localStorage.removeItem(key);
              }
            });
            // Also clear process-data-cache if it exists
            try {
              const processCache = localStorage.getItem('process-data-cache');
              if (processCache) {
                const cacheData = JSON.parse(processCache);
                cacheData.millsTimestamp = 0;
                localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
              }
            } catch (e) { }
            console.log('🗑️ Cleared ALL mill caches after millAdded event');
          } catch (e) {
            console.error('Error clearing caches:', e);
          }
        }

        const millId = newMill._id || (newMill as any).id;
        if (!millId) return;

        // ⚡ FIX: Add to recentlyAddedMillIds Set to ensure it appears in dropdown
        setRecentlyAddedMillIds(prev => {
          const updated = new Set(prev);
          updated.add(String(millId));
          console.log('📝 Added mill to recentlyAddedMillIds:', newMill.name, millId);
          return updated;
        });

        // Store in ref for immediate access
        newMillRef.current = newMill;

        // Update localMills immediately
        setLocalMills(prev => {
          // Check if already exists
          const exists = prev.some(m => {
            const mId = m._id || (m as any).id;
            return String(mId) === String(millId);
          });

          if (!exists) {
            console.log('✅ Adding new mill to MillInputForm localMills:', newMill.name);
            return [newMill, ...prev];
          } else {
            // Update existing mill with latest data
            return prev.map(m => {
              const mId = m._id || (m as any).id;
              return String(mId) === String(millId) ? newMill : m;
            });
          }
        });

        // Clear recentlyAddedMillIds after 5 minutes (similar to qualities)
        setTimeout(() => {
          setRecentlyAddedMillIds(prev => {
            const updated = new Set(prev);
            updated.delete(String(millId));
            return updated;
          });
        }, 5 * 60 * 1000);
      }
    };

    // Listen for millsRefreshed event to fetch fresh data
    const handleMillsRefreshed = async () => {
      console.log('🔄 MillInputForm: Received millsRefreshed event, fetching fresh data...');

      // ⚡ FIX: Clear ALL mill-related caches aggressively
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('mills_cache');
          // Clear all mill-related caches
          Object.keys(localStorage).forEach(key => {
            if (key.includes('mill') || key.includes('mills')) {
              localStorage.removeItem(key);
            }
          });
          // Also clear process-data-cache if it exists
          try {
            const processCache = localStorage.getItem('process-data-cache');
            if (processCache) {
              const cacheData = JSON.parse(processCache);
              cacheData.millsTimestamp = 0;
              localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
            }
          } catch (e) { }
          console.log('🗑️ Cleared ALL mill caches after millsRefreshed event');
        } catch (e) {
          console.error('Error clearing caches:', e);
        }
      }

      // Fetch fresh mills
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const millsResponse = await fetch(`/api/mills?t=${Date.now()}&limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          });

          if (millsResponse.ok) {
            const millsData = await millsResponse.json();
            if (millsData.success && Array.isArray(millsData.data)) {
              // Filter out deleted mills
              const filteredMills = millsData.data.filter((m: any) => {
                const mId = m._id || (m as any).id || '';
                return !deletedMillIds.has(String(mId)) && !deletedMillIdsRef.current.has(String(mId));
              });
              setLocalMills(filteredMills);
              console.log('✅ MillInputForm: Refreshed mills from server:', filteredMills.length, 'mills');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching fresh mills:', error);
      }

      // Also call parent's refresh function
      if (onRefreshMills) {
        onRefreshMills();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('millAdded', handleMillAdded);
      window.addEventListener('millsRefreshed', handleMillsRefreshed);
      return () => {
        window.removeEventListener('millAdded', handleMillAdded);
        window.removeEventListener('millsRefreshed', handleMillsRefreshed);
      };
    }
  }, [onRefreshMills]);

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
          console.log('🔄 MillInputForm: Synced localQualities with prop qualities:', merged.length, 'qualities');
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
        console.log('🎉 MillInputForm: Received qualityAdded event:', newQuality.name);

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
            console.log('✅ Adding new quality to MillInputForm localQualities:', newQuality.name);
            return [newQuality, ...prev];
          }
          return prev;
        });
      }
    };

    // Listen for qualitiesRefreshed event to fetch fresh data
    const handleQualitiesRefreshed = async () => {
      console.log('🔄 MillInputForm: Received qualitiesRefreshed event, fetching fresh data...');

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
              console.log('✅ MillInputForm: Refreshed qualities from server:', qualitiesData.data.length, 'qualities');
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

  // Process-related state
  const [activeProcessDropdown, setActiveProcessDropdown] = useState<{ itemId: string; type: 'main' | 'additional'; index?: number } | null>(null);
  const [processSearchStates, setProcessSearchStates] = useState<{ [key: string]: string }>({});
  const [currentProcessSearch, setCurrentProcessSearch] = useState('');

  // Memoized filtered mills options (must be at top level for React hooks rules)
  const filteredMillsOptions = useMemo(() => {
    // Use localMills if available, otherwise fallback to mills prop
    let options = localMills.length > 0 ? localMills : (mills || []);

    // ⚡ CRITICAL: Filter out deleted mills immediately (check both state and ref)
    options = options.filter(m => {
      const mId = m._id || (m as any).id || '';
      return !deletedMillIds.has(String(mId)) && !deletedMillIdsRef.current.has(String(mId));
    });

    // ⚡ FIX: Always ensure recently added mills are included (from recentlyAddedMillIds Set)
    const allMills = [...options];
    recentlyAddedMillIds.forEach(millId => {
      const hasMill = allMills.some(m => {
        const mId = m._id || (m as any).id || '';
        return String(mId) === String(millId);
      });
      if (!hasMill) {
        // Try to find in mills prop
        const recentMill = mills?.find(m => {
          const mId = m._id || (m as any).id || '';
          return String(mId) === String(millId) &&
            !deletedMillIds.has(String(mId)) &&
            !deletedMillIdsRef.current.has(String(mId));
        });
        if (recentMill) {
          allMills.unshift(recentMill);
        } else if (newMillRef.current) {
          const refId = newMillRef.current._id || (newMillRef.current as any).id;
          if (String(refId) === String(millId)) {
            allMills.unshift(newMillRef.current);
          }
        }
      }
    });

    // Also handle single recentlyAddedMill for backward compatibility
    if (recentlyAddedMill) {
      const hasMill = allMills.some(m => {
        const mId = m._id || (m as any).id || '';
        return String(mId) === String(recentlyAddedMill);
      });
      if (!hasMill) {
        const recentMill = mills?.find(m => {
          const mId = m._id || (m as any).id || '';
          return String(mId) === String(recentlyAddedMill) &&
            !deletedMillIds.has(String(mId)) &&
            !deletedMillIdsRef.current.has(String(mId));
        });
        if (recentMill) {
          allMills.unshift(recentMill);
        } else if (newMillRef.current && newMillRef.current._id === recentlyAddedMill) {
          allMills.unshift(newMillRef.current);
        }
      }
    }

    // Filter by search term if provided
    if (millSearch.trim()) {
      const filtered = allMills.filter(m =>
        m.name?.toLowerCase().includes(millSearch.toLowerCase())
      );
      // If search doesn't match but we have recently added mills, always include them
      const recentlyAddedMills = allMills.filter(m => {
        const mId = m._id || (m as any).id || '';
        return recentlyAddedMillIds.has(String(mId)) ||
          (recentlyAddedMill && String(mId) === String(recentlyAddedMill));
      });
      const missingRecentlyAdded = recentlyAddedMills.filter(ram =>
        !filtered.some(f => {
          const fId = f._id || (f as any).id || '';
          const ramId = ram._id || (ram as any).id || '';
          return String(fId) === String(ramId);
        })
      );
      return [...missingRecentlyAdded, ...filtered];
    }
    return allMills;
  }, [localMills, mills, millSearch, recentlyAddedMill, recentlyAddedMillIds, dropdownKey, deletedMillIds]);

  // Optimized mills loading - use cache when available
  useEffect(() => {
    if (isOpen && order?.orderId) {
      // First, use mills from props if available (instant) - but filter deleted mills
      if (mills && mills.length > 0 && localMills.length === 0) {
        const filteredMills = mills.filter((m: any) => {
          const mId = m._id || (m as any).id || '';
          return !deletedMillIdsRef.current.has(String(mId));
        });
        setLocalMills(filteredMills);
      }

      // Then fetch fresh data in background (non-blocking)
      setMillsLoading(true);
      const timeout = setTimeout(() => {
        fetchMillsDirectly(false);
      }, 0); // Immediate but non-blocking

      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order?.orderId]); // fetchMillsDirectly is stable (useCallback) and declared later

  // ⚡ FIX: Load deleted IDs from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('deletedMillIds');
        if (stored) {
          const parsed = JSON.parse(stored);
          deletedMillIdsRef.current = new Set(parsed);
          setDeletedMillIds(deletedMillIdsRef.current);
          console.log('📦 Loaded deleted mill IDs from sessionStorage:', parsed.length);
        }
      } catch (e) {
        console.error('Error loading deleted mill IDs from sessionStorage:', e);
      }
    }
  }, []); // Run once on mount

  // Force refresh mills when form opens to ensure fresh data
  useEffect(() => {
    if (isOpen && order?.orderId && onRefreshMills) {
      console.log('Form opened, refreshing mills from parent...');
      onRefreshMills();
    }
  }, [isOpen, order?.orderId, onRefreshMills]);

  // Monitor mills prop changes - merge with local mills (but exclude deleted mills)
  // ⚡ FIX: Also sync when recentlyAddedMill changes to ensure new mills are included
  useEffect(() => {
    if (mills && mills.length > 0) {
      setLocalMills(prev => {
        // ⚡ CRITICAL: Start fresh with prop mills (source of truth from server)
        // ⚡ CRITICAL: Filter out deleted mills first
        const merged = mills.filter(mill => {
          const millId = mill._id || (mill as any).id || '';
          const isDeleted = deletedMillIds.has(String(millId)) || deletedMillIdsRef.current.has(String(millId));
          if (isDeleted) {
            console.log('🚫 Filtering out deleted mill during sync:', millId, mill.name);
          }
          return !isDeleted;
        });

        // ⚡ FIX: Create a Set of existing IDs for faster lookup
        const existingIds = new Set(merged.map(m => {
          const mId = m._id || (m as any).id;
          return mId ? String(mId) : null;
        }).filter(Boolean));

        // Only add local mills that aren't in prop mills AND aren't deleted (newly created, not yet in backend)
        prev.forEach(localMill => {
          const localId = localMill._id || (localMill as any).id;
          if (localId) {
            const localIdStr = String(localId);
            // ⚡ CRITICAL: Skip if this mill was deleted (check both state and ref)
            if (deletedMillIds.has(localIdStr) || deletedMillIdsRef.current.has(localIdStr)) {
              return;
            }

            // ⚡ FIX: Check if this mill exists in the merged list (faster lookup)
            if (!existingIds.has(localIdStr)) {
              merged.unshift(localMill); // Add at beginning
              existingIds.add(localIdStr); // Track it to avoid duplicates
            }
          }
        });

        console.log('🔄 Synced localMills:', merged.length, 'mills (from props:', mills.length, ', deleted:', deletedMillIds.size, ')');
        return merged;
      });
    } else {
      // If mills prop is empty or invalid, clear localMills except newly created ones
      setLocalMills(prev => {
        // Keep only items that don't have _id (newly created, not yet saved) AND aren't deleted
        return prev.filter(m => {
          const mId = m._id || (m as any).id;
          return (!mId || (!deletedMillIds.has(String(mId)) && !deletedMillIdsRef.current.has(String(mId))));
        });
      });
    }
  }, [mills, deletedMillIds, recentlyAddedMill]); // Re-run when recentlyAddedMill changes

  // Note: Dropdown is now opened immediately in handleAddMill, no need for delayed useEffect

  // Load existing data when form opens (smart logic)
  useEffect(() => {
    console.log('🔄 MillInputForm useEffect triggered:', {
      isOpen,
      orderId: order?.orderId,
      existingMillInputsCount: existingMillInputs?.length,
      isEditing
    });

    if (isOpen && order?.orderId) {
      console.log('📋 Form opened, starting data loading process...');

      // Smart logic: Use isEditing prop to determine if we should fetch data
      console.log('🔍 Mill Input Smart Logic:', {
        isEditing,
        willFetchData: isEditing,
        orderId: order.orderId
      });

      // Reset states but don't reset form data yet - let API call determine what to show
      setLocalMillInputs([]);
      setErrors({});
      setSuccessMessage('');
      setShowDeleteConfirm(false);
      setItemToDelete(null);

      // Start loading immediately
      setHasExistingData(false);
      setLoadingExistingData(true);

      // Smart API logic:
      // - If isEditing is true → Fetch API (edit mode)
      // - If isEditing is false → Skip API call (add mode)
      if (isEditing) {
        console.log('📊 Edit mode detected - fetching existing mill input data');
        setTimeout(() => {
          fetchExistingMillInputData();
        }, 100);
      } else {
        console.log('⚡ Add mode detected - skipping API call');
        setLoadingExistingData(false);
        // Reset form to initial state for add mode
        setFormData({
          orderId: order.orderId || '',
          mill: '',
          millItems: [{
            id: '1',
            millDate: '',
            chalanNo: '',
            greighMtr: '',
            pcs: '',
            quality: '',
            process: '',
            additionalMeters: []
          }],
        });
      }
    } else if (!isOpen) {
      // Reset loading state when form is closed
      setHasExistingData(false);
      setLoadingExistingData(false);
    }
  }, [isOpen, order?.orderId, isEditing]);

  // Helper function to get mill name by ID
  const getMillName = (millId: string) => {
    const allMills = localMills.length > 0 ? localMills : mills;
    const mill = allMills.find(m => m._id === millId);
    return mill ? mill.name : '';
  };

  // Function to handle mill selection
  const handleMillSelect = (mill: any) => {
    setFormData({ ...formData, mill: mill._id || mill.id });
    setSelectedMillName(mill.name);
    setMillSearch(mill.name);
    setShowMillDropdown(false);
  };

  // Function to handle mill search change
  const handleMillSearchChange = (value: string) => {
    setMillSearch(value);
    // Clear mill selection if user is typing something different
    if (formData.mill && value !== selectedMillName) {
      setFormData({ ...formData, mill: '' });
      setSelectedMillName('');
    }
  };

  // Function to handle mill dropdown toggle
  const handleMillDropdownToggle = async () => {
    if (showMillDropdown) {
      // Close dropdown
      setShowMillDropdown(false);
      setMillSearch('');
    } else {
      // ⚡ FIX: Clear ALL mill-related caches aggressively when opening dropdown
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('mills_cache');
          // Clear all mill-related caches
          Object.keys(localStorage).forEach(key => {
            if (key.includes('mill') || key.includes('mills')) {
              localStorage.removeItem(key);
            }
          });
          // Also clear process-data-cache if it exists
          try {
            const processCache = localStorage.getItem('process-data-cache');
            if (processCache) {
              const cacheData = JSON.parse(processCache);
              cacheData.millsTimestamp = 0;
              localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
            }
          } catch (e) { }
          console.log('🗑️ Cleared ALL mill caches before opening dropdown');
        } catch (e) {
          console.error('Error clearing caches:', e);
        }
      }

      // ⚡ FIX: Fetch fresh mills directly and update localMills immediately
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const millsResponse = await fetch(`/api/mills?t=${Date.now()}&limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          });

          if (millsResponse.ok) {
            const millsData = await millsResponse.json();
            if (millsData.success && Array.isArray(millsData.data)) {
              // Filter out deleted mills
              const filteredMills = millsData.data.filter((m: any) => {
                const mId = m._id || (m as any).id || '';
                return !deletedMillIds.has(String(mId)) && !deletedMillIdsRef.current.has(String(mId));
              });
              // Update local mills immediately with fresh data
              setLocalMills(prev => {
                // Merge with recently added mills to ensure they're not lost
                const merged = [...filteredMills];
                const existingIds = new Set(filteredMills.map((m: any) => {
                  const mId = m._id || (m as any).id;
                  return mId ? String(mId) : null;
                }).filter(Boolean));

                // Add recently added mills that aren't in the fresh data
                prev.forEach(localMill => {
                  const localId = localMill._id || (localMill as any).id;
                  if (localId && recentlyAddedMillIds.has(String(localId)) && !existingIds.has(String(localId))) {
                    merged.unshift(localMill);
                    existingIds.add(String(localId));
                  }
                });

                // ⚡ FIX: If there's a selected mill ID, find and set its name immediately
                if (formData.mill && !selectedMillName) {
                  const selectedMill = merged.find(m => {
                    const mId = m._id || (m as any).id;
                    return String(mId) === String(formData.mill);
                  });
                  if (selectedMill) {
                    setSelectedMillName(selectedMill.name);
                    setMillSearch(selectedMill.name);
                    console.log('✅ Set selected mill name immediately:', selectedMill.name);
                  }
                }

                return merged;
              });
              console.log('✅ Updated localMills with fresh data:', filteredMills.length, 'mills');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching fresh mills:', error);
      }

      // ⚡ FIX: Also update selectedMillName from current localMills if not set
      if (formData.mill && !selectedMillName) {
        const allMills = localMills.length > 0 ? localMills : (mills || []);
        const selectedMill = allMills.find(m => {
          const mId = m._id || (m as any).id;
          return String(mId) === String(formData.mill);
        });
        if (selectedMill) {
          setSelectedMillName(selectedMill.name);
          setMillSearch(selectedMill.name);
          console.log('✅ Set selected mill name from existing mills:', selectedMill.name);
        }
      }

      // Also call parent's refresh function for consistency
      if (onRefreshMills) {
        onRefreshMills();
      }

      // Close any active quality and process dropdowns first
      setActiveQualityDropdown(null);
      setCurrentQualitySearch('');
      setActiveProcessDropdown(null);
      setCurrentProcessSearch('');
      // Open mill dropdown
      setShowMillDropdown(true);
    }
  };

  // Function to handle mill change
  const handleMillChange = (value: string) => {
    setFormData({ ...formData, mill: value });
    // Clear search and selected name if value is empty
    if (!value) {
      setMillSearch('');
      setSelectedMillName('');
    }
  };

  // Optimized function to fetch mills directly from API - SUPER FAST
  const fetchMillsDirectly = useCallback(async (forceRefresh = false) => {
    // Prevent multiple simultaneous calls
    if (isFetchingMills && !forceRefresh) {
      return;
    }

    setIsFetchingMills(true);
    setMillsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setMillsLoading(false);
        setIsFetchingMills(false);
        return;
      }

      // ⚡ FIX: Clear ALL mill-related caches aggressively before fetching
      if (forceRefresh && typeof window !== 'undefined') {
        try {
          localStorage.removeItem('mills_cache');
          // Clear all mill-related caches
          Object.keys(localStorage).forEach(key => {
            if (key.includes('mill') || key.includes('mills')) {
              localStorage.removeItem(key);
            }
          });
          // Also clear process-data-cache if it exists
          try {
            const processCache = localStorage.getItem('process-data-cache');
            if (processCache) {
              const cacheData = JSON.parse(processCache);
              cacheData.millsTimestamp = 0;
              localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
            }
          } catch (e) { }
          console.log('🗑️ Cleared ALL mill caches in fetchMillsDirectly');
        } catch (e) {
          console.error('Failed to clear cache:', e);
        }
      }

      // Fast timeout - 3 seconds max
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // ⚡ FIX: Add cache-busting and no-cache headers
      const cacheBuster = Date.now();
      const response = await fetch(`/api/mills?limit=1000&t=${cacheBuster}&_nocache=${cacheBuster}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        signal: controller.signal,
        cache: 'no-store' // Always force no cache
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.data?.mills) {
          const millsData = data.data.mills;
          // ⚡ FIX: Filter out deleted mills immediately
          const filteredMills = millsData.filter((m: any) => {
            const mId = m._id || (m as any).id || '';
            return !deletedMillIdsRef.current.has(String(mId));
          });
          console.log('🔄 Fetched mills:', millsData.length, ', filtered deleted:', filteredMills.length);
          // Update local mills state immediately with filtered data
          setLocalMills(filteredMills);
          // Update parent component in background
          if (onRefreshMills) {
            onRefreshMills();
          }
        } else if (mills?.length > 0) {
          // Fallback to props - also filter deleted mills
          const filteredMills = mills.filter((m: any) => {
            const mId = m._id || (m as any).id || '';
            return !deletedMillIdsRef.current.has(String(mId));
          });
          setLocalMills(filteredMills);
        } else {
          setLocalMills([]);
        }
      } else if (mills?.length > 0) {
        // Fallback to props on error - also filter deleted mills
        const filteredMills = mills.filter((m: any) => {
          const mId = m._id || (m as any).id || '';
          return !deletedMillIdsRef.current.has(String(mId));
        });
        setLocalMills(filteredMills);
      } else {
        setLocalMills([]);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        // Fallback to props or existing local mills
        if (mills?.length > 0) {
          setLocalMills(mills);
        } else if (localMills.length > 0) {
          // Keep existing local mills
        } else {
          setLocalMills([]);
        }
      }
    } finally {
      setMillsLoading(false);
      setIsFetchingMills(false);
    }
  }, [isFetchingMills, mills, onRefreshMills, localMills.length]);

  // Function to process existing mill inputs from props
  const processExistingMillInputs = (millInputs: any[]) => {
    console.log('🔄 Processing existing mill inputs:', millInputs.length, 'records');
    console.log('🔄 Raw mill inputs data:', millInputs);

    if (millInputs.length === 0) {
      setHasExistingData(false);
      setLocalMillInputs([]);
      return;
    }

    // Convert API data to form format
    const processedItems = millInputs.map((input, index) => ({
      id: input._id || `existing-${index}`,
      millDate: input.millDate ? new Date(input.millDate).toISOString().split('T')[0] : '',
      chalanNo: input.chalanNo || '',
      greighMtr: input.greighMtr?.toString() || '',
      pcs: input.pcs?.toString() || '',
      quality: input.quality?._id || input.quality || '',
      process: input.processName || '',
      additionalMeters: (input.additionalMeters || []).map((additional: any, addIndex: number) => ({
        meters: additional.greighMtr?.toString() || '',
        pieces: additional.pcs?.toString() || '',
        quality: additional.quality?._id || additional.quality || '',
        process: additional.processName || ''
      }))
    }));

    console.log('🔄 Processed mill input items:', processedItems.length, 'items');
    console.log('🔄 Processed items data:', processedItems);

    // Update form data with existing data
    setFormData(prev => ({
      ...prev,
      mill: millInputs[0]?.mill?._id || millInputs[0]?.mill || '',
      millItems: processedItems
    }));

    setLocalMillInputs(millInputs);
    setHasExistingData(true);

    console.log('🔄 Form data updated with existing mill inputs');
  };

  // Function to fetch existing mill input data from API (optimized for immediate display)
  const fetchExistingMillInputData = async () => {
    console.log('🔄 Starting to fetch mill input data for order:', order?.orderId);
    if (!order?.orderId) {
      console.log('No order ID available for fetching mill inputs');
      setHasExistingData(false);
      setLoadingExistingData(false);
      return;
    }

    // Double-check that we're in edit mode
    if (!isEditing) {
      console.log('⚠️ Not in edit mode, skipping data fetch');
      setHasExistingData(false);
      setLoadingExistingData(false);
      return;
    }

    console.log('📡 Fetching mill inputs for order:', order.orderId);

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No authentication token available');
        setHasExistingData(false);
        setLoadingExistingData(false);
        return;
      }

      // Create AbortController for timeout - increased timeout for reliability
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10 seconds for better reliability

      const response = await fetch(`/api/mill-inputs?orderId=${order.orderId}&t=${Date.now()}`, {
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

        if (data.success && data.data && data.data.millInputs && data.data.millInputs.length > 0) {
          console.log('✅ Found existing mill inputs from API:', data.data.millInputs.length, 'records');
          console.log('Mill inputs data:', data.data.millInputs);
          // Use the same processing function
          processExistingMillInputs(data.data.millInputs);
          setLoadingExistingData(false);
          console.log('✅ Mill input data loaded successfully - form should now show data');
        } else {
          console.log('❌ No existing mill inputs found in API response');
          console.log('Response structure:', {
            success: data.success,
            hasData: !!data.data,
            hasMillInputs: !!(data.data && data.data.millInputs),
            millInputsLength: data.data?.millInputs?.length || 0
          });
          setLocalMillInputs([]);
          setHasExistingData(false);
          setLoadingExistingData(false);

          // Set empty form data when no existing data
          const emptyFormData = {
            orderId: order.orderId || '',
            mill: '',
            millItems: [{
              id: '1',
              millDate: '',
              chalanNo: '',
              greighMtr: '',
              pcs: '',
              quality: '',
              process: '',
              additionalMeters: []
            }],
            _lastUpdated: Date.now()
          };

          setFormData(emptyFormData);
          console.log('✅ Empty form data set - ready for new mill input entry');
        }
      } else {
        console.log('❌ Failed to fetch mill inputs from API, status:', response.status);
        const errorText = await response.text();
        console.log('Error response:', errorText);
        setHasExistingData(false);
        setLoadingExistingData(false);

        // Set empty form data when API fails
        const errorFormData = {
          orderId: order.orderId || '',
          mill: '',
          millItems: [{
            id: '1',
            millDate: '',
            chalanNo: '',
            greighMtr: '',
            pcs: '',
            quality: '',
            process: '',
            additionalMeters: []
          }],
          _lastUpdated: Date.now()
        };

        setFormData(errorFormData);
        console.log('✅ Error form data set - ready for new mill input entry');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('❌ Mill inputs fetch was aborted due to timeout');
      } else {
        console.error('❌ Error fetching mill inputs from API:', error);
      }
      setHasExistingData(false);
      setLoadingExistingData(false);

      // Set empty form data when error occurs
      const catchFormData = {
        orderId: order.orderId || '',
        mill: '',
        millItems: [{
          id: '1',
          millDate: '',
          chalanNo: '',
          greighMtr: '',
          pcs: '',
          quality: '',
          process: '',
          additionalMeters: []
        }],
        _lastUpdated: Date.now()
      };

      setFormData(catchFormData);
      console.log('✅ Catch form data set - ready for new mill input entry');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Always stop loading when fetch completes (success or error)
      setLoadingExistingData(false);
      console.log('🔄 Mill input data fetch completed');
    }
  };

  // Note: Removed dependency on isEditing and existingMillInputs props
  // Form now fetches data independently from API like LabDataModal

  // Monitor mills array changes and clear loading state (simplified to prevent loops)
  useEffect(() => {
    if (mills.length > 0 || localMills.length > 0) {
      console.log('Mills loaded successfully, clearing loading state');
      setMillsLoading(false);

      // Initialize mill search value if form has a selected mill
      if (formData.mill && !millSearch) {
        const millName = getMillName(formData.mill);
        if (millName) {
          setMillSearch(millName);
          setSelectedMillName(millName);
        }
      }
    }
  }, [mills.length, localMills.length, formData.mill, millSearch]);

  // Reset form when order changes (but not when editing)
  useEffect(() => {
    if (order && !isEditing) {
      setFormData({
        orderId: order.orderId,
        mill: '',
        millItems: [{
          id: '1',
          millDate: '',
          chalanNo: '',
          greighMtr: '',
          pcs: '',
          quality: '', // Add quality field
          process: '', // Add process field
          additionalMeters: []
        }],
      });
      setErrors({});
      setSaving(false);
      setShowAddMillModal(false);
      setAddMillForm({
        name: '',
        contactPerson: '',
        contactPhone: '',
        address: '',
        email: ''
      });
      // Reset mill search state
      setMillSearch('');
      setSelectedMillName('');
      setShowMillDropdown(false);
    }
  }, [order?.orderId, isEditing]);

  // Initialize mill search when editing existing data
  useEffect(() => {
    if (isEditing && formData.mill && !millSearch) {
      const millName = getMillName(formData.mill);
      if (millName) {
        setMillSearch(millName);
        setSelectedMillName(millName);
      }
    }
  }, [isEditing, formData.mill, millSearch]);

  // ⚡ FIX: Update selectedMillName immediately when localMills updates and there's a selected mill
  useEffect(() => {
    if (formData.mill && (!selectedMillName || selectedMillName === '')) {
      const allMills = localMills.length > 0 ? localMills : (mills || []);
      const selectedMill = allMills.find(m => {
        const mId = m._id || (m as any).id;
        return String(mId) === String(formData.mill);
      });
      if (selectedMill && selectedMill.name) {
        setSelectedMillName(selectedMill.name);
        if (!millSearch || millSearch === '') {
          setMillSearch(selectedMill.name);
        }
        console.log('✅ Auto-updated selected mill name from localMills:', selectedMill.name);
      }
    }
  }, [localMills, mills, formData.mill, selectedMillName, millSearch]);

  // Function to load existing mill inputs from API data (LabDataModal pattern)
  const loadExistingMillInputsFromData = async (millInputsData: any[]) => {
    console.log('Loading existing mill inputs from API data:', { order: order?.orderId, millInputsData });

    if (!order || millInputsData.length === 0) {
      console.log('No order or existing mill inputs found');
      setHasExistingData(false);
      return;
    }

    try {
      // Group mill inputs by mill and chalan number
      const groupedInputs = groupMillInputsByMillAndChalan(millInputsData);
      console.log('🔍 Raw mill inputs data:', millInputsData);
      console.log('🔍 Grouped inputs from API:', groupedInputs);

      if (groupedInputs.length > 0) {
        const firstGroup = groupedInputs[0];

        // ⚡ CRITICAL: Preserve any newly added items (items with IDs starting with "new-")
        // These are items the user added but haven't saved yet - they should stay at the bottom
        const existingNewItems = formData.millItems.filter(item => item.id.startsWith('new-'));

        // ⚡ FIX: Sort grouped inputs by createdAt ascending (oldest first) before mapping
        const sortedExistingItems = [...groupedInputs]
          .sort((a, b) => {
            // Sort by createdAt ascending (oldest first)
            const dateA = new Date(a.mainInput?.createdAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.mainInput?.createdAt || b.createdAt || 0).getTime();
            return dateA - dateB; // Ascending order (oldest first)
          })
          .map((group, index) => {
            // ⚡ FIX: Use database _id if available, otherwise use index-based ID
            const groupId = group.mainInput?._id || group._id || `existing-${index}`;
            const mappedItem = {
              id: groupId,
              millDate: group.millDate,
              chalanNo: group.chalanNo,
              greighMtr: (group.mainInput.greighMtr || 0).toString(),
              pcs: (group.mainInput.pcs || 0).toString(),
              quality: group.mainInput.quality?._id || group.mainInput.quality || '', // Extract quality ID
              process: group.mainInput.processName || '', // Extract process name
              additionalMeters: group.additionalInputs.map((input: any) => {
                return {
                  meters: (input.greighMtr || 0).toString(),
                  pieces: (input.pcs || 0).toString(),
                  quality: input.quality?._id || input.quality || '', // Extract quality ID
                  process: input.processName || '' // Extract process name
                };
              })
            };

            return mappedItem;
          });

        // ⚡ CRITICAL: Combine existing items (oldest first) with newly added items (at bottom)
        const newFormData = {
          orderId: order.orderId,
          mill: firstGroup.millId,
          millItems: [
            ...sortedExistingItems, // Existing items from database (oldest first)
            ...existingNewItems     // Newly added items (at bottom)
          ]
        };

        console.log('Setting form data from API:', {
          existingItems: sortedExistingItems.length,
          newItems: existingNewItems.length,
          totalItems: newFormData.millItems.length
        });
        setFormData(newFormData);
        setHasExistingData(true);
      } else {
        console.log('No grouped inputs found from API');
        setHasExistingData(false);
      }
    } catch (error) {
      console.error('Error loading existing mill inputs from API:', error);
      setHasExistingData(false);
    }
  };

  // Function to load existing mill inputs from props (LabDataModal pattern)
  const loadExistingMillInputs = async () => {
    console.log('Loading existing mill inputs from props:', { order: order?.orderId, existingMillInputs });

    if (!order || existingMillInputs.length === 0) {
      console.log('No order or existing mill inputs found');
      setHasExistingData(false);
      return;
    }

    // Removed loading state
    try {
      // Group mill inputs by mill and chalan number
      const groupedInputs = groupMillInputsByMillAndChalan(existingMillInputs);
      console.log('Grouped inputs from props:', groupedInputs);

      if (groupedInputs.length > 0) {
        const firstGroup = groupedInputs[0];

        // ⚡ CRITICAL: Preserve any newly added items (items with IDs starting with "new-")
        // These are items the user added but haven't saved yet - they should stay at the bottom
        const existingNewItems = formData.millItems.filter(item => item.id.startsWith('new-'));

        // ⚡ FIX: Sort grouped inputs by createdAt ascending (oldest first) before mapping
        const sortedExistingItems = [...groupedInputs]
          .sort((a, b) => {
            // Sort by createdAt ascending (oldest first)
            const dateA = new Date(a.mainInput?.createdAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.mainInput?.createdAt || b.createdAt || 0).getTime();
            return dateA - dateB; // Ascending order (oldest first)
          })
          .map((group, index) => {
            // ⚡ FIX: Use database _id if available, otherwise use index-based ID
            const groupId = group.mainInput?._id || group._id || `existing-${index}`;
            const mappedItem = {
              id: groupId,
              millDate: group.millDate,
              chalanNo: group.chalanNo,
              greighMtr: (group.mainInput.greighMtr || 0).toString(),
              pcs: (group.mainInput.pcs || 0).toString(),
              quality: group.mainInput.quality?._id || group.mainInput.quality || '', // Extract quality ID
              process: group.mainInput.processName || '', // Extract process name
              additionalMeters: group.additionalInputs.map((input: any) => {
                return {
                  meters: (input.greighMtr || 0).toString(),
                  pieces: (input.pcs || 0).toString(),
                  quality: input.quality?._id || input.quality || '', // Extract quality ID
                  process: input.processName || '' // Extract process name
                };
              })
            };

            return mappedItem;
          });

        // ⚡ CRITICAL: Combine existing items (oldest first) with newly added items (at bottom)
        const newFormData = {
          orderId: order.orderId,
          mill: firstGroup.millId,
          millItems: [
            ...sortedExistingItems, // Existing items from database (oldest first)
            ...existingNewItems     // Newly added items (at bottom)
          ]
        };

        console.log('Setting form data from props:', {
          existingItems: sortedExistingItems.length,
          newItems: existingNewItems.length,
          totalItems: newFormData.millItems.length
        });
        setFormData(newFormData);
        setHasExistingData(true);
      } else {
        console.log('No grouped inputs found from props');
        setHasExistingData(false);
      }
    } catch (error) {
      console.error('Error loading existing mill inputs from props:', error);
      setHasExistingData(false);
    } finally {
      // Removed loading state
    }
  };

  // Helper function to group mill inputs by mill and chalan
  const groupMillInputsByMillAndChalan = (millInputs: any[]) => {
    const groups: any[] = [];

    millInputs.forEach((input: any, index: number) => {
      const existingGroup = groups.find(group =>
        group.millId === input.mill._id && group.chalanNo === input.chalanNo
      );

      if (existingGroup) {
        // Add as additional input (this shouldn't happen with the current API structure)
        existingGroup.additionalInputs.push({
          greighMtr: input.greighMtr,
          pcs: input.pcs,
          quality: input.quality || '',
          processName: input.processName || ''
        });
      } else {
        // Create new group with main input and any additional meters from the database
        const additionalInputs: any[] = [];

        // Add additional meters from the database record
        if (input.additionalMeters && Array.isArray(input.additionalMeters) && input.additionalMeters.length > 0) {
          input.additionalMeters.forEach((additional: any, addIndex: number) => {
            additionalInputs.push({
              greighMtr: additional.greighMtr,
              pcs: additional.pcs,
              quality: additional.quality || '',
              processName: additional.processName || ''
            });
          });
        }

        // Create one group per mill input record
        // The main input (M1) is the primary data, and additional meters (M2, M3, etc.) are in the additionalInputs array
        groups.push({
          millId: input.mill._id,
          millDate: input.millDate,
          chalanNo: input.chalanNo,
          createdAt: input.createdAt, // ⚡ FIX: Preserve createdAt for sorting
          mainInput: {
            _id: input._id, // ⚡ FIX: Preserve _id for proper identification
            greighMtr: input.greighMtr,
            pcs: input.pcs,
            quality: input.quality || '',
            processName: input.processName || '',
            createdAt: input.createdAt // ⚡ FIX: Preserve createdAt in mainInput too
          },
          additionalInputs: additionalInputs
        });
      }
    });

    return groups;
  };

  // Helper function to show which orders are using this mill
  const showMillUsage = async (millId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/mill-inputs?millId=${millId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();
      if (data.success && data.data.millInputs) {
        data.data.millInputs.forEach((input: any, index: number) => {
        });
      }
    } catch (error) {
    }
  };

  // Delete mill input data (LabDataModal pattern)
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    // ⚡ FIX: Prevent multiple simultaneous operations (like dispatch)
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

      // ⚡ FIX: Use bulk delete endpoint for better performance and reliability (like dispatch)
      const response = await fetch(`/api/mill-inputs?orderId=${order?.orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccessMessage('Mill input data deleted successfully!');
          setHasExistingData(false);

          // Reset form to initial state
          setFormData({
            orderId: order?.orderId || '',
            mill: '',
            millItems: [{
              id: '1',
              millDate: '',
              chalanNo: '',
              greighMtr: '',
              pcs: '',
              quality: '',
              process: '',
              additionalMeters: []
            }],
          });

          console.log('🎯 Mill input data deleted successfully, closing form and updating button state');

          // ⚡ OPTIMIZED: Close immediately (no artificial delay) - like dispatch
          onSuccess('delete');
          setTimeout(() => {
            setSuccessMessage('');
            onClose();
          }, 500);
        } else {
          setErrors({ submit: data.error || 'Failed to delete mill input data' });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setErrors({ submit: errorData.error || 'Failed to delete mill input data' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setErrors({ submit: 'Failed to delete mill input data' });
    } finally {
      setSaving(false);
      operationInProgressRef.current = false;
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Direct delete mill (no confirmation modal - like quality)
  const handleDeleteMillClick = async (mill: any) => {
    const millId = mill._id || mill.id;
    if (!millId) {
      setErrors({ submit: 'Invalid mill ID' });
      return;
    }

    // Prevent multiple clicks
    if (deletingMill === millId) {
      return;
    }

    console.log('🗑️ Starting mill deletion for:', { millId, millName: mill.name });

    setDeletingMill(millId);

    // ⚡ FIX: Make API call FIRST before removing from UI
    // This ensures we don't remove the mill if deletion fails
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/mills/${millId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('🗑️ Mill delete response:', data);

      // ⚡ CRITICAL: Only proceed with UI updates if deletion was successful
      if (data.success && response.ok) {
        console.log('✅ Mill deleted successfully, updating UI...');

        // ⚡ FIX: Clear cache immediately when deleting mill
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('mills_cache');
            console.log('🗑️ Cleared mills_cache from localStorage after deleting mill');
          } catch (e) {
            console.error('Failed to clear mills cache:', e);
          }
        }

        // ⚡ FIX: Add to both state and ref, and persist to sessionStorage
        deletedMillIdsRef.current.add(String(millId));
        setDeletedMillIds(new Set(deletedMillIdsRef.current));

        // ⚡ FIX: Save to sessionStorage immediately
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('deletedMillIds', JSON.stringify(Array.from(deletedMillIdsRef.current)));
            console.log('💾 Saved deleted mill ID to sessionStorage:', millId);
          } catch (e) {
            console.error('Failed to save deleted mill ID:', e);
          }
        }

        // ⚡ IMMEDIATELY call parent's onRemoveMill (like quality does)
        onRemoveMill?.(millId);
        console.log('🔄 Called onRemoveMill with ID:', millId);

        // ⚡ IMMEDIATELY remove from local state for instant UI update
        setLocalMills(prev => prev.filter(m => {
          const mId = m._id || (m as any).id || '';
          return String(mId) !== String(millId);
        }));
        setDropdownKey(prev => prev + 1); // Force dropdown re-render

        // Clear selection if deleted mill was selected
        if (formData.mill === millId) {
          setFormData(prev => ({ ...prev, mill: '' }));
          setMillSearch('');
          setSelectedMillName('');
        }

        // Close dropdown and clear search to show the change immediately
        setShowMillDropdown(false);
        setMillSearch('');

        // Show success message
        setSuccessMessage('Mill deleted successfully!');

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);

        // ⚡ FIX: Refresh from server to ensure everything is synced
        if (onRefreshMills) {
          try {
            console.log('🔄 Refreshing mills after deletion...');
            await onRefreshMills();
            console.log('✅ Mills refreshed successfully after deletion');
          } catch (err) {
            console.error('Error refreshing mills after deletion:', err);
          }
        }
      } else {
        // ⚡ FIX: Deletion failed - show error message but DON'T remove from UI
        // The mill was never removed from UI, so no rollback needed
        console.log('❌ Mill deletion failed:', data.message);
        setErrors({ submit: data.message || 'Failed to delete mill' });
        setTimeout(() => {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.submit;
            return newErrors;
          });
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Error deleting mill:', error);
      // ⚡ FIX: Network/API error - show error message but DON'T remove from UI
      // The mill was never removed from UI, so no rollback needed
      setErrors({ submit: 'Failed to delete mill. Please try again.' });
      setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.submit;
          return newErrors;
        });
      }, 5000);
    } finally {
      setDeletingMill(null);
    }
  };

  // Form handlers
  // ⚡ FIX: Add new mill item at the BOTTOM (end) of the list - oldest at top, newest at bottom
  const addMillItem = () => {
    // Generate unique ID using timestamp to ensure uniqueness
    const newId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ⚡ FIX: Add new items at the END (bottom) of the array
    // This ensures oldest items stay at top (index 0, 1, 2...) and newest at bottom
    setFormData(prevFormData => {
      const updatedMillItems = [
        ...prevFormData.millItems, // Keep ALL existing items first (preserve order)
        {
          id: newId,
          millDate: '',
          chalanNo: '',
          greighMtr: '',
          pcs: '',
          quality: '', // Add quality field
          process: '', // Add process field
          additionalMeters: []
        }
      ];

      console.log('➕ Added new mill item at bottom:', {
        newId,
        totalItems: updatedMillItems.length,
        newItemIndex: updatedMillItems.length - 1,
        firstItemId: updatedMillItems[0]?.id,
        lastItemId: updatedMillItems[updatedMillItems.length - 1]?.id
      });

      return {
        ...prevFormData,
        millItems: updatedMillItems // New item is at the end (bottom)
      };
    });

    // Scroll to the newly added item at the bottom after a short delay
    setTimeout(() => {
      const newItemElement = document.getElementById(`mill-item-${newId}`);
      if (newItemElement) {
        newItemElement.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, 100);
  };

  // ⚡ FIX: Remove only M1 (main entry) - if M2 exists, move it to M1 (like dispatch and mill output)
  const removeMainMillItem = (itemId: string) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item => {
        if (item.id === itemId) {
          // If there are additional entries (M2, M3, etc.), move the first one (M2) to M1
          if (item.additionalMeters.length > 0) {
            const firstAdditional = item.additionalMeters[0];
            return {
              ...item,
              greighMtr: firstAdditional.meters, // Move M2 to M1
              pcs: firstAdditional.pieces, // Move M2 pieces to M1
              quality: firstAdditional.quality, // Move M2 quality to M1
              process: firstAdditional.process, // Move M2 process to M1
              additionalMeters: item.additionalMeters.slice(1) // Remove M2 from additional list
            };
          } else {
            // No additional entries, just clear M1
            return {
              ...item,
              greighMtr: '',
              pcs: '',
              quality: '',
              process: ''
            };
          }
        }
        return item;
      })
    });
  };

  const removeMillItem = (itemId: string) => {
    console.log('🗑️ Removing mill item:', itemId);
    console.log('🔍 Current mill items:', formData.millItems.length);

    // ⚡ FIX: Always allow deletion, even if it's the last item
    const newMillItems = formData.millItems.filter(item => item.id !== itemId);
    console.log('🔍 New mill items after removal:', newMillItems.length);

    // If all items are deleted, add one empty item
    if (newMillItems.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        ...formData,
        millItems: [{
          id: `new-${Date.now()}`,
          millDate: today,
          chalanNo: '',
          greighMtr: '',
          pcs: '',
          quality: '',
          process: '',
          additionalMeters: []
        }]
      });
    } else {
      setFormData({
        ...formData,
        millItems: newMillItems
      });
    }
  };

  const updateMillItem = (itemId: string, field: keyof MillItem, value: string) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    });
  };

  // Increment/decrement functions for number inputs
  const incrementValue = (itemId: string, field: 'greighMtr' | 'pcs', step: number = 1) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item => {
        if (item.id === itemId) {
          const currentValue = parseFloat(item[field]) || 0;
          const newValue = currentValue + step;
          return { ...item, [field]: newValue.toString() };
        }
        return item;
      })
    });
  };

  const decrementValue = (itemId: string, field: 'greighMtr' | 'pcs', step: number = 1) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item => {
        if (item.id === itemId) {
          const currentValue = parseFloat(item[field]) || 0;
          const newValue = Math.max(0, currentValue - step);
          return { ...item, [field]: newValue.toString() };
        }
        return item;
      })
    });
  };

  const addAdditionalMeters = (itemId: string) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            additionalMeters: [...item.additionalMeters, { meters: '', pieces: '', quality: '', process: '' }]
          }
          : item
      )
    });
  };

  const removeAdditionalMeters = (itemId: string, index: number) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            additionalMeters: item.additionalMeters.filter((_, i) => i !== index)
          }
          : item
      )
    });
  };

  const updateAdditionalMeters = (itemId: string, index: number, field: 'meters' | 'pieces' | 'quality' | 'process', value: string) => {
    setFormData({
      ...formData,
      millItems: formData.millItems.map(item =>
        item.id === itemId
          ? {
            ...item,
            additionalMeters: item.additionalMeters.map((additional, i) =>
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
    console.log('MillInputForm getFilteredQualities called:', { itemId, type, index, allQualities: allQualities.length, localQualities: localQualities.length, propQualities: qualities?.length });
    // Safety check for undefined qualities
    if (!allQualities || !Array.isArray(allQualities) || allQualities.length === 0) {
      console.log('MillInputForm: No qualities available or not an array:', allQualities);
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

    if (type === 'main') {
      updateMillItem(itemId, 'quality', qualityId);
    } else {
      updateAdditionalMeters(itemId, index!, 'quality', qualityId);
    }

    setQualitySearchStates(prev => ({ ...prev, [searchKey]: quality.name }));
    setCurrentQualitySearch(quality.name);
    setActiveQualityDropdown(null);
  };

  // Process helper functions
  const getFilteredProcesses = (itemId: string, type: 'main' | 'additional', index?: number) => {
    const searchKey = `${itemId}_${type}${index !== undefined ? `_${index}` : ''}`;
    const searchTerm = activeProcessDropdown?.itemId === itemId && activeProcessDropdown?.type === type && activeProcessDropdown?.index === index
      ? currentProcessSearch
      : (processSearchStates[searchKey] || '');

    const filtered = PROCESS_OPTIONS.filter(process =>
      process.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered;
  };

  const handleProcessSelect = (itemId: string, type: 'main' | 'additional', process: string, index?: number) => {
    const searchKey = `${itemId}_${type}${index !== undefined ? `_${index}` : ''}`;

    if (type === 'main') {
      updateMillItem(itemId, 'process', process);
    } else {
      updateAdditionalMeters(itemId, index!, 'process', process);
    }

    setProcessSearchStates(prev => ({ ...prev, [searchKey]: process }));
    setCurrentProcessSearch(process);
    setActiveProcessDropdown(null);
  };

  const validateForm = () => {
    const newErrors: ValidationErrors = {};

    if (!formData.mill || formData.mill.trim() === '') {
      newErrors.mill = 'Please select a mill';
    }

    // ⚡ REMOVED: Duplicate chalan number validation - chalan numbers don't need to be unique

    formData.millItems.forEach((item, itemIndex) => {
      if (!item.quality || item.quality.trim() === '') {
        newErrors[`quality_${item.id}`] = 'Quality is required';
      }
      if (!item.millDate || item.millDate.trim() === '') {
        newErrors[`millDate_${item.id}`] = 'Mill date is required';
      }
      if (!item.chalanNo || item.chalanNo.trim() === '') {
        newErrors[`chalanNo_${item.id}`] = 'Chalan number is required';
      }
      if (!item.greighMtr || item.greighMtr.trim() === '' || parseFloat(item.greighMtr) <= 0) {
        newErrors[`greighMtr_${item.id}`] = 'Valid greigh meters is required';
      }
      if (!item.pcs || item.pcs.trim() === '' || parseInt(item.pcs) <= 0) {
        newErrors[`pcs_${item.id}`] = 'Valid number of pieces is required';
      }

      item.additionalMeters.forEach((additional, additionalIndex) => {
        if (!additional.quality || additional.quality.trim() === '') {
          newErrors[`additionalQuality_${item.id}_${additionalIndex}`] = 'Quality is required';
        }
        if (!additional.meters || additional.meters.trim() === '' || parseFloat(additional.meters) <= 0) {
          newErrors[`additionalMeters_${item.id}_${additionalIndex}_meters`] = 'Valid additional meters is required';
        }
        if (!additional.pieces || additional.pieces.trim() === '' || parseInt(additional.pieces) <= 0) {
          newErrors[`additionalMeters_${item.id}_${additionalIndex}_pieces`] = 'Valid additional pieces is required';
        }
      });
    });

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;

    if (!isValid) {
      console.log('Validation failed:', newErrors);
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚡ FIX: Prevent multiple simultaneous submissions
    if (operationInProgressRef.current || saving) {
      console.warn('⚠️ Operation already in progress, ignoring duplicate submission');
      return;
    }

    // ⚡ FIX: Allow submission even if form is empty (user deleted all items)
    if (formData.millItems.length === 0) {
      console.log('⚠️ Form is empty - user deleted all items, proceeding with update to clear all data');
    } else if (!validateForm()) {
      return;
    }

    // ⚡ FIX: Set operation flag immediately
    operationInProgressRef.current = true;
    setSaving(true);
    setSavingProgress('Preparing data...');
    setSuccessMessage('');
    setErrors({});

    try {
      const token = localStorage.getItem('token');

      const wasUpdating = hasExistingData;

      console.log('🔍 Submit logic:', {
        hasExistingData,
        wasUpdating,
        isEditing,
        orderId: order?.orderId
      });

      if (hasExistingData) {
        setSavingProgress('Updating existing mill inputs...');
        // Update existing mill inputs
        await updateExistingMillInputs(token);
      } else {
        setSavingProgress('Creating new mill inputs...');
        // Create new mill inputs
        await createNewMillInputs(token);
      }

      setSavingProgress('Saving completed successfully!');
      setSuccessMessage('Mill input data saved successfully!');

      // ⚡ OPTIMIZED: Immediately update local state for better UX
      setHasExistingData(true);

      // ⚡ FIX: DON'T reload from API after update - keep current form state
      // The form state already has all the correct data, reloading would overwrite it
      // Only refresh if we need to get new IDs, but for updates, the state is already correct
      console.log('✅ Update completed - keeping current form state (no reload needed)');

      // ⚡ OPTIMIZED: Close immediately after showing success (no artificial delay)
      onSuccess(wasUpdating ? 'edit' : 'add');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to handle mill input' });
      setSavingProgress('');
    } finally {
      setSaving(false);
      // ⚡ FIX: Clear operation flag
      operationInProgressRef.current = false;
    }
  };

  // ⚡ FIX: Function to create new mill inputs (with deduplication)
  const createNewMillInputs = async (token: string | null) => {
    if (!token) throw new Error('No authentication token');

    console.log('📝 Creating mill inputs for items:', formData.millItems.length, 'items');
    console.log('📝 Form data mill items:', formData.millItems);

    // ⚡ FIX: Handle empty form gracefully - allow deletion of all items
    if (formData.millItems.length === 0) {
      console.log('⚠️ No mill items to create - this is valid if user deleted all items');
      return []; // Return empty array instead of throwing error
    }

    // ⚡ FIX: Deduplicate items by millDate + chalanNo to prevent duplicates
    const seenItems = new Set<string>();
    const uniqueItems = formData.millItems.filter(item => {
      const key = `${item.millDate}-${item.chalanNo}`;
      if (seenItems.has(key)) {
        console.warn('⚠️ Skipping duplicate item:', key);
        return false;
      }
      seenItems.add(key);
      return true;
    });

    // Check for empty or invalid items (process is optional)
    const validItems = uniqueItems.filter(item =>
      item.millDate &&
      item.chalanNo &&
      item.greighMtr &&
      item.pcs &&
      item.quality
      // process is optional - removed from required fields
    );

    // ⚡ FIX: Handle case where all items are invalid - allow deletion of all items
    if (validItems.length === 0) {
      console.log('⚠️ No valid mill items to create - this is valid if user deleted all items');
      return []; // Return empty array instead of throwing error
    }

    console.log('📝 Valid unique items to create:', validItems.length, '(filtered from', formData.millItems.length, 'total)');

    // ⚡ FIX: Process requests sequentially to prevent race conditions
    const results = [];
    try {
      for (let index = 0; index < validItems.length; index++) {
        const item = validItems[index];
        console.log(`📝 Processing item ${index + 1}/${validItems.length}:`, item);

        // Update progress
        setSavingProgress(`Creating item ${index + 1} of ${validItems.length}...`);

        // Prepare additional meters data
        const additionalMeters = item.additionalMeters
          .filter(additional => additional.meters && additional.pieces && additional.quality)
          .map(additional => ({
            greighMtr: parseFloat(additional.meters),
            pcs: parseInt(additional.pieces),
            quality: additional.quality,
            processName: additional.process || ''
          }));

        // Send single request with all data for this item
        const requestBody = {
          orderId: formData.orderId,
          mill: formData.mill,
          millDate: item.millDate,
          chalanNo: item.chalanNo,
          greighMtr: parseFloat(item.greighMtr),
          pcs: parseInt(item.pcs),
          quality: item.quality,
          processName: item.process || '',
          additionalMeters: additionalMeters.length > 0 ? additionalMeters : [],
          notes: ''
        };

        console.log(`📤 Sending request for item ${index + 1}:`, requestBody);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('/api/mill-inputs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        console.log(`📥 Response for item ${index + 1}:`, data);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${data.message || 'Server error'}`);
        }

        if (!data.success) {
          throw new Error(data.message || 'Failed to add mill input');
        }

        results.push(data);
      }

      console.log('✅ Successfully created', results.length, 'mill inputs');
      return results;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - please try again');
        }
        throw error;
      }
      throw new Error('Unknown error occurred while saving mill inputs');
    }
  };

  // ⚡ FIX: Function to update existing mill inputs (sequential to prevent race conditions)
  const updateExistingMillInputs = async (token: string | null) => {
    if (!token) throw new Error('No authentication token');

    console.log('🔄 Starting mill input update process...');
    console.log('📝 Current form data items:', formData.millItems.length);

    try {
      // ⚡ FIX: Delete first, then create (sequential to prevent duplicates)
      const deleteResponse = await fetch(`/api/mill-inputs?orderId=${order?.orderId}`, {
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
        console.log('✅ Deleted existing mill inputs:', deleteData);
      }

      // ⚡ FIX: Wait a small moment to ensure delete is processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // ⚡ FIX: Now create new inputs (handles empty form gracefully)
      const results = await createNewMillInputs(token);

      console.log('✅ Mill input update completed - created', results?.length || 0, 'items');

      // ⚡ FIX: If no items were created (user deleted all), update hasExistingData to false
      if (!results || results.length === 0) {
        console.log('⚠️ No items created - user deleted all items');
        setHasExistingData(false);
      }

    } catch (error) {
      console.error('❌ Error in update process:', error);
      throw error;
    }
  };

  const handleAddMill = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addMillForm.name.trim()) {
      setErrors({ addMill: 'Mill name is required' });
      return;
    }

    setAddingMill(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/mills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: addMillForm.name.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        const newMill = data.data;
        const newMillId = newMill._id;
        const newMillName = newMill.name;

        console.log('✅ Adding new mill:', newMillName);

        // ⚡ FIX: Clear ALL mill-related caches aggressively when creating new mill
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('mills_cache');
            // Clear all mill-related caches
            Object.keys(localStorage).forEach(key => {
              if (key.includes('mill') || key.includes('mills')) {
                localStorage.removeItem(key);
              }
            });
            // Also clear process-data-cache if it exists
            try {
              const processCache = localStorage.getItem('process-data-cache');
              if (processCache) {
                const cacheData = JSON.parse(processCache);
                cacheData.millsTimestamp = 0;
                localStorage.setItem('process-data-cache', JSON.stringify(cacheData));
              }
            } catch (e) { }
            console.log('🗑️ Cleared ALL mill caches from localStorage after creating mill');
          } catch (e) {
            console.error('Failed to clear mills cache:', e);
          }
        }

        // ⚡ IMMEDIATELY add to local mills state FIRST - no waiting!
        const currentMills = localMills.length > 0 ? localMills : (mills || []);
        const exists = currentMills.some(m => {
          const mId = m._id || (m as any).id;
          return String(mId) === String(newMillId);
        });
        const updatedMills = exists ? currentMills : [newMill, ...currentMills];

        // Store in ref for immediate access
        newMillRef.current = newMill;

        // ⚡ FIX: Add to recentlyAddedMillIds Set to ensure it appears in dropdown
        setRecentlyAddedMillIds(prev => {
          const updated = new Set(prev);
          updated.add(String(newMillId));
          console.log('📝 Added mill to recentlyAddedMillIds:', newMillName, newMillId);
          return updated;
        });

        // Set all states in the correct order - IMMEDIATELY, no setTimeout delays
        setRecentlyAddedMill(newMillId); // Set this FIRST so filteredMillsOptions includes it
        setLocalMills(updatedMills); // Update local mills immediately
        setFormData(prev => ({ ...prev, mill: newMillId })); // Select the new mill
        setSelectedMillName(newMillName); // Set mill name immediately
        setMillSearch(newMillName); // Set search to show the new mill name
        setShowAddMillModal(false);
        setDropdownKey(prev => prev + 1); // Force dropdown re-render

        // Clear recentlyAddedMillIds after 5 minutes (similar to qualities)
        setTimeout(() => {
          setRecentlyAddedMillIds(prev => {
            const updated = new Set(prev);
            updated.delete(String(newMillId));
            return updated;
          });
        }, 5 * 60 * 1000);

        // ⚡ IMMEDIATELY call parent's onAddMill with new mill data (like quality does)
        // This will dispatch events and update parent state
        onAddMill(newMill);

        // Set recently added indicator in parent
        onSetRecentlyAddedMill?.(newMillId);

        // Open dropdown immediately to show the new mill
        setShowMillDropdown(true);

        // Clear the "recently added" indicator after 3 seconds
        setTimeout(() => {
          setRecentlyAddedMill(null);
          onSetRecentlyAddedMill?.(null);
        }, 3000);

        // ⚡ FIX: Refresh from server to ensure everything is synced
        // This ensures the dropdown always has the latest data
        if (onRefreshMills) {
          try {
            console.log('🔄 Refreshing mills after creation...');
            await onRefreshMills();
            console.log('✅ Mills refreshed successfully');
          } catch (err) {
            console.error('Error refreshing mills after creation:', err);
          }
        }

        setAddMillForm({
          name: '',
          contactPerson: '',
          contactPhone: '',
          address: '',
          email: ''
        });
        setErrors({});
      } else {
        setErrors({ addMill: data.message || 'Failed to add mill' });
      }
    } catch (error) {
      setErrors({ addMill: 'Failed to add mill' });
    } finally {
      setAddingMill(false);
    }
  };

  // Don't block form opening - show form even if order is not immediately available
  // if (!order) return null;

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

  // Debug log to track form data changes
  console.log('🔄 MillInputForm render - formData:', {
    orderId: formData.orderId,
    millItemsCount: formData.millItems?.length || 0,
    hasExistingData,
    loadingExistingData,
    firstItem: formData.millItems?.[0]
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

      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}>
        <div className={`relative w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[95vh] overflow-hidden rounded-xl shadow-2xl ${isClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
          {/* Loading Overlay for Loading Data */}
          {/* ⚡ FIX: Single loading overlay - prioritize saving over loading data */}
          {(loadingExistingData || saving) && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-3 text-sm font-medium">
                  {saving ? (savingProgress || 'Saving mill input data...') : 'Loading mill input data...'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {saving ? 'Please wait, do not close this window' : 'Please wait while we fetch your data'}
                </p>
              </div>
            </div>
          )}
          {/* Header - Order ID badge with title and close button */}
          <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${isDarkMode ? 'border-gray-700 bg-blue-900/20' : 'border-gray-200 bg-blue-50'
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
                Mill Input
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
            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 pb-20 sm:pb-24">
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

              {/* Mill Selection */}
              <div className="w-full">
                <div>
                  <label className={`block text-sm font-medium mb-2 sm:mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Mill Name <span className="text-red-500">*</span>
                  </label>


                  {millsLoading || isFetchingMills ? (
                    <div className={`p-4 text-center rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}>
                      <div className="flex flex-col items-center space-y-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        <p className="text-sm">Loading mills...</p>
                      </div>
                    </div>
                  ) : (mills.length === 0 && localMills.length === 0 && !millsLoading && !isFetchingMills) ? (
                    <div className={`p-4 text-center rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}>
                      <div className="flex flex-col items-center space-y-3">
                        <p className="text-sm">No mills available. Add a mill to get started.</p>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => fetchMillsDirectly(true)}
                            disabled={isFetchingMills}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isFetchingMills
                              ? 'bg-gray-400 cursor-not-allowed text-white'
                              : isDarkMode
                                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                : 'bg-gray-500 hover:bg-gray-600 text-white'
                              }`}
                          >
                            {isFetchingMills ? 'Loading...' : 'Refresh Mills'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddMillModal(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                              }`}
                          >
                            Add New Mill
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative" key={`mill-dropdown-${dropdownKey}-${localMills.length}`}>
                      <EnhancedDropdown
                        options={filteredMillsOptions}
                        value={formData.mill}
                        onChange={handleMillChange}
                        placeholder={
                          (millsLoading || isFetchingMills)
                            ? "Loading mills..."
                            : (mills.length === 0 && localMills.length === 0)
                              ? "No mills available"
                              : "Search mills..."
                        }
                        searchValue={millSearch}
                        onSearchChange={handleMillSearchChange}
                        showDropdown={showMillDropdown}
                        onToggleDropdown={handleMillDropdownToggle}
                        onSelect={handleMillSelect}
                        isDarkMode={isDarkMode}
                        error={errors.mill}
                        onAddNew={() => setShowAddMillModal(true)}
                        onDelete={handleDeleteMillClick}
                        recentlyAddedId={recentlyAddedMill}
                        deletingItems={deletingMill ? [deletingMill] : []}
                      />
                      <div className="absolute top-2 right-2 flex space-x-1">
                        {millsLoading && (mills.length > 0 || localMills.length > 0) && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowAddMillModal(true)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${isDarkMode
                            ? ' text-white'
                            : 'text-black'
                            }`}
                          title="Add New Mill"
                        >

                        </button>
                      </div>
                    </div>
                  )}
                  {errors.mill && (
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`}>
                      {errors.mill}
                    </p>
                  )}
                </div>
              </div>

              {/* Mill Items */}
              <div>

                <div className="space-y-4 sm:space-y-6">
                  {/* ⚡ CRITICAL: Render items in order - oldest at top (index 0 = Mill Item 1), newest at bottom */}
                  {formData.millItems.map((item, itemIndex) => (
                    <div key={item.id} id={`mill-item-${item.id}`} className={`p-4 sm:p-6 rounded-xl border transition-all duration-200 hover:shadow-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                      }`}>
                      {/* ⚡ FIX: Item header with number and delete button - only show if multiple items */}
                      {formData.millItems.length > 1 && (
                        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-300 dark:border-gray-600">
                          <h4 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            Mill Item {itemIndex + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeMillItem(item.id)}
                            className={`p-2 rounded-lg transition-colors ${isDarkMode
                              ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                              : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                              }`}
                            title="Remove this mill item"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}

                      {/* Main Fields Row 1 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                        {/* Mill Date */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 sm:mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            Mill Date <span className="text-red-500">*</span>
                          </label>
                          <CustomDatePicker
                            value={item.millDate}
                            onChange={(value) => updateMillItem(item.id, 'millDate', value)}
                            placeholder="Select mill date"
                            isDarkMode={isDarkMode}
                          />
                          {errors[`millDate_${item.id}`] && (
                            <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                              }`}>
                              {errors[`millDate_${item.id}`]}
                            </p>
                          )}
                        </div>

                        {/* Chalan Number */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 sm:mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            Chalan Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.chalanNo}
                            onChange={(e) => updateMillItem(item.id, 'chalanNo', e.target.value)}
                            placeholder="Enter chalan number"
                            required
                            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${errors[`chalanNo_${item.id}`]
                              ? isDarkMode
                                ? 'border-red-500 bg-gray-800 text-white'
                                : 'border-red-500 bg-white text-gray-900'
                              : isDarkMode
                                ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                              }`}
                          />
                          {errors[`chalanNo_${item.id}`] && (
                            <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                              }`}>
                              {errors[`chalanNo_${item.id}`]}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Additional Meters & Pieces Section */}
                      <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-200'
                        }`}>
                        <h6 className={`text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                          Additional Meters & Pieces
                        </h6>

                        <div className="space-y-3 sm:space-y-4">
                          {/* M1 and P1 Fields (Always visible) - Responsive grid: 1 col mobile, 2 col tablet, 5 col desktop */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                            {/* Quality for M1 */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                <label className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Quality M1 <span className="text-red-500">*</span>
                                </label>
                                {onRefreshQualities && (
                                  <button
                                    type="button"
                                    onClick={onRefreshQualities}
                                    className={`p-1 rounded transition-colors ${isDarkMode
                                      ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                      }`}
                                    title="Refresh qualities"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <div className="relative">
                                <EnhancedDropdown
                                  options={getFilteredQualities(item.id, 'main')}
                                  value={item.quality}
                                  onChange={(value) => updateMillItem(item.id, 'quality', value)}
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
                                    // Close mill and process dropdowns if open
                                    setShowMillDropdown(false);
                                    setActiveProcessDropdown(null);
                                    setCurrentProcessSearch('');

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

                                      setActiveQualityDropdown({ itemId: item.id, type: 'main' });
                                      setCurrentQualitySearch(qualitySearchStates[`${item.id}_main`] || '');
                                    }
                                  }}
                                  onSelect={(quality) => handleQualitySelect(item.id, 'main', quality)}
                                  isDarkMode={isDarkMode}
                                  error={errors[`quality_${item.id}`]}
                                  recentlyAddedId={recentlyAddedQuality}
                                />
                                {item.quality && (
                                  <button
                                    type="button"
                                    onClick={() => updateMillItem(item.id, 'quality', '')}
                                    className={`absolute right-8 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode
                                      ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                                      : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                                      }`}
                                    title="Clear quality"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Process for M1 */}
                            <div>
                              <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Process M1
                              </label>
                              <div className="relative">
                                <EnhancedDropdown
                                  options={getFilteredProcesses(item.id, 'main').map(process => ({ name: process, _id: process }))}
                                  value={item.process}
                                  onChange={(value) => updateMillItem(item.id, 'process', value)}
                                  placeholder="Search process..."
                                  searchValue={activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'main'
                                    ? currentProcessSearch
                                    : (processSearchStates[`${item.id}_main`] || '')}
                                  onSearchChange={(value) => {
                                    if (activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'main') {
                                      setCurrentProcessSearch(value);
                                    } else {
                                      setProcessSearchStates(prev => ({ ...prev, [`${item.id}_main`]: value }));
                                    }
                                  }}
                                  showDropdown={activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'main'}
                                  onToggleDropdown={() => {
                                    // Close mill and quality dropdowns if open
                                    setShowMillDropdown(false);
                                    setActiveQualityDropdown(null);
                                    setCurrentQualitySearch('');

                                    if (activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'main') {
                                      setActiveProcessDropdown(null);
                                      setCurrentProcessSearch('');
                                    } else {
                                      setActiveProcessDropdown({ itemId: item.id, type: 'main' });
                                      setCurrentProcessSearch(processSearchStates[`${item.id}_main`] || '');
                                    }
                                  }}
                                  onSelect={(process) => handleProcessSelect(item.id, 'main', process.name)}
                                  isDarkMode={isDarkMode}
                                  error={errors[`process_${item.id}`]}
                                />
                                {item.process && (
                                  <button
                                    type="button"
                                    onClick={() => updateMillItem(item.id, 'process', '')}
                                    className={`absolute right-8 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode
                                      ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                                      : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                                      }`}
                                    title="Clear process"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {errors[`process_${item.id}`] && (
                                <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                                  }`}>
                                  {errors[`process_${item.id}`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Greigh Meters M1 <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={item.greighMtr || ''}
                                  onChange={(e) => updateMillItem(item.id, 'greighMtr', e.target.value)}
                                  placeholder="Enter meters"
                                  min="0"
                                  step="0.01"
                                  required
                                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                    }`}
                                />
                                <BeakerIcon className={`absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`} />
                              </div>
                            </div>
                            <div>
                              <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Number of Pieces P1 <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={item.pcs || ''}
                                  onChange={(e) => updateMillItem(item.id, 'pcs', e.target.value)}
                                  placeholder="Enter pieces"
                                  min="0"
                                  required
                                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                    : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                    }`}
                                />
                                <PlusIcon className={`absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`} />
                              </div>
                            </div>

                            {/* ⚡ FIX: Delete button for M1 only - disabled if only M1 exists (no M2) */}
                            <div className="flex items-end sm:col-span-2 lg:col-span-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  // Only allow deletion if M2 exists (so M2 can move to M1)
                                  if (item.additionalMeters.length === 0) {
                                    return;
                                  }

                                  // Delete only M1 (main entry) - M2 will move to M1
                                  removeMainMillItem(item.id);
                                }}
                                disabled={item.additionalMeters.length === 0}
                                className={`w-full px-3 py-2.5 sm:py-3 rounded-lg border transition-all duration-150 flex items-center justify-center ${item.additionalMeters.length === 0
                                  ? isDarkMode
                                    ? 'border-gray-600/50 text-gray-500 bg-gray-800/50 cursor-not-allowed opacity-60'
                                    : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'
                                  : isDarkMode
                                    ? 'border-red-600/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-300 bg-red-900/10'
                                    : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 bg-red-50/50'
                                  }`}
                                title={item.additionalMeters.length === 0 ? "Cannot delete - at least one entry (M1) required" : "Delete M1 only (M2 will move to M1 if exists)"}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          {item.additionalMeters.map((additional, index) => (
                            <div key={index} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                              {/* Quality for Additional Meters */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                  <label className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    Quality M{index + 2} <span className="text-red-500">*</span>
                                  </label>
                                  {onRefreshQualities && (
                                    <button
                                      type="button"
                                      onClick={onRefreshQualities}
                                      className={`p-1 rounded transition-colors ${isDarkMode
                                        ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                        }`}
                                      title="Refresh qualities"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                <div className="relative">
                                  <EnhancedDropdown
                                    options={getFilteredQualities(item.id, 'additional', index)}
                                    value={additional.quality}
                                    onChange={(value) => updateAdditionalMeters(item.id, index, 'quality', value)}
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
                                      // Close mill and process dropdowns if open
                                      setShowMillDropdown(false);
                                      setActiveProcessDropdown(null);
                                      setCurrentProcessSearch('');

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
                                  {additional.quality && (
                                    <button
                                      type="button"
                                      onClick={() => updateAdditionalMeters(item.id, index, 'quality', '')}
                                      className={`absolute right-8 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode
                                        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                                        : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                                        }`}
                                      title="Clear quality"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Process for Additional Meters */}
                              <div>
                                <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Process M{index + 2}
                                </label>
                                <div className="relative">
                                  <EnhancedDropdown
                                    options={getFilteredProcesses(item.id, 'additional', index).map(process => ({ name: process, _id: process }))}
                                    value={additional.process}
                                    onChange={(value) => updateAdditionalMeters(item.id, index, 'process', value)}
                                    placeholder="Search process..."
                                    searchValue={activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'additional' && activeProcessDropdown?.index === index
                                      ? currentProcessSearch
                                      : (processSearchStates[`${item.id}_additional_${index}`] || '')}
                                    onSearchChange={(value) => {
                                      if (activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'additional' && activeProcessDropdown?.index === index) {
                                        setCurrentProcessSearch(value);
                                      } else {
                                        setProcessSearchStates(prev => ({ ...prev, [`${item.id}_additional_${index}`]: value }));
                                      }
                                    }}
                                    showDropdown={activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'additional' && activeProcessDropdown?.index === index}
                                    onToggleDropdown={() => {
                                      // Close mill and quality dropdowns if open
                                      setShowMillDropdown(false);
                                      setActiveQualityDropdown(null);
                                      setCurrentQualitySearch('');

                                      if (activeProcessDropdown?.itemId === item.id && activeProcessDropdown?.type === 'additional' && activeProcessDropdown?.index === index) {
                                        setActiveProcessDropdown(null);
                                        setCurrentProcessSearch('');
                                      } else {
                                        setActiveProcessDropdown({ itemId: item.id, type: 'additional', index });
                                        setCurrentProcessSearch(processSearchStates[`${item.id}_additional_${index}`] || '');
                                      }
                                    }}
                                    onSelect={(process) => handleProcessSelect(item.id, 'additional', process.name, index)}
                                    isDarkMode={isDarkMode}
                                    error={errors[`additionalProcess_${item.id}_${index}`]}
                                  />
                                  {additional.process && (
                                    <button
                                      type="button"
                                      onClick={() => updateAdditionalMeters(item.id, index, 'process', '')}
                                      className={`absolute right-8 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode
                                        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                                        : 'text-gray-500 hover:text-red-500 hover:bg-red-100'
                                        }`}
                                      title="Clear process"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                                {errors[`additionalProcess_${item.id}_${index}`] && (
                                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                                    }`}>
                                    {errors[`additionalProcess_${item.id}_${index}`]}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Greigh Meters M{index + 2} <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={additional.meters}
                                    onChange={(e) => updateAdditionalMeters(item.id, index, 'meters', e.target.value)}
                                    placeholder="Enter meters"
                                    min="0"
                                    step="0.01"
                                    required
                                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${isDarkMode
                                      ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                      : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                      }`}
                                  />
                                  <BeakerIcon className={`absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                  Number of Pieces P{index + 2} <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={additional.pieces}
                                    onChange={(e) => updateAdditionalMeters(item.id, index, 'pieces', e.target.value)}
                                    placeholder="Enter pieces"
                                    min="0"
                                    required
                                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${isDarkMode
                                      ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                                      : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                                      }`}
                                  />
                                  <PlusIcon className={`absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                                </div>
                              </div>

                              {/* ⚡ FIX: Delete button in same row - enabled when multiple entries exist (like dispatch) */}
                              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Only allow deletion if there's more than one entry (M1 + at least one additional)
                                    const totalEntries = 1 + (item.additionalMeters.length || 0);
                                    if (totalEntries <= 1) {
                                      return;
                                    }

                                    // Remove additional meter (M2, M3, etc.)
                                    removeAdditionalMeters(item.id, index);
                                  }}
                                  disabled={1 + (item.additionalMeters.length || 0) <= 1}
                                  className={`w-full px-3 py-2.5 sm:py-3 rounded-lg border transition-all duration-150 flex items-center justify-center ${1 + (item.additionalMeters.length || 0) <= 1
                                    ? isDarkMode
                                      ? 'border-gray-600/50 text-gray-500 bg-gray-800/50 cursor-not-allowed opacity-60'
                                      : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'
                                    : isDarkMode
                                      ? 'border-red-600/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-300 bg-red-900/10'
                                      : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 bg-red-50/50'
                                    }`}
                                  title={1 + (item.additionalMeters.length || 0) <= 1 ? "Cannot delete - at least one entry required" : `Delete M${index + 2} row`}
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add More Additional Meters Button - Full width horizontal design */}
                        <div className="mt-3 sm:mt-4">
                          <button
                            type="button"
                            onClick={() => addAdditionalMeters(item.id)}
                            className={`w-full flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-all duration-200 text-xs sm:text-sm font-semibold ${isDarkMode
                              ? 'bg-gray-800/70 border-gray-600 hover:bg-gray-700 hover:border-gray-500 text-gray-200 hover:text-white'
                              : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-gray-400 text-gray-700 hover:text-gray-900'
                              }`}
                          >
                            <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                            <span>Add More Meters & Pieces</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Item Card */}
                  <div className={`p-3 sm:p-4 rounded-xl border-2 border-dashed transition-all duration-200 hover:shadow-lg cursor-pointer ${isDarkMode
                    ? 'border-gray-600 bg-gray-800/50 hover:border-blue-500 hover:bg-gray-800'
                    : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-gray-50'
                    }`} onClick={addMillItem}>
                    <div className="flex items-center justify-center space-x-2 sm:space-x-3 py-3 sm:py-4">
                      <div className={`p-1.5 sm:p-2 rounded-full ${isDarkMode
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-blue-100 text-blue-600'
                        }`}>
                        <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="text-center">
                        <h4 className={`text-sm sm:text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                          Add New Mill Item
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Sticky Submit Button */}
          <div className={`sticky bottom-0 left-0 right-0 p-3 sm:p-6 border-t shadow-lg bg-inherit ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4">
              <button
                type="button"
                onClick={handleClose}
                className={`px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg border transition-all duration-200 hover:scale-105 text-sm sm:text-base ${isDarkMode
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
                  className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 text-sm sm:text-base ${saving
                    ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                    : isDarkMode
                      ? 'border-red-500 text-red-400 hover:bg-red-500 hover:text-white'
                      : 'border-red-300 text-red-600 hover:bg-red-500 hover:text-white'
                    }`}
                >
                  <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1.5 sm:mr-2" />
                  Delete
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                onClick={handleSubmit}
                className={`px-6 sm:px-10 py-2.5 sm:py-3 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105 text-sm sm:text-base ${saving
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

          {/* Add Mill Modal */}
          {showAddMillModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                }`}>
                {/* Modal Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    Add New Mill
                  </h3>
                  <button
                    onClick={() => setShowAddMillModal(false)}
                    className={`p-2 rounded-full transition-colors ${isDarkMode
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <form onSubmit={handleAddMill} className="p-6 space-y-4">
                  {errors.addMill && (
                    <div className={`p-3 rounded-lg border ${isDarkMode
                      ? 'bg-red-900/20 border-red-500/30 text-red-400'
                      : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                      {errors.addMill}
                    </div>
                  )}

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      Mill Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addMillForm.name}
                      onChange={(e) => setAddMillForm({ ...addMillForm, name: e.target.value })}
                      required
                      placeholder="Enter mill name"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${isDarkMode
                        ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                    />
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddMillModal(false)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${isDarkMode
                        ? 'text-gray-300 bg-gray-700 hover:bg-gray-600'
                        : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                        }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingMill}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${addingMill
                        ? 'bg-gray-400 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                    >
                      {addingMill ? 'Adding...' : 'Add Mill'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

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
                    <h3 className="text-lg font-semibold">Delete Mill Input Data</h3>
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
                      Are you sure you want to delete all mill input data for this order? This action cannot be undone.
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
                          This will permanently remove all mill input data for this order.
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
                          Delete Mill Input Data
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
      </div>
    </>
  );
}
