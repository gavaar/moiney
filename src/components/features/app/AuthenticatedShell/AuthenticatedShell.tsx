import type { ReactNode } from "react";
import { View } from "react-native";
import { useLayoutMode } from "@/lib/styles/useLayoutMode";
import { ExpandedNavigation } from "./components/ExpandedNavigation/ExpandedNavigation";
import { CreationFlowProvider } from "@features/creation/CreationFlowProvider/CreationFlowProvider";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const expanded = useLayoutMode() === "expanded";
  return <CreationFlowProvider>
    <View className="flex-1 flex-row min-w-0 w-full max-w-app-shell self-center bg-background">
      {expanded ? <ExpandedNavigation /> : null}
      <View className="flex-1 min-w-0 max-w-screen-content mx-auto">{children}</View>
    </View>
  </CreationFlowProvider>;
}
