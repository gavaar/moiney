import type { KeyboardEvent } from "react";
import { Platform, type KeyDownEvent } from "react-native";

export type ControlKeyEvent = KeyDownEvent | KeyboardEvent<HTMLElement>;

export function keyboardKey(event: ControlKeyEvent) {
  return "key" in event ? event.key : event.nativeEvent.key;
}

export function isComposingKey(event: { nativeEvent: object }) {
  const key = event.nativeEvent;
  return ("isComposing" in key && !!key.isComposing) || ("keyCode" in key && key.keyCode === 229);
}

// IME Escape cancels composition, not the surrounding picker/editor layer.
// Do not preventDefault: the editor still needs its native cancellation behavior.
export const editorKeyboardProps = Platform.OS === "web" ? {
  onKeyUpCapture(event: ControlKeyEvent) {
    if (keyboardKey(event) === "Escape" && isComposingKey(event)) event.stopPropagation();
  },
} : {};

// RN Web handles Enter for every Pressable, but Space only for button roles.
// Keep checkbox/radio semantics and use the same click/disabled path as pointers.
export const choiceKeyboardProps = Platform.OS === "web" ? {
  onKeyDown(event: ControlKeyEvent) {
    if (keyboardKey(event) !== " ") return;
    event.preventDefault();
    event.stopPropagation();
  },
  onKeyUp(event: ControlKeyEvent) {
    if (keyboardKey(event) !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.click();
  },
} : {};
