/**
 * Reusable Form Field Component
 * 
 * Provides consistent validation, error display, and animations
 */

'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/Input.optimized';

export interface FormFieldProps {
  label: string;
  name: string;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  showError?: boolean;
  animateError?: boolean;
}

/**
 * Form field with validation, error display, and animations
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  type = 'text',
  placeholder,
  disabled = false,
  leftIcon,
  rightIcon,
  className,
  inputClassName,
  showError = true,
  animateError = true,
}) => {
  const id = useId();
  const fieldId = `${name}-${id}`;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  const hasError = !!error && showError;

  return (
    <div className={cn('w-full', className)}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <Input
          id={fieldId}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
          error={hasError ? error : undefined}
          helperText={!hasError ? helperText : undefined}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperId}
          className={cn(
            inputClassName,
            hasError && animateError && 'animate-shake',
            'transition-all duration-200'
          )}
        />
      </div>

      {hasError && (
        <p
          id={errorId}
          className={cn(
            'mt-1 text-sm text-red-600 dark:text-red-400',
            animateError && 'animate-fade-in'
          )}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';

