/**
 * Design System - Centralized Component Styles
 * 
 * All UI components use these base styles for consistency
 */

import { cn } from '@/lib/utils';

// ============================================================================
// BUTTON STYLES
// ============================================================================

export const buttonBaseStyles = `
  inline-flex items-center justify-center font-medium
  rounded-lg transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  active:scale-[0.98]
  min-h-[44px] min-w-[44px]
  sm:min-h-[40px] sm:min-w-[40px]
`;

export const buttonVariants = {
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
} as const;

export const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg min-h-[48px]',
} as const;

// ============================================================================
// CARD STYLES
// ============================================================================

export const cardBaseStyles = `
  rounded-lg p-4 sm:p-6 transition-colors duration-200
`;

export const cardVariants = {
  default: 'bg-white dark:bg-gray-800',
  outlined: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/50',
} as const;

// ============================================================================
// INPUT STYLES
// ============================================================================

export const inputBaseStyles = `
  w-full px-3 py-2 text-base
  border border-gray-300 dark:border-gray-600
  rounded-lg
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-white
  placeholder:text-gray-400 dark:placeholder:text-gray-500
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  sm:text-sm
  min-h-[44px] sm:min-h-[40px]
`;

export const inputErrorStyles = `
  border-red-500 focus:ring-red-500
`;

// ============================================================================
// MODAL STYLES
// ============================================================================

export const modalBackdropStyles = `
  fixed inset-0 z-50 flex items-center justify-center p-4
  bg-black/50 backdrop-blur-sm
`;

export const modalContentStyles = `
  relative bg-white dark:bg-gray-800 rounded-lg shadow-xl
  w-full max-h-[90vh] overflow-y-auto
`;

export const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
} as const;

// ============================================================================
// BADGE STYLES
// ============================================================================

export const badgeBaseStyles = `
  inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
`;

export const badgeVariants = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
} as const;

export const badgeSizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
  lg: 'px-3 py-1 text-base',
} as const;

// ============================================================================
// AVATAR STYLES
// ============================================================================

export const avatarBaseStyles = `
  inline-flex items-center justify-center
  rounded-full bg-gray-200 dark:bg-gray-700
  text-gray-600 dark:text-gray-300
  font-medium
`;

export const avatarSizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
} as const;

// ============================================================================
// LOADER STYLES
// ============================================================================

export const loaderBaseStyles = `
  animate-spin rounded-full border-b-2
`;

export const loaderSizes = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-4',
} as const;

export const loaderColors = {
  primary: 'border-blue-600',
  white: 'border-white',
  gray: 'border-gray-600',
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get button classes
 */
export function getButtonClasses(
  variant: keyof typeof buttonVariants = 'primary',
  size: keyof typeof buttonSizes = 'md',
  fullWidth = false
): string {
  return cn(
    buttonBaseStyles,
    buttonVariants[variant],
    buttonSizes[size],
    fullWidth && 'w-full'
  );
}

/**
 * Get card classes
 */
export function getCardClasses(
  variant: keyof typeof cardVariants = 'default'
): string {
  return cn(cardBaseStyles, cardVariants[variant]);
}

/**
 * Get input classes
 */
export function getInputClasses(hasError = false): string {
  return cn(inputBaseStyles, hasError && inputErrorStyles);
}

/**
 * Get badge classes
 */
export function getBadgeClasses(
  variant: keyof typeof badgeVariants = 'default',
  size: keyof typeof badgeSizes = 'md'
): string {
  return cn(badgeBaseStyles, badgeVariants[variant], badgeSizes[size]);
}

/**
 * Get avatar classes
 */
export function getAvatarClasses(
  size: keyof typeof avatarSizes = 'md'
): string {
  return cn(avatarBaseStyles, avatarSizes[size]);
}

/**
 * Get loader classes
 */
export function getLoaderClasses(
  size: keyof typeof loaderSizes = 'md',
  color: keyof typeof loaderColors = 'primary'
): string {
  return cn(loaderBaseStyles, loaderSizes[size], loaderColors[color]);
}

