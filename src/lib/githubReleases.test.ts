import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GitHub release lookup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the newest published non-draft release", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          name: "older",
          html_url: "https://github.com/gavaar/moiney/releases/tag/older",
          published_at: "2026-08-01T00:00:00Z",
          draft: false,
        },
        {
          name: "newest",
          html_url: "https://github.com/gavaar/moiney/releases/tag/newest",
          published_at: "2026-08-03T00:00:00Z",
          draft: false,
        },
        {
          name: "draft",
          html_url: "https://github.com/gavaar/moiney/releases/tag/draft",
          published_at: "2026-08-04T00:00:00Z",
          draft: true,
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getLatestMoineyRelease } = await import("./githubReleases");

    await expect(getLatestMoineyRelease()).resolves.toEqual({
      name: "newest",
      url: "https://github.com/gavaar/moiney/releases/tag/newest",
    });
    await getLatestMoineyRelease();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { getLatestMoineyRelease } = await import("./githubReleases");

    await expect(getLatestMoineyRelease()).resolves.toBeNull();
  });
});
