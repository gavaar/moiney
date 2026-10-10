import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { expo } from "@/../app.json";
import { getUpdateKind } from "@domain/releases/version";
import { useLatestAppRelease } from "../updates/AppUpdateProvider";
import { AppUpdateMessage } from "../updates/AppUpdateMessage";
import { Icon } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";

export function MoineyVers() {
  const latestRelease = useLatestAppRelease();
  const [showOutdatedModal, setShowOutdatedModal] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const isOutdated = latestRelease !== null && getUpdateKind(expo.version, latestRelease.latestAppVersion) === "optional";

  const openLatestRelease = () => {
    setDownloadFailed(false);
    if (latestRelease) void Linking.openURL(latestRelease.downloadUrl).catch(() => setDownloadFailed(true));
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
          {latestRelease ? <AppUpdateMessage release={latestRelease} onDownload={openLatestRelease} /> : null}
          {downloadFailed ? <Text accessibilityRole="alert" className="text-base text-error">Could not open the download. Please try again.</Text> : null}
        </View>
      </ModalShell>
    </>
  );
}
