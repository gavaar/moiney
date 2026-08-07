import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { SignOutButton } from "@features/account/SignOutButton";

export default function Profile() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="Profile" />

      <ScrollView className="flex-1" contentContainerClassName="items-center justify-center flex-1">
        <Text className="text-3xl font-bold text-text">Profile</Text>
        <View className="mt-8">
          <SignOutButton onSignedOut={() => router.replace("/login")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
