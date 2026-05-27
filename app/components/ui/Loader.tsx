import React from 'react';
import { cn } from '@/lib/utils';
import { getLoaderClasses, loaderSizes, loaderColors } from './design-system';

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray';
  'aria-label'?: string;
}

/**
 * Loader/Spinner component
 * - Consistent styling
 * - Multiple sizes and colors
 * - Accessible
 */
export const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(
  (
    {
      className,
      size = 'md',
      color = 'primary',
      'aria-label': ariaLabel = 'Loading',
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
        className={cn(getLoaderClasses(size, color), className)}
        {...props}
      >
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }
);

Loader.displayName = 'Loader';

