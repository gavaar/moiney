import { createContext, useContext, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import type { View } from "react-native";

export type OptionListHostValue = {
  viewportRef: RefObject<View | null>;
  present: (id: symbol, content: ReactNode) => void;
  dismiss: (id: symbol) => void;
};

export const OptionListHostContext = createContext<OptionListHostValue | null>(null);

export function useOptionListHost() {
  return useContext(OptionListHostContext);
}

export function OptionListLayer({ children }: { children: ReactNode }) {
  const host = useOptionListHost();
  const [id] = useState(() => Symbol("option-list"));
  useLayoutEffect(() => {
    if (!host) throw new Error("AnchoredOptionList requires an OptionListHost in the current native window");
    host.present(id, children);
    return () => host.dismiss(id);
  }, [host, id, children]);
  return null;
}
