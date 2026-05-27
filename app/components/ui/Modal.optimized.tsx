'use client';

import React, { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { trapFocus, restoreFocus, saveFocus } from '@/lib/accessibility';
import { Button } from './Button.optimized';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Accessible Modal component
 * - Focus trap
 * - Keyboard navigation (Escape to close)
 * - ARIA attributes
 * - Responsive design
 * - WCAG compliant
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Trap focus and save previous focus
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    previousFocusRef.current = saveFocus();
    const cleanup = trapFocus(modalRef.current);

    return () => {
      cleanup();
      restoreFocus(previousFocusRef.current);
    };
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  const computedAriaLabel = ariaLabel || title;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={ariaDescribedBy}
      aria-label={computedAriaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={cn(
          'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl',
          'w-full max-h-[90vh] overflow-y-auto',
          sizes[size],
          'modal-enter'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="modal-title" className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'transition-colors duration-200',
                'min-h-[40px] min-w-[40px]' // Ensures touch target size (accessible)
              )}
              aria-label="Close dialog"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';

