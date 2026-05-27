import { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchDashboardStats } from '@/lib/serverFetch';
import DashboardClient from './DashboardClient';
import { Loading } from '@/app/components/feedback';
import { ErrorBoundary } from '@/app/components/feedback/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Dashboard | ViralFabrics',
  description: 'View order statistics, metrics, and analytics',
  openGraph: {
    title: 'Dashboard | ViralFabrics',
    description: 'View order statistics, metrics, and analytics',
    type: 'website',
  },
};

// Server Component - Fetches data on server
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; financialYear?: string }>;
}) {
  const params = await searchParams;
  
  // Fetch dashboard stats on server
  let initialStats = null;
  try {
    const statsResponse = await fetchDashboardStats({
      startDate: params.startDate,
      endDate: params.endDate,
      financialYear: params.financialYear,
    });
    
    if (statsResponse.success && statsResponse.data) {
      initialStats = statsResponse.data;
    }
  } catch (error) {
    // Error will be handled by ErrorBoundary
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch dashboard stats:', error);
    }
  }

  // ErrorBoundary is handled by error.tsx file in Next.js 15
  return (
    <Suspense fallback={<Loading type="skeleton" />}>
      <DashboardClient initialStats={initialStats} />
    </Suspense>
  );
}

