import type { BiometricVault } from "./biometricLogin";

// The browser never receives a persisted password or offers native biometrics.
export const biometricVault: BiometricVault = {
  isAvailable: async () => false,
  readPreferences: async () => ({ accountKey: null, suppressed: false }),
  writePreferences: async () => {},
  save: async () => false,
  unlock: async () => null,
  remove: async () => {},
};
