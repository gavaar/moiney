import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  getAccessSnapshot,
  subscribeAccess,
  getRefreshSnapshot,
  subscribeRefresh,
  init,
  setAccessToken,
  clear,
} from "@/lib/authState";

export function useCustomAuth() {
  const accessToken = useSyncExternalStore(subscribeAccess, getAccessSnapshot);
  const refreshToken = useSyncExternalStore(subscribeRefresh, getRefreshSnapshot);
  const refreshAccess = useAction(api.auth.refreshAccess);

  useEffect(() => {
    init();
  }, []);

  const fetchAccessToken = useCallback(
    async (args?: { forceRefreshToken?: boolean }) => {
      if (accessToken && !args?.forceRefreshToken) return accessToken;
      if (!refreshToken) return null;

      try {
        const result = await refreshAccess({ refreshToken });
        setAccessToken(result.accessToken);
        return result.accessToken;
      } catch {
        await clear();
        return null;
      }
    },
    [accessToken, refreshToken, refreshAccess],
  );

  return {
    isLoading: refreshToken === undefined,
    isAuthenticated: refreshToken !== null && refreshToken !== undefined,
    fetchAccessToken,
  };
}