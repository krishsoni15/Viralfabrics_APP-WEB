/**
 * Button Component - Unified Design System
 * 
 * Uses centralized design system for consistency
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { getButtonClasses, buttonBaseStyles, buttonVariants, buttonSizes } from './design-system';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  'aria-label'?: string;
  'aria-busy'?: boolean;
}

/**
 * Unified Button component using design system
 * - Consistent styling across app
 * - Full accessibility support
 * - Responsive from 320px+
 * - Optimized animations
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      fullWidth = false,
      'aria-label': ariaLabel,
      'aria-busy': ariaBusy,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const computedAriaLabel = ariaLabel || (isLoading ? 'Loading' : undefined);
    const computedAriaBusy = ariaBusy !== undefined ? ariaBusy : isLoading;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          getButtonClasses(variant, size, fullWidth),
          className
        )}
        disabled={disabled || isLoading}
        aria-label={computedAriaLabel}
        aria-busy={computedAriaBusy}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="sr-only">Loading</span>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span aria-hidden="true">Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="mr-2" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            <span>{children}</span>
            {rightIcon && (
              <span className="ml-2" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
