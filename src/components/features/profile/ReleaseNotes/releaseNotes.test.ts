import { afterEach, describe, expect, it, vi } from "vitest";
import { loadReleaseNotes } from "./releaseNotes";

const fetchMock = vi.fn();
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("version-specific release notes", () => {
  it("fetches the exact installed tag and keeps its Markdown body", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(reply({ body: "## Changes\n\n* Fixed settlement" }));
    expect(await loadReleaseNotes("1.2.3")).toBe("## Changes\n\n* Fixed settlement");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/gavaar/moiney/releases/tags/1.2.3");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([null, "", "   "])("falls back to the tagged commit when the body is %j", async (body) => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(reply({ body }))
      .mockResolvedValueOnce(reply({ commit: { message: "0.5.3 (#24)\n\n* Fixed settlement" } }));
    expect(await loadReleaseNotes(`fallback-${String(body)}`)).toBe("0.5.3 (#24)\n\n* Fixed settlement");
    expect(fetchMock.mock.calls[1][0]).toBe(`https://api.github.com/repos/gavaar/moiney/commits/${encodeURIComponent(`fallback-${String(body)}`)}`);
  });

  it("can use an existing tag even without a published release", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(reply({}, 404))
      .mockResolvedValueOnce(reply({ commit: { message: "Tagged changes" } }));
    expect(await loadReleaseNotes("unpublished")).toBe("Tagged changes");
  });

  it("reports unavailable when neither source exists", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(reply({}, 404));
    expect(await loadReleaseNotes("missing")).toBeNull();
  });

  it("reports unavailable for empty commit messages", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(reply({ body: null }))
      .mockResolvedValueOnce(reply({ commit: { message: " " } }));
    expect(await loadReleaseNotes("empty")).toBeNull();
  });

  it.each([403, 429, 500])("rejects HTTP %i so the UI can offer retry", async (status) => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(reply({ message: "Unavailable" }, status));
    await expect(loadReleaseNotes(`error-${status}`)).rejects.toThrow();
  });

  it("does not disguise a commit lookup failure as missing notes", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(reply({ body: null })).mockResolvedValueOnce(reply({}, 500));
    await expect(loadReleaseNotes("commit-error")).rejects.toThrow();
  });

  it("rejects malformed responses rather than rendering untrusted values", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(reply({ body: { unexpected: true } }));
    await expect(loadReleaseNotes("malformed")).rejects.toThrow();
  });

  it("retains successful notes across callers for the session", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => reply({ body: "Cached notes" }));
    expect(await loadReleaseNotes("cached")).toBe("Cached notes");
    expect(await loadReleaseNotes("cached")).toBe("Cached notes");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries failures rather than caching errors", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("Offline"))
      .mockResolvedValueOnce(reply({ body: "Recovered" }));
    await expect(loadReleaseNotes("retry")).rejects.toThrow("Offline");
    expect(await loadReleaseNotes("retry")).toBe("Recovered");
  });
});
