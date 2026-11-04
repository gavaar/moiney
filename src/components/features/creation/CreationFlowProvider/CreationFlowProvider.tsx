import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, type ViewInstance } from "react-native";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { CreateModal } from "../CreateModal";
import { CreationFlowContext } from "../creation-flow";

export function CreationFlowProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggers = useRef(new Set<ViewInstance>());
  const wasOpen = useRef(false);
  useEffect(() => {
    // A breakpoint change can replace the opener while the modal is active.
    if (wasOpen.current && !isOpen && Platform.OS === "web") {
      for (const trigger of triggers.current) trigger.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return <CreationFlowContext value={{
    open: () => setIsOpen(true),
    registerTrigger: trigger => {
      triggers.current.add(trigger);
      return () => { triggers.current.delete(trigger); };
    },
  }}>
    {children}
    {isOpen ? <PipeCatalogProvider>
      <CreateModal onClose={() => setIsOpen(false)} />
    </PipeCatalogProvider> : null}
  </CreationFlowContext>;
}
