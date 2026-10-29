import { ReactNode } from 'react';
import { Text } from 'react-native';
import { cn } from '@/lib/styles/cn';
import { InputError } from './components/InputError';

export function InputHelperText({ error, supportingText, value, maxLength }: { error?: string; supportingText?: ReactNode; value?: unknown; maxLength?: number }) {
  if (error !== undefined) {
      return <InputError error={error} />;
    }

  if (supportingText !== undefined) {
    if (typeof supportingText === "string" || typeof supportingText === "number") {
      return <Text className="text-sm text-muted">{supportingText}</Text>;
    }
    return supportingText;
  }

  const currentLength = String(value ?? "").length;
  if (maxLength) {
    return <Text className={cn("text-sm", currentLength > maxLength ? "text-error" : "text-muted")}>
      {currentLength} / {maxLength}
    </Text>;
  }

  return null;
}
