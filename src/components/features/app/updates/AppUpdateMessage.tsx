import { Text } from "react-native";
import type { AppRelease } from "./AppUpdateProvider";

export function AppUpdateMessage({ release, onDownload }: { release: AppRelease; onDownload: () => void }) {
  return (
    <Text testID="outdated-app-message" className="text-base text-text">
      your app is out of date, please get the newest app from{" "}
      <Text
        accessibilityRole="link"
        accessibilityLabel="Download latest APK"
        className="text-primary underline"
        onPress={onDownload}
      >
        GitHub
      </Text>
      {" "}({release.latestAppVersion}).
    </Text>
  );
}
