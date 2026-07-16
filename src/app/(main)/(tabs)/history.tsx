import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ui/ScreenHeader/ScreenHeader";

export default function History() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="History" />

      <ScrollView className="flex-1" contentContainerClassName="items-center justify-center flex-1">
        <Text className="text-3xl font-bold text-text">History</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
