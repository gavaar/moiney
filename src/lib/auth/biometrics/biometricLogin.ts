export type Credentials = { accountKey: string; username: string; password: string };
export type Preferences = { accountKey: string | null; suppressed: boolean };
export type BiometricVault = {
  isAvailable(): Promise<boolean>;
  readPreferences(): Promise<Preferences>;
  writePreferences(value: Preferences): Promise<void>;
  save(value: Credentials): Promise<boolean>;
  unlock(): Promise<Credentials | null>;
  remove(): Promise<void>;
};

export function createBiometricLogin(vault: BiometricVault, deployment: string) {
  const belongsToDeployment = (accountKey: string | null) => accountKey?.startsWith(`${deployment}:`) === true;
  async function clear(suppressed: boolean) {
    await vault.remove();
    await vault.writePreferences({ accountKey: null, suppressed });
  }
  return {
    async status(accountKey: string | null) {
      const preferences = await vault.readPreferences();
      return {
        available: await vault.isAvailable(),
        enabled: belongsToDeployment(preferences.accountKey) && (accountKey === null || preferences.accountKey === accountKey),
      };
    },
    async shouldOffer(accountKey: string) {
      const preferences = await vault.readPreferences();
      return !preferences.suppressed && preferences.accountKey !== accountKey && await vault.isAvailable();
    },
    async suppressOffer() {
      await vault.writePreferences({ ...await vault.readPreferences(), suppressed: true });
    },
    async enable(credentials: Credentials) {
      if (!belongsToDeployment(credentials.accountKey) || !await vault.isAvailable()) return "unavailable" as const;
      const preferences = await vault.readPreferences();
      if (!await vault.save(credentials)) return "cancelled" as const;
      try {
        await vault.writePreferences({ accountKey: credentials.accountKey, suppressed: preferences.suppressed });
      } catch (error) {
        // A failed publication must not leave a password that Settings cannot remove.
        await clear(preferences.suppressed);
        throw error;
      }
      return "enabled" as const;
    },
    async disable(accountKey: string) {
      if ((await vault.readPreferences()).accountKey === accountKey) await clear(true);
    },
    async login(signIn: (username: string, password: string) => Promise<void>) {
      const preferences = await vault.readPreferences();
      if (!belongsToDeployment(preferences.accountKey) || !await vault.isAvailable()) return "unavailable" as const;
      let credentials;
      try {
        credentials = await vault.unlock();
      } catch (error) {
        if (errorMessage(error).toLowerCase().includes("cancel")) return "cancelled" as const;
        throw error;
      }
      // Never authenticate a different deployment/account if a storage write was interrupted.
      if (!credentials || credentials.accountKey !== preferences.accountKey) {
        await clear(preferences.suppressed);
        return "invalidated" as const;
      }
      try {
        await signIn(credentials.username, credentials.password);
      } catch (error) {
        if (!errorMessage(error).includes("Invalid credentials")) throw error;
        await clear(preferences.suppressed);
        return "invalidated" as const;
      }
      return "signed-in" as const;
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Object && "message" in error ? String(error.message) : "";
}
