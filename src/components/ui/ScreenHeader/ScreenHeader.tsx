import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export type ScreenHeaderProps = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  titleAction?: { onPress: () => void; label: string };
};

export function ScreenHeader({ title, left, right, titleAction }: ScreenHeaderProps) {
  const titleText = <Text className="text-text font-bold expanded:text-xl">{title}</Text>;
  return (
    <View className="flex-row items-center min-h-10 border-b border-border pb-2 mb-6">
      <View className="flex-1">{left}</View>
      {titleAction
        ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={titleAction.label}
            onPress={titleAction.onPress}
            className="rounded-sm web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary"
          >
            {titleText}
          </Pressable>
        : titleText}
      <View className="flex-1 items-end">{right}</View>
    </View>
  );
}
