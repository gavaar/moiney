import "@/global.css";
import { Stack } from "expo-router";
import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
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
import { OptionListHost } from "@ui/OptionList";
import { colors } from "@/lib/styles";
import { localHistoryRouter } from "@/lib/navigation/local-history";

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
                    <OptionListHost>
                      <ThemeProvider value={{
                        ...DarkTheme,
                        colors: {
                          ...DarkTheme.colors,
                          primary: colors.primary,
                          background: colors.background,
                          card: colors.surface,
                          text: colors.text,
                          border: colors.border,
                          notification: colors.error,
                        },
                      }}>
                        <Stack UNSTABLE_router={localHistoryRouter} screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: colors.background },
                        }} />
                      </ThemeProvider>
                      <BiometricLoginOffer />
                    </OptionListHost>
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
