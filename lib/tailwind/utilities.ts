/**
 * Tailwind Utility Classes
 * 
 * Reusable Tailwind class combinations to avoid repetition
 */

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

export const layout = {
  container: 'container mx-auto px-4 sm:px-6 lg:px-8',
  section: 'py-4 sm:py-6 lg:py-8',
  grid: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexCol: 'flex flex-col',
  flexRow: 'flex flex-row',
} as const;

// ============================================================================
// SPACING UTILITIES
// ============================================================================

export const spacing = {
  section: 'py-4 sm:py-6 lg:py-8',
  card: 'p-4 sm:p-6',
  button: 'px-4 py-2',
  input: 'px-3 py-2',
  gap: 'gap-4 sm:gap-6',
  gapSmall: 'gap-2 sm:gap-4',
} as const;

// ============================================================================
// TYPOGRAPHY UTILITIES
// ============================================================================

export const typography = {
  h1: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white',
  h2: 'text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white',
  h3: 'text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white',
  h4: 'text-base sm:text-lg font-medium text-gray-900 dark:text-white',
  body: 'text-sm sm:text-base text-gray-600 dark:text-gray-300',
  bodyLarge: 'text-base sm:text-lg text-gray-600 dark:text-gray-300',
  caption: 'text-xs sm:text-sm text-gray-500 dark:text-gray-400',
  label: 'text-sm font-medium text-gray-700 dark:text-gray-300',
} as const;

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export const colors = {
  text: {
    primary: 'text-gray-900 dark:text-white',
    secondary: 'text-gray-600 dark:text-gray-300',
    muted: 'text-gray-500 dark:text-gray-400',
    error: 'text-red-600 dark:text-red-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  },
  bg: {
    primary: 'bg-white dark:bg-gray-800',
    secondary: 'bg-gray-50 dark:bg-gray-900',
    muted: 'bg-gray-100 dark:bg-gray-700',
    error: 'bg-red-50 dark:bg-red-900/20',
    success: 'bg-green-50 dark:bg-green-900/20',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  border: {
    default: 'border-gray-200 dark:border-gray-700',
    error: 'border-red-300 dark:border-red-700',
    success: 'border-green-300 dark:border-green-700',
  },
} as const;

// ============================================================================
// INTERACTIVE UTILITIES
// ============================================================================

export const interactive = {
  focus: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  hover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  active: 'active:scale-[0.98]',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
  transition: 'transition-all duration-200',
} as const;

// ============================================================================
// SHADOW UTILITIES
// ============================================================================

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  none: 'shadow-none',
  hover: 'hover:shadow-md',
} as const;

// ============================================================================
// BORDER UTILITIES
// ============================================================================

export const borders = {
  none: 'border-0',
  sm: 'border',
  md: 'border-2',
  rounded: 'rounded-lg',
  roundedFull: 'rounded-full',
} as const;

// ============================================================================
// COMPOSITE UTILITIES
// ============================================================================

export const card = {
  base: `${layout.flexCol} ${spacing.card} ${colors.bg.primary} ${borders.rounded} ${shadows.sm} ${interactive.transition}`,
  elevated: `${layout.flexCol} ${spacing.card} ${colors.bg.primary} ${borders.rounded} ${shadows.lg}`,
  outlined: `${layout.flexCol} ${spacing.card} ${colors.bg.primary} ${borders.rounded} ${borders.sm} ${colors.border.default}`,
} as const;

const buttonBase = `${interactive.focus} ${interactive.transition} ${interactive.active} ${interactive.disabled} ${borders.rounded} font-medium`;

export const button = {
  base: buttonBase,
  primary: `${buttonBase} bg-blue-600 hover:bg-blue-700 text-white ${shadows.sm} ${shadows.hover}`,
  secondary: `${buttonBase} bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white ${shadows.sm} ${shadows.hover}`,
  danger: `${buttonBase} bg-red-600 hover:bg-red-700 text-white ${shadows.sm} ${shadows.hover}`,
  ghost: `${buttonBase} hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-800 dark:text-gray-300`,
  outline: `${buttonBase} border-2 border-gray-300 hover:bg-gray-50 text-gray-700 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-300`,
} as const;

const inputBase = `w-full ${spacing.input} ${colors.bg.primary} ${colors.text.primary} ${borders.rounded} ${borders.sm} ${colors.border.default} ${interactive.focus} ${interactive.transition} ${interactive.disabled} placeholder:${colors.text.muted}`;

export const input = {
  base: inputBase,
  error: `${inputBase} ${colors.border.error} ${colors.text.error}`,
} as const;

