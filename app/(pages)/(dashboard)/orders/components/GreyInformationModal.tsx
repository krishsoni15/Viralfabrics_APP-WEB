'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { XMarkIcon, ChevronDownIcon, PlusIcon, TrashIcon, CalendarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { getDisplayOrderId } from '@/utils/orders';
import { Order, Quality } from '@/types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useSession } from '../../hooks/useSession';

// Date parsing function for custom date picker
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
          return date.toISOString().split('T')[0];
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
          return date.toISOString().split('T')[0];
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
          return date.toISOString().split('T')[0];
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
        setShowMonthPicker(false);
        setShowYearPicker(false);
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
      setShowMonthPicker(false);
      setShowYearPicker(false);
    } else if (e.key === 'Tab') {
      setShowCalendar(false);
      setShowMonthPicker(false);
      setShowYearPicker(false);
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
              className={`p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'
                }`}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setShowCalendar(!showCalendar)}
            className={`p-1 rounded-full hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'
              }`}
          >
            <CalendarIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showCalendar && (
        <div
          ref={calendarRef}
          onClick={handleCalendarClick}
          className={`absolute z-[9999] bottom-full mb-2 p-2 rounded-lg border-2 shadow-xl calendar-container date-picker min-w-[220px] max-w-[240px] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
            }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
              }}
              className={`p-1 rounded hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              <ChevronDownIcon className="h-3 w-3 transform rotate-90" />
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMonthPicker(!showMonthPicker);
                  setShowYearPicker(false);
                }}
                className={`px-2 py-1 rounded hover:bg-opacity-80 transition-colors text-xs font-semibold ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
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
                className={`px-2 py-1 rounded hover:bg-opacity-80 transition-colors text-xs font-semibold ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
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
              className={`p-1 rounded hover:bg-opacity-80 transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              <ChevronDownIcon className="h-3 w-3 transform -rotate-90" />
            </button>
          </div>

          {/* Month Picker */}
          {showMonthPicker && (
            <div className={`mb-2 p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
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
                    className={`p-1 text-xs rounded transition-colors ${index === currentDate.getMonth()
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
            <div className={`mb-2 p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
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
                    className={`p-1 text-xs rounded transition-colors ${year === currentDate.getFullYear()
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

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`text-center text-xs font-medium p-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                {day.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
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
                className={`p-1.5 text-xs rounded transition-colors ${!day ? 'invisible' :
                  day.toDateString() === new Date().toDateString()
                    ? 'bg-blue-500 text-white' :
                    value === day.toISOString().split('T')[0]
                      ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700' :
                      `hover:bg-opacity-80 ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
                      }`
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

interface GreyInformationModalProps {
  order: Order | null;
  qualities: Quality[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedEntries?: any[]) => void;
  existingGreyInfo?: any;
  onRefreshQualities?: () => void | Promise<void>; // Add quality refresh function
  readOnly?: boolean;
}

interface GreyInfoEntry {
  id: string;
  qualityId: string;
  qualityName: string;
  weaverNames: string[]; // Array of all weaver names
  weaverNameNotFound: boolean;
  quantity: string;
  chalanNo: string;
  numberOfPieces: string;
  date: string;
  qualitySearch: string;
  showQualityDropdown: boolean;
}

export default function GreyInformationModal({
  order,
  qualities,
  isOpen,
  onClose,
  onSuccess,
  existingGreyInfo,
  onRefreshQualities,
  readOnly = false
}: GreyInformationModalProps) {
  const { isDarkMode } = useDarkMode();
  const { isMaster } = useSession();
  const [entries, setEntries] = useState<GreyInfoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loadingGreyInfo, setLoadingGreyInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchedGreyInfo, setFetchedGreyInfo] = useState<any[] | null>(null);
  const [deletedEntryIds, setDeletedEntryIds] = useState<string[]>([]); // Track entries deleted from UI
  const [hasAutoFilled, setHasAutoFilled] = useState(false); // Track if we've already auto-filled once

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };
  const qualityDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const fetchedOrderIdRef = useRef<string | null>(null); // Track which order we've fetched for

  // ⚡ FIX: Local qualities state to include newly added qualities
  const [localQualities, setLocalQualities] = useState<Quality[]>([]);

  // Sync local qualities with prop qualities
  useEffect(() => {
    if (qualities && Array.isArray(qualities)) {
      if (qualities.length === 0) {
        // ⚡ FIX: If qualities prop is empty array, clear localQualities (all deleted)
        setLocalQualities([]);
      } else {
        setLocalQualities(prev => {
          // ⚡ FIX: When qualities prop changes (e.g., after deletion), use prop as source of truth
          // Merge prop qualities with local qualities, avoiding duplicates
          // Use a Map to ensure we keep the latest version of each quality
          const qualityMap = new Map();

          // ⚡ FIX: First, add prop qualities (these are the source of truth after deletion)
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
          console.log('🔄 GreyInfoModal: Synced localQualities with prop qualities:', merged.length, 'qualities');
          return merged;
        });
      }
    }
  }, [qualities]);

  // ⚡ FIX: Function to refresh qualities when dropdown is opened
  const refreshQualitiesForDropdown = useCallback(async () => {
    // Clear cache
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qualities_cache');
    }

    // Fetch fresh qualities directly and update localQualities immediately
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('No token found for qualities fetch');
        }
        return;
      }

      const qualitiesResponse = await fetch(`/api/qualities?t=${Date.now()}&limit=1000`, {
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
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ GreyInfoModal: Refreshed qualities on dropdown open:', qualitiesData.data.length, 'qualities');
          }
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
  }, [onRefreshQualities]);

  // ⚡ FIX: Listen for qualityAdded event to immediately update localQualities
  // Also handle multiple rapid quality creations
  useEffect(() => {
    let pendingQualities: any[] = [];
    let batchTimeout: any = null;

    const handleQualityAdded = (event: any) => {
      const newQuality = event.detail?.quality;
      if (newQuality) {
        console.log('🎉 GreyInfoModal: Received qualityAdded event:', newQuality.name);

        // Clear cache immediately
        if (typeof window !== 'undefined') {
          localStorage.removeItem('qualities_cache');
        }

        // Track recently added quality ID
        const qualityId = newQuality._id || (newQuality as any).id;
        if (qualityId) {
          setRecentlyAddedQualityIds(prev => new Set([...prev, String(qualityId)]));
          // Clear after 5 minutes (in case it gets added to order items)
          setTimeout(() => {
            setRecentlyAddedQualityIds(prev => {
              const updated = new Set(prev);
              updated.delete(String(qualityId));
              return updated;
            });
          }, 5 * 60 * 1000);
        }

        pendingQualities.push(newQuality);

        // Clear existing timeout
        if (batchTimeout) {
          clearTimeout(batchTimeout);
        }

        // Batch process multiple qualities created quickly
        batchTimeout = setTimeout(() => {
          if (pendingQualities.length > 0) {
            console.log('🔄 Processing', pendingQualities.length, 'new qualities in batch');
            setLocalQualities(prev => {
              const qualityMap = new Map();

              // Add existing qualities
              prev.forEach(q => {
                const qId = q._id || (q as any).id;
                if (qId) {
                  qualityMap.set(String(qId), q);
                }
              });

              // Add new qualities
              pendingQualities.forEach(newQuality => {
                const qualityId = newQuality._id || (newQuality as any).id;
                if (qualityId && !qualityMap.has(String(qualityId))) {
                  qualityMap.set(String(qualityId), newQuality);
                  console.log('✅ Adding new quality to GreyInfoModal localQualities:', newQuality.name);
                }
              });

              const merged = Array.from(qualityMap.values());
              console.log('✅ GreyInfoModal: Updated localQualities with', merged.length, 'qualities');
              return merged;
            });

            // Also fetch fresh data from server to ensure we have everything
            const fetchFreshQualities = async () => {
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
                      console.log('✅ GreyInfoModal: Refreshed localQualities from server:', qualitiesData.data.length, 'qualities');
                    }
                  }
                }
              } catch (error) {
                console.error('Error fetching fresh qualities after batch:', error);
              }
            };

            // Fetch fresh data after a short delay to ensure all qualities are saved
            setTimeout(fetchFreshQualities, 200);

            pendingQualities = [];
          }
        }, 100); // Batch window of 100ms
      }
    };

    // ⚡ FIX: Also listen for qualitiesRefreshed event to fetch all qualities
    const handleQualitiesRefreshed = async () => {
      console.log('🔄 GreyInfoModal: Received qualitiesRefreshed event, fetching fresh data...');

      // Clear cache
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qualities_cache');
      }

      await refreshQualitiesForDropdown();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('qualityAdded', handleQualityAdded);
      window.addEventListener('qualitiesRefreshed', handleQualitiesRefreshed);
      return () => {
        if (batchTimeout) {
          clearTimeout(batchTimeout);
        }
        window.removeEventListener('qualityAdded', handleQualityAdded);
        window.removeEventListener('qualitiesRefreshed', handleQualitiesRefreshed);
      };
    }
  }, [refreshQualitiesForDropdown]);

  // Custom confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'delete' | 'warning';
  } | null>(null);

  // Custom alert/notification state
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{
    message: string;
    type?: 'success' | 'error' | 'info';
  } | null>(null);

  // Fetch all weaver names based on quality
  const fetchWeaverNames = useCallback(async (qualityName: string, qualityId?: string): Promise<{ names: string[]; notFound: boolean }> => {
    try {
      // First, try to get weaver from order items if order exists
      if (order && order.items && qualityId) {
        const matchingItem = order.items.find((item: any) => {
          const itemQualityId = typeof item.quality === 'string' ? item.quality : item.quality?._id;
          return itemQualityId === qualityId || String(itemQualityId) === String(qualityId);
        });

        if (matchingItem && matchingItem.weaverSupplierName) {
          return { names: [matchingItem.weaverSupplierName], notFound: false };
        }
      }

      // Fallback to API call
      const response = await fetch(`/api/fabrics/weavers?qualityName=${encodeURIComponent(qualityName)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Handle different response structures
          let weaverNames: string[] = [];

          if (Array.isArray(data.data)) {
            weaverNames = data.data
              .map((item: any) => {
                // Handle if it's an object with a name property
                if (typeof item === 'object' && item !== null) {
                  return item.name || item.weaverName || item.weaverSupplierName || '';
                }
                // Handle if it's a string directly
                return typeof item === 'string' ? item : '';
              })
              .filter((name: string) => name && name.trim() !== '');
          } else if (data.data && typeof data.data === 'string') {
            weaverNames = [data.data];
          }

          if (weaverNames.length > 0) {
            return { names: weaverNames, notFound: false };
          }
        }
      }
      return { names: [], notFound: true };
    } catch (error) {
      console.error('Error fetching weaver names:', error);
      return { names: [], notFound: true };
    }
  }, [order]);

  // Get quality IDs from order items
  // ⚡ FIX: Improved quality ID extraction to handle different formats
  const getOrderItemQualityIds = useCallback(() => {
    if (!order || !order.items) return new Set<string>();

    const qualityIds = new Set<string>();

    order.items.forEach((item: any) => {
      if (item.quality) {
        // Handle different quality formats
        let qualityId: string | undefined;

        if (typeof item.quality === 'string') {
          qualityId = item.quality;
        } else if (item.quality?._id) {
          qualityId = item.quality._id;
        } else if ((item.quality as any)?.id) {
          qualityId = (item.quality as any).id;
        }

        if (qualityId) {
          qualityIds.add(String(qualityId));
        }
      }
    });

    console.log('🔍 Order item quality IDs:', Array.from(qualityIds), 'for order:', order.orderId);
    return qualityIds;
  }, [order]);

  // ⚡ INSTANT LOAD: Use data provided by parent (parent handles all fetching)
  // ⚡ FIX: Fetch fresh data when modal opens to ensure newly added entries are shown
  useEffect(() => {
    if (isOpen && order?.orderId) {
      // ⚡ FIX: Check if we have existing data - only fetch API if in Edit mode
      const hasExistingData = existingGreyInfo && Array.isArray(existingGreyInfo) && existingGreyInfo.length > 0;

      // If no existing data (Add mode), skip API call and don't show loading
      if (!hasExistingData) {
        setFetchedGreyInfo([]);
        setLoadingGreyInfo(false);
        fetchedOrderIdRef.current = order.orderId;
        return;
      }

      // ⚡ FIX: Reset fetchedGreyInfo to null when modal opens to force fresh fetch (Edit mode only)
      setFetchedGreyInfo(null);

      // Only fetch fresh data when modal opens if we have existing data (Edit mode)
      const fetchFreshData = async () => {
        setLoadingGreyInfo(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setLoadingGreyInfo(false);
            return;
          }

          // ⚡ FIX: Fetch fresh qualities when modal opens to include newly added ones
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
              // Update local qualities with fresh data
              setLocalQualities(qualitiesData.data);
            }
          }

          // ⚡ FIX: Add cache busting timestamp and use no-store to ensure fresh data
          // ⚡ FIX: Increase timeout to 30 seconds
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}&t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store',
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.greyInfo) {
              const greyInfoEntries = Array.isArray(data.data.greyInfo) ? data.data.greyInfo : [];
              setFetchedGreyInfo(greyInfoEntries);
              fetchedOrderIdRef.current = order.orderId;
            } else {
              // No data found, use empty array
              setFetchedGreyInfo([]);
              fetchedOrderIdRef.current = order.orderId;
            }
          } else {
            // Fallback to existingGreyInfo prop if fetch fails
            const hasExistingData = existingGreyInfo && Array.isArray(existingGreyInfo) && existingGreyInfo.length > 0;
            setFetchedGreyInfo(hasExistingData ? existingGreyInfo : []);
            fetchedOrderIdRef.current = order.orderId;
          }
        } catch (error) {
          console.error('Error fetching grey info:', error);
          // Fallback to existingGreyInfo prop on error
          const hasExistingData = existingGreyInfo && Array.isArray(existingGreyInfo) && existingGreyInfo.length > 0;
          setFetchedGreyInfo(hasExistingData ? existingGreyInfo : []);
          fetchedOrderIdRef.current = order.orderId;
        } finally {
          setLoadingGreyInfo(false);
        }
      };

      fetchFreshData();
    } else if (!isOpen) {
      // Reset when modal closes
      setFetchedGreyInfo(null);
      setLoadingGreyInfo(false);
      fetchedOrderIdRef.current = null;
    } else if (order?.orderId && fetchedOrderIdRef.current !== order.orderId) {
      // Order changed, reset ref
      fetchedOrderIdRef.current = null;
      setFetchedGreyInfo(null);
    }
  }, [isOpen, order?.orderId]); // ⚡ FIX: Remove existingGreyInfo from dependencies to always fetch fresh

  // Initialize form - wait for data to load before initializing
  useEffect(() => {
    // ⚡ FIX: Don't initialize entries while loading grey info
    if (!isOpen || loadingGreyInfo) {
      // Only clear entries if modal is closed, not while loading
      if (!isOpen) {
        setEntries([]);
      }
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Reset deleted entry IDs and auto-fill flag when modal opens
    setDeletedEntryIds([]);
    setHasAutoFilled(false);

    // ⚡ FIX: Always use fetchedGreyInfo if it's been set (not null), otherwise use existingGreyInfo prop
    // fetchedGreyInfo will be null initially, then [] if no data, or array if data exists
    // ⚡ FIX: Also check if we're still waiting for fetch (fetchedGreyInfo is null and we have orderId)
    if (fetchedGreyInfo === null && order?.orderId) {
      // Still waiting for fetch to complete, don't initialize yet
      return;
    }

    const greyInfoToUse = fetchedGreyInfo !== null ? fetchedGreyInfo : (existingGreyInfo || []);

    // Check if we have existing grey information data
    const hasExistingData = Array.isArray(greyInfoToUse) && greyInfoToUse.length > 0;

    if (hasExistingData) {
      // ⚡ FIX: Sort existing entries by createdAt (oldest first) before loading
      const sortedGreyInfo = [...greyInfoToUse].sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB; // Ascending order (oldest first)
      });

      // Load existing entries - use the actual database _id if available
      const loadedEntries = sortedGreyInfo.map((item: any, index: number) => {
        // Handle both populated and unpopulated quality objects
        const qualityId = typeof item.quality === 'string'
          ? item.quality
          : (item.quality?._id || item.quality?.id || '');

        // Try to find quality in the qualities array first
        let quality: any = qualities.find(q => q._id === qualityId || q._id?.toString() === qualityId?.toString());

        // If not found in qualities array, check if quality is populated in item
        if (!quality && item.quality && typeof item.quality === 'object') {
          quality = {
            _id: item.quality._id || (item.quality as any).id || qualityId,
            name: item.quality.name || ''
          } as any;
        }

        // Get quality name from found quality or populated object
        const qualityName = quality?.name || (typeof item.quality === 'object' ? item.quality?.name : '') || '';

        // Use the actual database ID if it exists, otherwise use a temp ID
        const entryId = item._id ? item._id : `existing-${index}-${Date.now()}`;

        return {
          id: entryId,
          qualityId: qualityId || (quality?._id || ''),
          qualityName: qualityName,
          weaverNames: [],
          weaverNameNotFound: false,
          quantity: item.quantity ? String(item.quantity) : '',
          chalanNo: item.chalanNo || '',
          numberOfPieces: item.numberOfPieces ? String(item.numberOfPieces) : '',
          date: item.date ? new Date(item.date).toISOString().split('T')[0] : today,
          qualitySearch: qualityName, // Set qualitySearch to qualityName so it displays
          showQualityDropdown: false
        };
      });

      setEntries(loadedEntries);

      // Fetch weaver names for all entries
      loadedEntries.forEach(async (entry: GreyInfoEntry, index: number) => {
        if (entry.qualityName && entry.qualityId) {
          const weaverData = await fetchWeaverNames(entry.qualityName, entry.qualityId);
          setEntries(prev => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = {
                ...updated[index],
                weaverNames: weaverData.names,
                weaverNameNotFound: weaverData.notFound
              };
            }
            return updated;
          });
        }
      });
    } else {
      // Start with one empty entry
      setEntries([{
        id: `new-${Date.now()}`,
        qualityId: '',
        qualityName: '',
        weaverNames: [],
        weaverNameNotFound: false,
        quantity: '',
        chalanNo: '',
        numberOfPieces: '',
        date: today,
        qualitySearch: '',
        showQualityDropdown: false
      }]);
    }
  }, [isOpen, existingGreyInfo, fetchedGreyInfo, qualities, fetchWeaverNames, loadingGreyInfo]); // ⚡ FIX: Add loadingGreyInfo to dependencies

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is on a clear button or inside dropdown
      const isClearButton = (target as HTMLElement).closest('button[title="Clear quality"]');
      const isDropdownItem = (target as HTMLElement).closest('[role="listbox"]');

      if (isClearButton || isDropdownItem) {
        return; // Don't close if clicking clear button or dropdown item
      }

      Object.values(qualityDropdownRefs.current).forEach(ref => {
        if (ref && !ref.contains(target)) {
          const entryId = Object.keys(qualityDropdownRefs.current).find(
            key => qualityDropdownRefs.current[key] === ref
          );
          if (entryId) {
            setEntries(prev => prev.map(entry =>
              entry.id === entryId ? { ...entry, showQualityDropdown: false } : entry
            ));
          }
        }
      });
    };

    if (isOpen) {
      // Use a small delay to ensure click events are processed first
      document.addEventListener('mousedown', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Handle quality selection
  const handleQualitySelect = async (entryId: string, quality: Quality) => {
    const qualityId = quality._id || '';
    const qualityName = quality.name || '';
    const weaverData = await fetchWeaverNames(qualityName, qualityId);

    setEntries(prev => prev.map(entry =>
      entry.id === entryId
        ? {
          ...entry,
          qualityId,
          qualityName,
          qualitySearch: qualityName,
          showQualityDropdown: false,
          weaverNames: weaverData.names,
          weaverNameNotFound: weaverData.notFound
        }
        : entry
    ));
  };

  // Handle clear quality
  const handleClearQuality = (entryId: string) => {
    setEntries(prev => prev.map(entry =>
      entry.id === entryId
        ? {
          ...entry,
          qualityId: '',
          qualityName: '',
          qualitySearch: '',
          showQualityDropdown: false,
          weaverNames: [],
          weaverNameNotFound: false
        }
        : entry
    ));
  };

  // Add new entry
  const handleAddEntry = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newEntryId = `new-${Date.now()}-${Math.random()}`;

    // Only auto-fill ONCE per session - check if we've already auto-filled
    // Get the last entry from current state before updating
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

    // Only auto-fill if:
    // 1. We haven't auto-filled before (hasAutoFilled is false)
    // 2. The last entry has a quality
    const shouldAutoFill = !hasAutoFilled && lastEntry && lastEntry.qualityId && lastEntry.qualityName;
    const qualityToCopy = shouldAutoFill
      ? { qualityId: lastEntry.qualityId, qualityName: lastEntry.qualityName }
      : null;

    // If we're auto-filling, mark the flag as true so we don't auto-fill again
    if (shouldAutoFill) {
      setHasAutoFilled(true);
    }

    // Add new entry with auto-filled quality only if conditions are met
    setEntries(prev => {
      const newEntry: GreyInfoEntry = {
        id: newEntryId,
        qualityId: qualityToCopy ? qualityToCopy.qualityId : '',
        qualityName: qualityToCopy ? qualityToCopy.qualityName : '',
        weaverNames: [],
        weaverNameNotFound: false,
        quantity: '',
        chalanNo: '',
        numberOfPieces: '',
        date: today,
        qualitySearch: qualityToCopy ? qualityToCopy.qualityName : '',
        showQualityDropdown: false
      };

      return [...prev, newEntry];
    });

    // If we have quality info, fetch weaver names asynchronously after state is set
    if (qualityToCopy) {
      // Use setTimeout to ensure state is fully updated first
      setTimeout(async () => {
        const weaverData = await fetchWeaverNames(qualityToCopy.qualityName, qualityToCopy.qualityId);
        setEntries(currentEntries =>
          currentEntries.map(entry =>
            entry.id === newEntryId
              ? {
                ...entry,
                weaverNames: weaverData.names,
                weaverNameNotFound: weaverData.notFound
              }
              : entry
          )
        );
      }, 50);
    }

    // Auto-scroll to the newly added entry after state update
    setTimeout(() => {
      const newEntryElement = document.getElementById(`entry-${newEntryId}`);
      if (newEntryElement) {
        newEntryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus on the quality input field with a delay to ensure state is ready
        const qualityInput = newEntryElement.querySelector('input[placeholder="Enter quality"]') as HTMLInputElement;
        if (qualityInput) {
          setTimeout(() => {
            qualityInput.focus();
            // Move cursor to end of input
            qualityInput.setSelectionRange(qualityInput.value.length, qualityInput.value.length);
          }, 200);
        }
      }
    }, 150);
  };

  // Remove entry immediately from UI (will be deleted from database on save)
  const handleRemoveEntry = (entryId: string) => {
    if (entries.length === 1) {
      showCustomAlert('At least one entry is required', 'info');
      return;
    }

    const entryToRemove = entries.find(e => e.id === entryId);
    if (!entryToRemove) return;

    // Check if this is an existing entry (has a database ID that's not a temp ID)
    const isExistingEntry = entryToRemove.id &&
      !entryToRemove.id.startsWith('existing-') &&
      !entryToRemove.id.startsWith('new-');

    // If it's an existing entry, track it for deletion on save
    if (isExistingEntry) {
      setDeletedEntryIds(prev => [...prev, entryId]);
    }

    // Remove from UI immediately (no confirmation, no API call)
    setEntries(prev => prev.filter(entry => entry.id !== entryId));
  };

  // Update entry field
  const updateEntry = (entryId: string, field: keyof GreyInfoEntry, value: any) => {
    setEntries(prev => prev.map(entry =>
      entry.id === entryId ? { ...entry, [field]: value } : entry
    ));
  };

  // Track recently added qualities (from qualityAdded event)
  const [recentlyAddedQualityIds, setRecentlyAddedQualityIds] = useState<Set<string>>(new Set());

  // Filter qualities - show qualities from order items AND recently added qualities
  const getFilteredQualities = (search: string) => {
    // Use localQualities if available, otherwise fallback to qualities prop
    const allQualities = localQualities.length > 0 ? localQualities : (qualities || []);

    // Get quality IDs from order items
    const orderItemQualityIds = getOrderItemQualityIds();

    console.log('🔍 Filtering qualities:', {
      totalQualities: allQualities.length,
      searchTerm: search,
      orderItemQualityIds: Array.from(orderItemQualityIds),
      recentlyAddedQualityIds: Array.from(recentlyAddedQualityIds),
      localQualitiesCount: localQualities.length,
      propQualitiesCount: qualities?.length || 0
    });

    // Filter to show qualities that are in order items OR recently added
    const filtered = allQualities.filter(q => {
      if (!q) return false;

      // Get quality ID (handle both _id and id fields)
      const qualityId = q._id || (q as any).id;
      if (!qualityId) return false;

      const qualityIdStr = String(qualityId);

      // Show if in order items OR recently added (to allow newly created qualities)
      const isInOrderItems = orderItemQualityIds.has(qualityIdStr);
      const isRecentlyAdded = recentlyAddedQualityIds.has(qualityIdStr);

      if (!isInOrderItems && !isRecentlyAdded) return false;

      // Filter by search term
      if (!search || search.trim() === '') return true; // Show all if no search
      const matchesSearch = q.name?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });

    console.log('🔍 Filtered qualities result (order items + recently added):', filtered.map(q => q.name));
    return filtered;
  };

  // Show custom confirmation modal
  const showConfirmation = (title: string, message: string, onConfirm: () => void, type: 'delete' | 'warning' = 'delete') => {
    setConfirmModalData({ title, message, onConfirm, type });
    setShowConfirmModal(true);
  };

  // Show custom alert
  const showCustomAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertData({ message, type });
    setShowAlert(true);
    setTimeout(() => {
      setShowAlert(false);
      setAlertData(null);
    }, 3000);
  };

  // Handle confirm from modal
  const handleConfirm = () => {
    if (confirmModalData?.onConfirm) {
      confirmModalData.onConfirm();
    }
    setShowConfirmModal(false);
    setConfirmModalData(null);
  };

  // Handle delete all grey information
  const handleDeleteAll = () => {
    if (!order || isSubmitting) return;

    showConfirmation(
      'Delete All Grey Information',
      'Are you sure you want to delete all grey information for this order? This action cannot be undone.',
      async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            showCustomAlert('Please login to continue', 'error');
            setLoading(false);
            return;
          }

          // Delete all grey info for this order using orderId
          const response = await fetch(`/api/grey-info?orderId=${encodeURIComponent(order.orderId)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const deletedCount = data.data?.deletedCount || 0;
              showCustomAlert(
                deletedCount > 0
                  ? `Successfully deleted ${deletedCount} entr${deletedCount > 1 ? 'ies' : 'y'}`
                  : 'All grey information deleted successfully',
                'success'
              );
              // ⚡ IMMEDIATE: Clear fetched grey info state to reflect deletion
              // This ensures the button shows "Add" immediately
              setFetchedGreyInfo([]);

              // Call onSuccess to refresh the parent component
              onSuccess();
              // Close modal after a short delay
              setTimeout(() => {
                onClose();
              }, 1500);
            } else {
              showCustomAlert(data.message || 'Failed to delete grey information', 'error');
              setLoading(false);
              setIsSubmitting(false);
            }
          } else {
            let errorMessage = 'Failed to delete grey information';
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
            } catch (e) {
              errorMessage = `HTTP ${response.status}: Failed to delete grey information`;
            }
            showCustomAlert(errorMessage, 'error');
            setLoading(false);
            setIsSubmitting(false);
          }
        } catch (error) {
          console.error('Error deleting grey information:', error);
          showCustomAlert('Failed to delete grey information', 'error');
          setLoading(false);
          setIsSubmitting(false);
        } finally {
          setLoading(false);
          setIsSubmitting(false);
        }
      },
      'delete'
    );
  };

  // ⚡ FIX: Add ref to prevent multiple simultaneous submits
  const submittingRef = useRef(false);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚡ FIX: Prevent multiple simultaneous submits
    if (submittingRef.current || loading || isSubmitting) {
      console.log('⚠️ Submit already in progress, ignoring duplicate request');
      return;
    }

    if (!order) return;

    setIsSubmitting(true);
    submittingRef.current = true;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showCustomAlert('Please login to continue', 'error');
        setLoading(false);
        return;
      }

      // ⚡ OPTIMIZED: Delete all entries in parallel
      const deletePromises = deletedEntryIds.map(entryId =>
        fetch(`/api/grey-info/${entryId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(error => {
          console.error(`Error deleting entry ${entryId}:`, error);
          return { ok: false };
        })
      );

      // Wait for all deletes to complete (but don't block on errors)
      await Promise.all(deletePromises);

      // ⚡ OPTIMIZED: Process all entries in parallel
      const entryPromises = entries.map(async (entry, i) => {
        try {
          const greyInfoData: any = {
            orderId: order.orderId
          };

          // Add optional fields only if provided
          if (entry.date && entry.date.trim && entry.date.trim() !== '') {
            greyInfoData.date = entry.date;
          } else if (entry.date && typeof entry.date === 'string' && entry.date !== '') {
            greyInfoData.date = entry.date;
          }
          if (entry.chalanNo !== undefined && entry.chalanNo !== null && entry.chalanNo.trim() !== '') {
            greyInfoData.chalanNo = entry.chalanNo.trim();
          }
          if (entry.quantity !== undefined && entry.quantity !== null && entry.quantity.trim() !== '') {
            const qtyValue = parseFloat(entry.quantity);
            if (!isNaN(qtyValue) && qtyValue >= 0) {
              greyInfoData.quantity = qtyValue;
            }
          }
          if (entry.numberOfPieces !== undefined && entry.numberOfPieces !== null && entry.numberOfPieces.trim() !== '') {
            const piecesValue = parseInt(entry.numberOfPieces);
            if (!isNaN(piecesValue) && piecesValue >= 0) {
              greyInfoData.numberOfPieces = piecesValue;
            }
          }
          if (entry.qualityId && entry.qualityId.trim() !== '') {
            greyInfoData.quality = entry.qualityId;
          }

          // ⚡ FIX: Check if entry has existing ID (update) or new (create)
          // An entry is considered existing if it has a valid MongoDB ObjectId (24 hex characters)
          // Temp IDs start with 'existing-' or 'new-', real IDs are MongoDB ObjectIds
          const isTempId = entry.id.startsWith('existing-') || entry.id.startsWith('new-');
          // ⚡ FIX: Also check if it's a valid MongoDB ObjectId (24 hex characters)
          const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(entry.id);
          const existingId = (isTempId || !isValidObjectId) ? null : entry.id;

          const response = existingId
            ? await fetch(`/api/grey-info/${existingId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(greyInfoData)
            })
            : await fetch('/api/grey-info', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(greyInfoData)
            });

          if (response.ok) {
            const responseData = await response.json();
            if (responseData.success) {
              // ⚡ FIX: Extract the saved data with _id from API response
              // API returns: { success: true, data: { greyInfo: {...} }, message: "..." }
              const savedData = responseData.data?.greyInfo || responseData.data || responseData.greyInfo || null;
              return {
                success: true,
                index: i + 1,
                data: savedData // Include saved entry data with database _id
              };
            } else {
              return {
                success: false,
                index: i + 1,
                error: responseData.message || 'Failed to save entry'
              };
            }
          } else {
            // Get error message from response
            let errorMessage = 'Unknown error';
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorData.data?.message || `HTTP ${response.status}`;
            } catch (e) {
              errorMessage = `HTTP ${response.status}: Failed to save entry`;
            }
            return { success: false, index: i + 1, error: errorMessage };
          }
        } catch (error: any) {
          return {
            success: false,
            index: i + 1,
            error: error.message || 'Network error'
          };
        }
      });

      // Wait for all entries to be processed in parallel
      const entryResults = await Promise.all(entryPromises);

      // Check results
      const failedEntries = entryResults.filter(r => !r.success);
      const successfulCount = entryResults.filter(r => r.success).length;

      if (failedEntries.length === 0) {
        // All entries saved successfully
        // Clear deleted entry IDs since they've been processed
        setDeletedEntryIds([]);
        showCustomAlert('Grey information saved successfully', 'success');

        // ⚡ FIX: Build saved entries using actual database IDs from API responses
        // ⚡ FIX: Preserve the order of entries (oldest first) when building saved entries
        const savedEntries = entryResults
          .filter(r => r.success && r.data)
          .map((result, index) => {
            const entry = entries[index];
            const savedData = result.data; // This contains the saved entry with _id from database

            // ⚡ FIX: Extract the actual database _id from the response
            // savedData is already the greyInfo object from the API response
            // API returns: { success: true, data: { greyInfo: {...} }, message: "..." }
            // We already extracted greyInfo in the response handler above
            const greyInfoData = savedData; // savedData is already the greyInfo object
            const dbId = greyInfoData._id || greyInfoData.id;

            return {
              _id: dbId || entry.id, // Use database _id if available, fallback to entry.id
              orderId: order.orderId,
              quality: entry.qualityId ? {
                _id: entry.qualityId,
                name: entry.qualityName
              } : (greyInfoData.quality || null),
              quantity: greyInfoData.quantity !== undefined ? greyInfoData.quantity : (entry.quantity ? parseFloat(entry.quantity) : undefined),
              chalanNo: greyInfoData.chalanNo || entry.chalanNo || undefined,
              numberOfPieces: greyInfoData.numberOfPieces !== undefined ? greyInfoData.numberOfPieces : (entry.numberOfPieces ? parseInt(entry.numberOfPieces) : undefined),
              date: greyInfoData.date || entry.date || undefined,
              createdAt: greyInfoData.createdAt || savedData.createdAt || new Date(),
              updatedAt: greyInfoData.updatedAt || savedData.updatedAt || new Date()
            };
          })
          .filter(e => e._id && (e.quantity || e.chalanNo || e.numberOfPieces || e.date))
          // ⚡ FIX: Sort by createdAt to ensure oldest first (maintain order)
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateA - dateB; // Ascending order (oldest first)
          });

        // ⚡ FIX: Update fetched grey info with actual database IDs immediately
        // This ensures that if the modal is reopened quickly, it has the latest data
        setFetchedGreyInfo(savedEntries);

        // ⚡ FIX: Pass saved entries immediately without delay for better UX
        // Pass saved entries data to onSuccess for immediate UI update
        onSuccess(savedEntries);

        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        // Some or all entries failed
        const failedCount = failedEntries.length;
        const totalCount = entries.length;

        let errorMessage = '';
        if (failedCount === totalCount) {
          errorMessage = `All ${totalCount} entry${totalCount > 1 ? 'ies' : ''} failed to save.`;
        } else {
          errorMessage = `${failedCount} of ${totalCount} entr${totalCount > 1 ? 'ies' : 'y'} failed to save.`;
        }

        // Add specific error details if available
        if (failedEntries.length <= 3) {
          const errorDetails = failedEntries.map(e => `Entry ${e.index}: ${e.error || 'Unknown error'}`).join('. ');
          errorMessage += ` ${errorDetails}`;
        } else {
          const firstThree = failedEntries.slice(0, 3).map(e => `Entry ${e.index}: ${e.error || 'Unknown error'}`).join('. ');
          errorMessage += ` ${firstThree} and ${failedCount - 3} more.`;
        }

        showCustomAlert(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error saving grey information:', error);
      showCustomAlert('Failed to save grey information', 'error');
    } finally {
      setLoading(false);
      submittingRef.current = false;
      setIsSubmitting(false);
    }
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

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}
          onClick={handleClose}
        ></div>

        <div ref={modalContentRef} className={`relative w-full max-w-6xl rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto ${isClosing ? 'modal-exit' : 'modal-enter'} ${isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
          {/* Loading Indicator */}
          {loadingGreyInfo && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                <div className="flex items-center space-x-3">
                  <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-500'
                    }`}></div>
                  <div className="flex flex-col">
                    <span className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                      Loading Grey Info...
                    </span>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                      Please wait while we fetch the grey information
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            }`}>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-lg font-bold ${isDarkMode
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-blue-100 text-blue-700'
                }`}>
                {getDisplayOrderId(order?.orderId) || 'N/A'}
              </span>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                Grey Info
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className={`p-1 rounded-md hover:bg-opacity-80 ${loading
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode
                    ? 'text-gray-400 hover:bg-gray-700'
                    : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <fieldset disabled={readOnly} className="space-y-6 contents">
            {/* Show message when no existing data and modal was opened expecting data (edit mode) */}
            {!loadingGreyInfo && (() => {
              const greyInfoToCheck = fetchedGreyInfo !== null ? fetchedGreyInfo : existingGreyInfo;
              return greyInfoToCheck !== undefined && (!Array.isArray(greyInfoToCheck) || greyInfoToCheck.length === 0) && entries.length === 0;
            })() && (
                <div className={`p-6 rounded-xl border-2 ${isDarkMode ? 'border-gray-600 bg-gray-700/40' : 'border-gray-300 bg-gray-50'
                  }`}>
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                      }`}>
                      <DocumentTextIcon className={`h-8 w-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                    </div>
                    <p className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      Mill input not found
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                      No grey information available for this order. Add a new entry below.
                    </p>
                  </div>
                </div>
              )}
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                id={`entry-${entry.id}`}
                className={`p-6 rounded-xl border-2 shadow-md ${isDarkMode ? 'border-gray-600 bg-gray-700/40' : 'border-gray-300 bg-gray-50'
                  }`}
              >
                {/* Entry Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b ${
                  isDarkMode ? 'border-gray-600' : 'border-gray-200'
                }">
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    Entry {index + 1}
                  </h3>
                  {!readOnly && entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(entry.id)}
                      className={`p-1 rounded-md ${isDarkMode
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-red-600 hover:bg-red-50'
                        }`}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Row 1: Quality Name and Weaver Name */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Quality Dropdown */}
                    <div>
                      <label className={`block text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Quality Name
                      </label>
                      <div className="relative" ref={el => { qualityDropdownRefs.current[entry.id] = el; }}>
                        <input
                          type="text"
                          placeholder="Enter quality"
                          disabled={readOnly}
                          value={entry.qualityName || entry.qualitySearch || ''}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            // Update both fields in a single state update to avoid race conditions
                            setEntries(prev => prev.map(ent =>
                              ent.id === entry.id
                                ? {
                                  ...ent,
                                  qualitySearch: newValue,
                                  // Clear qualityName when user types (they're searching for a new quality)
                                  qualityName: newValue === ent.qualityName ? ent.qualityName : '',
                                  qualityId: newValue === ent.qualityName ? ent.qualityId : '',
                                  showQualityDropdown: newValue.length > 0 ? true : ent.showQualityDropdown
                                }
                                : ent
                            ));
                          }}
                          onKeyDown={(e) => {
                            // Handle backspace and delete properly
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              // Allow default behavior - let onChange handle it
                              e.stopPropagation();
                            }
                            // Close dropdown on Escape
                            if (e.key === 'Escape') {
                              updateEntry(entry.id, 'showQualityDropdown', false);
                            }
                          }}
                          onFocus={async (e) => {
                            if (readOnly) return;
                            // Always show dropdown on focus
                            e.stopPropagation();
                            // ⚡ FIX: Always fetch fresh qualities when opening dropdown
                            await refreshQualitiesForDropdown();

                            // Show dropdown after fetching
                            setEntries(prev => prev.map(ent =>
                              ent.id === entry.id
                                ? { ...ent, showQualityDropdown: true }
                                : ent
                            ));
                          }}
                          onClick={async (e) => {
                            if (readOnly) return;
                            // Show dropdown when clicking on input
                            e.stopPropagation();
                            // ⚡ FIX: Always fetch fresh qualities when opening dropdown
                            await refreshQualitiesForDropdown();

                            // Show dropdown after fetching
                            setEntries(prev => prev.map(ent =>
                              ent.id === entry.id
                                ? { ...ent, showQualityDropdown: true }
                                : ent
                            ));
                          }}
                          className={`w-full px-4 py-3 pr-20 text-base rounded-lg border-2 ${isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all`}
                        />
                        {/* Clear button - shows when there's text in the field */}
                        {!readOnly && (entry.qualityName || entry.qualitySearch) && (entry.qualityName || entry.qualitySearch).trim() !== '' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleClearQuality(entry.id);
                            }}
                            onMouseDown={(e) => {
                              // Prevent input from losing focus when clicking clear
                              e.preventDefault();
                            }}
                            className={`absolute right-12 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-opacity-80 transition-colors z-20 ${isDarkMode
                              ? 'text-gray-400 hover:bg-gray-600 hover:text-white'
                              : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                              }`}
                            title="Clear quality"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        )}
                        <ChevronDownIcon className={`absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          } ${entry.showQualityDropdown ? 'rotate-180' : ''} transition-transform`} />

                        {entry.showQualityDropdown && (
                          <div className={`absolute z-50 mt-2 w-full max-h-72 overflow-auto rounded-xl border-2 shadow-xl ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                            }`}>
                            {getFilteredQualities(entry.qualitySearch).length > 0 ? (
                              getFilteredQualities(entry.qualitySearch).map((quality, qualityIndex) => {
                                // ⚡ FIX: Create unique key combining entry ID and quality ID (or index as fallback)
                                const qualityId = quality._id || (quality as any).id || `quality-${qualityIndex}`;
                                const uniqueKey = `${entry.id}-${qualityId}`;

                                // ⚡ FIX: Compare quality IDs as strings to handle different formats
                                const isSelected = String(entry.qualityId) === String(qualityId);

                                return (
                                  <button
                                    key={uniqueKey}
                                    type="button"
                                    onClick={() => handleQualitySelect(entry.id, quality)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-opacity-80 transition-colors ${isSelected
                                      ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                                      : isDarkMode ? 'hover:bg-gray-600 text-white' : 'hover:bg-gray-100 text-gray-700'
                                      }`}
                                  >
                                    {quality.name}
                                  </button>
                                );
                              })
                            ) : (
                              <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                No qualities found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Weaver Name (Read-only) */}
                    <div>
                      <label className={`block text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Weaver Name{entry.weaverNames.length > 1 ? 's' : ''}
                        {entry.weaverNames.length > 1 && (
                          <span className={`ml-2 text-sm font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            ({entry.weaverNames.length} found)
                          </span>
                        )}
                      </label>
                      <div className={`w-full px-4 py-3 text-base rounded-lg border-2 min-h-[3rem] flex items-center ${isDarkMode
                        ? 'bg-gray-700/50 border-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed'
                        }`}>
                        {entry.qualityId ? (
                          entry.weaverNameNotFound || entry.weaverNames.length === 0 ? (
                            <span className={`italic ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              Not found
                            </span>
                          ) : (
                            <span className="break-words">
                              {entry.weaverNames.join(', ')}
                            </span>
                          )
                        ) : (
                          <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Select quality first
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Quantity, Chalan Number, Number of Pieces, Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Quantity */}
                    <div>
                      <label className={`block text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Quantity
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.quantity}
                        onChange={(e) => updateEntry(entry.id, 'quantity', e.target.value)}
                        placeholder="Enter Quantity"
                        disabled={readOnly}
                        className={`w-full px-4 py-3 text-base rounded-lg border-2 ${isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all`}
                      />
                    </div>

                    {/* Chalan Number */}
                    <div>
                      <label className={`block text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Chalan Number
                      </label>
                      <input
                        type="text"
                        value={entry.chalanNo}
                        onChange={(e) => updateEntry(entry.id, 'chalanNo', e.target.value)}
                        placeholder="Enter chalan number"
                        disabled={readOnly}
                        className={`w-full px-4 py-3 text-base rounded-lg border-2 ${isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all`}
                      />
                    </div>

                    {/* Number of Pieces */}
                    <div>
                      <label className={`block text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Number of Pieces P1 (Taka)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={entry.numberOfPieces}
                        onChange={(e) => updateEntry(entry.id, 'numberOfPieces', e.target.value)}
                        placeholder="Enter number of pieces"
                        disabled={readOnly}
                        className={`w-full px-4 py-3 text-base rounded-lg border-2 ${isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all`}
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className={`block text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Date
                      </label>
                      <CustomDatePicker
                        value={entry.date}
                        onChange={(value) => updateEntry(entry.id, 'date', value)}
                        placeholder="Select date"
                        isDarkMode={isDarkMode}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Entry Button */}
            {!readOnly && (
              <button
                type="button"
                onClick={handleAddEntry}
                className={`w-full py-4 px-6 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all hover:scale-[1.02] ${isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
              >
                <PlusIcon className="h-6 w-6" />
                <span className="text-base font-semibold">Add Another Entry</span>
              </button>
            )}

            </fieldset>

            {/* Buttons */}
            <div className={`flex justify-end items-center space-x-4 pt-6 border-t sticky bottom-0 bg-inherit pb-4 mt-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
              {/* Cancel button */}
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`px-6 py-3 rounded-lg text-base font-semibold transition-all ${loading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </button>

              {/* Delete All button - transparent bg, red text, red border */}
              {!readOnly && isMaster && (() => {
                const greyInfoToCheck = fetchedGreyInfo !== null ? fetchedGreyInfo : existingGreyInfo;
                return greyInfoToCheck && Array.isArray(greyInfoToCheck) && greyInfoToCheck.length > 0;
              })() && (
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={loading}
                    className={`px-6 py-3 rounded-lg text-base font-semibold transition-all flex items-center gap-2 border-2 ${loading
                      ? 'opacity-50 cursor-not-allowed border-red-300 text-red-300'
                      : isDarkMode
                        ? 'bg-transparent border-red-500 text-red-500 hover:bg-red-500/10 hover:border-red-400'
                        : 'bg-transparent border-red-500 text-red-500 hover:bg-red-50 hover:border-red-600'
                      }`}
                  >
                    <TrashIcon className="h-5 w-5" />
                    Delete All
                  </button>
                )}

              {/* Save button */}
              {!readOnly && (
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg text-base font-semibold text-white transition-all ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                    }`}
                >
                  {loading ? 'Saving...' : 'Save All'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && confirmModalData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={() => setShowConfirmModal(false)}
            ></div>

            <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${confirmModalData.type === 'delete'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-yellow-100 dark:bg-yellow-900/30'
                    }`}>
                    <TrashIcon className={`h-6 w-6 ${confirmModalData.type === 'delete'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                      }`} />
                  </div>
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                    {confirmModalData.title}
                  </h3>
                </div>

                <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                  {confirmModalData.message}
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmModal(false);
                      setConfirmModalData(null);
                    }}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${loading
                      ? 'opacity-50 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${loading
                      ? 'opacity-50 cursor-not-allowed bg-gray-400'
                      : confirmModalData.type === 'delete'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                  >
                    {loading ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Notification */}
      {showAlert && alertData && (
        <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-5">
          <div className={`max-w-md rounded-lg shadow-xl p-4 flex items-center gap-3 ${alertData.type === 'success'
            ? isDarkMode ? 'bg-green-800 border border-green-700' : 'bg-green-50 border border-green-200'
            : alertData.type === 'error'
              ? isDarkMode ? 'bg-red-800 border border-red-700' : 'bg-red-50 border border-red-200'
              : isDarkMode ? 'bg-blue-800 border border-blue-700' : 'bg-blue-50 border border-blue-200'
            }`}>
            <div className={`flex-shrink-0 ${alertData.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : alertData.type === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-blue-600 dark:text-blue-400'
              }`}>
              {alertData.type === 'success' ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : alertData.type === 'error' ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <p className={`flex-1 font-medium ${alertData.type === 'success'
              ? isDarkMode ? 'text-green-200' : 'text-green-800'
              : alertData.type === 'error'
                ? isDarkMode ? 'text-red-200' : 'text-red-800'
                : isDarkMode ? 'text-blue-200' : 'text-blue-800'
              }`}>
              {alertData.message}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowAlert(false);
                setAlertData(null);
              }}
              className={`flex-shrink-0 ${alertData.type === 'success'
                ? 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300'
                : alertData.type === 'error'
                  ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                  : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                }`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

