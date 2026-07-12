import { Text, TouchableOpacity, View } from "react-native";
import { useModal } from "@/components/Modal";

export default function Dashboard() {
  const { open } = useModal();

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-3xl font-bold text-text">Dashboard</Text>
      <TouchableOpacity
        onPress={() => open(<Text className="text-text text-base">I'm a modal!</Text>)}
        className="mt-6 bg-primary size-14 rounded-full items-center justify-center"
        activeOpacity={0.7}
      >
        <Text className="text-white text-3xl leading-none">+</Text>
      </TouchableOpacity>
    </View>
  );
}
