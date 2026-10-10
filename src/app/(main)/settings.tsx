import { useRouter } from "expo-router";
import { SettingsScreen } from "@features/profile/SettingsScreen/SettingsScreen";

export default function Settings() {
  const router = useRouter();
  return <SettingsScreen onBack={() => router.dismissTo("/profile")} />;
}
