// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipeViewPreferences } from "./usePipeViewPreferences";

const auth = { accountKey: "deployment:alice" as string | null };
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));

describe("usePipeViewPreferences", () => {
  beforeEach(() => { auth.accountKey = "deployment:alice"; });

  it("hydrates saved IDs, persists changes and prunes only against a loaded catalog", async () => {
    const entries = new Map([["deployment:alice", '["one","deleted"]']]);
    const storage = {
      read: vi.fn(async (key: string) => entries.get(key) ?? null),
      write: vi.fn(async (key: string, value: string) => { entries.set(key, value); }),
    };
    const { result, rerender } = renderHook(
      ({ ids }: { ids?: string[] }) => usePipeViewPreferences(ids, storage),
      { initialProps: { ids: undefined as string[] | undefined } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.minimized.has("deleted")).toBe(true);
    expect(storage.write).not.toHaveBeenCalled();

    rerender({ ids: ["one", "two"] });
    await waitFor(() => expect(result.current.minimized.has("deleted")).toBe(false));
    act(() => result.current.minimize("two"));
    await waitFor(() => expect(entries.get("deployment:alice")).toBe('["one","two"]'));
    act(() => result.current.maximize("one"));
    await waitFor(() => expect(entries.get("deployment:alice")).toBe('["two"]'));
  });

  it("does not expose another account's choices while switching accounts", async () => {
    const storage = {
      read: vi.fn(async (key: string) => key.endsWith("alice") ? '["one"]' : null),
      write: vi.fn(async () => {}),
    };
    const { result, rerender } = renderHook(() => usePipeViewPreferences(undefined, storage));
    await waitFor(() => expect(result.current.minimized.has("one")).toBe(true));
    auth.accountKey = "deployment:bob";
    rerender();
    expect(result.current.ready).toBe(false);
    expect(result.current.minimized.has("one")).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
});
