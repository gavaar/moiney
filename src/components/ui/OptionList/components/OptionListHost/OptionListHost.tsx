import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { OptionListHostContext, type OptionListHostValue } from "./optionListHost.context";

/** Keeps floating content in the same native window, outside descendant scroll views. */
export function OptionListHost({ children }: { children: ReactNode }) {
  const viewportRef = useRef<View>(null);
  const [entry, setEntry] = useState<{ id: symbol; content: ReactNode } | null>(null);
  const [host] = useState<OptionListHostValue>(() => ({
    viewportRef,
    present: (id, content) => setEntry({ id, content }),
    dismiss: id => setEntry(current => current?.id === id ? null : current),
  }));

  return <OptionListHostContext.Provider value={host}>
    <View ref={viewportRef} collapsable={false} style={{ flex: 1 }} pointerEvents="box-none">
      {children}
      {entry?.content}
    </View>
  </OptionListHostContext.Provider>;
}
