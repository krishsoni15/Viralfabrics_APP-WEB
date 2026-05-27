/**
 * Enhanced Form Validation Hook
 * 
 * Combines useValidation with form-specific features like submit handling
 */

import { useCallback, useState } from 'react';
import { useValidation, ValidationErrors } from '@/app/hooks/useValidation';
import { ZodSchema } from 'zod';

export interface UseFormValidationOptions<T> {
  schema: ZodSchema<T>;
  initialValues?: Partial<T>;
  onSubmit?: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface UseFormValidationReturn<T> {
  // From useValidation
  values: Partial<T>;
  errors: ValidationErrors;
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  validate: () => boolean;
  isValid: boolean;
  reset: () => void;
  getFieldError: (field: keyof T) => string | undefined;
  hasError: (field: keyof T) => boolean;
  
  // Form-specific
  isSubmitting: boolean;
  submitError: string | null;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  clearSubmitError: () => void;
}

/**
 * Enhanced form validation hook with submit handling
 * 
 * @example
 * const form = useFormValidation({
 *   schema: createOrderSchema,
 *   initialValues: { orderType: 'Dying' },
 *   onSubmit: async (values) => {
 *     await createOrder(values);
 *   },
 * });
 */
export function useFormValidation<T extends Record<string, any>>(
  options: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const { schema, initialValues, onSubmit, validateOnChange, validateOnBlur } = options;

  const validation = useValidation({
    schema,
    initialValues,
    validateOnChange,
    validateOnBlur,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Clear previous submit error
      setSubmitError(null);

      // Validate form
      if (!validation.validate()) {
        return;
      }

      // Submit
      if (onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(validation.values as T);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An error occurred while submitting the form';
          setSubmitError(errorMessage);
          throw error; // Re-throw to allow caller to handle
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [validation, onSubmit]
  );

  const clearSubmitError = useCallback(() => {
    setSubmitError(null);
  }, []);

  return {
    ...validation,
    isSubmitting,
    submitError,
    handleSubmit,
    clearSubmitError,
  };
}

