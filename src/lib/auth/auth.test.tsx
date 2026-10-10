// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth";

const mocks = vi.hoisted(() => ({
  mockSetAuth: vi.fn(),
  action: vi.fn(),
  vault: {
    isAvailable: vi.fn(), readPreferences: vi.fn(), writePreferences: vi.fn(),
    save: vi.fn(), unlock: vi.fn(), remove: vi.fn(),
  },
  storage: {
    getRefreshToken: vi.fn(),
    getAccessToken: vi.fn(),
    getAccountKey: vi.fn(),
    setRefreshToken: vi.fn(),
    setAccessToken: vi.fn(),
    setAccountKey: vi.fn(),
  },
}));

vi.mock("convex/react", () => {
  const mockClient = {
    setAuth: mocks.mockSetAuth,
    clearAuth: vi.fn(),
    action: mocks.action,
  };
  return {
    ConvexReactClient: vi.fn(function () {
      return mockClient;
    }),
  };
});

vi.mock("./storage", () => ({
  getRefreshToken: mocks.storage.getRefreshToken,
  getAccessToken: mocks.storage.getAccessToken,
  getAccountKey: mocks.storage.getAccountKey,
  setRefreshToken: mocks.storage.setRefreshToken,
  setAccessToken: mocks.storage.setAccessToken,
  setAccountKey: mocks.storage.setAccountKey,
  removeRefreshToken: vi.fn(),
  removeAccessToken: vi.fn(),
  removeAccountKey: vi.fn(),
}));

vi.mock("./biometrics/vault", () => ({ biometricVault: mocks.vault }));

vi.mock("@/lib/errors", () => ({
  toUserFriendly: vi.fn(),
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    auth: {
      signIn: {},
      signUp: {},
      signOut: {},
      refreshAccess: {},
    },
  },
}));

function AuthStateDisplay() {
  const { accountKey, isLoading, isAuthenticated, login, signUp, signOut, biometrics } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
      <span data-testid="account-key">{accountKey ?? "none"}</span>
      <span data-testid="biometric-offer">{String(biometrics?.offer ?? false)}</span>
      <span data-testid="biometric-enabled">{String(biometrics?.enabled ?? false)}</span>
      <button onClick={() => login("alice", "password123")}>Login</button>
      <button onClick={() => signUp("alice", "alice@example.com", "password123")}>Signup</button>
      <button onClick={() => signOut()}>Logout</button>
      <button onClick={() => biometrics.enable("password123")}>Enable</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.vault.isAvailable.mockResolvedValue(true);
    mocks.vault.readPreferences.mockResolvedValue({ accountKey: null, suppressed: false });
    mocks.action.mockResolvedValue({ refreshToken: "rt", accessToken: "at" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves loading to false when no refresh token exists", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("resolves loading to false when refresh token exists and auth completes", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue("rt");
    mocks.storage.getAccountKey.mockResolvedValue("unknown:user@example.com");

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocks.mockSetAuth).toHaveBeenCalled();
    });

    const onChange = mocks.mockSetAuth.mock.calls[0][1];
    await act(async () => {
      onChange(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("account-key").textContent).toBe(
      "unknown:user@example.com",
    );
  });

  it("persists the replacement refresh token", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue("old-refresh-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "success",
          value: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          },
        }),
      }),
    );

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );
    await waitFor(() => expect(mocks.mockSetAuth).toHaveBeenCalled());
    const fetchToken = mocks.mockSetAuth.mock.calls[0][0];

    const accessToken = await fetchToken({ forceRefreshToken: true });

    expect(accessToken).toBe("new-access-token");
    expect(mocks.storage.setRefreshToken).toHaveBeenCalledWith(
      "new-refresh-token",
    );
    expect(mocks.storage.setAccessToken).toHaveBeenCalledWith(
      "new-access-token",
    );
  });

  it("shares one request between concurrent token refreshes", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue("old-refresh-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "success",
        value: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );
    await waitFor(() => expect(mocks.mockSetAuth).toHaveBeenCalled());
    const fetchToken = mocks.mockSetAuth.mock.calls[0][0];

    const results = await Promise.all([
      fetchToken({ forceRefreshToken: true }),
      fetchToken({ forceRefreshToken: true }),
    ]);

    expect(results).toEqual(["new-access-token", "new-access-token"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["Login", "Signup"])("offers biometrics after %s without changing session authentication", async (button) => {
    mocks.storage.getRefreshToken.mockResolvedValue(null);
    render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => { screen.getByText(button).click(); });
    await waitFor(() => expect(screen.getByTestId("biometric-offer").textContent).toBe("true"));
    expect(mocks.storage.setRefreshToken).toHaveBeenCalledWith("rt");
    expect(mocks.vault.save).not.toHaveBeenCalled();
  });

  it("restores sessions without unlocking or offering biometrics and retains saved credentials on logout", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue("rt");
    mocks.storage.getAccountKey.mockResolvedValue("https://test.convex.cloud:alice");
    mocks.vault.readPreferences.mockResolvedValue({ accountKey: "https://test.convex.cloud:alice", suppressed: false });
    render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
    await waitFor(() => expect(mocks.mockSetAuth).toHaveBeenCalled());
    await act(async () => { mocks.mockSetAuth.mock.calls[0][1](true); });
    expect(screen.getByTestId("biometric-offer").textContent).toBe("false");
    expect(mocks.vault.unlock).not.toHaveBeenCalled();
    await act(async () => { screen.getByText("Logout").click(); });
    expect(mocks.vault.remove).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("does not reinstall a session when Settings password validation finishes after sign-out", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue("old-rt");
    mocks.storage.getAccountKey.mockResolvedValue("https://test.convex.cloud:alice");
    render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
    await waitFor(() => expect(mocks.mockSetAuth).toHaveBeenCalled());
    await act(async () => { mocks.mockSetAuth.mock.calls[0][1](true); });
    let resolveLogin!: (value: { refreshToken: string; accessToken: string }) => void;
    mocks.action.mockReturnValueOnce(new Promise((resolve) => { resolveLogin = resolve; }));
    await act(async () => { screen.getByText("Enable").click(); });
    await act(async () => { screen.getByText("Logout").click(); });
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    await act(async () => { resolveLogin({ refreshToken: "validation-rt", accessToken: "validation-at" }); });
    expect(mocks.mockSetAuth).toHaveBeenCalledOnce();
    expect(mocks.storage.setRefreshToken).not.toHaveBeenCalled();
    expect(mocks.vault.save).not.toHaveBeenCalled();
  });

  it("exposes the saved device slot when a different account's session expires", async () => {
    mocks.storage.getRefreshToken.mockResolvedValue("bob-rt");
    mocks.storage.getAccountKey.mockResolvedValue("https://test.convex.cloud:bob");
    mocks.vault.readPreferences.mockResolvedValue({ accountKey: "https://test.convex.cloud:alice", suppressed: false });
    render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
    await waitFor(() => expect(mocks.mockSetAuth).toHaveBeenCalled());
    await act(async () => { mocks.mockSetAuth.mock.calls[0][1](true); });
    await waitFor(() => expect(screen.getByTestId("biometric-enabled").textContent).toBe("false"));
    await act(async () => { mocks.mockSetAuth.mock.calls[0][1](false); });
    await waitFor(() => expect(screen.getByTestId("biometric-enabled").textContent).toBe("true"));
  });
});
