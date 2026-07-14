import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { ConvexReactClient, type AuthTokenFetcher } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  getRefreshToken,
  setRefreshToken as storeRefreshToken,
  removeRefreshToken,
  getAccessToken,
  setAccessToken as storeAccessToken,
  removeAccessToken,
} from "./storage";
import { toUserFriendly } from "@/lib/errors";

let _client: ConvexReactClient | null = null;
export function getConvexClient(): ConvexReactClient {
  if (!_client) {
    const url = process.env.EXPO_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("Missing EXPO_PUBLIC_CONVEX_URL in environment");
    _client = new ConvexReactClient(url);
  }
  return _client;
}

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;

  try {
    const response = await fetch(`${convexUrl}/api/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Convex-Client": "web-1.0",
      },
      body: JSON.stringify({
        path: "auth:refreshAccess",
        format: "convex_encoded_json",
        args: [{ refreshToken }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== "success") return null;
    const value = data.value;
    if (value.accessToken) {
      await storeAccessToken(value.accessToken);
      return value.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

const fetchTokenFn: AuthTokenFetcher = async ({ forceRefreshToken }) => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  if (forceRefreshToken) {
    return refreshAccessToken(refreshToken);
  }

  const accessToken = await getAccessToken();
  if (accessToken) return accessToken;

  return refreshAccessToken(refreshToken);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authSetupRef = useRef(false);

  const handleAuthChange = useCallback((isAuth: boolean) => {
    setIsAuthenticated(isAuth);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (authSetupRef.current) return;
    authSetupRef.current = true;

    getRefreshToken()
      .then((token) => {
        if (token) {
          getConvexClient().setAuth(fetchTokenFn, handleAuthChange);
        } else {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await getConvexClient().action(api.auth.signIn, { username, password });
      await storeRefreshToken(result.refreshToken);
      if (result.accessToken) {
        await storeAccessToken(result.accessToken);
      }
      getConvexClient().setAuth(fetchTokenFn, handleAuthChange);
    } catch (e) {
      toUserFriendly(e);
    }
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    try {
      const result = await getConvexClient().action(api.auth.signUp, { username, email, password });
      await storeRefreshToken(result.refreshToken);
      if (result.accessToken) {
        await storeAccessToken(result.accessToken);
      }
      getConvexClient().setAuth(fetchTokenFn, handleAuthChange);
    } catch (e) {
      toUserFriendly(e);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const token = await getRefreshToken();
      if (token) {
        await getConvexClient().action(api.auth.signOut, { refreshToken: token }).catch(() => {});
      }
    } finally {
      getConvexClient().clearAuth();
      await removeAccessToken();
      await removeRefreshToken();
      setIsAuthenticated(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isLoading, isAuthenticated, login, signUp, signOut }),
    [isLoading, isAuthenticated, login, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
