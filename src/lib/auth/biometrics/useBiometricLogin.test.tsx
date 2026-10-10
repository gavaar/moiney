// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBiometricLogin } from "./useBiometricLogin";

const vault = vi.hoisted(() => ({
  isAvailable: vi.fn(), readPreferences: vi.fn(), writePreferences: vi.fn(),
  save: vi.fn(), unlock: vi.fn(), remove: vi.fn(),
}));
vi.mock("./vault", () => ({ biometricVault: vault }));
const credentials = { accountKey: "https://test.convex.cloud:alice", username: "alice", password: "secret" };

describe("biometric login orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vault.isAvailable.mockResolvedValue(true);
    vault.readPreferences.mockResolvedValue({ accountKey: null, suppressed: false });
    vault.save.mockResolvedValue(true);
  });

  it("offers setup after password authentication and releases the password on dismissal", async () => {
    const { result } = renderHook(() => useBiometricLogin(vi.fn(), credentials.accountKey, vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.offerAfterLogin(credentials));
    expect(result.current.offer).toBe(true);
    await act(() => result.current.dismissOffer(false));
    expect(result.current.offer).toBe(false);
    await act(() => result.current.enable());
    expect(vault.save).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Enter your current password to enable biometric login.");
  });

  it("revalidates Settings passwords before enabling and never saves a rejected password", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error("Invalid credentials"));
    const { result } = renderHook(() => useBiometricLogin(vi.fn(), credentials.accountKey, signIn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.enable("wrong"));
    expect(vault.save).not.toHaveBeenCalled();
    signIn.mockResolvedValue(undefined);
    await act(() => result.current.enable("correct"));
    expect(vault.save).toHaveBeenCalledWith({ ...credentials, password: "correct" });
  });

  it("uses offer credentials without another password login and suppresses explicitly declined offers", async () => {
    const signIn = vi.fn();
    const { result } = renderHook(() => useBiometricLogin(signIn, credentials.accountKey, vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.offerAfterLogin(credentials));
    await act(() => result.current.enable());
    expect(signIn).not.toHaveBeenCalled();
    expect(vault.save).toHaveBeenCalledWith(credentials);
    expect(result.current.offer).toBe(false);
    await act(() => result.current.offerAfterLogin(credentials));
    await act(() => result.current.dismissOffer(true));
    expect(vault.writePreferences).toHaveBeenLastCalledWith({ accountKey: null, suppressed: true });
  });

  it("never displays another account's enabled setting while an account switch loads", async () => {
    vault.readPreferences.mockResolvedValue({ accountKey: credentials.accountKey, suppressed: false });
    const { result, rerender } = renderHook(({ accountKey }) => useBiometricLogin(vi.fn(), accountKey, vi.fn()), {
      initialProps: { accountKey: credentials.accountKey },
    });
    await waitFor(() => expect(result.current.enabled).toBe(true));
    vault.readPreferences.mockImplementation(() => new Promise(() => {}));
    rerender({ accountKey: "https://test.convex.cloud:bob" });
    expect(result.current.loading).toBe(true);
    expect(result.current.enabled).toBe(false);
  });

  it("does not resurrect an offer whose eligibility check completed after dismissal", async () => {
    let resolvePreferences!: (value: { accountKey: null; suppressed: false }) => void;
    const pendingPreferences = new Promise<{ accountKey: null; suppressed: false }>((resolve) => { resolvePreferences = resolve; });
    const { result } = renderHook(() => useBiometricLogin(vi.fn(), credentials.accountKey, vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vault.readPreferences.mockReturnValueOnce(pendingPreferences);
    let pendingOffer!: Promise<void>;
    act(() => { pendingOffer = result.current.offerAfterLogin(credentials); });
    await act(() => result.current.dismissOffer(false));
    await act(async () => { resolvePreferences({ accountKey: null, suppressed: false }); await pendingOffer; });
    expect(result.current.offer).toBe(false);
    await act(() => result.current.enable());
    expect(vault.save).not.toHaveBeenCalled();
  });
});
