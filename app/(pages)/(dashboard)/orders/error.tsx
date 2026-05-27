'use client';

import { ErrorState } from '@/app/components/feedback/ErrorState';
import { useEffect } from 'react';
import { logError } from '@/lib/logger';

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('Orders error', error);
  }, [error]);

  return (
    <ErrorState
      error={error}
      onRetry={reset}
      title="Failed to load orders"
    />
  );
}
