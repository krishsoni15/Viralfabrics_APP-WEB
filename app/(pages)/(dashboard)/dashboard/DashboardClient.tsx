'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuthSession } from '../hooks/useAuthSession';
import MetricsCard from './components/MetricsCard';
import DashboardFilters from './components/DashboardFilters';
import PieChart from './components/PieChart';
import DeliveredSoonTable from './components/DeliveredSoonTable';
import DashboardSkeleton from './components/DashboardSkeleton';
import { Loading, ErrorState, EmptyState } from '@/app/components/feedback';
import { useDataFetch } from '@/app/hooks/useDataFetch';
import { fetchDashboardStats } from '@/lib/serverFetch';
import { formatNumber } from './utils/formatNumber';

interface DashboardStats {
  totalOrders: number;
  statusStats: {
    pending: number;
    in_progress: number;
    completed: number;
    delivered: number;
    cancelled: number;
    not_set: number;
  };
  typeStats: {
    Dying: number;
    Printing: number;
    not_set: number;
  };
  pendingTypeStats: {
    Dying: number;
    Printing: number;
    not_set: number;
  };
  deliveredTypeStats: {
    Dying: number;
    Printing: number;
    not_set: number;
  };
  monthlyTrends: Array<{
    month: string;
    count: number;
  }>;
  recentOrders: any[];
}

interface DashboardFilters {
  startDate: string;
  endDate: string;
  financialYear: string;
}

interface DashboardClientProps {
  initialStats: DashboardStats | null;
}

