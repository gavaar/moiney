import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "convex/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@ui/ErrorBoundary";
import { AlertProvider } from "@ui/Alert";
import { AuthProvider, getConvexClient } from "@/lib/auth";
import { EventHistoryCacheProvider } from "@features/transactions/cache/EventHistoryCacheContext";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import { AppUpdateProvider } from "@features/app/updates/AppUpdateProvider";
import { BiometricLoginOffer } from "@features/auth/BiometricLoginOffer/BiometricLoginOffer";

export default function RootLayout() {
  const convexClient = getConvexClient();

  return (
    <ErrorBoundary>
      <ConvexProvider client={convexClient}>
        <AuthProvider>
          <EventHistoryCacheProvider>
            <SafeAreaProvider>
              <StatusBar style="light" />
              <AppUpdateProvider>
                <AlertProvider>
                  <ConfirmModalProvider>
                    <Stack screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: "#111111" },
                    }} />
                    <BiometricLoginOffer />
                  </ConfirmModalProvider>
                </AlertProvider>
              </AppUpdateProvider>
            </SafeAreaProvider>
          </EventHistoryCacheProvider>
        </AuthProvider>
      </ConvexProvider>
    </ErrorBoundary>
  );
}
