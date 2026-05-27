import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
  style,
  ...props
}) => {
  const baseStyles = 'bg-gray-100 dark:bg-white/10';
  
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };
  
  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-[wave_1.6s_ease-in-out_0.5s_infinite]',
    none: '',
  };
  
  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        animations[animation],
        className
      )}
      style={{
        width: width || (variant === 'circular' ? height : '100%'),
        height: height || (variant === 'text' ? '1em' : '1rem'),
        ...style,
      }}
      {...props}
    />
  );
};

// Pre-built skeleton components
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className,
}) => (
  <div className={className}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={i < lines - 1 ? 'mb-2' : ''}
        style={{ width: i === lines - 1 ? '80%' : '100%' }}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-6 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5', className)}>
    <Skeleton variant="text" height="1.5rem" className="mb-4 w-3/4" />
    <SkeletonText lines={3} />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 4,
  className,
}) => (
  <div className={cn('rounded-lg border overflow-hidden bg-white dark:bg-white/5 border-gray-200 dark:border-white/10', className)}>
    {/* Header */}
    <div className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 px-6 py-3">
      <div className="flex space-x-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height="1rem" className="flex-1" />
        ))}
      </div>
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className={`px-6 py-4 border-b border-gray-200 dark:border-white/10 last:border-b-0`}>
        <div className="flex space-x-2">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="rectangular" height="1rem" className="flex-1" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

