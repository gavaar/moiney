import { existsSync } from "node:fs";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function prepareWebExport(directory: string): Promise<void> {
  const source = join(directory, "assets/node_modules");
  const target = join(directory, "assets/vendor");
  // Wrangler excludes every node_modules directory, including Expo's exported fonts.
  if (existsSync(source)) {
    if (existsSync(target)) throw new Error("assets/vendor already exists; create a fresh Expo web export.");
    await rename(source, target);
  }

  async function rewriteReferences(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await rewriteReferences(path);
      } else if (entry.isFile() && /\.(js|json|html|css|map)$/.test(entry.name)) {
        const original = await readFile(path, "utf8");
        const updated = original.replaceAll("assets/node_modules/", "assets/vendor/");
        if (updated !== original) await writeFile(path, updated);
      }
    }
  }

  await rewriteReferences(directory);
}

export function normalizeConvexUrl(value: string | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, "") ?? "";
  const url = URL.parse(normalized);
  if (!url || url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("EXPO_PUBLIC_CONVEX_URL must be an HTTPS deployment origin, without a path, query, or credentials.");
  }
  return url.origin;
}
