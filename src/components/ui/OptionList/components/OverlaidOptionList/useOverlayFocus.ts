import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react";
import { Platform, type ViewInstance } from "react-native";
import { focusControls, focusFirstControl } from "@ui/keyboard/focus";

/** Same-window modal choices need their own keyboard boundary inside the host. */
export function useOverlayFocus(ready: boolean, anchorRef: RefObject<ViewInstance | null>, onRequestClose: () => boolean) {
  const surfaceRef = useRef<ViewInstance>(null);
  const requestClose = useEffectEvent(onRequestClose);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!ready || Platform.OS !== "web" || !(surface instanceof HTMLElement)) return;
    const anchor = anchorRef.current;
    focusFirstControl(surfaceRef.current);
    if (!surface.contains(document.activeElement)) surface.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = focusControls(surfaceRef.current);
      const next = event.shiftKey ? controls.at(-1) : controls[0];
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === boundary || document.activeElement === surface || !controls.length) {
        event.preventDefault();
        (next ?? surface).focus();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape" && requestClose()) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
    surface.addEventListener("keydown", keyDown);
    surface.addEventListener("keyup", keyUp);
    return () => {
      surface.removeEventListener("keydown", keyDown);
      surface.removeEventListener("keyup", keyUp);
      // Do not steal focus from another control/layer when a page becomes hidden.
      if (surface.contains(document.activeElement) || document.activeElement === document.body) {
        // The host removes its content in a subsequent commit. Restore afterward,
        // not during React's focus-preserving DOM update or a temporary remeasure.
        queueMicrotask(() => {
          if (!surface.isConnected && document.activeElement === document.body) focusFirstControl(anchor);
        });
      }
    };
  }, [ready, anchorRef]);
  return surfaceRef;
}
