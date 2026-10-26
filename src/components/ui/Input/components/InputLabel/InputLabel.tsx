import { Text } from "react-native";

export function InputLabel({ label = "" }: { label?: string }) {
  if (label === "") return null;

  return <Text className="text-sm font-medium text-text pl-2">{label}</Text>;
}
