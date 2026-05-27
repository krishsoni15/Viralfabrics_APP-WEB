import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button.optimized';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  'aria-label'?: string;
}

/**
 * Accessible Empty State component
 * - Semantic HTML structure
 * - Full keyboard navigation
 * - Screen reader friendly
 * - Responsive design
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data found',
  description = 'There is no data to display at the moment.',
  actionLabel,
  onAction,
  icon,
  'aria-label': ariaLabel,
}) => {
  const computedAriaLabel = ariaLabel || `${title}. ${description}`;

  return (
    <section
      className="flex flex-col items-center justify-center p-4 sm:p-8 min-h-[300px] sm:min-h-[400px]"
      aria-label={computedAriaLabel}
      role="status"
      aria-live="polite"
    >
      <div className="text-center max-w-md">
        {icon || (
          <MagnifyingGlassIcon
            className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 dark:text-gray-500 mb-4 mx-auto"
            aria-hidden="true"
          />
        )}
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
          {description}
        </p>
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            variant="primary"
            aria-label={`${actionLabel} - ${title}`}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </section>
  );
};

