import { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { cookies, headers } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { fetchDashboardStatsAction, fetchOrdersAction, fetchPartiesAction, fetchQualitiesAction, fetchMillsAction } from '@/app/actions/dataActions';
import DashboardSkeleton from './components/DashboardSkeleton';
import OrdersTableSkeleton from '../orders/components/OrdersTableSkeleton';
import PartyDashboard from './components/PartyDashboard';

// Lazy load client component (must be in client component, not server)
const DashboardClient = dynamic(() => import('./DashboardClient'), {
  loading: () => <DashboardSkeleton />,
});

const OrdersClient = dynamic(() => import('../orders/OrdersClient'), {
  loading: () => <OrdersTableSkeleton />,
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
  
  // Determine current user role from token so we can render a simplified party view
  const cookieStore = await cookies();
  const headersList = await headers();
  const authHeader = headersList.get('authorization') || cookieStore.get('auth-token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = token ? await verifyToken(token) : null;
  const isPartyUser = payload?.role === 'party';

  if (isPartyUser && payload) {
    return (
      <PartyDashboard
        user={{
          id: payload.id,
          username: payload.username,
          role: payload.role,
          name: payload.name,
          phoneNumber: payload.phoneNumber,
          address: payload.address,
        }}
      />
    );
  }

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
