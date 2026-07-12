import { Redirect, Stack } from "expo-router";
import { useConvexAuth } from "convex/react";
import { View } from "react-native";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <View className="flex-1 bg-background" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#111111" } }} />
  );
}
