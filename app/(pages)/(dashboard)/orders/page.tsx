import { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import dynamicImport from 'next/dynamic';
import { fetchOrdersAction, fetchPartiesAction, fetchQualitiesAction, fetchMillsAction } from '@/app/actions/dataActions';
import { verifyToken } from '@/lib/auth';
import OrdersTableSkeleton from './components/OrdersTableSkeleton';

// Lazy load heavy client component
// Note: ssr: false removed - Next.js 15 doesn't allow it in Server Components
const OrdersClient = dynamicImport(() => import('./OrdersClient'), {
  loading: () => <OrdersTableSkeleton />,
});

export const metadata: Metadata = {
  title: 'Orders | ViralFabrics',
  description: 'Manage and track all orders',
  openGraph: {
    title: 'Orders | ViralFabrics',
    description: 'Manage and track all orders',
    type: 'website',
  },
};

// Force dynamic rendering since we use cookies and headers
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Server Component - Fetches initial data on server
 * Optimized with parallel data fetching and server actions
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    searchType?: string;
    status?: string;
    orderType?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
    millId?: string;
  }>;
}) {
  const params = await searchParams;
  
  const cookieStore = await cookies();
  const headersList = await headers();
  const authHeader = headersList.get('authorization') || cookieStore.get('auth-token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = token ? await verifyToken(token) : null;
  const isPartyUser = payload?.role === 'party';

  if (isPartyUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 shadow-md">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Orders Portal</h2>
          <p className="text-sm text-gray-650 dark:text-gray-450 mb-6 leading-relaxed">
            Your personalized order portal is under development. In the future, all your fabric orders, processing stages, and details will be tracked here.
          </p>
          <div className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/20">
            Coming Soon
          </div>
        </div>
      </div>
    );
  }

  let initialOrders: any[] = [];
  let initialParties: any[] = [];
  let initialQualities: any[] = [];
  let initialMills: any[] = [];

  try {
    if (authHeader) {
      // Fetch all data in parallel using server actions (direct DB access, no API overhead)
      const [ordersResult, partiesResult, qualitiesResult, millsResult] = await Promise.allSettled([
        fetchOrdersAction({
          limit: parseInt(params.limit || '25'),
          page: parseInt(params.page || '1'),
          search: params.search,
          searchType: params.searchType,
          status: params.status,
          orderType: params.orderType,
          startDate: params.startDate,
          endDate: params.endDate,
          sort: params.sort,
          millId: params.millId,
        }),
        fetchPartiesAction({ limit: 100 }),
        fetchQualitiesAction({ limit: 100 }),
        fetchMillsAction({ limit: 100 }),
      ]);

      if (ordersResult.status === 'fulfilled' && ordersResult.value.success) {
        initialOrders = ordersResult.value.data || [];
      }

      if (partiesResult.status === 'fulfilled' && partiesResult.value.success) {
        initialParties = partiesResult.value.data || [];
      }

      if (qualitiesResult.status === 'fulfilled' && qualitiesResult.value.success) {
        initialQualities = qualitiesResult.value.data || [];
      }

      if (millsResult.status === 'fulfilled' && millsResult.value.success) {
        initialMills = millsResult.value.data || [];
      }
    }
  } catch (error) {
    // Error will be handled by ErrorBoundary
    // Use logger in production
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Server-side data fetch error:', error);
    }
  }

  // ErrorBoundary is handled by error.tsx file in Next.js 15
  return (
    <Suspense fallback={<OrdersTableSkeleton />}>
      <OrdersClient
        initialOrders={initialOrders}
        initialParties={initialParties}
        initialQualities={initialQualities}
        initialMills={initialMills}
      />
    </Suspense>
  );
}
