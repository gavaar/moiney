import { useLayoutEffect, useState, type ReactNode } from "react";
import { useOptionListHost } from "../../optionListHost.context";

export function OptionListLayer({ children, onRequestClose }: { children: ReactNode; onRequestClose?: () => boolean }) {
  const host = useOptionListHost();
  const [id] = useState(() => Symbol("option-list"));
  useLayoutEffect(() => {
    if (!host) throw new Error("Floating option lists require an OptionListHost in the current native window");
    host.present(id, children, onRequestClose);
    return () => host.dismiss(id);
  }, [host, id, children, onRequestClose]);
  return null;
}
