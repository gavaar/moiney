import { useEffect, useState } from "react";
import { useIsFocused } from "expo-router/react-navigation";

/** One clock owned by the visible list, shared by all its timed rule icons. */
export function useRuleClock(enabled: boolean) {
  const focused = useIsFocused();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!focused || !enabled) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [enabled, focused]);
  return now;
}
