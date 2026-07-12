import { Stack, useRouter } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import { View } from "react-native";
import { ModalProvider } from "@/components/Modal";

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <View className="flex-1 bg-background" />;
  if (!isAuthenticated) return null;

  return (
    <ModalProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#111111" } }} />
    </ModalProvider>
  );
}
