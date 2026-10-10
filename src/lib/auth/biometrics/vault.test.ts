import { beforeEach, describe, expect, it, vi } from "vitest";
import { biometricVault } from "./vault.native";

const mocks = vi.hoisted(() => ({
  os: "ios",
  values: new Map<string, string>(),
  set: vi.fn(), get: vi.fn(), remove: vi.fn(),
  available: vi.fn(), authenticate: vi.fn(), level: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { get OS() { return mocks.os; } } }));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  canUseBiometricAuthentication: mocks.available,
  setItemAsync: mocks.set, getItemAsync: mocks.get, deleteItemAsync: mocks.remove,
}));
vi.mock("expo-local-authentication", () => ({
  authenticateAsync: mocks.authenticate,
  getEnrolledLevelAsync: mocks.level,
  SecurityLevel: { BIOMETRIC_STRONG: 3 },
}));

const credentials = { accountKey: "deployment:alice", username: "alice", password: "secret" };

describe("native biometric vault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.os = "ios";
    mocks.values.clear();
    mocks.available.mockReturnValue(true);
    mocks.level.mockResolvedValue(3);
    mocks.authenticate.mockResolvedValue({ success: true });
    mocks.set.mockImplementation(async (key, value) => { mocks.values.set(key, value); });
    mocks.get.mockImplementation(async (key) => mocks.values.get(key) ?? null);
    mocks.remove.mockImplementation(async (key) => { mocks.values.delete(key); });
  });

  it("proves iOS biometrics before saving enrollment-bound, device-only credentials", async () => {
    expect(await biometricVault.save(credentials)).toBe(true);
    expect(mocks.authenticate).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: true, fallbackLabel: "", biometricsSecurityLevel: "strong" }));
    expect(mocks.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify(credentials), expect.objectContaining({ requireAuthentication: true, keychainAccessible: 6 }));
    expect(await biometricVault.unlock()).toEqual(credentials);
    expect(mocks.get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ requireAuthentication: true }));
  });

  it("does not save on iOS cancellation and relies on Android's crypto-bound write prompt", async () => {
    mocks.authenticate.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    expect(await biometricVault.save(credentials)).toBe(false);
    expect(mocks.set).not.toHaveBeenCalled();
    mocks.os = "android";
    expect(await biometricVault.save(credentials)).toBe(true);
    expect(mocks.authenticate).toHaveBeenCalledTimes(1);
  });

  it("rejects weak biometrics and reads preferences without unlocking the password", async () => {
    mocks.level.mockResolvedValue(2);
    expect(await biometricVault.isAvailable()).toBe(false);
    expect(await biometricVault.readPreferences()).toEqual({ accountKey: null, suppressed: false });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledOnce();
  });

  it("treats malformed preferences and credential payloads as absent", async () => {
    mocks.get.mockResolvedValue("{broken");
    expect(await biometricVault.readPreferences()).toEqual({ accountKey: null, suppressed: false });
    expect(await biometricVault.unlock()).toBeNull();
  });
});
