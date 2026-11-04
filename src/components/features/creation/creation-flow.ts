import { createContext, useContext } from "react";
import type { ViewInstance } from "react-native";

export const CreationFlowContext = createContext<{
  open: () => void;
  registerTrigger: (trigger: ViewInstance) => () => void;
} | null>(null);

export function useCreationFlow() {
  const flow = useContext(CreationFlowContext);
  if (!flow) throw new Error("useCreationFlow must be used within CreationFlowProvider");
  return flow;
}
