import { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import OrdersClient from './OrdersClient';
import { fetchOrders, fetchParties, fetchQualities, fetchMills } from '@/lib/serverFetch';
import { Loading } from '@/app/components/feedback';
import { ErrorBoundary } from '@/app/components/feedback';

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

// Server Component - Fetches initial data
export default async function OrdersPage() {
  let initialOrders: any[] = [];
  let initialParties: any[] = [];
  let initialQualities: any[] = [];
  let initialMills: any[] = [];

  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const authHeader = headersList.get('authorization') || cookieStore.get('token')?.value;
    
    if (authHeader) {
      // Fetch initial data in parallel with error handling
      const [ordersResponse, partiesResponse, qualitiesResponse, millsResponse] = await Promise.allSettled([
        fetchOrders({ status: 'pending', limit: 10, page: 1 }),
        fetchParties({ limit: 50, page: 1 }),
        fetchQualities({ limit: 50, page: 1 }),
        fetchMills({ limit: 50, page: 1 }),
      ]);

      if (ordersResponse.status === 'fulfilled' && ordersResponse.value.success) {
        initialOrders = ordersResponse.value.data || [];
      }

      if (partiesResponse.status === 'fulfilled' && partiesResponse.value.success) {
        initialParties = partiesResponse.value.data || [];
      }

      if (qualitiesResponse.status === 'fulfilled' && qualitiesResponse.value.success) {
        initialQualities = qualitiesResponse.value.data || [];
      }

      if (millsResponse.status === 'fulfilled' && millsResponse.value.success) {
        initialMills = millsResponse.value.data || [];
      }
    }
  } catch (error) {
    // Error will be handled by ErrorBoundary
    console.error('Server-side data fetch error:', error);
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading type="table" rows={10} cols={8} />}>
        <OrdersClient
          initialOrders={initialOrders}
          initialParties={initialParties}
          initialQualities={initialQualities}
          initialMills={initialMills}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

