import { Slot, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { View } from "react-native";
import { ModalProvider } from "@/components/ui/Modal";

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
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
      <Slot />
    </ModalProvider>
  );
}
