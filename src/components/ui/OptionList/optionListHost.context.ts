import { createContext, useContext, type ReactNode, type RefObject } from "react";
import type { ViewInstance } from "react-native";

export type OptionListHostValue = {
  viewportRef: RefObject<ViewInstance | null>;
  boundsRef?: RefObject<ViewInstance | null>;
  present: (id: symbol, content: ReactNode, onRequestClose?: () => boolean) => void;
  dismiss: (id: symbol) => void;
};

export const OptionListHostContext = createContext<OptionListHostValue | null>(null);

export function useOptionListHost() {
  return useContext(OptionListHostContext);
}
