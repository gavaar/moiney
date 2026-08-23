import { type ReactNode } from "react";
import { Text, View } from "react-native";

export type ScreenHeaderProps = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center min-h-10 border-b border-border pb-2 mb-6">
      <View className="flex-1">{left}</View>
      <Text className="text-text font-bold">{title}</Text>
      <View className="flex-1 items-end">{right}</View>
    </View>
  );
}
