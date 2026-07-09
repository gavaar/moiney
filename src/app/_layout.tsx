import "@/global.css";
import { Stack } from "expo-router";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCustomAuth } from "@/lib/useCustomAuth";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ConvexProviderWithAuth client={convex} useAuth={useCustomAuth}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="sign-up" />
        </Stack>
      </ConvexProviderWithAuth>
    </ErrorBoundary>
  );
}
