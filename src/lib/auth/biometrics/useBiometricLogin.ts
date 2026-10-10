import { useCallback, useEffect, useRef, useState } from "react";
import { createBiometricLogin, type Credentials } from "./biometricLogin";
import { biometricVault } from "./vault";

const biometricLogin = createBiometricLogin(biometricVault, process.env.EXPO_PUBLIC_CONVEX_URL ?? "unknown");

export function useBiometricLogin(
  signIn: (username: string, password: string) => Promise<void>,
  accountKey: string | null,
  verifyCredentials: (username: string, password: string) => Promise<void>,
) {
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<{
    accountKey: string | null; revision: number; available: boolean; enabled: boolean;
  } | null>(null);
  const loading = status === null || status.accountKey !== accountKey || status.revision !== revision;
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credentials = useRef<Credentials | null>(null);
  const offerGeneration = useRef(0);
  const working = useRef(false);

  useEffect(() => {
    let active = true;
    biometricLogin.status(accountKey).then((value) => {
      if (active) setStatus({ ...value, accountKey, revision });
    }).catch(() => {
      if (active) setStatus({ available: false, enabled: false, accountKey, revision });
    });
    return () => { active = false; };
  }, [accountKey, revision]);

  // Serialize OS prompts and storage writes for slot replacement and deletion.
  const run = useCallback(async (operation: () => Promise<boolean>) => {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("Invalid credentials")
        ? "Invalid username or password" : "Couldn't complete biometric setup or login. Please try again.");
      return false;
    } finally {
      working.current = false;
      setBusy(false);
      setRevision((value) => value + 1);
    }
  }, []);

  const offerAfterLogin = useCallback(async (value: Credentials) => {
    const generation = ++offerGeneration.current;
    credentials.current = null;
    setOffer(false);
    // Optional setup must never turn a successful password login into a failure.
    try {
      if (await biometricLogin.shouldOffer(value.accountKey) && generation === offerGeneration.current) {
        credentials.current = value;
        setOffer(true);
      }
    } catch { /* Login remains available if device storage is unavailable. */ }
  }, []);

  const dismissOffer = useCallback(async (suppress: boolean) => {
    offerGeneration.current += 1;
    credentials.current = null;
    setOffer(false);
    if (suppress) await run(async () => { await biometricLogin.suppressOffer(); return true; });
  }, [run]);

  const enable = useCallback((password?: string) => run(async () => {
    const generation = offerGeneration.current;
    let value = credentials.current;
    if (!value || value.accountKey !== accountKey) {
      if (!password || !accountKey) {
        setError("Enter your current password to enable biometric login.");
        return false;
      }
      const username = accountKey.slice(`${process.env.EXPO_PUBLIC_CONVEX_URL ?? "unknown"}:`.length);
      await verifyCredentials(username, password);
      if (generation !== offerGeneration.current) return false;
      value = { accountKey, username, password };
    }
    const result = await biometricLogin.enable(value);
    // Keep plaintext only for the lifetime of the offer, never for future Settings visits.
    credentials.current = null;
    setOffer(false);
    if (result === "unavailable") setError("Biometric login is not available on this device.");
    return result === "enabled";
  }), [accountKey, run, verifyCredentials]);

  const disable = useCallback(() => run(async () => {
    if (!accountKey) return false;
    await biometricLogin.disable(accountKey);
    return true;
  }), [accountKey, run]);

  const login = useCallback(() => run(async () => {
    const result = await biometricLogin.login(signIn);
    if (result === "invalidated") setError("Saved login details are no longer valid. Sign in with your password to set up biometrics again.");
    return result === "signed-in";
  }), [run, signIn]);

  return {
    available: status?.available ?? false,
    enabled: status?.accountKey === accountKey && status.enabled,
    loading, busy, offer, error, login, enable, disable, offerAfterLogin, dismissOffer,
  };
}
