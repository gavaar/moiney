import { useLayoutEffect, useState, type ReactNode } from "react";
import { useOptionListHost } from "../../components/OptionListHost/optionListHost.context";

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
