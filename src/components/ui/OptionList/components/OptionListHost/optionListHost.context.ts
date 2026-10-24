import { createContext, useContext, type ReactNode, type RefObject } from "react";
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
