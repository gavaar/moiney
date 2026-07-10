import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Redirect } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { signOut } = useAuth();

  return (
    <>
      <AuthLoading>
        <View className="flex-1 bg-background" />
      </AuthLoading>
      <Authenticated>
        <View className="flex-1 items-center justify-center bg-background">
          <Text className="text-3xl font-bold text-text">moiney</Text>
          <Text className="mt-2 text-base text-secondary">
            Your financial companion
          </Text>
          <TouchableOpacity
            onPress={() => signOut()}
            className="mt-8 rounded-lg bg-error px-4 py-2"
          >
            <Text className="font-semibold text-white">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Authenticated>
      <Unauthenticated>
        <Redirect href="/login" />
      </Unauthenticated>
    </>
  );
}
