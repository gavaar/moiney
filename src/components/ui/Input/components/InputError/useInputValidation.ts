import { useEffect, useEffectEvent, useState } from "react";

/** Validation stays live after the first blur or committed interaction. */
export function useInputValidation<Value>(
  value: Value,
  validator?: (value: Value) => string | undefined,
  onError?: (error?: string) => void,
) {
  const [dirty, setDirty] = useState(false);
  const error = dirty ? validator?.(value) : undefined;

  const notifyError = useEffectEvent(() => onError?.(error));
  useEffect(() => {
    notifyError();
  }, [error]);

  const markAsDirty = () => setDirty(true);

  return { error, markAsDirty };
}
