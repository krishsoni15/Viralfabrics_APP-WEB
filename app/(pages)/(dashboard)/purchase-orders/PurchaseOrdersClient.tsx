'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ListBulletIcon,
  Squares2X2Icon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  InformationCircleIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  ClockIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAppStore } from '@/app/store/useAppStore';
import { generatePurchaseOrderPDF, getPurchaseOrderPDFFileName } from '@/lib/poPdfGenerator';
import { getDisplayOrderId } from '@/utils/orders';

// Company header configs
const COMPANY_HEADERS: Record<string, {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  email: string;
  website: string;
  locationUrl: string;
}> = {
  'Viral Fabrics': {
    name: 'VIRAL FABRICS',
    address: 'PLOT NO.37-38, KRISHNA IND.SOC., OPP.UMIYA RESI. BAMROLI, PANDESARA, SURAT 394210',
    phone: '094279 88999',
    gstin: '24AXYPP4119J1ZW',
    email: 'viralfabrics@yahoo.com',
    website: 'www.viralfabrics.com',
    locationUrl: 'https://maps.app.goo.gl/Q1FkRLFxuZeUbNPp6'
  },
  'Viral Enterprise': {
    name: 'VIRAL ENTERPRISE',
    address: 'Plot 37,38 , Krishna Industrial. Society, Opposite Umiya Residency ,Near Milan Point, Bamroli - Vadod Road, Bamroli, Pandesara, Surat 394210',
    phone: '+91-9427988999',
    gstin: '24AAJHV2286E1Z0',
    email: 'viralfabrics@yahoo.com',
    website: 'www.viralfabrics.com',
    locationUrl: 'https://maps.app.goo.gl/Q1FkRLFxuZeUbNPp6'
  }
};

// Types
interface PurchaseOrder {
  _id: string;
  companyHeader: string;
  poNumber: string;
  poDate: string;
  brokerName: string;
  brokerPhone: string;
  supplierName: string;
  supplierAddress: string;
  supplierGstin: string;
  quality: string;
  pcsMtr: string;
  delivery: string;
  rate: string;
  paymentTerms: string;
  specs: {
    finishGsm: string;
    greyWidth: string;
    finishWidth: string;
    weight: string;
  };
  notes: string;
  financialYear: string;
  createdBy?: { name: string; username: string };
  createdAt: string;
  updatedAt?: string;
}

interface Broker { _id: string; name: string; phone?: string; }
interface Supplier { _id: string; name: string; address?: string; gstin?: string; }

