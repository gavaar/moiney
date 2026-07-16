import { Text, View } from "react-native";

type ScreenHeaderProps = {
  title: string;
};

export function ScreenHeader({ title }: ScreenHeaderProps) {
  return (
    <View className="w-2/5 mx-auto border-b border-border pb-2 mb-6 items-center">
      <Text className="text-text font-bold">{title}</Text>
    </View>
  );
}
