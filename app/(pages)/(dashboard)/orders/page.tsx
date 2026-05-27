import { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import dynamicImport from 'next/dynamic';
import { fetchOrdersAction, fetchPartiesAction, fetchQualitiesAction, fetchMillsAction } from '@/app/actions/dataActions';
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
  
  let initialOrders: any[] = [];
  let initialParties: any[] = [];
  let initialQualities: any[] = [];
  let initialMills: any[] = [];

  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const authHeader = headersList.get('authorization') || cookieStore.get('auth-token')?.value;
    
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
