import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { expo } from "@/../app.json";
import { getLatestMoineyRelease, type LatestMoineyRelease } from "@/lib/githubReleases";
import { Icon } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";

export function MoineyVers() {
  const [latestRelease, setLatestRelease] = useState<LatestMoineyRelease | null>(null);
  const [showOutdatedModal, setShowOutdatedModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getLatestMoineyRelease().then((release) => {
      if (!cancelled) setLatestRelease(release);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const isOutdated = latestRelease !== null && latestRelease.name !== expo.version;

  const openLatestRelease = () => {
    if (latestRelease) void Linking.openURL(latestRelease.url);
  };

  return (
    <>
      <Pressable
        testID="moiney-version"
        accessibilityRole="button"
        accessibilityLabel={`Moiney version ${expo.version}`}
        disabled={!isOutdated}
        onPress={() => setShowOutdatedModal(true)}
        className="flex-row items-center gap-1"
      >
        <Text className="text-sm text-muted">moiney v{expo.version}</Text>
        {isOutdated ? (
          <Icon
            name="warning-outline"
            size={15}
            color={colors.warning}
            testID="moiney-version-warning"
          />
        ) : null}
      </Pressable>

      <ModalShell
        visible={showOutdatedModal && isOutdated}
        onClose={() => setShowOutdatedModal(false)}
      >
        <View className="gap-4">
          <Text className="text-lg font-bold text-text">Update available</Text>
          <Text testID="outdated-app-message" className="text-base text-text">
            your app is out of date, please get the newest app from{" "}
            <Text
              accessibilityRole="link"
              accessibilityLabel="Open latest GitHub release"
              className="text-primary underline"
              onPress={openLatestRelease}
            >
              GitHub
            </Text>
            {" "}({latestRelease?.name}).
          </Text>
        </View>
      </ModalShell>
    </>
  );
}
