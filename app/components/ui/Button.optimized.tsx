import React from 'react';
import { cn } from '@/lib/utils';

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
 * Accessible, semantic Button component
 * - Full keyboard navigation support
 * - WCAG AA compliant focus states
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
    const baseStyles = `
      inline-flex items-center justify-center font-medium
      rounded-lg transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      active:scale-[0.98]
      min-h-[44px] min-w-[44px]
      sm:min-h-[40px] sm:min-w-[40px]
    `;
    
    const variants = {
      primary: `
        bg-blue-600 hover:bg-blue-700 active:bg-blue-800
        text-white
        focus:ring-blue-500 focus:ring-offset-white
        dark:focus:ring-offset-gray-800
        shadow-sm hover:shadow-md
      `,
      secondary: `
        bg-gray-200 hover:bg-gray-300 active:bg-gray-400
        text-gray-900
        focus:ring-gray-500 focus:ring-offset-white
        dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500
        dark:text-white dark:focus:ring-offset-gray-800
        shadow-sm hover:shadow-md
      `,
      danger: `
        bg-red-600 hover:bg-red-700 active:bg-red-800
        text-white
        focus:ring-red-500 focus:ring-offset-white
        dark:focus:ring-offset-gray-800
        shadow-sm hover:shadow-md
      `,
      ghost: `
        hover:bg-gray-100 active:bg-gray-200
        text-gray-700
        focus:ring-gray-500 focus:ring-offset-white
        dark:hover:bg-gray-800 dark:active:bg-gray-700
        dark:text-gray-300 dark:focus:ring-offset-gray-800
      `,
      outline: `
        border-2 border-gray-300 hover:bg-gray-50 active:bg-gray-100
        text-gray-700
        focus:ring-gray-500 focus:ring-offset-white
        dark:border-gray-600 dark:hover:bg-gray-800 dark:active:bg-gray-700
        dark:text-gray-300 dark:focus:ring-offset-gray-800
      `,
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm min-h-[36px]',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg min-h-[48px]',
    };

    const computedAriaLabel = ariaLabel || (isLoading ? 'Loading' : undefined);
    const computedAriaBusy = ariaBusy !== undefined ? ariaBusy : isLoading;
    
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
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

