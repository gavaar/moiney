import { Text, TouchableOpacity, View } from "react-native";

type InnerPipesScreenProps = {
  name: string;
  onDeselect: () => void;
};

export function InnerPipesScreen({ name, onDeselect }: InnerPipesScreenProps) {
  return (
    <View className="flex-1">
      <TouchableOpacity testID="back-button" onPress={onDeselect}>
        <Text className="text-primary text-lg">← Back</Text>
      </TouchableOpacity>
      <Text className="text-text text-xl">selected {name}</Text>
    </View>
  );
}
