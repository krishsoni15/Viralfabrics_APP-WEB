'use client';

import { ErrorState } from '@/app/components/feedback/ErrorState';
import { useEffect } from 'react';
import { logError } from '@/lib/logger';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    logError('Dashboard error', error);
  }, [error]);

  return (
    <ErrorState
      error={error}
      onRetry={reset}
      title="Failed to load dashboard"
    />
  );
}
