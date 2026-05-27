/**
 * Frontend Validation Hook
 * 
 * Uses the same Zod schemas as backend for consistency
 */

import { useState, useCallback, useMemo } from 'react';
import { z, ZodSchema } from 'zod';

export interface ValidationErrors {
  [key: string]: string;
}

export interface UseValidationOptions<T> {
  schema: ZodSchema<T>;
  initialValues?: Partial<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface UseValidationReturn<T> {
  values: Partial<T>;
  errors: ValidationErrors;
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  clearAllErrors: () => void;
  validate: () => boolean;
  validateField: (field: keyof T) => boolean;
  isValid: boolean;
  reset: () => void;
  getFieldError: (field: keyof T) => string | undefined;
  hasError: (field: keyof T) => boolean;
}

/**
 * Validation hook for forms
 * 
 * @example
 * const { values, errors, setValue, validate, isValid } = useValidation({
 *   schema: createOrderSchema,
 *   initialValues: { orderType: 'Dying' },
 *   validateOnChange: true,
 * });
 */
export function useValidation<T extends Record<string, any>>(
  options: UseValidationOptions<T>
): UseValidationReturn<T> {
  const { schema, initialValues = {}, validateOnChange = false, validateOnBlur = true } = options;

  const [values, setValuesState] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());

  // Validate entire form
  const validate = useCallback((): boolean => {
    const result = schema.safeParse(values);
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join('.') || 'root';
        errors[path] = err.message;
      });
      setErrors(errors);
      return false;
    }
    
    setErrors({});
    return true;
  }, [schema, values]);

  // Validate single field
  const validateField = useCallback((field: keyof T): boolean => {
    // Validate the entire form and extract error for this field
    const result = schema.safeParse(values);
    
    if (result.success) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
      return true;
    } else {
      // Find error for this specific field
      const fieldError = result.error.issues
        .find(err => err.path.join('.') === String(field))
        ?.message || undefined;
      
      if (fieldError) {
        setErrors((prev) => ({
          ...prev,
          [field as string]: fieldError,
        }));
        return false;
      } else {
        // No error for this field, clear it
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
        return true;
      }
    }
  }, [schema, values]);

  // Set single value
  const setValue = useCallback((field: keyof T, value: any) => {
    setValuesState((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field as string]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }

    // Validate on change if enabled
    if (validateOnChange && touched.has(field)) {
      setTimeout(() => validateField(field), 0);
    }
  }, [errors, validateOnChange, touched, validateField]);

  // Set multiple values
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({
      ...prev,
      ...newValues,
    }));

    // Clear errors for changed fields
    const fieldsToClear = Object.keys(newValues) as (keyof T)[];
    setErrors((prev) => {
      const newErrors = { ...prev };
      fieldsToClear.forEach((field) => {
        delete newErrors[field as string];
      });
      return newErrors;
    });
  }, []);

  // Set error manually
  const setError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [field as string]: error,
    }));
  }, []);

  // Clear single error
  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Reset form
  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrors({});
    setTouched(new Set());
  }, [initialValues]);

  // Get field error
  const getFieldError = useCallback((field: keyof T): string | undefined => {
    return errors[field as string];
  }, [errors]);

  // Check if field has error
  const hasError = useCallback((field: keyof T): boolean => {
    return !!errors[field as string];
  }, [errors]);

  // Check if form is valid
  const isValid = useMemo(() => {
    const result = schema.safeParse(values);
    return result.success;
  }, [schema, values]);

  // Handle blur (mark as touched and validate)
  const handleBlur = useCallback((field: keyof T) => {
    setTouched((prev) => new Set([...prev, field]));
    if (validateOnBlur) {
      validateField(field);
    }
  }, [validateOnBlur, validateField]);

  return {
    values,
    errors,
    setValue,
    setValues,
    setError,
    clearError,
    clearAllErrors,
    validate,
    validateField,
    isValid,
    reset,
    getFieldError,
    hasError,
  };
}

