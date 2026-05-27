import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  'aria-label'?: string;
}

/**
 * Accessible Skeleton component
 * - Screen reader friendly
 * - Optimized animations
 * - Responsive sizing
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
  'aria-label': ariaLabel = 'Loading content',
  style,
  ...props
}) => {
  const baseStyles = `
    bg-gray-200 dark:bg-gray-700
    animate-pulse
    rounded
  `;
  
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };
  
  const animations = {
    pulse: 'animate-pulse',
    wave: 'skeleton-shimmer',
    none: '',
  };
  
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn(
        baseStyles,
        variants[variant],
        animations[animation],
        className
      )}
      style={{
        width: width || (variant === 'circular' ? height : '100%'),
        height: height || (variant === 'text' ? '1em' : '1rem'),
        minWidth: variant === 'text' ? '60px' : undefined,
        ...style,
      }}
      {...props}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};

// Pre-built skeleton components
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  'aria-label'?: string;
}> = ({
  lines = 1,
  className,
  'aria-label': ariaLabel = 'Loading text',
}) => (
  <div className={className} role="status" aria-label={ariaLabel} aria-live="polite">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={i < lines - 1 ? 'mb-2' : ''}
        style={{ width: i === lines - 1 ? '80%' : '100%' }}
        aria-label={`${ariaLabel} line ${i + 1}`}
      />
    ))}
    <span className="sr-only">{ariaLabel}</span>
  </div>
);

export const SkeletonCard: React.FC<{
  className?: string;
  'aria-label'?: string;
}> = ({ className, 'aria-label': ariaLabel = 'Loading card' }) => (
  <article
    className={cn(
      'p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-gray-700',
      className
    )}
    role="status"
    aria-label={ariaLabel}
    aria-live="polite"
  >
    <Skeleton variant="text" height="1.5rem" className="mb-4 w-3/4" />
    <SkeletonText lines={3} aria-label={`${ariaLabel} content`} />
    <span className="sr-only">{ariaLabel}</span>
  </article>
);

export const SkeletonTable: React.FC<{
  rows?: number;
  cols?: number;
  className?: string;
  'aria-label'?: string;
}> = ({
  rows = 5,
  cols = 4,
  className,
  'aria-label': ariaLabel = 'Loading table',
}) => (
  <div
    className={cn('space-y-2', className)}
    role="status"
    aria-label={ariaLabel}
    aria-live="polite"
  >
    <span className="sr-only">{ariaLabel}</span>
    {/* Header */}
    <div className="flex space-x-2" role="row">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          height="2rem"
          className="flex-1"
          aria-label={`${ariaLabel} header column ${i + 1}`}
        />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-2" role="row">
        {Array.from({ length: cols }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            variant="rectangular"
            height="3rem"
            className="flex-1"
            aria-label={`${ariaLabel} row ${rowIndex + 1} column ${colIndex + 1}`}
          />
        ))}
      </div>
    ))}
  </div>
);

