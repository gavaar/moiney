import { MoineyVers } from '@features/components/MoineyVers';
import { type ReactNode } from "react";
import { Text, View } from "react-native";

type ScreenHeaderProps = {
  title: string;
  right?: ReactNode;
};

export function ScreenHeader({ title, right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center border-b border-border pb-2 mb-6">
      <View className="flex-1">
        <MoineyVers />
      </View>
      <Text className="text-text font-bold">{title}</Text>
      <View className="flex-1 items-end">{right}</View>
    </View>
  );
}