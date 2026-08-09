import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupOrphanedProfilePictures,
  generateProfilePictureUploadUrl,
  getMyProfile,
  removeProfilePicture,
  setProfilePicture,
} from "./profile";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue("user-1"),
}));

afterEach(() => {
  vi.useRealTimers();
});

type UserDoc = {
  _id: string;
  username: string;
  email: string;
  password: string;
  picture?: string | null;
};

function baseUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user-1",
    username: "alice",
    email: "alice@example.com",
    password: "salt:password-hash",
    ...overrides,
  };
}

function mockCtx() {
  const db = {
    get: vi.fn(),
    patch: vi.fn(),
    query: vi.fn(),
    system: {
      query: vi.fn(),
    },
  };
  const storage = {
    getUrl: vi.fn(),
    delete: vi.fn(),
    generateUploadUrl: vi.fn(),
  };
  return {
    db,
    storage,
    auth: { getUserIdentity: vi.fn() },
  } as any;
}

describe("profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyProfile", () => {
    it("returns the current user's username and a resolved picture URL", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: "file-1" }));
      ctx.storage.getUrl.mockResolvedValue("https://cdn.convex.cloud/file-1");

      const result = await (getMyProfile as any)._handler(ctx, {});

      expect(result).toEqual({
        username: "alice",
        pictureUrl: "https://cdn.convex.cloud/file-1",
      });
      expect(ctx.db.get).toHaveBeenCalledWith("user-1");
      expect(ctx.storage.getUrl).toHaveBeenCalledWith("file-1");
    });

    it("does not include email or password in the result", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: "file-1" }));
      ctx.storage.getUrl.mockResolvedValue("https://cdn.convex.cloud/file-1");

      const result = await (getMyProfile as any)._handler(ctx, {});

      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("password");
    });

    it("returns a null picture URL when the user has no picture", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: null }));

      const result = await (getMyProfile as any)._handler(ctx, {});

      expect(result).toEqual({ username: "alice", pictureUrl: null });
      expect(ctx.storage.getUrl).not.toHaveBeenCalled();
    });

    it("throws when the user no longer exists", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(null);

      await expect((getMyProfile as any)._handler(ctx, {})).rejects.toThrow("User not found");
    });
  });

  describe("generateProfilePictureUploadUrl", () => {
    it("returns an upload URL", async () => {
      const ctx = mockCtx();
      ctx.storage.generateUploadUrl.mockResolvedValue(
        "https://some-deployment.convex.cloud/api/storage/upload",
      );

      const result = await (generateProfilePictureUploadUrl as any)._handler(ctx, {});

      expect(result).toBe("https://some-deployment.convex.cloud/api/storage/upload");
    });
  });

  describe("setProfilePicture", () => {
    it("replaces the existing picture and deletes the previous file after saving the new reference", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: "old-file" }));

      await (setProfilePicture as any)._handler(ctx, { storageId: "new-file" });

      const patchOrder = ctx.db.patch.mock.invocationCallOrder[0];
      const deleteOrder = ctx.storage.delete.mock.invocationCallOrder[0];
      expect(patchOrder).toBeLessThan(deleteOrder);
      expect(ctx.storage.delete).toHaveBeenCalledWith("old-file");
      expect(ctx.db.patch).toHaveBeenCalledWith("user-1", { picture: "new-file" });
    });

    it("writes the picture when none was set before", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: null }));

      await (setProfilePicture as any)._handler(ctx, { storageId: "new-file" });

      expect(ctx.storage.delete).not.toHaveBeenCalled();
      expect(ctx.db.patch).toHaveBeenCalledWith("user-1", { picture: "new-file" });
    });

    it("throws when the user does not exist", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(null);

      await expect(
        (setProfilePicture as any)._handler(ctx, { storageId: "new-file" }),
      ).rejects.toThrow("User not found");
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });
  });

  describe("removeProfilePicture", () => {
    it("deletes the stored file and clears the field", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: "file-1" }));

      await (removeProfilePicture as any)._handler(ctx, {});

      expect(ctx.storage.delete).toHaveBeenCalledWith("file-1");
      expect(ctx.db.patch).toHaveBeenCalledWith("user-1", { picture: undefined });
    });

    it("does nothing when there is no picture", async () => {
      const ctx = mockCtx();
      ctx.db.get.mockResolvedValue(baseUser({ picture: null }));

      await (removeProfilePicture as any)._handler(ctx, {});

      expect(ctx.storage.delete).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });
  });

  describe("cleanupOrphanedProfilePictures", () => {
    const now = 1_720_000_000_000;
    const graceMs = 24 * 60 * 60 * 1000;
    const cutoff = now - graceMs;

    function storageDoc(id: string, createdAt: number) {
      return { _id: id, _creationTime: createdAt, sha256: "abc", size: 10 };
    }

    function storageQuery(docs: Array<{ _id: string; _creationTime: number }>) {
      return {
        [Symbol.asyncIterator]: async function* () {
          for (const doc of docs) yield doc;
        },
      };
    }

    function usersQuery(users: Array<{ picture?: string | null }>) {
      return { collect: async () => users };
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
    });

    it("deletes old files not referenced by any user picture", async () => {
      const ctx = mockCtx();
      ctx.db.query.mockReturnValue(
        usersQuery([{ picture: "referenced-file" }]),
      );
      ctx.db.system.query.mockReturnValue(
        storageQuery([
          storageDoc("orphan", cutoff - 1000),
          storageDoc("referenced-file", cutoff - 1000),
          storageDoc("recent", now),
        ]),
      );

      const result = await (cleanupOrphanedProfilePictures as any)._handler(ctx, {});

      expect(result).toBe(1);
      expect(ctx.db.system.query).toHaveBeenCalledWith("_storage");
      expect(ctx.storage.delete).toHaveBeenCalledTimes(1);
      expect(ctx.storage.delete).toHaveBeenCalledWith("orphan");
    });

    it("never deletes files still referenced by a user picture", async () => {
      const ctx = mockCtx();
      ctx.db.query.mockReturnValue(
        usersQuery([{ picture: "ref-1" }, { picture: "ref-2" }]),
      );
      ctx.db.system.query.mockReturnValue(
        storageQuery([
          storageDoc("ref-1", cutoff - 1000),
          storageDoc("ref-2", now),
        ]),
      );

      const result = await (cleanupOrphanedProfilePictures as any)._handler(ctx, {});

      expect(result).toBe(0);
      expect(ctx.storage.delete).not.toHaveBeenCalled();
    });

    it("keeps orphaned files still inside the grace window", async () => {
      const ctx = mockCtx();
      ctx.db.query.mockReturnValue(usersQuery([]));
      ctx.db.system.query.mockReturnValue(
        storageQuery([
          storageDoc("recent-upload", cutoff + 1),
          storageDoc("in-flight", now),
        ]),
      );

      const result = await (cleanupOrphanedProfilePictures as any)._handler(ctx, {});

      expect(result).toBe(0);
      expect(ctx.storage.delete).not.toHaveBeenCalled();
    });

    it("keeps users without a picture from being treated as references", async () => {
      const ctx = mockCtx();
      ctx.db.query.mockReturnValue(usersQuery([{}, { picture: null }]));
      ctx.db.system.query.mockReturnValue(
        storageQuery([storageDoc("orphan", cutoff - 1000)]),
      );

      const result = await (cleanupOrphanedProfilePictures as any)._handler(ctx, {});

      expect(result).toBe(1);
      expect(ctx.storage.delete).toHaveBeenCalledWith("orphan");
    });
  });
});