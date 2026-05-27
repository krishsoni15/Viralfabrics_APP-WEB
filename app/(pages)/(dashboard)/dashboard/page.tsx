import { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { fetchDashboardStatsAction } from '@/app/actions/dataActions';
import DashboardSkeleton from './components/DashboardSkeleton';

// Lazy load client component (must be in client component, not server)
const DashboardClient = dynamic(() => import('./DashboardClient'), {
  loading: () => <DashboardSkeleton />,
});

export const metadata: Metadata = {
  title: 'Dashboard | ViralFabrics',
  description: 'View order statistics, metrics, and analytics',
  openGraph: {
    title: 'Dashboard | ViralFabrics',
    description: 'View order statistics, metrics, and analytics',
    type: 'website',
  },
};

// Server Component - Fetches data on server using server action
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; financialYear?: string }>;
}) {
  const params = await searchParams;
  
  // Fetch dashboard stats on server using server action (direct DB access)
  let initialStats = null;
  try {
    const statsResult = await fetchDashboardStatsAction({
      startDate: params.startDate,
      endDate: params.endDate,
      financialYear: params.financialYear,
    });
    
    if (statsResult.success && statsResult.data) {
      initialStats = {
        ...statsResult.data,
        monthlyTrends: [],
      };
    }
  } catch (error) {
    // Error will be handled by ErrorBoundary
    // Use logger in production
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch dashboard stats:', error);
    }
  }

  // ErrorBoundary is handled by error.tsx file in Next.js 15
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient initialStats={initialStats} />
    </Suspense>
  );
}
