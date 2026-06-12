'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { getDisplayOrderId } from '@/utils/orders';

interface UpcomingOrder {
  id: string;
  orderId: string;
  orderType: string;
  deliveryDate: string;
  party: {
    name: string;
    contactPerson?: string;
    contactPhone?: string;
  };
  status: string;
  priority: number;
  items: Array<{
    quantity: number;
    description?: string;
  }>;
  daysUntilDelivery: number;
}

interface DeliveredSoonTableProps {
  isDarkMode: boolean;
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
        <CalendarIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`} />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowCalendar(true)}
          placeholder={placeholder}
          className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-300 ${isDarkMode
            ? 'bg-slate-700 border-slate-500 text-gray-100 placeholder-gray-400'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
        />
        {inputValue && (
          <button
            type="button"
            onClick={clearDate}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showCalendar && (
        <div className={`absolute z-[9999] mt-1 rounded-lg border shadow-lg p-4 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'
          }`} style={{ minWidth: '280px' }}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => handleYearChange(-1)}
              className={`p-1 rounded hover:bg-opacity-20 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>««</span>
            </button>
            <button
              type="button"
              onClick={() => handleMonthChange(-1)}
              className={`p-1 rounded hover:bg-opacity-20 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>«</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMonthPicker(!showMonthPicker);
                setShowYearPicker(false);
              }}
              className={`px-3 py-1 rounded font-medium ${isDarkMode ? 'text-gray-100 hover:bg-slate-700' : 'text-gray-900 hover:bg-gray-100'
                }`}
            >
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </button>
            <button
              type="button"
              onClick={() => handleMonthChange(1)}
              className={`p-1 rounded hover:bg-opacity-20 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>»</span>
            </button>
            <button
              type="button"
              onClick={() => handleYearChange(1)}
              className={`p-1 rounded hover:bg-opacity-20 ${isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                }`}
            >
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>»»</span>
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
                  className={`px-3 py-2 text-sm rounded ${currentDate.getMonth() === index
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
                    className={`text-center text-xs font-medium py-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
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
                    className={`p-2 text-sm rounded ${!day
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

// Ultra-fast client-side cache for delivered soon data
const deliveredSoonCache = {
  data: null as UpcomingOrder[] | null,
  timestamp: 0,
  ttl: 30 * 1000 // 30 seconds for ultra-fast loading
};

const DeliveredSoonTable: React.FC<DeliveredSoonTableProps> = ({ isDarkMode }) => {
  // Use refs to track intervals and prevent duplicate calls
  const refreshIntervalRef = useRef<any>(null);
  const retryIntervalRef = useRef<any>(null);
  const isFetchingRef = useRef(false);

  // Load from localStorage for instant display
  const [upcomingOrders, setUpcomingOrders] = useState<UpcomingOrder[]>(() => {
    try {
      const cached = localStorage.getItem('upcoming-deliveries-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30000) { // 30 seconds
          return data || [];
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return []; // Start with empty array, will be populated by API
  });
  // Initialize loading to true if no cached data, false if we have cached data
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('upcoming-deliveries-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (data && Array.isArray(data) && data.length > 0 && (Date.now() - timestamp < 30000)) {
          return false; // We have cached data, don't show loading
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return true; // No cached data, show loading initially
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [filteredOrders, setFilteredOrders] = useState<UpcomingOrder[]>(upcomingOrders);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => {
    // If we have cached data, consider it as loaded once
    try {
      const cached = localStorage.getItem('upcoming-deliveries-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (data && Array.isArray(data) && data.length > 0 && (Date.now() - timestamp < 30000)) {
          return true;
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return false;
  });
  const isInitialMountRef = useRef(true);

  const fetchUpcomingOrders = useCallback(async () => {
    // Prevent duplicate calls
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    try {
      // ⚡ FIX: Always try to load from localStorage first for instant display
      // This ensures data shows immediately even if API is slow
      try {
        const cached = localStorage.getItem('upcoming-deliveries-cache');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // Use cached data if it's less than 5 minutes old (more lenient for initial load)
          if (data && Array.isArray(data) && data.length > 0 && (Date.now() - timestamp < 300000)) {
            setUpcomingOrders(data);
            setFilteredOrders(data);
            // Update in-memory cache too
            deliveredSoonCache.data = data;
            deliveredSoonCache.timestamp = timestamp;
            // Continue to fetch fresh data in background (don't return early)
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }

      // Ultra-fast cache check - load from cache immediately if available
      if (deliveredSoonCache.data && (Date.now() - deliveredSoonCache.timestamp) < deliveredSoonCache.ttl) {
        setUpcomingOrders(deliveredSoonCache.data);
        setFilteredOrders(deliveredSoonCache.data);
        // Still fetch fresh data in background, but show cached data immediately
        // (don't return early - continue to fetch)
      }

      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setHasLoadedOnce(true);
        setError('Please log in to view upcoming orders');
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // Reasonable timeout for reliable data loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for reliable loading

      // Try dedicated upcoming deliveries endpoint first, fallback to orders API
      let response: Response | undefined;
      let useFallback = false;

      try {
        // ⚡ OPTIMIZATION: Use deduplicated fetch to prevent duplicate requests
        const { deduplicatedFetch } = await import('@/lib/requestDeduplication');
        response = await deduplicatedFetch(`/api/dashboard/upcoming-deliveries-instant`, {
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal,
          cache: 'default'
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          // Timeout occurred, try with cached data or show empty state
          if (deliveredSoonCache.data) {
            setUpcomingOrders(deliveredSoonCache.data);
            setFilteredOrders(deliveredSoonCache.data);
            setHasLoadedOnce(true);
            setLoading(false);
            return; // Use cached data instead of showing error
          }
          // No cached data, show empty state instead of error
          setUpcomingOrders([]);
          setFilteredOrders([]);
          setHasLoadedOnce(true);
          setLoading(false);
          return;
        }
        // If dedicated endpoint fails, try fallback
        useFallback = true;
      }

      // If dedicated endpoint failed or returned error, try fallback
      if (useFallback || !response || !response.ok) {
        try {
          response = await fetch(`/api/orders?limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            signal: controller.signal,
            cache: 'default'
          });
        } catch (fallbackError: any) {
          if (fallbackError.name === 'AbortError') {
            if (deliveredSoonCache.data) {
              setUpcomingOrders(deliveredSoonCache.data);
              setFilteredOrders(deliveredSoonCache.data);
              setHasLoadedOnce(true);
              setLoading(false);
              return;
            }
            setUpcomingOrders([]);
            setFilteredOrders([]);
            setHasLoadedOnce(true);
            setLoading(false);
            return;
          }
          throw fallbackError;
        }
      }

      if (response && response.ok) {
        // ⚡ FIX: Read response body ONCE - can't read it multiple times
        let data;
        try {
          // ⚡ FIX: Clone response if we need to check headers, otherwise read directly
          // Read response as text first to check if it's valid JSON
          const responseText = await response.text();

          // Check if response is empty
          if (!responseText || responseText.trim() === '') {
            console.warn('Empty response body received');
            if (deliveredSoonCache.data) {
              setUpcomingOrders(deliveredSoonCache.data);
              setFilteredOrders(deliveredSoonCache.data);
              setHasLoadedOnce(true);
              setLoading(false);
              return;
            }
            setUpcomingOrders([]);
            setFilteredOrders([]);
            setHasLoadedOnce(true);
            setLoading(false);
            return;
          }

          // Try to parse JSON
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          // If we can't parse, try to use cached data
          if (deliveredSoonCache.data) {
            setUpcomingOrders(deliveredSoonCache.data);
            setFilteredOrders(deliveredSoonCache.data);
            setHasLoadedOnce(true);
            setLoading(false);
            return;
          }
          // No cached data - show empty state instead of error
          setUpcomingOrders([]);
          setFilteredOrders([]);
          setHasLoadedOnce(true);
          setLoading(false);
          return;
        }

        // Handle response format
        let orders = [];
        if (data.success && data.data) {
          orders = Array.isArray(data.data) ? data.data : [];
        } else if (Array.isArray(data)) {
          orders = data;
        } else if (data.error) {
          // API returned an error response
          console.error('API error:', data.error, data.message);
          // Try to use cached data if available
          if (deliveredSoonCache.data) {
            setUpcomingOrders(deliveredSoonCache.data);
            setFilteredOrders(deliveredSoonCache.data);
            setHasLoadedOnce(true);
            setLoading(false);
            return;
          }
          setHasLoadedOnce(true);
          setError(data.message || 'Failed to load upcoming orders. Please try again.');
          setLoading(false);
          return;
        }

        let validUpcoming;

        // Check if this is from the dedicated endpoint (pre-processed) or fallback (needs processing)
        if (orders.length > 0 && orders[0].daysUntilDelivery !== undefined) {
          // Data is already processed by the dedicated API, just use it directly
          validUpcoming = orders.filter((order: any) => order && order.orderId && order.daysUntilDelivery >= 0);

        } else {
          // Fallback: process orders from the general orders API
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Start from yesterday to catch any timezone issues
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);

          const upcoming = orders
            .filter((order: any) => order.deliveryDate)
            .map((order: any) => {
              const deliveryDate = new Date(order.deliveryDate);
              if (isNaN(deliveryDate.getTime())) return null;

              // Normalize delivery date to start of day for accurate comparison
              deliveryDate.setHours(0, 0, 0, 0);

              const daysUntil = Math.round((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              return {
                id: order._id || order.id,
                orderId: order.orderId,
                orderType: order.orderType || 'Not Set',
                deliveryDate: order.deliveryDate,
                party: order.party || { name: 'Unknown Party' },
                status: order.status,
                priority: order.priority || 5,
                items: order.items || [],
                daysUntilDelivery: daysUntil
              };
            })
            .filter((order: UpcomingOrder | null) => {
              if (!order) return false;
              // Include orders from today to 7 days from now
              return order.daysUntilDelivery >= 0 && order.daysUntilDelivery <= 7;
            })
            .sort((a: UpcomingOrder | null, b: UpcomingOrder | null) => {
              if (!a || !b) return 0;
              return a.daysUntilDelivery - b.daysUntilDelivery;
            });

          validUpcoming = upcoming.filter((order: UpcomingOrder | null): order is UpcomingOrder => order !== null);
        }

        // ⚡ FIX: Always update state even if we already have cached data
        // This ensures fresh data is always shown
        setUpcomingOrders(validUpcoming);
        setFilteredOrders(validUpcoming);
        setHasLoadedOnce(true);
        setError(null); // Clear any errors on successful load

        // Update cache for instant future loads
        deliveredSoonCache.data = validUpcoming;
        deliveredSoonCache.timestamp = Date.now();

        // Also save to localStorage for instant loading on page refresh
        try {
          localStorage.setItem('upcoming-deliveries-cache', JSON.stringify({
            data: validUpcoming,
            timestamp: Date.now()
          }));
        } catch (e) {
          // Ignore localStorage errors
        }
      } else {
        // Response is not OK - handle different status codes
        if (response) {
          if (response.status === 401) {
            setError('Authentication failed. Please log in again.');
          } else if (response.status === 404) {
            // 404 means no data found - show empty state, not error
            setUpcomingOrders([]);
            setFilteredOrders([]);
            deliveredSoonCache.data = [];
            deliveredSoonCache.timestamp = Date.now();
            setHasLoadedOnce(true);
            setError(null); // Clear any previous errors
            setLoading(false);
          } else if (response.status === 500) {
            // Server error - try to use cached data if available
            if (deliveredSoonCache.data) {
              setUpcomingOrders(deliveredSoonCache.data);
              setFilteredOrders(deliveredSoonCache.data);
              setHasLoadedOnce(true);
              setLoading(false);
              return;
            }
            setHasLoadedOnce(true);
            setError('Server error. Please try again later.');
            setLoading(false);
          } else {
            // Other errors - try cached data first
            if (deliveredSoonCache.data) {
              setUpcomingOrders(deliveredSoonCache.data);
              setFilteredOrders(deliveredSoonCache.data);
              setHasLoadedOnce(true);
              setLoading(false);
              return;
            }
            setHasLoadedOnce(true);
            setError(`Failed to load upcoming orders (${response.status})`);
            setLoading(false);
          }
        } else {
          // No response - try cached data
          if (deliveredSoonCache.data) {
            setUpcomingOrders(deliveredSoonCache.data);
            setFilteredOrders(deliveredSoonCache.data);
            setHasLoadedOnce(true);
            setLoading(false);
            return;
          }
          setHasLoadedOnce(true);
          setError('Failed to load upcoming orders. Please try again.');
          setLoading(false);
        }
      }
    } catch (error: any) {
      // Graceful error handling - don't show errors for timeouts if we have cached data
      if (error.name === 'AbortError') {
        // Check if we have cached data to show instead of error
        if (deliveredSoonCache.data) {
          setUpcomingOrders(deliveredSoonCache.data);
          setFilteredOrders(deliveredSoonCache.data);
          setHasLoadedOnce(true);
          setLoading(false);
          return; // Show cached data instead of error
        }
        // Only show timeout error if no cached data available
        setHasLoadedOnce(true);
        setError('Request timeout. Please try again.');
        setLoading(false);
      } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        // Network errors - try to use cached data first
        if (deliveredSoonCache.data) {
          setUpcomingOrders(deliveredSoonCache.data);
          setFilteredOrders(deliveredSoonCache.data);
          setHasLoadedOnce(true);
          setLoading(false);
          return; // Show cached data instead of error
        }
        setHasLoadedOnce(true);
        setError('Network error. Please check your connection.');
        setLoading(false);
      } else {
        // Other errors - try to use cached data first
        if (deliveredSoonCache.data) {
          setUpcomingOrders(deliveredSoonCache.data);
          setFilteredOrders(deliveredSoonCache.data);
          setHasLoadedOnce(true);
          setLoading(false);
          setError(null); // Clear error if we have cached data
          return; // Show cached data instead of error
        }
        // Show error or empty state
        setHasLoadedOnce(true);
        console.error('Error loading upcoming orders:', error);
        setError('Failed to load upcoming orders. Please try again.');
        setUpcomingOrders([]);
        setFilteredOrders([]);
        setLoading(false);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [hasLoadedOnce]);

  useEffect(() => {
    // ⚡ FIX: Initial fetch with retry mechanism for reliability
    let retryCount = 0;
    const MAX_INITIAL_RETRIES = 2;
    const INITIAL_RETRY_DELAY = 3000; // 3 seconds
    let retryTimeout1: any = null;
    let retryTimeout2: any = null;

    const initialFetchWithRetry = async () => {
      // First attempt - immediate
      await fetchUpcomingOrders();

      // Retry mechanism - check if data loaded, if not retry
      retryTimeout1 = setTimeout(async () => {
        // Check if we have data in cache
        const hasData = deliveredSoonCache.data && deliveredSoonCache.data.length > 0;

        if (!hasData && retryCount < MAX_INITIAL_RETRIES) {
          retryCount++;
          console.log(`Retrying initial fetch (attempt ${retryCount + 1}/${MAX_INITIAL_RETRIES + 1})...`);
          await fetchUpcomingOrders();

          // One more retry if still no data
          if (retryCount < MAX_INITIAL_RETRIES) {
            retryTimeout2 = setTimeout(async () => {
              const stillNoData = !deliveredSoonCache.data || deliveredSoonCache.data.length === 0;
              if (stillNoData) {
                retryCount++;
                console.log(`Final retry (attempt ${retryCount + 1}/${MAX_INITIAL_RETRIES + 1})...`);
                await fetchUpcomingOrders();
              }
            }, INITIAL_RETRY_DELAY);
          }
        }
      }, INITIAL_RETRY_DELAY);
    };

    initialFetchWithRetry();

    // Clear any existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
    }

    // Background refresh - less aggressive (60 seconds)
    refreshIntervalRef.current = setInterval(() => {
      if (!loading && !isFetchingRef.current) {
        fetchUpcomingOrders();
      }
    }, 60000); // 60 seconds

    return () => {
      if (retryTimeout1) clearTimeout(retryTimeout1);
      if (retryTimeout2) clearTimeout(retryTimeout2);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, [fetchUpcomingOrders]); // Include fetchUpcomingOrders in dependencies

  // Separate effect for error retry
  useEffect(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
    }

    if (error && !loading) {
      // Retry on error - less aggressive (30 seconds)
      retryIntervalRef.current = setInterval(() => {
        if (!loading && !isFetchingRef.current && error) {
          fetchUpcomingOrders();
        }
      }, 30000); // 30 seconds
    }

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, [error, loading, fetchUpcomingOrders]);

  // Refresh when tab becomes visible to show latest data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading && !isFetchingRef.current) {
        // Check if cache is stale (older than 30 seconds)
        if (!deliveredSoonCache.data || (Date.now() - deliveredSoonCache.timestamp) > 30000) {
          // Clear cache and refetch to get latest data
          deliveredSoonCache.data = null;
          deliveredSoonCache.timestamp = 0;
          fetchUpcomingOrders();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loading, fetchUpcomingOrders]);

  // Refetch when date changes to get latest data instantly
  useEffect(() => {
    // Skip on initial mount to avoid double fetch
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // When date changes (including when cleared), clear cache and refetch to get latest data
    // Clear cache to force fresh fetch
    deliveredSoonCache.data = null;
    deliveredSoonCache.timestamp = 0;
    // Refetch with fresh data
    fetchUpcomingOrders();
  }, [selectedDate, fetchUpcomingOrders]);

  // Filter orders by selected date
  useEffect(() => {
    if (!selectedDate) {
      setFilteredOrders(upcomingOrders);
    } else {
      const filtered = upcomingOrders.filter(order =>
        order.deliveryDate.startsWith(selectedDate)
      );
      setFilteredOrders(filtered);
    }
  }, [selectedDate, upcomingOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return isDarkMode ? 'text-green-400' : 'text-green-600';
      case 'in_progress':
        return isDarkMode ? 'text-blue-400' : 'text-blue-600';
      case 'pending':
        return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return isDarkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return isDarkMode ? 'text-red-400' : 'text-red-600';
    if (priority >= 6) return isDarkMode ? 'text-orange-400' : 'text-orange-600';
    return isDarkMode ? 'text-green-400' : 'text-green-600';
  };

  const getDaysUntilColor = (days: number) => {
    if (days <= 0) return isDarkMode ? 'text-red-400' : 'text-red-600';
    if (days <= 2) return isDarkMode ? 'text-orange-400' : 'text-orange-600';
    return isDarkMode ? 'text-green-400' : 'text-green-600';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };


  if (loading) {
    return (
      <div className={`rounded-lg border p-6 ${isDarkMode
        ? 'bg-white/5 border-white/10'
        : 'bg-white border-gray-200'
        }`}>
        <div className="animate-pulse">
          <div className={`h-6 w-48 rounded mb-4 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-16 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${isDarkMode
      ? 'bg-white/5 border-white/10'
      : 'bg-white border-gray-200'
      }`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <TruckIcon className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
              Delivered Soon
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
              ? 'bg-blue-900/30 text-blue-300'
              : 'bg-blue-100 text-blue-800'
              }`}>
              Next 7 Days
            </span>
          </div>

          {/* Date Filter and Refresh */}
          <div className="flex items-center gap-2">
            <CustomDatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="dd/mm/yyyy"
              isDarkMode={isDarkMode}
            />
            <button
              onClick={() => {
                // Clear cache and localStorage to force fresh fetch
                deliveredSoonCache.data = null;
                deliveredSoonCache.timestamp = 0;
                try {
                  localStorage.removeItem('upcoming-deliveries-cache');
                } catch (e) {
                  // Ignore localStorage errors
                }
                // Refetch with fresh data
                fetchUpcomingOrders();
              }}
              disabled={loading || isFetchingRef.current}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${isDarkMode
                ? 'bg-slate-700 text-gray-300 hover:bg-slate-600 border-slate-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-300'
                } ${loading || isFetchingRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading || isFetchingRef.current ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message - Only show if we have a real error and no cached data */}
      {error && !deliveredSoonCache.data && (
        <div className="p-6">
          <div className={`flex items-center justify-between gap-2 p-3 rounded-lg ${isDarkMode
            ? 'bg-red-900/20 border border-red-800/30'
            : 'bg-red-50 border border-red-200'
            }`}>
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
              <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-800'
                }`}>
                {error}
              </p>
            </div>
            <button
              onClick={() => {
                setError(null);
                fetchUpcomingOrders();
              }}
              disabled={loading}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${loading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : isDarkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
            >
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredOrders.length === 0 && !loading && hasLoadedOnce ? (
          <div className="p-6 text-center">
            <TruckIcon className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
              {selectedDate
                ? `No orders scheduled for ${formatDate(selectedDate)}`
                : 'No orders scheduled for delivery in the next 7 days'
              }
            </p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'
                }`}>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Order Details
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Party
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Delivery Date
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'
              }`}>
              {filteredOrders.map((order) => {
                const handleRowClick = () => {
                  // Store order number in sessionStorage for auto-search
                  sessionStorage.setItem('ordersPageSearchOrder', getDisplayOrderId(order.orderId));
                  sessionStorage.setItem('ordersPageSearchTime', Date.now().toString());
                  console.log('🔧 Navigating to orders page with order search:', getDisplayOrderId(order.orderId));
                  // Navigate to orders page
                  window.location.href = '/orders';
                };

                return (
                  <tr
                    key={order.id}
                    onClick={handleRowClick}
                    className={`hover:${isDarkMode ? 'bg-white/10' : 'bg-gray-50'
                      } transition-all duration-200 cursor-pointer hover:shadow-sm`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                          #{getDisplayOrderId(order.orderId)}
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          {order.orderType}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                          {order.party.name}
                        </div>
                        {order.party.contactPerson && (
                          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            {order.party.contactPerson}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                            {formatDate(order.deliveryDate)}
                          </div>
                          <div className={`text-sm font-medium ${getDaysUntilColor(order.daysUntilDelivery)}`}>
                            {order.daysUntilDelivery === 0
                              ? 'Today'
                              : order.daysUntilDelivery === 1
                                ? 'Tomorrow'
                                : order.daysUntilDelivery === -1
                                  ? 'Yesterday'
                                  : order.daysUntilDelivery < -1
                                    ? `${Math.abs(order.daysUntilDelivery)} days ago`
                                    : `${order.daysUntilDelivery} days`
                            }
                          </div>
                        </div>
                        {order.daysUntilDelivery <= 2 && (
                          <ClockIcon className={`w-4 h-4 ${order.daysUntilDelivery <= 0
                            ? (isDarkMode ? 'text-red-400' : 'text-red-600')
                            : (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                            }`} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                        {order.priority >= 8 && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${isDarkMode
                            ? 'bg-red-900/30 text-red-300'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            High Priority
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* Footer */}
      {filteredOrders.length > 0 && (
        <div className={`px-6 py-3 border-t ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
          }`}>
          <div className="flex items-center justify-between text-sm">
            <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
              Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {selectedDate && ` for ${formatDate(selectedDate)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveredSoonTable;
