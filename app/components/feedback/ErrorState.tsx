import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui';

export interface ErrorStateProps {
  error: Error | string;
  onRetry?: () => void;
  title?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  title = 'Something went wrong',
}) => {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
      <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
        {errorMessage}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          Try Again
        </Button>
      )}
    </div>
  );
};

