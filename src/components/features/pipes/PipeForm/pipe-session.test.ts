import { describe, expect, it } from "vitest";
import type { IconName } from "@ui/Icon";
import { changePipeSession, createPipeSession, readPipeSession, resetPipeSession } from "./pipe-session";

describe("pipe session icons", () => {
  const context = { pipes: [] };

  it.each<IconName>(["wallet-outline", "pipe", "feed-pipe"])("preserves a custom %s icon across type changes", icon => {
    let session = createPipeSession();
    session = changePipeSession(session, { kind: "boiler" }, context);
    session = changePipeSession(session, { icon }, context);
    session = changePipeSession(session, { kind: "feed" }, context);
    expect(readPipeSession(session, context).draft.icon).toBe(icon);
    session = changePipeSession(session, { kind: "boiler" }, context);
    expect(readPipeSession(session, context).draft.icon).toBe(icon);
  });

  it("restores automatic type icons after resetting a custom icon", () => {
    let session = createPipeSession();
    session = changePipeSession(session, { kind: "boiler" }, context);
    session = changePipeSession(session, { icon: "wallet-outline" }, context);
    session = resetPipeSession(session, context);
    expect(readPipeSession(session, context).draft.kind).toBeNull();
    session = changePipeSession(session, { kind: "feed" }, context);
    expect(readPipeSession(session, context).draft.icon).toBe("feed-pipe");
  });
});
