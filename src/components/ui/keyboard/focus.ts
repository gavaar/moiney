import { Platform, type ViewInstance } from "react-native";

const controls = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]';

export function hasFocusWithin(surface: ViewInstance | null) {
  return Platform.OS === "web" && surface instanceof HTMLElement && surface.contains(document.activeElement);
}

export function focusMovingInto(surface: ViewInstance | null, event: unknown) {
  return Platform.OS === "web" && surface instanceof HTMLElement &&
    typeof event === "object" && event !== null && "relatedTarget" in event &&
    event.relatedTarget instanceof Node && surface.contains(event.relatedTarget);
}

export function focusControls(surface: ViewInstance | null): HTMLElement[] {
  if (Platform.OS !== "web" || !(surface instanceof HTMLElement)) return [];
  return Array.from(surface.querySelectorAll<HTMLElement>(controls)).filter(control =>
    !control.closest('[aria-disabled="true"], [aria-hidden="true"], [inert]') &&
    (!control.checkVisibility || control.checkVisibility({ checkVisibilityCSS: true })),
  );
}

/** Focus actual controls, not pointer-only backdrops or scroll containers. */
export function focusFirstControl(surface: ViewInstance | null) {
  for (const control of focusControls(surface)) {
    control.focus();
    if (document.activeElement === control) return;
  }
}
