import { describe, expect, it, vi } from "vitest";
import { createBiometricLogin, type BiometricVault, type Credentials, type Preferences } from "./biometricLogin";

const alice: Credentials = { accountKey: "deployment:alice", username: "alice", password: "password123" };

function fixture() {
  let preferences: Preferences = { accountKey: null, suppressed: false };
  let saved: Credentials | null = null;
  const vault: BiometricVault = {
    isAvailable: vi.fn().mockResolvedValue(true),
    readPreferences: async () => preferences,
    writePreferences: vi.fn(async (value) => { preferences = value; }),
    save: vi.fn(async (value) => { saved = value; return true; }),
    unlock: vi.fn(async () => saved),
    remove: vi.fn(async () => { saved = null; }),
  };
  return { vault, module: createBiometricLogin(vault, "deployment") };
}

describe("biometric login", () => {
  it("enables only after protected storage accepts credentials and signs in through that slot", async () => {
    const { module } = fixture();
    expect((await module.status(alice.accountKey)).enabled).toBe(false);
    expect(await module.enable(alice)).toBe("enabled");
    expect((await module.status(alice.accountKey)).enabled).toBe(true);
    const signIn = vi.fn();
    expect(await module.login(signIn)).toBe("signed-in");
    expect(signIn).toHaveBeenCalledWith("alice", "password123");
  });

  it("keeps the previous slot when replacement is cancelled", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    vi.mocked(vault.save).mockResolvedValueOnce(false);
    expect(await module.enable({ ...alice, accountKey: "deployment:bob", username: "bob" })).toBe("cancelled");
    expect((await module.status(alice.accountKey)).enabled).toBe(true);
    expect((await module.status("deployment:bob")).enabled).toBe(false);
  });

  it("replaces the single account slot and offers only for accounts not already saved", async () => {
    const { module } = fixture();
    expect(await module.shouldOffer(alice.accountKey)).toBe(true);
    await module.enable(alice);
    expect(await module.shouldOffer(alice.accountKey)).toBe(false);
    expect(await module.shouldOffer("deployment:bob")).toBe(true);
    await module.enable({ ...alice, accountKey: "deployment:bob", username: "bob" });
    expect((await module.status(alice.accountKey)).enabled).toBe(false);
    const signIn = vi.fn();
    await module.login(signIn);
    expect(signIn).toHaveBeenCalledWith("bob", alice.password);
  });

  it("suppresses offers device-wide without preventing manual setup", async () => {
    const { module } = fixture();
    await module.suppressOffer();
    expect(await module.shouldOffer(alice.accountKey)).toBe(false);
    expect(await module.shouldOffer("deployment:bob")).toBe(false);
    expect(await module.enable(alice)).toBe("enabled");
    expect(await module.shouldOffer("deployment:bob")).toBe(false);
  });

  it("removes credentials and suppresses offers only when the saved account disables", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    await module.disable("deployment:bob");
    expect(vault.remove).not.toHaveBeenCalled();
    await module.disable(alice.accountKey);
    expect((await module.status(null)).enabled).toBe(false);
    expect(await module.shouldOffer(alice.accountKey)).toBe(false);
    expect(await module.login(vi.fn())).toBe("unavailable");
  });

  it("never offers, stores, or unlocks credentials on an unsupported device", async () => {
    const { module, vault } = fixture();
    vi.mocked(vault.isAvailable).mockResolvedValue(false);
    expect(await module.shouldOffer(alice.accountKey)).toBe(false);
    expect(await module.enable(alice)).toBe("unavailable");
    expect(await module.login(vi.fn())).toBe("unavailable");
    expect(vault.save).not.toHaveBeenCalled();
    expect(vault.unlock).not.toHaveBeenCalled();
  });

  it("keeps saved credentials on cancellation and network failures", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    vi.mocked(vault.unlock).mockRejectedValueOnce(new Error("User canceled the operation."));
    expect(await module.login(vi.fn())).toBe("cancelled");
    const signIn = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    await expect(module.login(signIn)).rejects.toThrow("Network unavailable");
    expect((await module.status(alice.accountKey)).enabled).toBe(true);
    expect(vault.remove).not.toHaveBeenCalled();
  });

  it.each(["Invalid credentials", "A(auth:signIn): Invalid credentials"])('deletes rejected credentials for "%s"', async (message) => {
    const { module, vault } = fixture();
    await module.enable(alice);
    expect(await module.login(vi.fn().mockRejectedValue(new Error(message)))).toBe("invalidated");
    expect(vault.remove).toHaveBeenCalledOnce();
    expect((await module.status(null)).enabled).toBe(false);
  });

  it("invalidates missing enrollment-bound credentials without attempting login", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    vi.mocked(vault.unlock).mockResolvedValueOnce(null);
    const signIn = vi.fn();
    expect(await module.login(signIn)).toBe("invalidated");
    expect(signIn).not.toHaveBeenCalled();
    expect((await module.status(null)).enabled).toBe(false);
  });

  it("fails closed if credential storage and slot metadata disagree", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    vi.mocked(vault.unlock).mockResolvedValueOnce({ ...alice, accountKey: "other-deployment:alice" });
    const signIn = vi.fn();
    expect(await module.login(signIn)).toBe("invalidated");
    expect(signIn).not.toHaveBeenCalled();
  });
  it("does not mark removal complete if protected storage cannot delete", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    vi.mocked(vault.remove).mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(module.disable(alice.accountKey)).rejects.toThrow("Storage unavailable");
    expect((await module.status(alice.accountKey)).enabled).toBe(true);
  });

  it("never unlocks or sends saved credentials to another deployment", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    const otherDeployment = createBiometricLogin(vault, "other-deployment");
    expect((await otherDeployment.status(null)).enabled).toBe(false);
    const signIn = vi.fn();
    expect(await otherDeployment.login(signIn)).toBe("unavailable");
    expect(vault.unlock).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("removes an orphaned secret when publishing the enabled slot fails", async () => {
    const { module, vault } = fixture();
    vi.mocked(vault.writePreferences).mockRejectedValueOnce(new Error("Storage full"));
    await expect(module.enable(alice)).rejects.toThrow("Storage full");
    expect(vault.remove).toHaveBeenCalledOnce();
    expect((await module.status(null)).enabled).toBe(false);
  });

  it("does not leave the previous account falsely enabled after a failed replacement publication", async () => {
    const { module, vault } = fixture();
    await module.enable(alice);
    vi.mocked(vault.writePreferences).mockRejectedValueOnce(new Error("Storage full"));
    await expect(module.enable({ ...alice, accountKey: "deployment:bob", username: "bob" })).rejects.toThrow("Storage full");
    expect((await module.status(alice.accountKey)).enabled).toBe(false);
    expect(await module.shouldOffer(alice.accountKey)).toBe(true);
    expect(await module.login(vi.fn())).toBe("unavailable");
  });
});
