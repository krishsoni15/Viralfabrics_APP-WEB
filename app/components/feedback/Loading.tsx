'use client';

import React from 'react';
import { Skeleton, SkeletonCard, SkeletonTable } from '../ui';

export interface LoadingProps {
  type?: 'spinner' | 'skeleton' | 'card' | 'table';
  message?: string;
  rows?: number;
  cols?: number;
}

export const Loading: React.FC<LoadingProps> = ({
  type = 'spinner',
  message = 'Loading...',
  rows = 5,
  cols = 4,
}) => {
  if (type === 'spinner') {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    );
  }
  
  if (type === 'skeleton') {
    return (
      <div className="space-y-4 p-4">
        <Skeleton height="2rem" className="w-3/4" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" className="w-5/6" />
      </div>
    );
  }
  
  if (type === 'card') {
    return <SkeletonCard />;
  }
  
  if (type === 'table') {
    return <SkeletonTable rows={rows} cols={cols} />;
  }
  
  return null;
};

