'use client';

import { useState, useTransition } from 'react';

export interface UseServerActionOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseServerActionResult<TData, TVariables> {
  execute: (variables: TVariables) => Promise<TData | undefined>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useServerAction<TData, TVariables = void>(
  action: (variables: TVariables) => Promise<TData>,
  options?: UseServerActionOptions<TData>
): UseServerActionResult<TData, TVariables> {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  const execute = async (variables: TVariables): Promise<TData | undefined> => {
    return new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          setError(null);
          const result = await action(variables);
          options?.onSuccess?.(result);
          resolve(result);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error);
          options?.onError?.(error);
          reject(error);
        }
      });
    });
  };

  const reset = () => {
    setError(null);
  };

  return {
    execute,
    isPending,
    error,
    reset,
  };
}

