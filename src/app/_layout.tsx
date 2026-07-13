import "@/global.css";
import { Stack } from "expo-router";
import { ConvexProvider } from "convex/react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AuthProvider, getConvexClient } from "@/lib/auth";

export default function RootLayout() {
  const convexClient = getConvexClient();

  return (
    <ErrorBoundary>
      <ConvexProvider client={convexClient}>
        <AuthProvider>
          <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#111111" },
          }} />
        </AuthProvider>
      </ConvexProvider>
    </ErrorBoundary>
  );
}
