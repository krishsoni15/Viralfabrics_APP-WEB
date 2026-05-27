'use client';

import React, { useState, useTransition } from 'react';
import { 
  ShoppingBagIcon, 
  ClockIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';
import MetricsCard from './components/MetricsCard';
import DashboardFilters from './components/DashboardFilters';
import PieChart from './components/PieChart';
import DeliveredSoonTable from './components/DeliveredSoonTable';
import { Loading, ErrorState, EmptyState } from '@/app/components/feedback';
import { fetchDashboardStatsAction } from '@/app/actions/dataActions';

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

/**
 * Optimized Dashboard Client Component
 * Uses server actions instead of API calls for better performance
 */
export default function DashboardClient({ initialStats }: DashboardClientProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: '',
    endDate: '',
    financialYear: 'all',
  });
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Refetch stats when filters change (using server action)
  const handleFilterChange = (newFilters: Partial<DashboardFilters> | DashboardFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);

    startTransition(async () => {
      try {
        setError(null);
        const result = await fetchDashboardStatsAction({
          startDate: updatedFilters.startDate || undefined,
          endDate: updatedFilters.endDate || undefined,
          financialYear: updatedFilters.financialYear !== 'all' ? updatedFilters.financialYear : undefined,
        });

        if (result.success && result.data) {
          setStats({
            ...result.data,
            monthlyTrends: [],
          } as DashboardStats);
        } else {
          setError(result.message || 'Failed to fetch dashboard stats');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard stats');
      }
    });
  };

  if (!mounted) {
    return <Loading type="skeleton" />;
  }

  if (error && !stats) {
    return <ErrorState error={error} onRetry={() => handleFilterChange({})} />;
  }

  // Use initial stats if available, otherwise use fetched stats
  const displayStats = stats || {
    totalOrders: 0,
    statusStats: {
      pending: 0,
      in_progress: 0,
      completed: 0,
      delivered: 0,
      cancelled: 0,
      not_set: 0,
    },
    typeStats: {
      Dying: 0,
      Printing: 0,
      not_set: 0,
    },
    pendingTypeStats: {
      Dying: 0,
      Printing: 0,
      not_set: 0,
    },
    deliveredTypeStats: {
      Dying: 0,
      Printing: 0,
      not_set: 0,
    },
    monthlyTrends: [],
    recentOrders: [],
  };

  if (displayStats.totalOrders === 0) {
    return (
      <div className="p-6">
        <DashboardFilters onFiltersChange={handleFilterChange} loading={isPending} />
        <EmptyState description="No orders found" />
      </div>
    );
  }

  return (
    <div className={`p-6 ${isDarkMode ? 'dark' : ''}`}>
      <DashboardFilters onFiltersChange={handleFilterChange} loading={isPending} />

      {isPending && (
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Updating dashboard...
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <MetricsCard
          title="Total Orders"
          value={displayStats.totalOrders}
          icon={ShoppingBagIcon as any}
          color="blue"
          trend={undefined}
        />
        <MetricsCard
          title="Pending Orders"
          value={displayStats.statusStats.pending}
          icon={ClockIcon as any}
          color="yellow"
          trend={undefined}
        />
        <MetricsCard
          title="Completed Orders"
          value={displayStats.statusStats.completed + displayStats.statusStats.delivered}
          icon={CheckCircleIcon as any}
          color="green"
          trend={undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PieChart
          title="Orders by Status"
          total={displayStats.totalOrders}
          isDarkMode={isDarkMode}
          data={[
            { name: 'Pending', value: displayStats.statusStats.pending, color: '#fbbf24' },
            { name: 'In Progress', value: displayStats.statusStats.in_progress, color: '#3b82f6' },
            { name: 'Completed', value: displayStats.statusStats.completed, color: '#10b981' },
            { name: 'Delivered', value: displayStats.statusStats.delivered, color: '#059669' },
            { name: 'Cancelled', value: displayStats.statusStats.cancelled, color: '#ef4444' },
          ]}
        />
        <PieChart
          title="Orders by Type"
          total={displayStats.typeStats.Dying + displayStats.typeStats.Printing}
          isDarkMode={isDarkMode}
          data={[
            { name: 'Dying', value: displayStats.typeStats.Dying, color: '#8b5cf6' },
            { name: 'Printing', value: displayStats.typeStats.Printing, color: '#6366f1' },
          ]}
        />
      </div>

      {/* Recent Orders Table */}
      <DeliveredSoonTable isDarkMode={isDarkMode} />
    </div>
  );
}