// Dynamic FY option calculator (Stops at FY 25-26 minimum, no FY 24-25)
function getCalculatedFYOptions() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const startYear = month >= 3 ? year : year - 1;

  const currentFYCode = `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
  const options: { value: string; label: string; isCurrent: boolean }[] = [];

  for (let sYr = startYear; sYr >= 2025; sYr--) {
    const eYr = sYr + 1;
    const code = `${String(sYr).slice(-2)}${String(eYr).slice(-2)}`;
    const label = `FY ${String(sYr).slice(-2)}-${String(eYr).slice(-2)}`;
    options.push({
      value: code,
      label,
      isCurrent: code === currentFYCode
    });
  }

  return options;
}

// Custom Date Picker Component matching Order Form design & user request
function CustomDatePicker({
  value,
  onChange,
  placeholder,
  isDarkMode,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDarkMode: boolean;
  disabled?: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [inputValue, setInputValue] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Format date for display (dd/mm/yyyy)
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-GB');
  };

  const parseDateFromDisplay = (displayValue: string) => {
    if (!displayValue) return '';
    const ddMmYyyyMatch = displayValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddMmYyyyMatch) {
      const [, dayStr, monthStr, yearStr] = ddMmYyyyMatch;
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

  const clearDate = () => {
    onChange('');
    setInputValue('');
    setShowCalendar(false);
  };

  useEffect(() => {
    setInputValue(formatDateForDisplay(value));
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = value.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d));
    }
  }, [value]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showCalendar) {
      setShowCalendar(false);
    } else if (e.key === 'Escape') {
      setShowCalendar(false);
    } else if (e.key === 'Tab') {
      setShowCalendar(false);
    }
  };

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
      <div
        className="relative cursor-pointer"
        onClick={() => !disabled && setShowCalendar(prev => !prev)}
      >
        <input
          ref={dateInputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            setInputValue(val);
            if (val.length >= 8) {
              const parsedDate = parseDateFromDisplay(val);
              onChange(parsedDate);
            } else {
              onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "dd/mm/yyyy"}
          onFocus={() => !disabled && setShowCalendar(true)}
          className={`w-full p-2.5 pr-10 rounded-xl border text-sm cursor-pointer ${
            isDarkMode
              ? 'bg-slate-700/60 border-slate-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          } focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {!disabled && value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearDate();
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-red-400"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          <CalendarDaysIcon className="h-4 w-4 text-gray-400 hover:text-blue-400" />
        </div>
      </div>

      {showCalendar && (
        <div
          ref={calendarRef}
          onClick={handleCalendarClick}
          className={`absolute z-[100] mt-1 p-4 rounded-xl border shadow-2xl calendar-container date-picker w-72 ${
            isDarkMode ? 'bg-[#1E293B] border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
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
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMonthPicker(!showMonthPicker);
                  setShowYearPicker(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
              >
                {monthNames[currentDate.getMonth()]}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowYearPicker(!showYearPicker);
                  setShowMonthPicker(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
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
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Month Picker Grid */}
          {showMonthPicker && (
            <div className={`mb-3 p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
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
                    }}
                    className={`p-1.5 text-xs rounded-lg font-semibold transition-all ${
                      index === currentDate.getMonth()
                        ? 'bg-blue-600 text-white shadow'
                        : isDarkMode ? 'hover:bg-slate-700 text-gray-200' : 'hover:bg-blue-50 text-gray-800'
                    }`}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Year Picker Grid */}
          {showYearPicker && (
            <div className={`mb-3 p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
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
                    }}
                    className={`p-1.5 text-xs rounded-lg font-semibold transition-all ${
                      year === currentDate.getFullYear()
                        ? 'bg-blue-600 text-white shadow'
                        : isDarkMode ? 'hover:bg-slate-700 text-gray-200' : 'hover:bg-blue-50 text-gray-800'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[11px] font-bold text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
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
                className={`p-1.5 text-xs rounded-lg font-semibold transition-all ${
                  !day ? 'invisible' :
                  day.toDateString() === new Date().toDateString()
                    ? 'bg-blue-600 text-white font-bold shadow' :
                    value === `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                      ? isDarkMode ? 'bg-blue-900/60 text-blue-300 border border-blue-500/50' : 'bg-blue-100 text-blue-800' :
                      isDarkMode ? 'text-gray-200 hover:bg-slate-700' : 'text-gray-800 hover:bg-gray-100'
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

// Reusable Responsive Pagination Component (Compact on Mobile, Numbered on Desktop)
function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  setLimit,
  setPage,
  isDarkMode,
  inputBg
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  setLimit: (limit: number) => void;
  setPage: (page: number) => void;
  isDarkMode: boolean;
  inputBg: string;
}) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  return (
    <div className={`px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border flex flex-row items-center justify-between gap-3 shadow-md ${
      isDarkMode ? 'bg-[#1E293B] border-slate-700/80 text-slate-300' : 'bg-white border-gray-200 text-slate-700'
    }`}>
      {/* Left: Range and Select Limit */}
      <div className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-semibold">
        {/* Mobile text */}
        <span className="sm:hidden">{startIdx}-{endIdx} of {total}</span>
        {/* Desktop text */}
        <span className={`hidden sm:inline font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
          Showing {startIdx} to {endIdx} of {total} orders
        </span>

        <div className="relative flex items-center">
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className={`pl-2 pr-6 py-0.5 rounded-lg border text-xs font-bold ${inputBg} appearance-none outline-none cursor-pointer`}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <ChevronDownIcon className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
        </div>
      </div>

      {/* Right: Mobile Buttons (arrow-only) */}
      <div className="flex sm:hidden items-center gap-1.5">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
            isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Previous Page"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
            isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Next Page"
        >
          <ChevronRightIcon className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Right: Desktop Buttons (Numbered standard layout) */}
      <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isDarkMode
              ? 'bg-slate-700/70 hover:bg-slate-700 text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          Previous
        </button>

        {getPageNumbers().map((p, idx) => (
          typeof p === 'number' ? (
            <button
              key={idx}
              onClick={() => setPage(p)}
              className={`min-w-[32px] h-[32px] px-2 rounded-xl text-xs font-bold transition-all ${
                page === p
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                  : isDarkMode
                    ? 'bg-slate-700/60 hover:bg-slate-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="px-1 text-xs text-gray-400 font-bold">...</span>
          )
        ))}

        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isDarkMode
              ? 'bg-slate-700/70 hover:bg-slate-700 text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'success'
    ? 'bg-emerald-500 shadow-emerald-500/20'
    : type === 'error'
      ? 'bg-red-500 shadow-red-500/20'
      : 'bg-blue-500 shadow-blue-500/20';

  return (
    <div className={`fixed top-4 right-4 z-[9999] ${bgClass} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-slide-in-right text-sm font-medium max-w-sm`}>
      {type === 'success' && <CheckIcon className="w-5 h-5 shrink-0" />}
      {type === 'error' && <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="p-1 opacity-70 hover:opacity-100 transition-opacity">
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// Table Skeleton
function TableSkeleton({ isDarkMode, limit }: { isDarkMode: boolean; limit: number }) {
  const barClass = isDarkMode ? 'bg-slate-700' : 'bg-slate-200';
  return (
    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/60' : 'divide-gray-200'}`}>
      {[...Array(limit)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-20`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-16`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-28`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-24`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-32`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-20`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-36`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-24`} /></td>
          <td className="px-4 py-4"><div className={`h-4 ${barClass} rounded w-20 mx-auto`} /></td>
        </tr>
      ))}
    </tbody>
  );
}

// Cards Skeleton
function CardsSkeleton({ isDarkMode, limit }: { isDarkMode: boolean; limit: number }) {
  const barClass = isDarkMode ? 'bg-slate-700' : 'bg-slate-200';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(limit)].map((_, i) => (
        <div key={i} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} animate-pulse space-y-3`}>
          <div className="flex justify-between items-center">
            <div className={`h-5 ${barClass} rounded w-20`} />
            <div className={`h-4 ${barClass} rounded w-16`} />
          </div>
          <div className={`h-4 ${barClass} rounded w-3/4`} />
          <div className={`h-4 ${barClass} rounded w-1/2`} />
          <div className="pt-2 flex justify-between">
            <div className={`h-4 ${barClass} rounded w-16`} />
            <div className={`h-4 ${barClass} rounded w-16`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PurchaseOrdersClient() {
  const { isDarkMode } = useDarkMode();
  const { user } = useAppStore();
  const isMaster = user?.role === 'master';

  // Responsive default view mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    const checkScreen = () => {
      const mobile = window.innerWidth < 768;
      const savedMode = localStorage.getItem('poViewMode');
      if (savedMode === 'table' || savedMode === 'cards') {
        setViewMode(savedMode);
      } else {
        setViewMode(mobile ? 'cards' : 'table');
      }
    };
    checkScreen();
    window.addEventListener('resize', checkScreen, { passive: true });
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  const handleViewModeChange = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    localStorage.setItem('poViewMode', mode);
  };

  // State
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Load saved page limit from localStorage on mount
  useEffect(() => {
    const savedLimit = localStorage.getItem('poPageLimit');
    if (savedLimit) {
      const parsed = Number(savedLimit);
      if ([10, 25, 50, 100].includes(parsed)) {
        setLimit(parsed);
      }
    }
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    localStorage.setItem('poPageLimit', String(newLimit));
  }, []);

  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Company Details Popup Modal
  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<typeof COMPANY_HEADERS[string] | null>(null);

  // Entry Audit Info Modal
  const [selectedAuditPO, setSelectedAuditPO] = useState<PurchaseOrder | null>(null);

  // Expanded Notes Tracking (ID -> boolean)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const toggleNotesExpand = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Expanded Supplier Address Tracking (ID -> boolean)
  const [expandedSupplierAddress, setExpandedSupplierAddress] = useState<Record<string, boolean>>({});

  const toggleSupplierAddressExpand = (id: string) => {
    setExpandedSupplierAddress(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Expanded Payment Terms Tracking (ID -> boolean)
  const [expandedPaymentTerms, setExpandedPaymentTerms] = useState<Record<string, boolean>>({});

  const togglePaymentTermsExpand = (id: string) => {
    setExpandedPaymentTerms(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest_first' | 'oldest_first'>('latest_first');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [companyFilter, setCompanyFilter] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const [fyFilter, setFyFilter] = useState('');
  const [showFYDropdown, setShowFYDropdown] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dynamic FY Options (FY 26-27, FY 25-26 only)
  const fyOptions = useMemo(() => getCalculatedFYOptions(), []);

  // FY Notification Alert in April
  const isAprilFYNotice = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 3 && now.getDate() <= 14;
  }, []);
  const [showFYNotice, setShowFYNotice] = useState(true);

  // PDF Preview Modal
  const [pdfPreviewPO, setPdfPreviewPO] = useState<PurchaseOrder | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Create/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Next PO Number (only relevant in Create mode)
  const [nextPONumber, setNextPONumber] = useState<string>('');
  const [loadingNextPONumber, setLoadingNextPONumber] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    companyHeader: 'Viral Fabrics' as string,
    poDate: new Date().toISOString().split('T')[0],
    brokerName: '',
    brokerPhone: '',
    supplierName: '',
    supplierAddress: '',
    supplierGstin: '',
    quality: '',
    pcsMtr: '',
    delivery: '',
    rate: '',
    paymentTerms: '',
    specs: { finishGsm: '', greyWidth: '', finishWidth: '', weight: '' },
    notes: ''
  });

  // Suggestions state & keyboard navigation
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [brokerHighlightIndex, setBrokerHighlightIndex] = useState(-1);
  const [supplierHighlightIndex, setSupplierHighlightIndex] = useState(-1);

  const brokerRef = useRef<HTMLDivElement>(null);
  const supplierRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brokerRef.current && !brokerRef.current.contains(e.target as Node)) setShowBrokerSuggestions(false);
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setShowSupplierSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auth header helper
  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  // Fetch next PO number preview on Create Mode
  useEffect(() => {
    if (showModal && !editingPO) {
      const fetchNextPONumber = async () => {
        setLoadingNextPONumber(true);
        try {
          const params = new URLSearchParams({
            companyHeader: formData.companyHeader,
            poDate: formData.poDate
          });
          const res = await fetch(`/api/purchase-orders/next-number?${params.toString()}`, {
            headers: getHeaders()
          });
          const data = await res.json();
          if (data.success && data.data?.poNumber) {
            setNextPONumber(data.data.poNumber);
          } else {
            setNextPONumber('');
          }
        } catch (error) {
          console.error('Error fetching next PO number:', error);
          setNextPONumber('');
        } finally {
          setLoadingNextPONumber(false);
        }
      };
      fetchNextPONumber();
    } else {
      setNextPONumber('');
    }
  }, [showModal, editingPO, formData.companyHeader, formData.poDate, getHeaders]);

  // Fetch purchase orders (supports silent background refresh without loading skeleton blink)
  const fetchPOs = useCallback(async (pageNum = page, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (companyFilter) params.set('companyHeader', companyFilter);
      if (fyFilter) params.set('fy', fyFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (sortOrder === 'oldest_first') params.set('sort', 'oldest_first');

      const res = await fetch(`/api/purchase-orders?${params.toString()}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPurchaseOrders(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch POs:', error);
      if (!isSilent) setToast({ message: 'Failed to load purchase orders', type: 'error' });
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [search, companyFilter, fyFilter, startDate, endDate, sortOrder, limit, page, getHeaders]);

  useEffect(() => {
    fetchPOs(page);
  }, [fetchPOs, page, limit]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/purchase-orders/suggestions', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setBrokers(data.data.brokers || []);
        setSuppliers(data.data.suppliers || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, [getHeaders]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Open create modal
  const handleCreate = useCallback(() => {
    setEditingPO(null);
    setFormData({
      companyHeader: 'Viral Fabrics',
      poDate: new Date().toISOString().split('T')[0],
      brokerName: '',
      brokerPhone: '',
      supplierName: '',
      supplierAddress: '',
      supplierGstin: '',
      quality: '',
      pcsMtr: '',
      delivery: '',
      rate: '',
      paymentTerms: '',
      specs: { finishGsm: '', greyWidth: '', finishWidth: '', weight: '' },
      notes: ''
    });
    setBrokerHighlightIndex(-1);
    setSupplierHighlightIndex(-1);
    fetchSuggestions();
    setShowModal(true);
  }, [fetchSuggestions]);

  // Open edit modal
  const handleEdit = useCallback((po: PurchaseOrder) => {
    setEditingPO(po);
    setFormData({
      companyHeader: po.companyHeader,
      poDate: po.poDate ? po.poDate.split('T')[0] : '',
      brokerName: po.brokerName || '',
      brokerPhone: po.brokerPhone || '',
      supplierName: po.supplierName || '',
      supplierAddress: po.supplierAddress || '',
      supplierGstin: po.supplierGstin || '',
      quality: po.quality || '',
      pcsMtr: po.pcsMtr || '',
      delivery: po.delivery || '',
      rate: po.rate || '',
      paymentTerms: po.paymentTerms || '',
      specs: po.specs || { finishGsm: '', greyWidth: '', finishWidth: '', weight: '' },
      notes: po.notes || ''
    });
    setBrokerHighlightIndex(-1);
    setSupplierHighlightIndex(-1);
    fetchSuggestions();
    setShowModal(true);
  }, [fetchSuggestions]);

  // Save (create or update) with Optimistic UI updates & Silent Background Refresh
  const handleSave = useCallback(async () => {
    if (!formData.companyHeader) {
      setToast({ message: 'Please select a company header', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const url = editingPO
        ? `/api/purchase-orders/${editingPO._id}`
        : '/api/purchase-orders';
      const method = editingPO ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setToast({
          message: editingPO ? 'Purchase order updated!' : `PO #${getDisplayOrderId(data.data?.poNumber) || ''} created successfully!`,
          type: 'success'
        });
        setShowModal(false);

        // Optimistic local state update for zero table reload flickering
        if (editingPO) {
          setPurchaseOrders(prev => prev.map(item => item._id === editingPO._id ? { ...item, ...data.data } : item));
        } else if (data.data) {
          setPurchaseOrders(prev => [data.data, ...prev.slice(0, limit - 1)]);
          setTotal(prev => prev + 1);
        }

        // Optimistically update local brokers suggestion array
        if (formData.brokerName.trim()) {
          setBrokers(prev => {
            const bName = formData.brokerName.trim();
            const bPhone = formData.brokerPhone.trim();
            const exists = prev.some(b => b.name.toLowerCase() === bName.toLowerCase() && b.phone?.trim() === bPhone);
            if (exists) {
              return prev.map(b => (b.name.toLowerCase() === bName.toLowerCase() && b.phone?.trim() === bPhone) ? { ...b, updatedAt: new Date().toISOString() } : b);
            }
            return [{ _id: Date.now().toString(), name: bName, phone: bPhone, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev];
          });
        }

        // Optimistically update local suppliers suggestion array
        if (formData.supplierName.trim()) {
          setSuppliers(prev => {
            const sName = formData.supplierName.trim();
            const sAddr = formData.supplierAddress.trim();
            const sGstin = formData.supplierGstin.trim().toUpperCase();
            const exists = prev.some(s => s.name.toLowerCase() === sName.toLowerCase() && s.address?.trim() === sAddr && s.gstin?.trim().toUpperCase() === sGstin);
            if (exists) {
              return prev.map(s => (s.name.toLowerCase() === sName.toLowerCase() && s.address?.trim() === sAddr && s.gstin?.trim().toUpperCase() === sGstin) ? { ...s, updatedAt: new Date().toISOString() } : s);
            }
            return [{ _id: Date.now().toString(), name: sName, address: sAddr, gstin: sGstin, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev];
          });
        }

        // Silent background refresh to keep server in sync without loading blink
        fetchPOs(page, true);
        fetchSuggestions();
      } else {
        setToast({ message: data.message || 'Failed to save', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Failed to save purchase order', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [formData, editingPO, getHeaders, fetchPOs, fetchSuggestions, page, limit]);

  // Delete with Optimistic UI update & Silent Background Refresh
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setToast({ message: data.message || 'Deleted successfully', type: 'success' });
        // Optimistic local state removal without full table skeleton reload
        setPurchaseOrders(prev => prev.filter(item => item._id !== id));
        setTotal(prev => Math.max(0, prev - 1));
        // Silent background refresh
        fetchPOs(page, true);
      } else {
        setToast({ message: data.message || 'Failed to delete', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Failed to delete', type: 'error' });
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(null);
    }
  }, [getHeaders, fetchPOs, page]);

  // Open PDF Preview Modal
  const handleOpenPdfPreview = useCallback((po: PurchaseOrder) => {
    setPdfPreviewPO(po);
    try {
      const doc = generatePurchaseOrderPDF(po);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      setToast({ message: 'Failed to preview PDF', type: 'error' });
    }
  }, []);

  // Close PDF Modal
  const handleClosePdfPreview = useCallback(() => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    setPdfBlobUrl(null);
    setPdfPreviewPO(null);
  }, [pdfBlobUrl]);

  // Download PDF file directly
  const handleDownloadPdf = useCallback((po: PurchaseOrder) => {
    try {
      const doc = generatePurchaseOrderPDF(po);
      const filename = getPurchaseOrderPDFFileName(po);
      doc.save(filename);
      setToast({ message: 'PDF downloaded successfully!', type: 'success' });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setToast({ message: 'Failed to download PDF', type: 'error' });
    }
  }, []);

  // Global Escape key listener to close any active modal or suggestion dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pdfPreviewPO) {
          handleClosePdfPreview();
        } else if (showModal) {
          if (!saving) setShowModal(false);
        } else if (selectedCompanyInfo) {
          setSelectedCompanyInfo(null);
        } else if (selectedAuditPO) {
          setSelectedAuditPO(null);
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(null);
        } else {
          setShowBrokerSuggestions(false);
          setShowSupplierSuggestions(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfPreviewPO, showModal, saving, selectedCompanyInfo, selectedAuditPO, showDeleteConfirm, handleClosePdfPreview]);

  // Filter broker suggestions
  const filteredBrokers = useMemo(() => {
    const q = formData.brokerName.trim().toLowerCase();
    if (!q) return brokers;
    return brokers.filter(b => b.name.toLowerCase().includes(q) || (b.phone && b.phone.toLowerCase().includes(q)));
  }, [formData.brokerName, brokers]);

  // Select broker suggestion
  const selectBroker = useCallback((b: Broker) => {
    setFormData(prev => ({
      ...prev,
      brokerName: b.name,
      brokerPhone: b.phone || ''
    }));
    setShowBrokerSuggestions(false);
    setBrokerHighlightIndex(-1);
  }, []);

  // Filter supplier suggestions
  const filteredSuppliers = useMemo(() => {
    const q = formData.supplierName.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.address && s.address.toLowerCase().includes(q)) || (s.gstin && s.gstin.toLowerCase().includes(q)));
  }, [formData.supplierName, suppliers]);

  // Select supplier suggestion
  const selectSupplier = useCallback((s: Supplier) => {
    setFormData(prev => ({
      ...prev,
      supplierName: s.name,
      supplierAddress: s.address || '',
      supplierGstin: s.gstin || ''
    }));
    setShowSupplierSuggestions(false);
    setSupplierHighlightIndex(-1);
  }, []);

  // Handle Broker Keyboard Navigation (ArrowUp, ArrowDown, Enter, Escape)
  const handleBrokerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showBrokerSuggestions || filteredBrokers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setBrokerHighlightIndex(prev => (prev < filteredBrokers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setBrokerHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredBrokers.length - 1));
    } else if (e.key === 'Enter') {
      if (brokerHighlightIndex >= 0 && brokerHighlightIndex < filteredBrokers.length) {
        e.preventDefault();
        selectBroker(filteredBrokers[brokerHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowBrokerSuggestions(false);
    }
  };

  // Handle Supplier Keyboard Navigation (ArrowUp, ArrowDown, Enter, Escape)
  const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSupplierSuggestions || filteredSuppliers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSupplierHighlightIndex(prev => (prev < filteredSuppliers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSupplierHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredSuppliers.length - 1));
    } else if (e.key === 'Enter') {
      if (supplierHighlightIndex >= 0 && supplierHighlightIndex < filteredSuppliers.length) {
        e.preventDefault();
        selectSupplier(filteredSuppliers[supplierHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSupplierSuggestions(false);
    }
  };

  // Format date for display
  const formatDate = (date: string) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Format date & time for audit info
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Styling classes with premium Light Mode & Dark Mode aesthetics
  const cardBg = isDarkMode ? 'bg-[#1E293B] border-slate-700/80 shadow-lg' : 'bg-white border-gray-200/90 shadow-sm';
  const inputBg = isDarkMode ? 'bg-slate-700/60 border-slate-600 text-white placeholder-gray-400' : 'bg-gray-50/80 border-gray-300 text-gray-900 placeholder-gray-400';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const hoverBg = isDarkMode ? 'hover:bg-slate-700/40' : 'hover:bg-blue-50/50';

  return (
    <div className="px-2 sm:px-4 py-3 sm:py-5 max-w-[1750px] mx-auto min-h-screen space-y-4">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* April FY Auto-Reset Notice Banner */}
      {isAprilFYNotice && showFYNotice && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-blue-200 flex items-center justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <InformationCircleIcon className="w-5 h-5 text-blue-400 shrink-0" />
            <span>
              <strong>New Financial Year FY 26-27 Active:</strong> Purchase Order numbers automatically reset to <strong>#001</strong> for new orders. Past FY orders remain preserved.
            </span>
          </div>
          <button onClick={() => setShowFYNotice(false)} className="p-1 hover:opacity-100 opacity-60">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── TOOLBAR CONTAINER ─── */}
      <div className={`p-3 sm:p-4 rounded-2xl border shadow-lg ${cardBg}`}>

        {/* ROW 1: SEARCH BAR + COMPACT CREATE BUTTON (SAME ROW ON MOBILE) */}
        <div className="flex flex-row items-center justify-between gap-2.5 mb-3.5">
          {/* Direct Search Input */}
          <div className={`relative flex-1 flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
            isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-gray-300 bg-slate-50 focus-within:bg-white text-slate-900 shadow-inner'
          }`}>
            <MagnifyingGlassIcon className={`absolute left-3 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="Search POs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-transparent outline-none ${
                isDarkMode ? 'text-white placeholder-gray-400' : 'text-slate-900 placeholder-slate-500 font-medium'
              }`}
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2.5">
                <XMarkIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </button>
            )}
          </div>

          {/* Create PO Button (Icon-only on mobile, full text on desktop) */}
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] shrink-0"
            title="Create Purchase Order"
          >
            <PlusIcon className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Create PO</span>
          </button>
        </div>

        {/* ROW 2: FILTER DROPDOWNS + VIEW SWITCHER (SINGLE ROW ON ALL SCREENS) */}
        <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-0.5 w-full">
          {/* Left: Filter dropdown pills */}
          <div className="flex flex-row items-center gap-1 sm:gap-2 shrink-0">
            {/* Sort Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className={`px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                  sortOrder === 'latest_first'
                    ? isDarkMode ? 'bg-slate-700/80 border-slate-600 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'
                    : 'bg-blue-600 text-white border-blue-600'
                }`}
              >
                <span>{sortOrder === 'latest_first' ? 'Latest' : 'Oldest'}</span>
                <ChevronDownIcon className="w-3 h-3 opacity-60" />
              </button>
              {showSortDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSortDropdown(false)} />
                  <div className={`absolute left-0 top-full mt-1 w-32 rounded-xl border shadow-xl z-40 py-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <button
                      onClick={() => { setSortOrder('latest_first'); setShowSortDropdown(false); setPage(1); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium ${hoverBg} ${sortOrder === 'latest_first' ? 'text-blue-500 font-bold' : textPrimary}`}
                    >
                      Latest
                    </button>
                    <button
                      onClick={() => { setSortOrder('oldest_first'); setShowSortDropdown(false); setPage(1); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium ${hoverBg} ${sortOrder === 'oldest_first' ? 'text-blue-500 font-bold' : textPrimary}`}
                    >
                      Oldest
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Company Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                className={`px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                  companyFilter
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isDarkMode ? 'bg-slate-700/80 border-slate-600 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'
                }`}
              >
                <span className="hidden sm:inline">{companyFilter || 'All Companies'}</span>
                <span className="sm:hidden">{companyFilter ? (companyFilter.includes('Fabrics') ? 'Fabrics' : 'Enterprise') : 'Company'}</span>
                <ChevronDownIcon className="w-3 h-3 opacity-60" />
              </button>
              {showCompanyDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowCompanyDropdown(false)} />
                  <div className={`absolute left-0 top-full mt-1 w-44 rounded-xl border shadow-xl z-40 py-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    {[
                      { value: '', label: 'All Companies' },
                      { value: 'Viral Fabrics', label: 'Viral Fabrics' },
                      { value: 'Viral Enterprise', label: 'Viral Enterprise' }
                    ].map(c => (
                      <button
                        key={c.value}
                        onClick={() => { setCompanyFilter(c.value); setShowCompanyDropdown(false); setPage(1); }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-medium ${hoverBg} ${companyFilter === c.value ? 'text-blue-500 font-bold' : textPrimary}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Financial Year Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setShowFYDropdown(!showFYDropdown)}
                className={`px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                  fyFilter
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isDarkMode ? 'bg-slate-700/80 border-slate-600 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'
                }`}
              >
                <span className="hidden sm:inline">{fyFilter === '' ? 'All Years' : `FY ${fyFilter.slice(0, 2)}-${fyFilter.slice(2, 4)}`}</span>
                <span className="sm:hidden">{fyFilter === '' ? 'Year' : `FY ${fyFilter.slice(0, 2)}-${fyFilter.slice(2, 4)}`}</span>
                <ChevronDownIcon className="w-3 h-3 opacity-60" />
              </button>

              {showFYDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowFYDropdown(false)} />
                  <div className={`absolute left-0 top-full mt-1 w-40 rounded-xl border shadow-xl z-40 py-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <button
                      onClick={() => { setFyFilter(''); setShowFYDropdown(false); setPage(1); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium ${hoverBg} ${fyFilter === '' ? 'text-blue-500 font-bold bg-blue-500/10' : textPrimary}`}
                    >
                      All Years
                    </button>
                    {fyOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setFyFilter(opt.value); setShowFYDropdown(false); setPage(1); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between ${hoverBg} ${fyFilter === opt.value ? 'text-blue-500 font-bold bg-blue-500/10' : textPrimary}`}
                      >
                        <span>{opt.label}</span>
                        {opt.isCurrent && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" title="Current Financial Year" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Clear Filters (if active) */}
            {(companyFilter || fyFilter || searchInput || sortOrder !== 'latest_first') && (
              <button
                onClick={() => {
                  setCompanyFilter('');
                  setFyFilter('');
                  setSearchInput('');
                  setSortOrder('latest_first');
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Right: Controls & View Switcher (Icon-only on mobile) */}
          <div className="flex items-center gap-1 sm:gap-1.5 justify-end shrink-0 pl-1">
            {/* View Switcher: Table / Cards */}
            <div className={`flex rounded-xl border p-0.5 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-100'}`}>
              <button
                onClick={() => handleViewModeChange('table')}
                className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow' : textSecondary}`}
                title="Table View"
              >
                <ListBulletIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => handleViewModeChange('cards')}
                className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'cards' ? 'bg-blue-600 text-white shadow' : textSecondary}`}
                title="Cards View"
              >
                <Squares2X2Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchPOs(page)}
              disabled={loading}
              title="Refresh POs"
              className={`p-1.5 sm:p-2 rounded-xl border text-xs font-semibold transition-all ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'} disabled:opacity-40`}
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── TOP PAGINATION BAR ─── */}
      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        setLimit={setLimit}
        setPage={setPage}
        isDarkMode={isDarkMode}
        inputBg={inputBg}
      />

      {/* ─── MAIN TABLE VIEW ─── */}
      {viewMode === 'table' ? (
        <div className={`rounded-2xl border overflow-hidden shadow-lg ${cardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-gray-50 border-gray-200/90 text-slate-800 font-bold'}`}>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">PO & Company</th>
                  <th className="px-3.5 py-3.5 font-bold uppercase tracking-wider text-xs">Date</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Broker</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Supplier</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Quality & Delivery</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Rate & Terms</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Specifications</th>
                  <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Notes</th>
                  <th className="px-3.5 py-3.5 text-center font-bold uppercase tracking-wider text-xs">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton isDarkMode={isDarkMode} limit={limit} />
              ) : (
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/60' : 'divide-gray-200/60'}`}>
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <ClipboardDocumentListIcon className={`w-12 h-12 mx-auto mb-3 opacity-30 ${textSecondary}`} />
                        <p className={`text-base font-semibold ${textPrimary}`}>No purchase orders found</p>
                        <p className={`text-xs mt-1 ${textSecondary}`}>Create your first purchase order using the button above.</p>
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => {
                      const isNotesExpanded = expandedNotes[po._id];
                      const hasLongNotes = (po.notes || '').length > 25;
                      const isSupplierAddrExpanded = expandedSupplierAddress[po._id];
                      const hasLongAddress = (po.supplierAddress || '').length > 22;
                      const isPaymentTermsExpanded = expandedPaymentTerms[po._id];
                      const hasLongPaymentTerms = (po.paymentTerms || '').length > 20;
                      const companyInfo = COMPANY_HEADERS[po.companyHeader] || COMPANY_HEADERS['Viral Fabrics'];

                      return (
                        <tr key={po._id} className={`${hoverBg} transition-colors`}>
                          {/* 1. PO No & Company Header */}
                          <td className="px-4 py-4">
                            <div className="font-bold text-blue-600 dark:text-blue-400 text-base">#{getDisplayOrderId(po.poNumber)}</div>
                            <button
                              onClick={() => setSelectedCompanyInfo(companyInfo)}
                              title="Click to view full company details"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 mt-1 text-xs font-bold rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm ${
                                po.companyHeader === 'Viral Fabrics'
                                  ? isDarkMode
                                    ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60 hover:bg-blue-800/60'
                                    : 'bg-blue-100 text-blue-950 border border-blue-300 font-extrabold hover:bg-blue-200 shadow-sm'
                                  : isDarkMode
                                    ? 'bg-purple-900/60 text-purple-300 border border-purple-700/60 hover:bg-purple-800/60'
                                    : 'bg-purple-100 text-purple-950 border border-purple-300 font-extrabold hover:bg-purple-200 shadow-sm'
                              }`}
                            >
                              <span>{po.companyHeader}</span>
                            </button>
                          </td>

                          {/* 2. Date + Direct Created At & Updated At Timestamps */}
                          <td className="px-3.5 py-4 whitespace-nowrap">
                            <div className={`font-bold text-sm ${textPrimary}`}>{formatDate(po.poDate)}</div>
                            {po.createdAt && (
                              <div className={`text-[11px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Created: {formatDateTime(po.createdAt)}
                              </div>
                            )}
                            {po.updatedAt && po.updatedAt !== po.createdAt && (
                              <div className={`text-[11px] font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                                Updated: {formatDateTime(po.updatedAt)}
                              </div>
                            )}
                          </td>

                          {/* 3. Broker */}
                          <td className="px-4 py-4">
                            <div className={`font-bold text-sm ${textPrimary}`}>{po.brokerName || '-'}</div>
                            {po.brokerPhone && (
                              <div className={`text-xs ${textSecondary} font-medium`}>{po.brokerPhone}</div>
                            )}
                          </td>

                          {/* 4. Supplier (Click Address to Expand/Collapse!) */}
                          <td className="px-4 py-4 max-w-[210px]">
                            <div className={`font-bold text-sm ${textPrimary}`}>{po.supplierName || '-'}</div>
                            {po.supplierAddress && (
                              <div
                                onClick={() => hasLongAddress && toggleSupplierAddressExpand(po._id)}
                                className={`text-xs ${hasLongAddress ? 'cursor-pointer' : ''} ${
                                  isSupplierAddrExpanded
                                    ? isDarkMode
                                      ? 'break-words whitespace-pre-line text-blue-300 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700 shadow-inner mt-1 font-medium'
                                      : 'break-words whitespace-pre-line text-slate-900 bg-slate-100 p-2.5 rounded-xl border border-slate-300 shadow-sm mt-1 font-semibold'
                                    : hasLongAddress
                                      ? `truncate ${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium`
                                      : `${textSecondary} font-normal`
                                }`}
                                title={hasLongAddress ? (isSupplierAddrExpanded ? 'Click address to collapse' : 'Click address to expand full address') : po.supplierAddress}
                              >
                                {isSupplierAddrExpanded ? po.supplierAddress : (hasLongAddress ? `${po.supplierAddress.slice(0, 22)}...` : po.supplierAddress)}
                              </div>
                            )}
                            {po.supplierGstin && (
                              <div className={`text-[11px] ${textMuted} font-mono font-semibold mt-0.5`}>GSTIN: {po.supplierGstin}</div>
                            )}
                          </td>

                          {/* 5. Quality & Delivery */}
                          <td className="px-4 py-4 max-w-[190px]">
                            <div className={`font-bold text-sm ${textPrimary} truncate`}>{po.quality || '-'}</div>
                            <div className={`text-xs ${textSecondary} font-medium mt-0.5`}>
                              {po.pcsMtr ? <span className="font-bold text-emerald-600 dark:text-emerald-400">{po.pcsMtr} Pcs/Mtr</span> : null}
                              {po.pcsMtr && po.delivery ? ' • ' : null}
                              {po.delivery ? <span>{po.delivery}</span> : null}
                            </div>
                          </td>

                          {/* 6. Rate & Payment Terms */}
                          <td className="px-4 py-4 max-w-[190px]">
                            <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">{po.rate ? `₹ ${po.rate}` : '-'}</div>
                            {po.paymentTerms && (
                              <div
                                onClick={() => hasLongPaymentTerms && togglePaymentTermsExpand(po._id)}
                                className={`text-xs ${hasLongPaymentTerms ? 'cursor-pointer' : ''} ${
                                  isPaymentTermsExpanded
                                    ? isDarkMode
                                      ? 'break-words whitespace-pre-line text-blue-300 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700 shadow-inner mt-1 font-medium'
                                      : 'break-words whitespace-pre-line text-slate-900 bg-slate-100 p-2.5 rounded-xl border border-slate-300 shadow-sm mt-1 font-semibold'
                                    : hasLongPaymentTerms
                                      ? `truncate ${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium`
                                      : `${textSecondary} font-medium`
                                }`}
                                title={hasLongPaymentTerms ? (isPaymentTermsExpanded ? 'Click to collapse' : 'Click to expand payment terms') : po.paymentTerms}
                              >
                                {isPaymentTermsExpanded ? po.paymentTerms : (hasLongPaymentTerms ? `${po.paymentTerms.slice(0, 20)}...` : po.paymentTerms)}
                              </div>
                            )}
                          </td>

                          {/* 7. Specifications */}
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                              {po.specs?.finishGsm && (
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg shadow-sm border transition-all ${isDarkMode ? 'bg-slate-700/80 text-slate-100 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                  GSM: {po.specs.finishGsm}
                                </span>
                              )}
                              {po.specs?.greyWidth && (
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg shadow-sm border transition-all ${isDarkMode ? 'bg-slate-700/80 text-slate-100 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                  Grey W: {po.specs.greyWidth}
                                </span>
                              )}
                              {po.specs?.finishWidth && (
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg shadow-sm border transition-all ${isDarkMode ? 'bg-slate-700/80 text-slate-100 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                  Finish W: {po.specs.finishWidth}
                                </span>
                              )}
                              {po.specs?.weight && (
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg shadow-sm border transition-all ${isDarkMode ? 'bg-slate-700/80 text-slate-100 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                  Wt: {po.specs.weight}
                                </span>
                              )}
                              {!po.specs?.finishGsm && !po.specs?.greyWidth && !po.specs?.finishWidth && !po.specs?.weight && (
                                <span className={textMuted}>-</span>
                              )}
                            </div>
                          </td>

                          {/* 8. Notes */}
                          <td className="px-4 py-4 max-w-[210px]">
                            {po.notes ? (
                              <div
                                onClick={() => hasLongNotes && toggleNotesExpand(po._id)}
                                className={`text-xs ${hasLongNotes ? 'cursor-pointer' : ''} ${
                                  isNotesExpanded
                                    ? isDarkMode
                                      ? 'break-words whitespace-pre-line text-blue-300 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700 shadow-inner'
                                      : 'break-words whitespace-pre-line text-slate-900 bg-slate-100 p-2.5 rounded-xl border border-slate-300 shadow-sm font-semibold'
                                    : hasLongNotes
                                      ? `truncate ${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium`
                                      : textSecondary
                                }`}
                                title={hasLongNotes ? (isNotesExpanded ? 'Click text to collapse' : 'Click text to expand full note') : po.notes}
                              >
                                {isNotesExpanded ? po.notes : (hasLongNotes ? `${po.notes.slice(0, 22)}...` : po.notes)}
                              </div>
                            ) : (
                              <span className={textMuted}>-</span>
                            )}
                          </td>

                          {/* 9. Actions */}
                          <td className="px-3.5 py-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenPdfPreview(po)}
                                title="Preview PDF"
                                className="p-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                              >
                                <EyeIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDownloadPdf(po)}
                                title="Download PDF"
                                className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                              >
                                <DocumentArrowDownIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleEdit(po)}
                                title="Edit PO"
                                className="p-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                              >
                                <PencilSquareIcon className="w-5 h-5" />
                              </button>
                              {isMaster && (
                                <button
                                  onClick={() => setShowDeleteConfirm(po._id)}
                                  title="Delete PO"
                                  disabled={deletingId === po._id}
                                  className="p-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                >
                                  {deletingId === po._id ? (
                                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <TrashIcon className="w-5 h-5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div>
          {loading ? (
            <CardsSkeleton isDarkMode={isDarkMode} limit={limit} />
          ) : purchaseOrders.length === 0 ? (
            <div className={`p-12 rounded-2xl border text-center ${cardBg}`}>
              <ClipboardDocumentListIcon className={`w-12 h-12 mx-auto mb-3 opacity-30 ${textSecondary}`} />
              <p className={`text-base font-semibold ${textPrimary}`}>No purchase orders found</p>
              <p className={`text-xs mt-1 ${textSecondary}`}>Create your first purchase order using the button above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {purchaseOrders.map((po) => {
                const isNotesExpanded = expandedNotes[po._id];
                const hasLongNotes = (po.notes || '').length > 25;
                const isSupplierAddrExpanded = expandedSupplierAddress[po._id];
                const hasLongAddress = (po.supplierAddress || '').length > 22;
                const isPaymentTermsExpanded = expandedPaymentTerms[po._id];
                const hasLongPaymentTerms = (po.paymentTerms || '').length > 20;
                const companyInfo = COMPANY_HEADERS[po.companyHeader] || COMPANY_HEADERS['Viral Fabrics'];

                return (
                  <div
                    key={po._id}
                    className={`p-4 rounded-2xl border shadow-md ${cardBg} hover:border-blue-500/50 transition-all space-y-3`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-blue-600 dark:text-blue-400">#{getDisplayOrderId(po.poNumber)}</span>
                          <button
                            onClick={() => setSelectedCompanyInfo(companyInfo)}
                            className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full cursor-pointer hover:scale-105 transition-all ${
                              po.companyHeader === 'Viral Fabrics'
                                ? isDarkMode
                                  ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
                                  : 'bg-blue-100 text-blue-950 border border-blue-300 font-extrabold shadow-sm'
                                : isDarkMode
                                  ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50'
                                  : 'bg-purple-100 text-purple-950 border border-purple-300 font-extrabold shadow-sm'
                            }`}
                          >
                            {po.companyHeader}
                          </button>
                        </div>
                        <p className={`text-xs ${textSecondary} flex items-center gap-1 mt-1`}>
                          <CalendarDaysIcon className="w-3.5 h-3.5" />
                          {formatDate(po.poDate)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenPdfPreview(po)} title="Preview PDF" className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDownloadPdf(po)} title="Download PDF" className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(po)} title="Edit" className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        {isMaster && (
                          <button onClick={() => setShowDeleteConfirm(po._id)} title="Delete" className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="space-y-2 text-xs">
                      {po.brokerName && (
                        <div className="flex items-center justify-between">
                          <span className={textSecondary}>Broker:</span>
                          <span className={`font-semibold ${textPrimary}`}>{po.brokerName} {po.brokerPhone ? `(${po.brokerPhone})` : ''}</span>
                        </div>
                      )}

                      {/* Supplier Stacked in Card (Click Address to Expand/Collapse) */}
                      {po.supplierName && (
                        <div className="pt-1 border-t border-gray-100 dark:border-slate-700/60">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary} block`}>Supplier Details</span>
                          <div className={`font-bold ${textPrimary} text-sm mt-0.5`}>{po.supplierName}</div>
                          {po.supplierAddress && (
                            <div
                              onClick={() => hasLongAddress && toggleSupplierAddressExpand(po._id)}
                              className={`text-xs ${hasLongAddress ? 'cursor-pointer' : ''} ${
                                isSupplierAddrExpanded
                                  ? isDarkMode
                                    ? 'break-words whitespace-pre-line text-blue-300 bg-slate-800/80 p-2 rounded-lg border border-slate-700 mt-1 font-medium'
                                    : 'break-words whitespace-pre-line text-slate-900 bg-slate-100 p-2 rounded-lg border border-slate-300 mt-1 font-semibold shadow-sm'
                                  : hasLongAddress
                                    ? `truncate ${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`
                                    : textSecondary
                              }`}
                              title={hasLongAddress ? (isSupplierAddrExpanded ? 'Click address to collapse' : 'Click address to expand full address') : po.supplierAddress}
                            >
                              {isSupplierAddrExpanded ? po.supplierAddress : (hasLongAddress ? `${po.supplierAddress.slice(0, 22)}...` : po.supplierAddress)}
                            </div>
                          )}
                          {po.supplierGstin && (
                            <div className={`text-[10px] ${textMuted} font-mono mt-0.5`}>GSTIN: {po.supplierGstin}</div>
                          )}
                        </div>
                      )}

                      {po.quality && (
                        <div className="flex items-center justify-between">
                          <span className={textSecondary}>Quality & Delivery:</span>
                          <span className={`font-semibold ${textPrimary} truncate max-w-[180px]`}>{po.quality} {po.pcsMtr ? `(${po.pcsMtr} Pcs/Mtr)` : ''}</span>
                        </div>
                      )}
                      {po.rate && (
                        <div className="pt-1 border-t border-gray-100 dark:border-slate-700/60 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className={textSecondary}>Rate & Terms:</span>
                            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">₹ {po.rate}</span>
                          </div>
                          {po.paymentTerms && (
                            <div
                              onClick={() => hasLongPaymentTerms && togglePaymentTermsExpand(po._id)}
                              className={`text-xs ${hasLongPaymentTerms ? 'cursor-pointer' : ''} ${
                                isPaymentTermsExpanded
                                  ? isDarkMode
                                    ? 'break-words whitespace-pre-line text-blue-300 bg-slate-800/80 p-2 rounded-lg border border-slate-700 mt-1 font-medium'
                                    : 'break-words whitespace-pre-line text-slate-900 bg-slate-100 p-2 rounded-lg border border-slate-300 mt-1 font-semibold shadow-sm'
                                  : hasLongPaymentTerms
                                    ? `truncate ${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`
                                    : textSecondary
                              }`}
                              title={hasLongPaymentTerms ? (isPaymentTermsExpanded ? 'Click to collapse' : 'Click to expand payment terms') : po.paymentTerms}
                            >
                              {isPaymentTermsExpanded ? po.paymentTerms : (hasLongPaymentTerms ? `${po.paymentTerms.slice(0, 20)}...` : po.paymentTerms)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Specs Grid in Card */}
                      {(po.specs?.finishGsm || po.specs?.greyWidth || po.specs?.finishWidth || po.specs?.weight) && (
                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700/60">
                          <span className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${textMuted}`}>Specifications</span>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {po.specs.finishGsm && <div className={`p-1.5 rounded-lg border text-xs font-semibold ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>GSM: {po.specs.finishGsm}</div>}
                            {po.specs.greyWidth && <div className={`p-1.5 rounded-lg border text-xs font-semibold ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>Grey W: {po.specs.greyWidth}</div>}
                            {po.specs.finishWidth && <div className={`p-1.5 rounded-lg border text-xs font-semibold ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>Finish W: {po.specs.finishWidth}</div>}
                            {po.specs.weight && <div className={`p-1.5 rounded-lg border text-xs font-semibold ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>Weight: {po.specs.weight}</div>}
                          </div>
                        </div>
                      )}

                      {/* Direct Click on Note Text to Expand/Collapse */}
                      {po.notes && (
                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700/60">
                          <span className={`text-[10px] font-bold block ${textMuted} mb-0.5`}>Notes:</span>
                          <div
                            onClick={() => hasLongNotes && toggleNotesExpand(po._id)}
                            className={`text-xs ${hasLongNotes ? 'cursor-pointer' : ''} ${
                              isNotesExpanded
                                ? isDarkMode
                                  ? 'break-words whitespace-pre-line text-blue-300 bg-slate-800/80 p-2 rounded-lg border border-slate-700 font-medium'
                                  : 'break-words whitespace-pre-line text-slate-900 bg-slate-100 p-2 rounded-lg border border-slate-300 font-semibold shadow-sm'
                                : hasLongNotes
                                  ? `truncate ${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`
                                  : textSecondary
                            }`}
                            title={hasLongNotes ? (isNotesExpanded ? 'Click to collapse' : 'Click to expand note') : po.notes}
                          >
                            {isNotesExpanded ? po.notes : (hasLongNotes ? `${po.notes.slice(0, 25)}...` : po.notes)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── BOTTOM PAGINATION BAR ─── */}
      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        setLimit={handleLimitChange}
        setPage={setPage}
        isDarkMode={isDarkMode}
        inputBg={inputBg}
      />

      {/* ─── COMPANY DETAILS MODAL CARD ─── */}
      {selectedCompanyInfo && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setSelectedCompanyInfo(null)}
        >
          <div
            className={`max-w-md w-full rounded-2xl shadow-2xl overflow-hidden p-6 border ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-slate-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-start justify-between border-b pb-4 ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                  <BuildingOffice2Icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{selectedCompanyInfo.name}</h3>
                  <p className={`text-xs font-mono font-semibold mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>GSTIN: {selectedCompanyInfo.gstin}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCompanyInfo(null)}
                className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              >
                <XMarkIcon className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <MapPinIcon className={`w-5 h-5 shrink-0 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <div>
                  <span className={`font-bold block text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Address</span>
                  <p className={`font-semibold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-900 font-bold'}`}>{selectedCompanyInfo.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <PhoneIcon className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <div>
                  <span className={`font-bold block text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Phone</span>
                  <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900 font-bold'}`}>{selectedCompanyInfo.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <EnvelopeIcon className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                <div>
                  <span className={`font-bold block text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Email</span>
                  <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900 font-bold'}`}>{selectedCompanyInfo.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <GlobeAltIcon className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                <div>
                  <span className={`font-bold block text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Website</span>
                  <a
                    href={`https://${selectedCompanyInfo.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`hover:underline font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                  >
                    {selectedCompanyInfo.website}
                  </a>
                </div>
              </div>
            </div>

            <div className={`mt-6 pt-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'} flex justify-end`}>
              <button
                onClick={() => setSelectedCompanyInfo(null)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PDF PREVIEW MODAL ─── */}
      {pdfPreviewPO && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm" onClick={handleClosePdfPreview}>
          <div
            className={`w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-all ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shadow-sm ${
              isDarkMode ? 'border-slate-700 bg-slate-800/95 text-white' : 'border-slate-200 bg-white text-slate-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${
                  pdfPreviewPO.companyHeader === 'Viral Fabrics'
                    ? isDarkMode ? 'bg-blue-900/40 border-blue-700/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
                    : isDarkMode ? 'bg-purple-900/40 border-purple-700/50 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-600'
                }`}>
                  <ClipboardDocumentListIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className={`text-base sm:text-lg font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      PO #{getDisplayOrderId(pdfPreviewPO.poNumber)} Preview
                    </h3>
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full border shadow-sm ${
                      pdfPreviewPO.companyHeader === 'Viral Fabrics'
                        ? isDarkMode
                          ? 'bg-blue-900/60 text-blue-300 border-blue-700/60'
                          : 'bg-blue-100 text-blue-950 border-blue-300 font-extrabold'
                        : isDarkMode
                          ? 'bg-purple-900/60 text-purple-300 border-purple-700/60'
                          : 'bg-purple-100 text-purple-950 border-purple-300 font-extrabold'
                    }`}>
                      {pdfPreviewPO.companyHeader}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Date: {formatDate(pdfPreviewPO.poDate)} {pdfPreviewPO.supplierName ? `• Supplier: ${pdfPreviewPO.supplierName}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownloadPdf(pdfPreviewPO)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleClosePdfPreview}
                  className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF IFrame */}
            <div className={`flex-1 p-3 sm:p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100/80'}`}>
              {pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className={`w-full h-full rounded-xl border shadow-md ${isDarkMode ? 'border-slate-800' : 'border-slate-300 bg-white'}`}
                  title={`PO-${getDisplayOrderId(pdfPreviewPO.poNumber)}-PDF`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Generating PDF preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[80] bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
          <div className={`max-w-sm w-full mx-4 p-6 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-900/30 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
              </div>
              <h3 className={`text-lg font-bold ${textPrimary}`}>Delete Purchase Order?</h3>
            </div>
            <p className={`text-xs mb-5 ${textSecondary}`}>This action cannot be undone. The purchase order will be soft deleted.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className={`px-4 py-2 text-xs font-semibold rounded-xl ${isDarkMode ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={!!deletingId}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)}>
          <div
            className={`w-full sm:max-w-2xl sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`sticky top-0 z-10 px-5 py-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl`}>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full sm:hidden" />
              <h2 className={`text-lg font-bold ${textPrimary}`}>
                {editingPO 
                  ? `Edit Purchase Order #${getDisplayOrderId(editingPO.poNumber)}` 
                  : `Create Purchase Order #${loadingNextPONumber ? '...' : (getDisplayOrderId(nextPONumber) || '...')}`
                }
              </h2>
              <button onClick={() => !saving && setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <XMarkIcon className={`w-5 h-5 ${textSecondary}`} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Company Header Selection */}
              <div>
                <label className={`text-xs font-bold ${textPrimary} block mb-2 uppercase tracking-wider`}>Company Header *</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(COMPANY_HEADERS).map(([key, val]) => (
                    <div
                      key={key}
                      onClick={() => !editingPO && setFormData({ ...formData, companyHeader: key })}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        formData.companyHeader === key
                          ? 'border-blue-500 bg-blue-500/10'
                          : isDarkMode ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300'
                      } ${editingPO ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <p className={`text-sm font-bold ${textPrimary}`}>{val.name}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCompanyInfo(val);
                          }}
                          title="View company details"
                          className="p-1 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-all shrink-0 ml-1"
                        >
                          <InformationCircleIcon className="w-5 h-5" />
                        </button>
                      </div>
                      <p className={`text-xs ${textSecondary} mt-0.5`}>GSTIN: {val.gstin}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* PO Date with Custom Calendar DatePicker */}
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>PO Date</label>
                <CustomDatePicker
                  value={formData.poDate}
                  onChange={(val) => setFormData({ ...formData, poDate: val })}
                  placeholder="dd/mm/yyyy"
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Broker Name with keyboard-navigatable floating suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative" ref={brokerRef}>
                  <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Broker Name</label>
                  <input
                    type="text"
                    value={formData.brokerName}
                    onChange={(e) => {
                      setFormData({ ...formData, brokerName: e.target.value });
                      setShowBrokerSuggestions(true);
                      setBrokerHighlightIndex(-1);
                    }}
                    onFocus={() => setShowBrokerSuggestions(true)}
                    onKeyDown={handleBrokerKeyDown}
                    placeholder="Type or press Arrow keys..."
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                  {showBrokerSuggestions && filteredBrokers.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 z-[100] rounded-xl border shadow-2xl max-h-48 overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                      {filteredBrokers.map((b, idx) => (
                        <div
                          key={b._id}
                          onClick={() => selectBroker(b)}
                          onMouseEnter={() => setBrokerHighlightIndex(idx)}
                          className={`px-3 py-2.5 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            brokerHighlightIndex === idx
                              ? 'bg-blue-600 text-white font-bold'
                              : `${hoverBg} ${textPrimary}`
                          }`}
                        >
                          <span className="font-semibold">{b.name}</span>
                          {b.phone && <span className={`text-[11px] ${brokerHighlightIndex === idx ? 'text-blue-100' : textSecondary}`}>{b.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Broker Mobile</label>
                  <input
                    type="tel"
                    value={formData.brokerPhone}
                    onChange={(e) => setFormData({ ...formData, brokerPhone: e.target.value })}
                    placeholder="Phone number"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>

              {/* Supplier Name with keyboard-navigatable floating suggestions */}
              <div className="relative" ref={supplierRef}>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Supplier Name</label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => {
                    setFormData({ ...formData, supplierName: e.target.value });
                    setShowSupplierSuggestions(true);
                    setSupplierHighlightIndex(-1);
                  }}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onKeyDown={handleSupplierKeyDown}
                  placeholder="Type or press Arrow keys..."
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                />
                {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-1 z-[100] rounded-xl border shadow-2xl max-h-52 overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                    {filteredSuppliers.map((s, idx) => (
                      <div
                        key={s._id}
                        onClick={() => selectSupplier(s)}
                        onMouseEnter={() => setSupplierHighlightIndex(idx)}
                        className={`px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                          supplierHighlightIndex === idx
                            ? 'bg-blue-600 text-white font-bold'
                            : `${hoverBg} ${textPrimary}`
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{s.name}</span>
                          {s.gstin && <span className={`text-[10px] font-mono ${supplierHighlightIndex === idx ? 'text-blue-100' : textSecondary}`}>GSTIN: {s.gstin}</span>}
                        </div>
                        {s.address && (
                          <div className={`text-[11px] truncate mt-0.5 ${supplierHighlightIndex === idx ? 'text-blue-100' : textSecondary}`}>
                            {s.address}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Supplier Address & GSTIN */}
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Supplier Address</label>
                <textarea
                  value={formData.supplierAddress}
                  onChange={(e) => setFormData({ ...formData, supplierAddress: e.target.value })}
                  rows={2}
                  placeholder="Supplier full address"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none resize-none`}
                />
              </div>
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Supplier GSTIN</label>
                <input
                  type="text"
                  value={formData.supplierGstin}
                  onChange={(e) => setFormData({ ...formData, supplierGstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 09AACFW3350K1ZY"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none font-mono`}
                />
              </div>

              {/* Quality */}
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Quality</label>
                <input
                  type="text"
                  value={formData.quality}
                  onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                  placeholder="e.g. GREY 20% RECYCLE POLY SATIN"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                />
              </div>

              {/* Pcs/Mtr & Delivery */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Pcs / Mtr</label>
                  <input
                    type="text"
                    value={formData.pcsMtr}
                    onChange={(e) => setFormData({ ...formData, pcsMtr: e.target.value })}
                    placeholder="e.g. 3606.00"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Delivery</label>
                  <input
                    type="text"
                    value={formData.delivery}
                    onChange={(e) => setFormData({ ...formData, delivery: e.target.value })}
                    placeholder="e.g. office"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>

              {/* Rate */}
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Rate</label>
                <input
                  type="text"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="e.g. 79.50 + GST"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none font-semibold`}
                />
              </div>

              {/* Payment Terms */}
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Payment Terms</label>
                <input
                  type="text"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  placeholder="e.g. 30 Days"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                />
              </div>

              {/* Specs Table */}
              <div>
                <label className={`text-xs font-bold ${textPrimary} block mb-2 uppercase tracking-wider`}>Specifications</label>
                <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                  {[
                    { key: 'finishGsm', label: 'Finish GSM' },
                    { key: 'greyWidth', label: 'Grey Width' },
                    { key: 'finishWidth', label: 'Finish Width' },
                    { key: 'weight', label: 'Weight' }
                  ].map((spec, i) => (
                    <div key={spec.key} className={`flex items-center ${i > 0 ? `border-t ${isDarkMode ? 'border-slate-600' : 'border-gray-200'}` : ''}`}>
                      <span className={`w-28 sm:w-36 px-3 py-2 text-xs font-semibold ${isDarkMode ? 'bg-slate-700/50 text-gray-300' : 'bg-gray-50 text-gray-600'} border-r ${isDarkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                        {spec.label}
                      </span>
                      <input
                        type="text"
                        value={(formData.specs as any)[spec.key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          specs: { ...formData.specs, [spec.key]: e.target.value }
                        })}
                        className={`flex-1 px-3 py-2 text-sm ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'} outline-none focus:ring-1 focus:ring-blue-500`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={`text-xs font-semibold ${textSecondary} block mb-1`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes..."
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none resize-none`}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`sticky bottom-0 px-5 py-4 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} flex justify-end gap-3 z-10`}>
              <button
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
                className={`px-5 py-2.5 text-xs font-semibold rounded-xl ${isDarkMode ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingPO ? 'Update PO' : 'Create PO'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ENTRY AUDIT DETAILS MODAL ─── */}
      {selectedAuditPO && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedAuditPO(null)}
        >
          <div
            className={`max-w-md w-full rounded-2xl shadow-2xl overflow-hidden p-6 border ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-slate-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-700 border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <ClockIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-purple-600 dark:text-purple-400">PO #{getDisplayOrderId(selectedAuditPO.poNumber)} Audit Info</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedAuditPO.companyHeader}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditPO(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 space-y-1">
                <span className="font-bold text-slate-400 block text-[11px] uppercase tracking-wider">Created By User</span>
                <p className="font-semibold text-blue-600 dark:text-blue-300">
                  {selectedAuditPO.createdBy?.name || selectedAuditPO.createdBy?.username || 'Master User'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 space-y-1">
                <span className="font-bold text-slate-400 block text-[11px] uppercase tracking-wider">Entry Created At (Date & Time)</span>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatDateTime(selectedAuditPO.createdAt)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 space-y-1">
                <span className="font-bold text-slate-400 block text-[11px] uppercase tracking-wider">Last Updated At (Date & Time)</span>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  {formatDateTime(selectedAuditPO.updatedAt || selectedAuditPO.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t dark:border-slate-700 border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedAuditPO(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-purple-500/20"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide in animation style */}
      <style jsx>{`
        @keyframes slide-in-right {
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
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
