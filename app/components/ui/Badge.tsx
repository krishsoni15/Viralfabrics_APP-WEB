import React from 'react';
import { cn } from '@/lib/utils';
import { getBadgeClasses, badgeVariants, badgeSizes } from './design-system';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
}

/**
 * Badge component for status indicators and labels
 * - Consistent styling across app
 * - Accessible with ARIA support
 * - Responsive sizing
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      children,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(getBadgeClasses(variant, size), className)}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

