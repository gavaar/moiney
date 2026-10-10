import { Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { ModalShell } from "@ui/Modal";
import { Button } from "@ui/Button";

export function BiometricLoginOffer() {
  const { isAuthenticated, biometrics } = useAuth();
  if (!isAuthenticated || !biometrics.offer) return null;
  return (
    <ModalShell visible onClose={() => void biometrics.dismissOffer(false)}>
      <View className="gap-4">
        <Text className="text-lg font-bold text-text">Use biometric login?</Text>
        <Text className="text-sm leading-5 text-muted">
          Save your login securely on this device and use Face ID or fingerprint next time you need to sign in. Only one account can be tied to biometric login on this device.
        </Text>
        {biometrics.error ? <Text accessibilityRole="alert" className="text-sm text-error">{biometrics.error}</Text> : null}
        <Button title="Yes" loading={biometrics.busy} onPress={() => void biometrics.enable()} />
        <Button title="Do not show again" variant="muted" disabled={biometrics.busy} onPress={() => void biometrics.dismissOffer(true)} />
      </View>
    </ModalShell>
  );
}
