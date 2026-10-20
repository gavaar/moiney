import { Text } from "react-native";

export function InputError({ error }: { error?: string }) {
  if (error === undefined) return null;

  return (
    <Text accessibilityRole="alert" accessibilityLabel={error} className="text-sm text-error">
      {error}
    </Text>
  );
}
