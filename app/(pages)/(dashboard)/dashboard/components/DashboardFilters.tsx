'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';

interface DashboardFiltersProps {
  onFiltersChange: (filters: {
    startDate: string;
    endDate: string;
    financialYear: string;
  }) => void;
  loading?: boolean;
}

// Custom Date Picker Component with dd/mm/yyyy format
function CustomDatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  isDarkMode
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDarkMode: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [inputValue, setInputValue] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const dateInputRef = useRef<HTMLDivElement>(null);

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
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Parse date from dd/mm/yyyy format
  const parseDateFromInput = (input: string): string => {
    if (!input.trim()) return '';

    // Handle dd/mm/yyyy format
    const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);

      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    return '';
  };

  const handleDateSelect = (date: Date) => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse the date
    const parsed = parseDateFromInput(newValue);
    if (parsed) {
      onChange(parsed);
    }
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
      if (dateInputRef.current && !dateInputRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
        setShowMonthPicker(false);
        setShowYearPicker(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleMonthChange = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const handleYearChange = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear() + offset, currentDate.getMonth(), 1));
  };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="relative z-30" ref={dateInputRef}>
      <div className="relative">
        <CalendarIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`} />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowCalendar(true)}
          placeholder={placeholder}
          className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-0 ${isDarkMode
              ? 'bg-slate-700 border-slate-500 text-gray-100 placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
        />
        {inputValue && (
          <button
            type="button"
            onClick={clearDate}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors duration-0 ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showCalendar && (
        <div className={`absolute z-[9999] mt-1 rounded-lg border shadow-lg p-4 transition-colors duration-0 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'
          }`} style={{ minWidth: '280px' }}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => handleYearChange(-1)}
              className={`p-1 rounded hover:bg-opacity-20 transition-colors duration-0 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm transition-colors duration-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>««</span>
            </button>
            <button
              type="button"
              onClick={() => handleMonthChange(-1)}
              className={`p-1 rounded hover:bg-opacity-20 transition-colors duration-0 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm transition-colors duration-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>«</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMonthPicker(!showMonthPicker);
                setShowYearPicker(false);
              }}
              className={`px-3 py-1 rounded font-medium transition-colors duration-0 ${isDarkMode ? 'text-gray-100 hover:bg-slate-700' : 'text-gray-900 hover:bg-gray-100'
                }`}
            >
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </button>
            <button
              type="button"
              onClick={() => handleMonthChange(1)}
              className={`p-1 rounded hover:bg-opacity-20 transition-colors duration-0 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm transition-colors duration-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>»</span>
            </button>
            <button
              type="button"
              onClick={() => handleYearChange(1)}
              className={`p-1 rounded hover:bg-opacity-20 transition-colors duration-0 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm transition-colors duration-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>»»</span>
            </button>
          </div>

          {/* Month Picker */}
          {showMonthPicker && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {months.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => {
                    setCurrentDate(new Date(currentDate.getFullYear(), index, 1));
                    setShowMonthPicker(false);
                  }}
                  className={`px-3 py-2 text-sm rounded transition-colors duration-0 ${currentDate.getMonth() === index
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'text-gray-300 hover:bg-slate-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* Calendar Days */}
          {!showMonthPicker && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {days.map((day) => (
                  <div
                    key={day}
                    className={`text-center text-xs font-medium py-2 transition-colors duration-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => day && handleDateSelect(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                    disabled={!day}
                    className={`p-2 text-sm rounded transition-colors duration-0 ${!day
                        ? ''
                        : day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()
                          ? isDarkMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-500 text-white'
                          : isDarkMode
                            ? 'text-gray-300 hover:bg-slate-700'
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardFilters({ onFiltersChange, loading = false }: DashboardFiltersProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [financialYear, setFinancialYear] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const [showFYDropdown, setShowFYDropdown] = useState(false);
  const [fyOptions, setFyOptions] = useState<Array<{ value: string; label: string; isCurrent?: boolean }>>([]);
  const fyDropdownRef = useRef<HTMLDivElement>(null);

  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  const getActivePresetLabel = () => {
    const active = getQuickPresets().find(
      p => p.startDate === startDate && p.endDate === endDate
    );
    return active ? active.label : (startDate || endDate ? 'Custom Range' : 'Select Preset');
  };

  // Get initial theme to prevent flash
  const [initialTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__INITIAL_THEME__ ?? false;
    }
    return false;
  });

  // Use mounted state to prevent flickering
  const effectiveDarkMode = mounted ? isDarkMode : initialTheme;

  // Fetch financial years on mount
  useEffect(() => {
    const fetchFYOptions = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await fetch('/api/orders/financial-years', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const json = await res.json();
          if (json.success && json.data?.options) {
            setFyOptions(json.data.options);
          }
        }
      } catch (e) {
        console.error('Failed to fetch FY options:', e);
      }
    };
    fetchFYOptions();
  }, []);

  // Handle click outside for FY dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fyDropdownRef.current && !fyDropdownRef.current.contains(event.target as Node)) {
        setShowFYDropdown(false);
      }
    };
    if (showFYDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFYDropdown]);

  // Handle click outside for Preset dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(event.target as Node)) {
        setShowPresetDropdown(false);
      }
    };
    if (showPresetDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPresetDropdown]);

  const handleApplyFilters = () => {
    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        setDateError('End date must be after start date');
        return;
      }
    }
    setDateError(null);

    onFiltersChange({
      startDate,
      endDate,
      financialYear
    });
  };

  // Quick filter presets
  const getQuickPresets = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6); // End of week (Saturday)

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return [
      {
        label: 'Today',
        startDate: formatDate(today),
        endDate: formatDate(today)
      },
      {
        label: 'This Week',
        startDate: formatDate(thisWeekStart),
        endDate: formatDate(thisWeekEnd)
      },
      {
        label: 'This Month',
        startDate: formatDate(thisMonthStart),
        endDate: formatDate(thisMonthEnd)
      },
      {
        label: 'Last Month',
        startDate: formatDate(lastMonthStart),
        endDate: formatDate(lastMonthEnd)
      }
    ];
  };

  const handlePresetClick = (preset: { label: string; startDate: string; endDate: string }) => {
    setStartDate(preset.startDate);
    setEndDate(preset.endDate);
    setFinancialYear('all');
    setDateError(null);

    onFiltersChange({
      startDate: preset.startDate,
      endDate: preset.endDate,
      financialYear: 'all'
    });
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFinancialYear('all');
    onFiltersChange({
      startDate: '',
      endDate: '',
      financialYear: 'all'
    });
  };

  const hasActiveFilters = startDate || endDate || financialYear !== 'all';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative z-20 rounded-xl border shadow-lg p-2.5 sm:p-3 transition-colors duration-0 ${effectiveDarkMode
          ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm'
          : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm'
        }`}
      suppressHydrationWarning
    >
      <div className={`flex items-center justify-between ${(showFilters || hasActiveFilters) ? 'mb-3' : ''}`}>
        <div className="flex items-center gap-2">
          <FunnelIcon className={`w-5 h-5 transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`} />
          <h3 className={`text-base sm:text-lg font-semibold transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>Filters</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded-md transition-colors duration-0 ${effectiveDarkMode
                  ? 'text-gray-300 hover:text-gray-100 border-slate-600 hover:bg-slate-700'
                  : 'text-gray-600 hover:text-gray-800 border-gray-300 hover:bg-gray-50'
                }`}
            >
              <XMarkIcon className="w-4 h-4" />
              Clear
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFilters(!showFilters);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-0 ${effectiveDarkMode
                ? 'bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 text-gray-300 hover:text-white'
                : 'bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 hover:text-gray-800'
              }`}
          >
            <FunnelIcon className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {showFilters && (
        <>
          {/* Quick Filter Presets */}
          <div className="mb-4" ref={presetDropdownRef}>
            <label className={`block text-sm font-medium mb-2 transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Quick Filters
            </label>
            <div className="relative w-full sm:w-64">
              <button
                type="button"
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center justify-between gap-2 text-sm ${effectiveDarkMode
                    ? 'bg-slate-700 border-slate-500 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                  }`}
              >
                <span>{getActivePresetLabel()}</span>
                <svg className={`h-4 w-4 transition-transform duration-200 ${showPresetDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPresetDropdown && (
                <div className={`absolute left-0 mt-1 w-full rounded-lg border shadow-xl z-[100] dropdown-enter overflow-hidden ${effectiveDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                  {getQuickPresets().map((preset) => {
                    const isActive = startDate === preset.startDate && endDate === preset.endDate;
                    return (
                      <button
                        type="button"
                        key={preset.label}
                        onClick={() => {
                          handlePresetClick(preset);
                          setShowPresetDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors ${isActive
                          ? effectiveDarkMode ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'bg-blue-100 text-blue-700 font-semibold'
                          : effectiveDarkMode ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClearFilters();
                        setShowPresetDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors border-t ${effectiveDarkMode ? 'border-slate-700' : 'border-gray-100'}`}
                    >
                      Clear Dates
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {/* Date Range */}
            <div className="space-y-2">
              <label className={`block text-sm font-medium transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Start Date
              </label>
              <CustomDatePicker
                value={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  setDateError(null);
                }}
                placeholder="dd/mm/yyyy"
                isDarkMode={effectiveDarkMode}
              />
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                End Date
              </label>
              <CustomDatePicker
                value={endDate}
                onChange={(date) => {
                  setEndDate(date);
                  setDateError(null);
                }}
                placeholder="dd/mm/yyyy"
                isDarkMode={effectiveDarkMode}
              />
            </div>


            {/* Financial Year */}
            <div className="space-y-2" ref={fyDropdownRef}>
              <label className={`block text-sm font-medium transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Financial Year
              </label>
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={async () => {
                    setShowFYDropdown(!showFYDropdown);
                    if (fyOptions.length === 0) {
                      try {
                        const token = localStorage.getItem('token');
                        if (token) {
                          const res = await fetch('/api/orders/financial-years', {
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          const json = await res.json();
                          if (json.success && json.data?.options) {
                            setFyOptions(json.data.options);
                          }
                        }
                      } catch (e) {
                        console.error('Failed to fetch FY options:', e);
                      }
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center justify-between gap-2 text-sm ${effectiveDarkMode
                      ? 'bg-slate-700 border-slate-500 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                    }`}
                >
                  <span>
                    {financialYear === 'all'
                      ? 'All Financial Years'
                      : fyOptions.find(o => o.value === financialYear)?.label || `FY ${financialYear.slice(0, 2)}-${financialYear.slice(2, 4)}`
                    }
                  </span>
                  <svg className={`h-4 w-4 transition-transform duration-200 ${showFYDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showFYDropdown && (
                  <div className={`absolute left-0 mt-1 w-full rounded-lg border shadow-xl z-[100] dropdown-enter overflow-hidden ${effectiveDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setFinancialYear('all');
                        setShowFYDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors ${financialYear === 'all'
                        ? effectiveDarkMode ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'bg-blue-100 text-blue-700 font-semibold'
                        : effectiveDarkMode ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      All Financial Years
                    </button>
                    {fyOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => {
                          setFinancialYear(option.value);
                          setShowFYDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-50 transition-colors flex items-center gap-2 ${financialYear === option.value
                          ? effectiveDarkMode ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'bg-blue-100 text-blue-700 font-semibold'
                          : effectiveDarkMode ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {option.label}
                        {option.isCurrent && (
                          <span className={`inline-block w-2 h-2 rounded-full ${effectiveDarkMode ? 'bg-green-400' : 'bg-green-500'}`} title="Current FY"></span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {dateError && (
            <div className={`mt-2 p-2 rounded-md text-sm ${effectiveDarkMode
                ? 'bg-red-900/30 text-red-300 border border-red-800'
                : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
              {dateError}
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <button
              onClick={handleApplyFilters}
              disabled={loading || !!dateError}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Applying...' : 'Apply Filters'}
            </button>
          </div>
        </>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className={`mt-2 pt-2 border-t ${effectiveDarkMode ? 'border-slate-600' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium transition-colors duration-0 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Active filters:</span>
            {financialYear !== 'all' && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-0 ${effectiveDarkMode
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                  : 'bg-blue-100 text-blue-800'
                }`}>
                FY: {financialYear}
              </span>
            )}
            {startDate && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-0 ${effectiveDarkMode
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                  : 'bg-blue-100 text-blue-800'
                }`}>
                From: {(() => {
                  if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [year, month, day] = startDate.split('-');
                    return `${day}/${month}/${year}`;
                  }
                  return new Date(startDate).toLocaleDateString('en-GB');
                })()}
              </span>
            )}
            {endDate && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-0 ${effectiveDarkMode
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                  : 'bg-blue-100 text-blue-800'
                }`}>
                To: {(() => {
                  if (endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [year, month, day] = endDate.split('-');
                    return `${day}/${month}/${year}`;
                  }
                  return new Date(endDate).toLocaleDateString('en-GB');
                })()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
