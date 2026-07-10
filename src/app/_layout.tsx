import "@/global.css";
import { Stack } from "expo-router";
import { ConvexProviderWithAuth } from "convex/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCustomAuth } from "@/lib/auth";
import { getConvexClient } from "@/lib/convexClient";

export default function RootLayout() {
  const convexClient = getConvexClient();
  return (
    <ErrorBoundary>
      <ConvexProviderWithAuth client={convexClient} useAuth={useCustomAuth}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#111111" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="sign-up" />
        </Stack>
      </ConvexProviderWithAuth>
    </ErrorBoundary>
  );
}
