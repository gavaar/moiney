import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { BiometricVault, Credentials, Preferences } from "./biometricLogin";

const PREFERENCES_KEY = "biometric_login_preferences";
const CREDENTIALS_KEY = "biometric_login_credentials";
const protectedOptions: SecureStore.SecureStoreOptions = {
  keychainService: "moiney.biometric-login",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: "Use biometrics to sign in to Moiney",
};

function parse(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export const biometricVault: BiometricVault = {
  async isAvailable() {
    return SecureStore.canUseBiometricAuthentication()
      && await LocalAuthentication.getEnrolledLevelAsync() === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  },
  async readPreferences() {
    const value = parse(await SecureStore.getItemAsync(PREFERENCES_KEY));
    if (value && typeof value === "object" && "accountKey" in value && "suppressed" in value
      && (value.accountKey === null || typeof value.accountKey === "string") && typeof value.suppressed === "boolean") {
      return { accountKey: value.accountKey, suppressed: value.suppressed };
    }
    return { accountKey: null, suppressed: false };
  },
  async writePreferences(value: Preferences) {
    await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(value));
  },
  async save(value: Credentials) {
    // Android authenticates the encryption operation itself. iOS only prompts on
    // reads/updates, so a newly-created keychain item needs an explicit setup proof.
    if (Platform.OS === "ios") {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Enable biometric login",
        disableDeviceFallback: true,
        fallbackLabel: "",
        biometricsSecurityLevel: "strong",
      });
      if (!result.success) return false;
    }
    try {
      await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(value), protectedOptions);
      return true;
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return false;
      throw error;
    }
  },
  async unlock() {
    const value = parse(await SecureStore.getItemAsync(CREDENTIALS_KEY, protectedOptions));
    if (value && typeof value === "object" && "accountKey" in value && "username" in value && "password" in value
      && typeof value.accountKey === "string" && typeof value.username === "string" && typeof value.password === "string") {
      return { accountKey: value.accountKey, username: value.username, password: value.password };
    }
    return null;
  },
  async remove() {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY, protectedOptions);
  },
};
