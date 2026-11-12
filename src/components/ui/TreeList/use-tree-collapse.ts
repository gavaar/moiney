import { useState } from "react";

export type TreeCollapse = { ids: ReadonlySet<string>; onToggle: (id: string) => void };

/** Mount-local state can live above a picker modal or a conditionally rendered view. */
export function useTreeCollapse(): TreeCollapse {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  return {
    ids,
    onToggle: id => setIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
  };
}
