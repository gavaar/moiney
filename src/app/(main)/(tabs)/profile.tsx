import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { useAuth } from "@/lib/auth";

export default function Profile() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="Profile" />

      <ScrollView className="flex-1" contentContainerClassName="items-center justify-center flex-1">
        <Text className="text-3xl font-bold text-text">Profile</Text>
        <TouchableOpacity
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="mt-8 rounded-lg bg-error px-4 py-2"
        >
          <Text className="font-semibold text-white">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
