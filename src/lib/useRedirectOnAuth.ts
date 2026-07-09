import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useConvexAuth } from "convex/react";

export function useRedirectOnAuth() {
  const [loginAttempted, setLoginAttempted] = useState(false);
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (isAuthenticated && loginAttempted) {
      router.replace("/");
    }
  }, [isAuthenticated, loginAttempted]);

  return { markLoginAttempted: () => setLoginAttempted(true) };
}