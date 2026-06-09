import { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { fetchWeaversAction } from '@/app/actions/weaverActions';
import WeaverPageSkeleton from './components/WeaverPageSkeleton';
import type { Weaver, PaginationInfo } from './hooks/useWeavers';

// Lazy load client component
const WeaverClient = dynamic(() => import('./WeaverClient'), {
  loading: () => <WeaverPageSkeleton />,
  ssr: false, // Client component handles all interactions
});

export const metadata: Metadata = {
  title: 'Weaver | ViralFabrics',
  description: 'Manage weavers and fabric samples',
  openGraph: {
    title: 'Weaver | ViralFabrics',
    description: 'Manage weavers and fabric samples',
    type: 'website',
  },
};

/**
 * Server Component - Fetches initial data on server
 * Passes data to client component for UI interactions
 */
export default async function WeaverPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    page?: string; 
    limit?: string; 
    search?: string; 
    sort?: 'newest' | 'oldest' 
  }>;
}) {
  const params = await searchParams;
  
  // Fetch initial weavers data on server
  let initialWeavers: Weaver[] = [];
  let initialPagination: PaginationInfo | undefined = undefined;
  
  try {
    const result = await fetchWeaversAction({
      page: params.page ? parseInt(params.page) : 1,
      limit: params.limit ? parseInt(params.limit) : 25,
      search: params.search || '',
      sort: params.sort || 'newest',
    });
    
    if (result.success && result.data) {
      initialWeavers = result.data;
      initialPagination = result.pagination ? {
        totalCount: result.pagination.total,
        totalPages: result.pagination.pages,
        currentPage: result.pagination.page,
        hasNextPage: result.pagination.page < result.pagination.pages,
        hasPrevPage: result.pagination.page > 1
      } : undefined;
    }
  } catch (error) {
    // Error will be handled by ErrorBoundary
    const logger = (await import('@/lib/logger')).logger;
    logger.error('Failed to fetch initial weavers', error instanceof Error ? error : new Error(String(error)), {
      endpoint: 'WeaverPage',
      params: params
    });
  }

  return (
    <Suspense fallback={<WeaverPageSkeleton />}>
      <WeaverClient 
        initialWeavers={initialWeavers}
        initialPagination={initialPagination}
      />
    </Suspense>
  );
}

