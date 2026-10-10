import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getUpdateKind, parseAppVersion } from "../domain/releases/version";

const releaseFields = {
  latestAppVersion: v.string(),
  downloadUrl: v.string(),
};

export const latest = query({
  args: {},
  returns: v.union(v.null(), v.object(releaseFields)),
  handler: async (ctx) => {
    const release = await ctx.db.query("appMetadata").unique();
    return release ? {
      latestAppVersion: release.latestAppVersion,
      downloadUrl: release.downloadUrl,
    } : null;
  },
});

export const publish = internalMutation({
  args: releaseFields,
  returns: v.null(),
  handler: async (ctx, release) => {
    const expectedUrl = `https://github.com/gavaar/moiney/releases/download/${release.latestAppVersion}/moiney.apk`;
    if (!parseAppVersion(release.latestAppVersion) || release.downloadUrl !== expectedUrl) {
      throw new ConvexError({ code: "INVALID_APP_RELEASE", message: "Expected a numeric app version and its GitHub APK URL" });
    }
    const current = await ctx.db.query("appMetadata").unique();
    if (current && current.latestAppVersion !== release.latestAppVersion && getUpdateKind(current.latestAppVersion, release.latestAppVersion) === "none") {
      throw new ConvexError({ code: "OLDER_APP_RELEASE", message: "Cannot publish an older app release" });
    }
    if (!current) {
      await ctx.db.insert("appMetadata", release);
    } else if (current.latestAppVersion !== release.latestAppVersion || current.downloadUrl !== release.downloadUrl) {
      await ctx.db.patch("appMetadata", current._id, release);
    }
    return null;
  },
});
