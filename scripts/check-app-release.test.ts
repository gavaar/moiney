import { afterEach, describe, expect, it, vi } from "vitest";
import { isAppReleasePublished } from "./check-app-release";

const args = { repository: "gavaar/moiney", version: "0.5.1", commit: "commit-a", token: "test-token" };

describe("release immutability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("allows building an unpublished version", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-a" })));
    expect(await isAppReleasePublished(args)).toBe(false);
  });

  it("reuses a published APK when retrying the same commit", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ draft: false, assets: [{ name: "moiney.apk" }] }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-a" })));
    expect(await isAppReleasePublished(args)).toBe(true);
  });

  it("requires a version bump rather than replacing a previous commit's APK", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ draft: false, assets: [{ name: "moiney.apk" }] }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-old" })));
    await expect(isAppReleasePublished(args)).rejects.toThrow("Bump app.json");
  });

  it("allows resuming a release that has no APK yet", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ draft: false, assets: [] }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-a" }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-a" })));
    expect(await isAppReleasePublished(args)).toBe(false);
  });

  it("does not treat GitHub failures as permission to replace an APK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(isAppReleasePublished(args)).rejects.toThrow("503");
  });

  it("rejects an unpublished older workflow before it can redeploy the backend", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-newer" })));
    await expect(isAppReleasePublished(args)).rejects.toThrow("Obsolete workflow commit");
  });

  it("rejects an incomplete older release before backend deployment", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ draft: false, assets: [] }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-a" }))
      .mockResolvedValueOnce(Response.json({ sha: "commit-newer" })));
    await expect(isAppReleasePublished(args)).rejects.toThrow("Obsolete workflow commit");
  });
});
