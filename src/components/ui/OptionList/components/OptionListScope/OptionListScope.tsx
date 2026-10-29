import { createContext, useContext, type ReactNode } from "react";

const ActiveContext = createContext(true);

/** Hidden modes/pages keep their drafts mounted without presenting floating UI. */
export function OptionListScope({ active, children }: { active: boolean; children: ReactNode }) {
  const parentActive = useContext(ActiveContext);
  return <ActiveContext.Provider value={parentActive && active}>{children}</ActiveContext.Provider>;
}

export function useOptionListActive() { return useContext(ActiveContext); }
