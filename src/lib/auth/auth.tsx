import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import { getRefreshToken, setRefreshToken as storeRefreshToken, removeRefreshToken } from "./storage";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    getRefreshToken()
      .then((token) => {
        setIsAuthenticated(token !== null);
        setIsLoading(false);
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
      setIsAuthenticated(true);
    } catch (e) {
      toUserFriendly(e);
    }
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    try {
      const result = await getConvexClient().action(api.auth.signUp, { username, email, password });
      await storeRefreshToken(result.refreshToken);
      setIsAuthenticated(true);
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
