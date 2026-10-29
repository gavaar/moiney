import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type RefObject } from "react";
import { BackHandler, Platform, View, type ViewInstance } from "react-native";
import { OptionListHostContext, type OptionListHostValue } from "../../optionListHost.context";

/** Keeps floating content in the same native window, outside descendant scroll views. */
export function OptionListHost({ children, boundsRef, backHandlerRef }: {
  children: ReactNode;
  boundsRef?: RefObject<ViewInstance | null>;
  backHandlerRef?: RefObject<(() => boolean) | null>;
}) {
  const viewportRef = useRef<ViewInstance>(null);
  const [entry, setEntry] = useState<{ id: symbol; content: ReactNode; onRequestClose?: () => boolean } | null>(null);
  useImperativeHandle(backHandlerRef, () => () => entry?.onRequestClose?.() ?? false, [entry]);
  useEffect(() => {
    if (Platform.OS === "web" || backHandlerRef || !entry?.onRequestClose) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", entry.onRequestClose);
    return () => listener.remove();
  }, [backHandlerRef, entry?.onRequestClose]);
  const [host] = useState<OptionListHostValue>(() => ({
    viewportRef,
    boundsRef,
    present: (id, content, onRequestClose) => setEntry({ id, content, onRequestClose }),
    dismiss: id => setEntry(current => current?.id === id ? null : current),
  }));

  return <OptionListHostContext.Provider value={host}>
    <View ref={viewportRef} collapsable={false} style={{ flex: 1 }} pointerEvents="box-none">
      {children}
      {entry?.content}
    </View>
  </OptionListHostContext.Provider>;
}
