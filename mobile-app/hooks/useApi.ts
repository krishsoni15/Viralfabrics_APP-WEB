import { useCallback } from 'react';
import { useQuery, useMutation, useInfiniteQuery, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';

/**
 * Generic API hooks built on React Query
 */

// Simple GET query
export function useApiQuery<T = any>(
  key: string[],
  url: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get<T>(url);
      return data;
    },
    ...options,
  });
}

// GET with params
export function useApiQueryWithParams<T = any>(
  key: (string | number | boolean | undefined | null)[],
  url: string,
  params?: Record<string, any>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get<T>(url, { params });
      return data;
    },
    ...options,
  });
}

// Infinite scroll query
export function useApiInfiniteQuery<T = any>(
  key: (string | number | boolean | undefined | null)[],
  url: string,
  params?: Record<string, any>,
  pageSize = 20
) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<T>(url, {
        params: { ...params, page: pageParam, limit: pageSize },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any, allPages) => {
      if (!lastPage) return undefined;
      const total = lastPage.total || lastPage.totalPages * pageSize;
      const loaded = allPages.length * pageSize;
      return loaded < total ? allPages.length + 1 : undefined;
    },
  });
}

// POST mutation
export function useApiMutation<TData = any, TVariables = any>(
  url: string,
  method: 'post' | 'put' | 'delete' = 'post',
  options?: UseMutationOptions<TData, Error, TVariables>
) {
  const addToast = useAppStore((s) => s.addToast);

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const { data } = await api[method]<TData>(url, variables);
      return data;
    },
    ...options,
  });
}
