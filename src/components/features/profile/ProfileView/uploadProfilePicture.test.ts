// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadProfilePicture } from "./uploadProfilePicture";

describe("uploadProfilePicture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the picked image bytes to the upload URL and returns the storage id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(new Blob(["image-bytes"])),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ storageId: "file-1" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const storageId = await uploadProfilePicture("https://upload-url", {
      uri: "blob:local-image",
      mimeType: "image/jpeg",
    });

    expect(storageId).toBe("file-1");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "blob:local-image");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://upload-url", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: expect.any(Blob),
    });
  });

  it("throws when the upload response is not ok", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(new Blob(["image-bytes"])),
      })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadProfilePicture("https://upload-url", { uri: "blob:local-image" }),
    ).rejects.toThrow("Upload failed");
  });

  it("throws when the response has no storage id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(new Blob(["image-bytes"])),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadProfilePicture("https://upload-url", { uri: "blob:local-image" }),
    ).rejects.toThrow("Upload failed");
  });
});
