// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  mockSetAuth: vi.fn(),
  storage: {
    getRefreshToken: vi.fn(),
    getAccessToken: vi.fn(),
  },
}));

vi.mock("convex/react", () => {
  const mockClient = {
    setAuth: mocks.mockSetAuth,
    clearAuth: vi.fn(),
    action: vi.fn(),
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
  setRefreshToken: vi.fn(),
  setAccessToken: vi.fn(),
  removeRefreshToken: vi.fn(),
  removeAccessToken: vi.fn(),
}));

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

import { AuthProvider, useAuth } from "./auth";

function AuthStateDisplay() {
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
