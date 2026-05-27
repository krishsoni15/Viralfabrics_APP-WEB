/**
 * Card Component - Unified Design System
 * 
 * Uses centralized design system for consistency
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { getCardClasses, cardBaseStyles, cardVariants } from './design-system';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  as?: 'article' | 'section' | 'div';
}

/**
 * Unified Card component using design system
 * - Semantic HTML structure
 * - Consistent styling
 * - Full accessibility support
 * - Responsive design
 */
export const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ className, variant = 'default', as: Component = 'article', children, ...props }, ref) => {
    return (
      <Component
        ref={ref as any}
        className={cn(getCardClasses(variant), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn('mb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      'text-lg sm:text-xl font-semibold text-gray-900 dark:text-white',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1',
      className
    )}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-gray-600 dark:text-gray-300', className)}
    {...props}
  />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <footer
    ref={ref}
    className={cn('mt-4 pt-4 border-t border-gray-200 dark:border-gray-700', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';
