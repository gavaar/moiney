import { useCallback, useState, useSyncExternalStore } from "react";
import { useIsFocused } from "expo-router/react-navigation";

function createClock() {
  let now = Date.now();
  return {
    getSnapshot: () => now,
    subscribe(onChange: () => void) {
      const tick = () => {
        now = Date.now();
        onChange();
      };
      tick();
      const timer = setInterval(tick, 60000);
      return () => clearInterval(timer);
    },
  };
}

/** One focus-scoped clock per visible list or timed rule form. */
export function useRuleClock(enabled: boolean) {
  const focused = useIsFocused();
  const [clock] = useState(createClock);
  const subscribe = useCallback((onChange: () => void) => {
    if (!focused || !enabled) return () => {};
    return clock.subscribe(onChange);
  }, [clock, enabled, focused]);
  return useSyncExternalStore(subscribe, clock.getSnapshot, clock.getSnapshot);
}
