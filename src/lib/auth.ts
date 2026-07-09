import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { save, clear, getRefreshTokenSync } from "./authState";
import { toUserFriendly } from "./errors";

export function useAuth() {
  const signInAction = useAction(api.auth.signIn);
  const signUpAction = useAction(api.auth.signUp);
  const signOutAction = useAction(api.auth.signOut);

  return {
    login: async (username: string, password: string) => {
      try {
        const result = await signInAction({ username, password });
        await save(result.accessToken, result.refreshToken);
      } catch (e) {
        toUserFriendly(e);
      }
    },
    signUp: async (username: string, email: string, password: string) => {
      try {
        const result = await signUpAction({ username, email, password });
        await save(result.accessToken, result.refreshToken);
      } catch (e) {
        toUserFriendly(e);
      }
    },
    signOut: async () => {
      const refreshToken = getRefreshTokenSync();
      if (refreshToken) {
        try {
          await signOutAction({ refreshToken });
        } catch {
          // ignore server-side errors during sign out
        }
      }
      await clear();
    },
  };
}