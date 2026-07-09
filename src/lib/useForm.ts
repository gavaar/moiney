import { useCallback, useState } from "react";

type ValidationErrors<T> = Partial<Record<keyof T, string>> & {
  form?: string;
};

type UseFormOptions<T extends Record<string, string>> = {
  initialValues: T;
  validate?: (values: T) => ValidationErrors<T>;
  onSubmit: (values: T) => Promise<void>;
};

export function useForm<T extends Record<string, string>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [loading, setLoading] = useState(false);

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateField = useCallback(<K extends keyof T>(field: K) => {
    if (!validate) return;
    const allErrors = validate(values);
    const fieldError = allErrors[field];
    setErrors((prev) => {
      if (fieldError) return { ...prev, [field]: fieldError };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, [values, validate]);

  const handleSubmit = useCallback(async () => {
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) return;
    }

    setLoading(true);
    try {
      await onSubmit(values);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setErrors((prev) => ({ ...prev, form: message }));
    } finally {
      setLoading(false);
    }
  }, [values, validate, onSubmit]);

  return { values, setField, validateField, errors, setErrors, loading, handleSubmit };
}