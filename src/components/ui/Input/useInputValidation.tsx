import { useEffect, useEffectEvent, useState } from "react";
import { Text } from "react-native";

export function InputError({ error }: { error?: string }) {
  if (error === undefined) return null;

  return (
    <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
      {error}
    </Text>
  );
}

/** Validation stays live after the first blur or committed interaction. */
export function useInputValidation<Value>(
  value: Value,
  validator?: (value: Value) => string | undefined,
  onError?: (error?: string) => void,
) {
  const [error, setError] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) setError(validator?.(value));
  }, [value, validator, dirty]);

  const notifyError = useEffectEvent(() => onError?.(error));
  useEffect(() => {
    notifyError();
  }, [error]);

  const markAsDirty = () => setDirty(true);

  return { error, markAsDirty };
}