export default function DashboardClient({ initialStats }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDarkMode, mounted } = useDarkMode();
  const { isAuthenticated, isLoading: authLoading, isSuperAdmin } = useAuthSession();

  // Initialize filters from URL params
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    return {
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      financialYear: searchParams.get('financialYear') || 'all',
    };
  });
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  // Sync filters when URL params change (only on mount or when URL changes externally)
  useEffect(() => {
    const urlStartDate = searchParams.get('startDate') || '';
    const urlEndDate = searchParams.get('endDate') || '';
    const urlFinancialYear = searchParams.get('financialYear') || 'all';

    // Only update if URL params differ from current filters (prevents infinite loop)
    if (urlStartDate !== filters.startDate || urlEndDate !== filters.endDate || urlFinancialYear !== filters.financialYear) {
      setFilters({
        startDate: urlStartDate,
        endDate: urlEndDate,
        financialYear: urlFinancialYear,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Memoize fetchFn to prevent duplicate fetches
  const fetchFn = useCallback(async () => {
    const queryParams = new URLSearchParams();
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.financialYear && filters.financialYear !== 'all') {
      queryParams.append('financialYear', filters.financialYear);
    }

    const response = await fetch(
      `/api/dashboard/stats-instant${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch dashboard stats');
    }

    return result.data;
  }, [filters.startDate, filters.endDate, filters.financialYear]);

  // Memoize cache key to prevent unnecessary refetches
  const cacheKey = useMemo(() => `dashboard-stats-${JSON.stringify(filters)}`, [filters]);

  // Only fetch if we don't have initialStats and filters haven't changed from default
  // This prevents duplicate fetches on initial load
  const shouldFetch = useMemo(() => {
    // If we have initialStats and filters are default, don't fetch
    if (initialStats &&
      !filters.startDate &&
      !filters.endDate &&
      filters.financialYear === 'all') {
      return false;
    }
    return true;
  }, [initialStats, filters.startDate, filters.endDate, filters.financialYear]);

  // Fetch dashboard data with caching - only if needed
  const { data: stats, loading, error, refetch } = useDataFetch<DashboardStats>({
    fetchFn,
    cacheKey,
    cacheTTL: 300000, // 5 minutes
    enabled: shouldFetch,
  });

  // Listen for order changes and refresh dashboard immediately
  useEffect(() => {
    const handleOrderChange = () => {
      // Clear cache and refetch when orders change
      refetch();
    };

    // Listen for custom event when orders are created/updated/deleted
    window.addEventListener('orderChanged', handleOrderChange);

    // Also listen for storage events (cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dashboardRefresh') {
        refetch();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('orderChanged', handleOrderChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refetch]);

  // Use initial stats if available, otherwise use fetched data
  const displayStats = initialStats || stats || {
    totalOrders: 0,
    statusStats: { pending: 0, in_progress: 0, completed: 0, delivered: 0, cancelled: 0, not_set: 0 },
    typeStats: { Dying: 0, Printing: 0, not_set: 0 },
    pendingTypeStats: { Dying: 0, Printing: 0, not_set: 0 },
    deliveredTypeStats: { Dying: 0, Printing: 0, not_set: 0 },
    monthlyTrends: [],
    recentOrders: [],
  };

  // Don't show loading if we have initialStats
  const isLoading = loading && !initialStats;

  const handleFiltersChange = useCallback((newFilters: DashboardFilters) => {
    setFilters(newFilters);

    // Update URL params
    const params = new URLSearchParams();
    if (newFilters.startDate) params.set('startDate', newFilters.startDate);
    if (newFilters.endDate) params.set('endDate', newFilters.endDate);
    if (newFilters.financialYear && newFilters.financialYear !== 'all') {
      params.set('financialYear', newFilters.financialYear);
    }

    const queryString = params.toString();
    router.push(queryString ? `/dashboard?${queryString}` : '/dashboard', { scroll: false });

    // Refetch will happen automatically due to cache key change
  }, [router]);

  const handleTotalOrdersClick = useCallback(() => {
    router.push('/orders');
  }, [router]);

  const handlePendingOrdersClick = useCallback(() => {
    router.push('/orders');
  }, [router]);

  const handleDeliveredOrdersClick = useCallback(() => {
    sessionStorage.setItem('ordersPageFilterToDelivered', 'true');
    sessionStorage.setItem('ordersPageFilterTime', Date.now().toString());
    router.push('/orders');
  }, [router]);

  const handlePieChartSegmentClick = useCallback((segmentName: string, chartType: 'pending' | 'delivered') => {
    // Set status filter based on chart type
    const statusFilter = chartType === 'pending' ? 'pending' : 'delivered';

    // Set type filter based on segment name
    // If segmentName is 'all', it means clicking on the card itself (not a specific segment)
    const typeFilter = segmentName === 'all'
      ? 'all'
      : segmentName === 'Dying'
        ? 'Dying'
        : segmentName === 'Printing'
          ? 'Printing'
          : 'all';

    // Clear any existing filter flags first
    sessionStorage.removeItem('ordersPageFilterToDelivered');
    sessionStorage.removeItem('ordersPageFilterStatus');
    sessionStorage.removeItem('ordersPageFilterType');
    sessionStorage.removeItem('ordersPageFilterTime');

    // Store filters in sessionStorage
    sessionStorage.setItem('ordersPageFilterStatus', statusFilter);
    sessionStorage.setItem('ordersPageFilterType', typeFilter);
    sessionStorage.setItem('ordersPageFilterTime', Date.now().toString());

    // Navigate to orders page
    router.push('/orders');
  }, [router]);

  // Backup handler — downloads a ZIP with JSON + CSV + Excel
  const handleBackup = useCallback(async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error('Backup failed');

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || 'ViralFabrics_Backup.zip';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Backup download failed:', err);
      alert('Failed to download backup. Please try again.');
    } finally {
      setBackupLoading(false);
    }
  }, []);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Show button when scrolled more than 300px or near bottom
      const isNearBottom = scrollPosition + windowHeight >= documentHeight - 100;
      setShowScrollToTop(scrollPosition > 300 || isNearBottom);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'auto' // Normal instant scroll - no smooth animation
    });
  }, []);

  // Prevent flickering by applying dark mode class immediately and synchronously
  useEffect(() => {
    if (mounted) {
      // Apply theme immediately without transition delay
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [mounted, isDarkMode]);

  // Apply theme class immediately on mount to prevent flash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initialTheme = (window as any).__INITIAL_THEME__;
      if (initialTheme !== undefined) {
        if (initialTheme) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }
  }, []);

  // Redirect to login if session is invalid (logout-all, expired, etc.)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Clear any stale data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Set flag to prevent redirect loop
      sessionStorage.setItem('fromDashboard', 'true');
      // Redirect to login
      window.location.replace('/login');
    }
  }, [authLoading, isAuthenticated]);

  if (!mounted || authLoading) {
    return <DashboardSkeleton />;
  }

  // Don't render content if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Show skeleton while loading (only if no initial stats)
  if (isLoading && !initialStats) {
    return <DashboardSkeleton />;
  }

  if (error && !initialStats) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-0 ${isDarkMode ? 'dark bg-slate-800' : 'bg-white'}`}
      suppressHydrationWarning
    >
      <div className="w-full max-w-7xl 2xl:max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-6 py-4 sm:py-6">
        {/* Filters + Backup */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
          <div className="w-full lg:flex-1">
            <DashboardFilters
              onFiltersChange={handleFiltersChange}
              loading={isLoading}
            />
          </div>

          {/* Backup Button (Superadmin Only) */}
          {isSuperAdmin && (
            <div className="flex w-full lg:w-auto justify-end sm:justify-start lg:justify-end">
              <button
                onClick={handleBackup}
                disabled={backupLoading}
                className={`w-full sm:w-auto h-[58px] sm:h-[62px] flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-semibold transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-100 border border-slate-600 shadow-black/20'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-slate-200/50'
                  }`}
              >
                {backupLoading ? (
                  <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'}`} />
                ) : (
                  <ArrowDownTrayIcon className={`h-5 w-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} strokeWidth={2} />
                )}
                <span className="tracking-wide">
                  {backupLoading ? 'Generating...' : 'Download Backup'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Main Content Layout - Cards and Pie Charts Side by Side on 2xl+ */}
        <div className="grid grid-cols-1 2xl:grid-cols-[0.45fr_1.55fr] gap-6 2xl:gap-8 mb-6 sm:mb-8">
          {/* Left Side - Metrics Cards (stacked vertically in different rows on 2xl+) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1 gap-4 sm:gap-6 2xl:gap-4">
            <MetricsCard
              title="Total Orders"
              value={formatNumber(displayStats.totalOrders)}
              icon={ShoppingBagIcon}
              color="blue"
              subtitle="All time orders"
              onClick={handleTotalOrdersClick}
            />
            <MetricsCard
              title="Pending Orders"
              value={formatNumber((displayStats.statusStats?.pending || 0) + (displayStats.statusStats?.not_set || 0))}
              icon={ClockIcon}
              color="yellow"
              subtitle="Awaiting processing"
              onClick={handlePendingOrdersClick}
            />
            <MetricsCard
              title="Delivered Orders"
              value={formatNumber((displayStats.statusStats?.completed || 0) + (displayStats.statusStats?.delivered || 0))}
              icon={CheckCircleIcon}
              color="green"
              subtitle="Successfully delivered"
              onClick={handleDeliveredOrdersClick}
            />
          </div>

          {/* Right Side - Pie Charts (2 side by side on 2xl+) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6 2xl:gap-4">
            <PieChart
              data={[
                {
                  name: 'Dying',
                  value: displayStats.pendingTypeStats?.Dying || 0,
                  color: '#F97316',
                },
                {
                  name: 'Printing',
                  value: displayStats.pendingTypeStats?.Printing || 0,
                  color: '#3B82F6',
                },
                {
                  name: 'Not Set',
                  value: displayStats.pendingTypeStats?.not_set || 0,
                  color: '#6B7280',
                },
              ]}
              title="Pending Orders by Type"
              icon={ClockIcon}
              total={
                (displayStats.pendingTypeStats?.Dying || 0) +
                (displayStats.pendingTypeStats?.Printing || 0) +
                (displayStats.pendingTypeStats?.not_set || 0)
              }
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              onSegmentClick={handlePieChartSegmentClick}
              chartType="pending"
            />
            <PieChart
              data={[
                {
                  name: 'Dying',
                  value: displayStats.deliveredTypeStats?.Dying || 0,
                  color: '#F97316',
                },
                {
                  name: 'Printing',
                  value: displayStats.deliveredTypeStats?.Printing || 0,
                  color: '#3B82F6',
                },
                {
                  name: 'Not Set',
                  value: displayStats.deliveredTypeStats?.not_set || 0,
                  color: '#6B7280',
                },
              ]}
              title="Delivered Orders by Type"
              icon={CheckCircleIcon}
              total={
                (displayStats.deliveredTypeStats?.Dying || 0) +
                (displayStats.deliveredTypeStats?.Printing || 0) +
                (displayStats.deliveredTypeStats?.not_set || 0)
              }
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              onSegmentClick={handlePieChartSegmentClick}
              chartType="delivered"
            />
          </div>
        </div>

        {/* Delivered Soon Table */}
        <div className="mb-6 sm:mb-8">
          <DeliveredSoonTable isDarkMode={isDarkMode} />
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-40 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 scroll-to-top-btn ${isDarkMode
            ? 'bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-sm border border-blue-500/30'
            : 'bg-white hover:bg-gray-50 text-blue-600 backdrop-blur-sm border-2 border-blue-500 shadow-xl'
            }`}
          aria-label="Scroll to top"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

