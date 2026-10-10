// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("app release metadata", () => {
  it("is readable before login and stays a singleton across publication retries", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.appRelease.latest, {})).toBeNull();
    const release = {
      latestAppVersion: "0.5.1",
      downloadUrl: "https://github.com/gavaar/moiney/releases/download/0.5.1/moiney.apk",
    };
    await t.mutation(internal.appRelease.publish, release);
    await t.mutation(internal.appRelease.publish, release);
    expect(await t.query(api.appRelease.latest, {})).toEqual(release);
    expect(await t.run((ctx) => ctx.db.query("appMetadata").collect())).toHaveLength(1);

    const next = {
      latestAppVersion: "0.6.0",
      downloadUrl: "https://github.com/gavaar/moiney/releases/download/0.6.0/moiney.apk",
    };
    await t.mutation(internal.appRelease.publish, next);
    expect(await t.query(api.appRelease.latest, {})).toEqual(next);
    expect(await t.run((ctx) => ctx.db.query("appMetadata").collect())).toHaveLength(1);
  });

  it.each([
    { latestAppVersion: "v0.5.1", downloadUrl: "https://github.com/gavaar/moiney/releases/download/0.5.1/moiney.apk" },
    { latestAppVersion: "0.5.1", downloadUrl: "https://example.com/moiney.apk" },
    { latestAppVersion: "0.5.1", downloadUrl: "https://github.com/gavaar/moiney/releases/download/0.5.0/moiney.apk" },
  ])("rejects invalid publication without changing the current release", async (release) => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.appRelease.publish, release)).rejects.toThrow();
    expect(await t.query(api.appRelease.latest, {})).toBeNull();
  });

  it("does not let a retry of an older release downgrade the latest metadata", async () => {
    const t = convexTest(schema, modules);
    const latest = {
      latestAppVersion: "0.6.0",
      downloadUrl: "https://github.com/gavaar/moiney/releases/download/0.6.0/moiney.apk",
    };
    await t.mutation(internal.appRelease.publish, latest);
    await expect(t.mutation(internal.appRelease.publish, {
      latestAppVersion: "0.5.1",
      downloadUrl: "https://github.com/gavaar/moiney/releases/download/0.5.1/moiney.apk",
    })).rejects.toThrow("Cannot publish an older app release");
    expect(await t.query(api.appRelease.latest, {})).toEqual(latest);
  });
});
