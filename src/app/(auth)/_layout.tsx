import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { View } from "react-native";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/pipes");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <View className="flex-1 bg-background" />;
  if (isAuthenticated) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#111111" } }} />
  );
}
