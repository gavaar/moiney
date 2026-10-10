import { isAppReleasePublished } from "./check-app-release";
import { expo } from "../app.json";
import { parseAppVersion } from "../domain/releases/version";

const { GITHUB_REPOSITORY: repository, GITHUB_SHA: commit, GH_TOKEN: token } = process.env as { GITHUB_REPOSITORY?: string; GITHUB_SHA?: string; GH_TOKEN?: string };
if (!repository || !commit || !token) throw new Error("Missing GitHub release-check environment");
if (!parseAppVersion(expo.version)) throw new Error("app.json version must be numeric major.minor.patch");
console.log(await isAppReleasePublished({ repository, commit, token, version: expo.version }));
