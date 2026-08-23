import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function useUsernameAvailability(username: string | undefined) {
  return useQuery(
    api.accounts.isUsernameAvailable,
    username ? { username } : "skip",
  );
}
