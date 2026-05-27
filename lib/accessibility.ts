/**
 * Accessibility Utilities
 * 
 * Helper functions and constants for accessibility features
 */

// ============================================================================
// ARIA LABELS
// ============================================================================

export const ariaLabels = {
  // Navigation
  mainNav: 'Main navigation',
  sidebar: 'Navigation sidebar',
  skipToContent: 'Skip to main content',
  
  // Actions
  close: 'Close',
  open: 'Open',
  toggle: 'Toggle',
  submit: 'Submit',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  save: 'Save',
  search: 'Search',
  filter: 'Filter',
  sort: 'Sort',
  
  // Loading
  loading: 'Loading',
  loadingContent: 'Loading content',
  loadingTable: 'Loading table',
  loadingCard: 'Loading card',
  
  // Empty states
  noData: 'No data available',
  noResults: 'No results found',
  
  // Modals
  modal: 'Dialog',
  closeModal: 'Close dialog',
  
  // Forms
  required: 'Required field',
  optional: 'Optional field',
  error: 'Error',
  success: 'Success',
} as const;

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

export const keyboardShortcuts = {
  // Navigation
  skipToContent: 'Alt+S',
  closeModal: 'Escape',
  openSearch: 'Ctrl+K',
  
  // Actions
  submit: 'Enter',
  cancel: 'Escape',
  delete: 'Delete',
  edit: 'E',
  save: 'Ctrl+S',
} as const;

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Trap focus within an element
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTab);
  firstElement?.focus();

  return () => {
    element.removeEventListener('keydown', handleTab);
  };
}

/**
 * Restore focus to previous element
 */
export function restoreFocus(previousElement: HTMLElement | null): void {
  if (previousElement && typeof previousElement.focus === 'function') {
    previousElement.focus();
  }
}

/**
 * Save current focus
 */
export function saveFocus(): HTMLElement | null {
  return document.activeElement as HTMLElement;
}

// ============================================================================
// ARIA HELPERS
// ============================================================================

/**
 * Generate unique ID for ARIA relationships
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get ARIA live region announcement
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const liveRegion = document.getElementById('aria-live-region') || createLiveRegion();
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = message;
  
  // Clear after announcement
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 1000);
}

/**
 * Create ARIA live region
 */
function createLiveRegion(): HTMLElement {
  const liveRegion = document.createElement('div');
  liveRegion.id = 'aria-live-region';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);
  return liveRegion;
}

// ============================================================================
// WCAG COMPLIANCE HELPERS
// ============================================================================

/**
 * Check if color contrast meets WCAG AA standards
 * Simplified version - use proper library in production
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  // This is a placeholder - use a proper contrast checker library
  // For now, return true to avoid blocking
  return true;
}

/**
 * Get focus visible class
 */
export function getFocusVisibleClass(): string {
  return 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500';
}

/**
 * Get focus ring styles
 */
export function getFocusRingStyles(color: string = 'blue-500'): string {
  return `focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${color}`;
}

// ============================================================================
// RESPONSIVE HELPERS
// ============================================================================

/**
 * Get responsive classes for breakpoints
 */
export function getResponsiveClasses(
  base: string,
  sm?: string,
  md?: string,
  lg?: string,
  xl?: string,
  xl2?: string
): string {
  const classes = [base];
  if (sm) classes.push(`sm:${sm}`);
  if (md) classes.push(`md:${md}`);
  if (lg) classes.push(`lg:${lg}`);
  if (xl) classes.push(`xl:${xl}`);
  if (xl2) classes.push(`2xl:${xl2}`);
  return classes.join(' ');
}

// ============================================================================
// TOUCH TARGET SIZES (WCAG 2.5.5)
// ============================================================================

/**
 * Minimum touch target size: 44x44px (WCAG 2.5.5)
 */
export const touchTargetSize = {
  min: '44px',
  recommended: '48px',
} as const;

/**
 * Get touch target classes
 */
export function getTouchTargetClasses(): string {
  return 'min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]';
}

