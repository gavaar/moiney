import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

export default function MainLayout() {
  return (
    <>
      <AuthLoading>
        <View className="flex-1 bg-background" />
      </AuthLoading>
      <Authenticated>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#111111" } }} />
      </Authenticated>
      <Unauthenticated>
        <Redirect href="/login" />
      </Unauthenticated>
    </>
  );
}
