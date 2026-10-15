import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { loadShowInMain, saveShowInMain } from "./persistence";

type Preference = { ready: boolean; showInMain: boolean; setShowInMain: (value: boolean) => void };
const Context = createContext<Preference | null>(null);

export function MonthlyCardPreferenceProvider({ children }: { children: ReactNode }) {
  const { accountKey } = useAuth();
  const [state, setState] = useState<{ accountKey: string; showInMain: boolean } | null>(null);
  const ready = state !== null && state.accountKey === accountKey;

  useEffect(() => {
    if (!accountKey) return;
    let active = true;
    void loadShowInMain(accountKey).then((showInMain) => {
      if (active) setState({ accountKey, showInMain });
    });
    return () => { active = false; };
  }, [accountKey]);

  const setShowInMain = (value: boolean) => {
    if (!accountKey || state?.accountKey !== accountKey) return;
    setState({ accountKey, showInMain: value });
    void saveShowInMain(accountKey, value);
  };

  return <Context.Provider value={{ ready, showInMain: ready ? state.showInMain : true, setShowInMain }}>{children}</Context.Provider>;
}

export function useMonthlyCardPreference() {
  const value = useContext(Context);
  if (!value) throw new Error("useMonthlyCardPreference must be used within MonthlyCardPreferenceProvider");
  return value;
}
