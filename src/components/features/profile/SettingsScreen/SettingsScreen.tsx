import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { ModalShell } from "@ui/Modal";

type SettingsAction = { type: "enable"; password: string } | { type: "disable" } | null;

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { biometrics } = useAuth();
  const [action, setAction] = useState<SettingsAction>(null);
  const close = () => setAction(null);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background px-4">
      <ScreenHeader title="Settings" left={<Button title="Back" icon="arrow-back" variant="muted" onPress={onBack} />} />
      <ScrollView contentContainerClassName="gap-3 pb-8">
        <Text className="text-lg font-semibold text-text">Use biometric login</Text>
        <Input
          type="toggle"
          value={biometrics.enabled}
          disabled={biometrics.loading || biometrics.busy || (!biometrics.available && !biometrics.enabled)}
          options={[
            { label: "Disabled", icon: "close", selectedBackgroundClassName: "bg-errorMuted" },
            { label: "Enabled", icon: "checkmark", selectedBackgroundClassName: "bg-primaryMuted" },
          ]}
          onChange={(enabled) => {
            if (enabled !== biometrics.enabled) setAction(enabled ? { type: "enable", password: "" } : { type: "disable" });
          }}
        />
        <Text className="text-sm leading-5 text-muted">
          Use Face ID or fingerprint to sign in with saved login details when needed. Only one account can be saved on this device. Signing out keeps these details; turning this off removes them.
        </Text>
        {!biometrics.loading && !biometrics.available ? <Text className="text-sm text-muted">Biometric login is unavailable. Use a supported phone with Face ID or a strong fingerprint enrolled.</Text> : null}
        {biometrics.error ? <Text accessibilityRole="alert" className="text-sm text-error">{biometrics.error}</Text> : null}
      </ScrollView>
      <ModalShell visible={action !== null} onClose={close}>
        {action ? <View className="gap-4">
          <Text className="text-lg font-bold text-text">{action.type === "enable" ? "Enable biometric login" : "Disable biometric login?"}</Text>
          <Text className="text-sm leading-5 text-muted">
            {action.type === "enable"
              ? "Confirm your current password to save your login securely. Only one account can be tied to biometric login on this device."
              : "This removes the saved login details from this device. You'll need your password next time you need to sign in. We won't ask you to enable this again."}
          </Text>
          {action.type === "enable" ? <Input label="Current password" value={action.password} secureTextEntry onChange={(password) => setAction({ type: "enable", password })} /> : null}
          {biometrics.error ? <Text accessibilityRole="alert" className="text-sm text-error">{biometrics.error}</Text> : null}
          <Button
            title={action.type === "enable" ? "Enable biometric login" : "Disable biometric login"}
            variant={action.type === "enable" ? "primary" : "error"}
            loading={biometrics.busy}
            disabled={action.type === "enable" && !action.password}
            onPress={async () => {
              const succeeded = action.type === "enable" ? await biometrics.enable(action.password) : await biometrics.disable();
              if (succeeded) setAction(null);
            }}
          />
        </View> : null}
      </ModalShell>
    </SafeAreaView>
  );
}
