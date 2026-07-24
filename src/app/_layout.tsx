import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "convex/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@ui/ErrorBoundary";
import { AlertProvider } from "@ui/Alert";
import { AuthProvider, getConvexClient } from "@/lib/auth";

export default function RootLayout() {
  const convexClient = getConvexClient();

  return (
    <ErrorBoundary>
      <ConvexProvider client={convexClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <AlertProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#111111" },
              }} />
            </AlertProvider>
          </SafeAreaProvider>
        </AuthProvider>
      </ConvexProvider>
    </ErrorBoundary>
  );
}
