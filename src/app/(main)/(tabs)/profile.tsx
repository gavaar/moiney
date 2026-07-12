import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth";

export default function Profile() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-background">
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
    </View>
  );
}
