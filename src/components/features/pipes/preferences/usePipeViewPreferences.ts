import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { pipeViewStorage } from "./storage";

export type PipeViewStorage = {
  read: (accountKey: string) => Promise<string | null>;
  write: (accountKey: string, value: string) => Promise<void>;
};

function parseIds(raw: string | null): Set<string> {
  try {
    const value: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function usePipeViewPreferences(
  catalogIds?: readonly string[],
  storage: PipeViewStorage = pipeViewStorage,
) {
  const { accountKey } = useAuth();
  const [state, setState] = useState<{ key: string; minimized: Set<string>; dirty: boolean } | null>(null);
  const pendingWrites = useRef(Promise.resolve());
  const ready = accountKey !== null && state?.key === accountKey;

  useEffect(() => {
    if (!accountKey) return;
    let active = true;
    void storage.read(accountKey).then((raw) => {
      if (active) setState({ key: accountKey, minimized: parseIds(raw), dirty: false });
    });
    return () => { active = false; };
  }, [accountKey, storage]);

  const update = useCallback((change: (current: Set<string>) => Set<string>) => {
    if (!accountKey) return;
    setState((previous) => {
      if (previous?.key !== accountKey) return previous;
      const minimized = change(previous.minimized);
      if (minimized === previous.minimized) return previous;
      return { key: accountKey, minimized, dirty: true };
    });
  }, [accountKey]);

  useEffect(() => {
    if (!state?.dirty) return;
    const value = JSON.stringify([...state.minimized]);
    pendingWrites.current = pendingWrites.current
      .catch(() => {})
      .then(() => storage.write(state.key, value));
  }, [state, storage]);

  // An undefined catalog means the query is still loading, not that pipes were deleted.
  const catalogKey = catalogIds?.join("\u0000");
  useEffect(() => {
    if (!ready || catalogIds === undefined) return;
    const valid = new Set(catalogIds);
    // The catalog is an external query; prune only when it has fully loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    update((current) => {
      if ([...current].every((id) => valid.has(id))) return current;
      return new Set([...current].filter((id) => valid.has(id)));
    });
    // catalogKey is the stable representation of the current catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, catalogKey, update]);

  const minimize = useCallback((id: string) => update((current) => {
    if (current.has(id)) return current;
    return new Set([...current, id]);
  }), [update]);
  const maximize = useCallback((id: string) => update((current) => {
    if (!current.has(id)) return current;
    const next = new Set(current);
    next.delete(id);
    return next;
  }), [update]);

  return {
    ready,
    minimized: ready ? state.minimized : new Set<string>(),
    minimize,
    maximize,
  };
}
