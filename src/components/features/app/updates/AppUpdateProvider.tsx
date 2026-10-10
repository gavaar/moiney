import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BackHandler, Linking, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@convex/_generated/api";
import { expo } from "@/../app.json";
import { getUpdateKind } from "@domain/releases/version";
import { Button } from "@ui/Button";
import { AppUpdateMessage } from "./AppUpdateMessage";

export type AppRelease = NonNullable<FunctionReturnType<typeof api.appRelease.latest>>;

const AppReleaseContext = createContext<{ latest: AppRelease | null } | null>(null);

export function useLatestAppRelease() {
  const context = useContext(AppReleaseContext);
  if (!context) throw new Error("useLatestAppRelease must be used within AppUpdateProvider");
  return context.latest;
}

function MandatoryUpdateScreen({ release }: { release: AppRelease }) {
  const [downloadFailed, setDownloadFailed] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []);

  const download = () => {
    setDownloadFailed(false);
    void Linking.openURL(release.downloadUrl).catch(() => setDownloadFailed(true));
  };

  return (
    <SafeAreaView className="flex-1 justify-center bg-background p-6">
      <View className="gap-4">
        <Text accessibilityRole="header" className="text-lg font-bold text-text">Update available</Text>
        <AppUpdateMessage release={release} onDownload={download} />
        <Text className="text-base text-text">
          Breaking changes were deployed, please update to the latest version.
        </Text>
        <Button title="Update" onPress={download} />
        {downloadFailed ? <Text accessibilityRole="alert" className="text-base text-error">Could not open the download. Please try again.</Text> : null}
      </View>
    </SafeAreaView>
  );
}

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const client = useConvex();
  const [state, setState] = useState<{ latest: AppRelease | null; required: AppRelease | null }>({ latest: null, required: null });

  useEffect(() => {
    // watchQuery lets this advisory query fail open instead of throwing into the app's error boundary.
    const watch = client.watchQuery(api.appRelease.latest, {});
    const update = () => {
      let latest: AppRelease | null;
      try {
        latest = watch.localQueryResult() ?? null;
      } catch {
        latest = null;
      }
      setState((current) => ({
        latest,
        // A known mandatory release remains enforced for this session, even offline.
        required: latest && getUpdateKind(expo.version, latest.latestAppVersion) === "mandatory"
          ? latest : current.required,
      }));
    };
    const unsubscribe = watch.onUpdate(update);
    update();
    return unsubscribe;
  }, [client]);

  return (
    <AppReleaseContext.Provider value={{ latest: state.latest }}>
      {state.required ? <MandatoryUpdateScreen release={state.required} /> : children}
    </AppReleaseContext.Provider>
  );
}
