import { useCallback, useLayoutEffect, useRef } from "react";
import { useNavigationContainerRef } from "expo-router";
import { focusedRoute, readDismissalId, writeLocalHistory } from "@/lib/navigation/local-history";

type Navigation = ReturnType<typeof useNavigationContainerRef>;
type Registration = { remove: () => void; activate: () => void };
type Guard = { id: string; routeKey: string; phase: "pending" | "armed" | "releasing" };
const controllers = new WeakMap<Navigation, ReturnType<typeof createController>>();
let sequence = 0;

function createController(navigation: Navigation) {
  const layers = new Map<symbol, () => void>();
  let guard: Guard | undefined;
  const dispose = () => {
    if (layers.size || guard) return;
    unsubscribe();
    controllers.delete(navigation);
  };
  const arm = () => {
    const root = navigation.getRootState();
    if (!root || guard || !layers.size) return;
    const route = focusedRoute(root);
    guard = { id: `modal:${sequence++}`, routeKey: route.key, phase: "pending" };
    // Reuse a dormant Forward stop instead of accumulating duplicate entries.
    writeLocalHistory(navigation, route.key, {
      operation: readDismissalId(route) ? "replace" : "push",
      dismissalId: guard.id,
    });
  };
  const release = () => {
    if (!guard || guard.phase !== "armed") return;
    guard.phase = "releasing";
    writeLocalHistory(navigation, guard.routeKey, { operation: "pop", dismissalId: null });
  };
  const unsubscribe = navigation.addListener("state", event => {
    if (event.data.state?.stale !== false) return;
    if (!guard) { arm(); dispose(); return; }
    const route = focusedRoute(event.data.state);
    if (route.key !== guard.routeKey) {
      // Another screen owns navigation now; never pop its history on cleanup.
      guard = undefined;
      arm();
      dispose();
      return;
    }
    const marker = readDismissalId(route);
    if (guard.phase === "pending") {
      // A child effect can queue a stop before the parent emits the preceding
      // state. Only the stop's own acknowledgement arms browser dismissal.
      if (marker === guard.id) {
        guard.phase = "armed";
        if (!layers.size) release();
      }
    } else if (guard.phase === "releasing") {
      if (marker !== guard.id) { guard = undefined; arm(); dispose(); }
    } else if (marker !== guard.id) {
      guard = undefined;
      const close = [...layers.values()].at(-1);
      // Restore protection before requesting closure: saving can block it, and
      // dirty forms can open another modal instead of closing the current one.
      arm();
      close?.();
    }
  });
  return {
    register(close: () => void): Registration {
      const key = Symbol();
      layers.set(key, close);
      arm();
      return {
        activate: () => {
          if (!layers.has(key)) return;
          layers.delete(key);
          layers.set(key, close);
        },
        remove: () => {
          layers.delete(key);
          if (!layers.size) release();
          dispose();
        },
      };
    },
  };
}

export function useModalBack(visible: boolean, requestClose: () => void) {
  const navigation = useNavigationContainerRef();
  const close = useRef(requestClose);
  const registration = useRef<Registration | null>(null);
  useLayoutEffect(() => { close.current = requestClose; });
  useLayoutEffect(() => {
    if (!visible) return;
    let controller = controllers.get(navigation);
    if (!controller) {
      controller = createController(navigation);
      controllers.set(navigation, controller);
    }
    const current = controller.register(() => close.current());
    registration.current = current;
    return () => { registration.current = null; current.remove(); };
  }, [navigation, visible]);
  return useCallback(() => registration.current?.activate(), []);
}
