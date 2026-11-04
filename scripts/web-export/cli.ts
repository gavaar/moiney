import { spawnSync } from "node:child_process";
import { normalizeConvexUrl, prepareWebExport } from "./web-export";

const convexUrl = normalizeConvexUrl(process.env.EXPO_PUBLIC_CONVEX_URL);
const result = spawnSync("bunx", ["--no-install", "expo", "export", "--platform", "web", "--clear"], {
  stdio: "inherit",
  env: { ...process.env, EXPO_NO_DOTENV: "1", EXPO_PUBLIC_CONVEX_URL: convexUrl },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

await prepareWebExport("dist");
console.log("Web export ready for Cloudflare Pages in dist/.");
