import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { ModalShell } from "@ui/Modal";
import { useMonthlyCardPreference } from "@features/statistics/preferences/MonthlyCardPreference";

type SettingsAction = { type: "enable"; password: string } | { type: "disable" } | null;

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { biometrics } = useAuth();
  const { ready, showInMain, setShowInMain } = useMonthlyCardPreference();
  const [action, setAction] = useState<SettingsAction>(null);
  const close = () => setAction(null);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppScreenHeader title="Settings" left={<Button className="max-w-20" title="Back" icon="arrow-back" variant="muted" onPress={onBack} />} />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-8">
        <Input
          type="checkbox"
          checkboxLabel="Show monthly statistics card in main view"
          value={showInMain}
          disabled={!ready}
          onChange={setShowInMain}
        />
        <Text className="text-sm leading-5 text-muted">
          Shows the current month’s live statistics at the top of the main view. You can always find this card in Statistics, even when this option is off.
        </Text>
        {!biometrics.loading && (biometrics.available || biometrics.enabled) ? <>
          <Input
            type="checkbox"
            checkboxLabel="Use biometric login"
            value={biometrics.enabled}
            disabled={biometrics.busy}
            onChange={(enabled) => {
              if (enabled !== biometrics.enabled) setAction(enabled ? { type: "enable", password: "" } : { type: "disable" });
            }}
          />
          <Text className="text-sm leading-5 text-muted">
            Use Face ID or fingerprint to sign in with saved login details when needed. Only one account can be saved on this device. Signing out keeps these details; turning this off removes them.
          </Text>
          {!biometrics.available ? <Text className="text-sm text-muted">Biometric login is unavailable on this device. Turn this off to remove the saved login details.</Text> : null}
          {biometrics.error ? <Text accessibilityRole="alert" className="text-sm text-error">{biometrics.error}</Text> : null}
        </> : null}
      </ScrollView>
      <ModalShell visible={action !== null} onClose={close}>
        {action ? <ScrollView contentContainerClassName="gap-4" style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
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
            disabled={biometrics.loading || (action.type === "enable" && (!biometrics.available || !action.password))}
            onPress={async () => {
              const succeeded = action.type === "enable" ? await biometrics.enable(action.password) : await biometrics.disable();
              if (succeeded) setAction(null);
            }}
          />
        </ScrollView> : null}
      </ModalShell>
    </SafeAreaView>
  );
}
