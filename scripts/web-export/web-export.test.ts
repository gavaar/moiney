import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeConvexUrl, prepareWebExport } from "./web-export";

const directories: string[] = [];

async function exportedSite() {
  const root = await mkdtemp(join(tmpdir(), "moiney-web-"));
  directories.push(root);
  const write = async (path: string, content: string | Uint8Array) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  };
  return { root, write };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe("Cloudflare Pages asset preparation", () => {
  it("keeps exported font URLs resolvable outside Wrangler's ignored node_modules directory", async () => {
    const { root, write } = await exportedSite();
    const font = new Uint8Array([0, 1, 0, 0, 255]);
    const oldPath = "assets/node_modules/@expo/vector-icons/Fonts/Ionicons.hash.ttf";
    const newPath = "assets/vendor/@expo/vector-icons/Fonts/Ionicons.hash.ttf";
    await write(oldPath, font);
    await write("_expo/static/js/web/entry.js", `const font = "/${oldPath}";`);

    await prepareWebExport(root);

    expect(await readFile(join(root, "_expo/static/js/web/entry.js"), "utf8")).toBe(`const font = "/${newPath}";`);
    expect(await readFile(join(root, newPath))).toEqual(Buffer.from(font));
    await expect(readFile(join(root, oldPath))).rejects.toThrow("ENOENT");
  });

  it("rewrites HTML, styles, and metadata without changing unrelated or binary assets", async () => {
    const { root, write } = await exportedSite();
    const oldPath = "assets/node_modules/package/image.png";
    const newPath = "assets/vendor/package/image.png";
    const binary = new Uint8Array([0, 255, 128, 42]);
    const documents = ["index.html", "_expo/static/css/web.css", "metadata.json"];
    await write(oldPath, binary);
    await write("assets/icon.png", binary);
    for (const path of documents) await write(path, `/${oldPath} /assets/icon.png`);

    await prepareWebExport(root);
    await prepareWebExport(root);

    for (const path of documents) {
      expect(await readFile(join(root, path), "utf8")).toBe(`/${newPath} /assets/icon.png`);
    }
    expect(await readFile(join(root, newPath))).toEqual(Buffer.from(binary));
    expect(await readFile(join(root, "assets/icon.png"))).toEqual(Buffer.from(binary));
  });

  it("does not overwrite an existing vendor directory", async () => {
    const { root, write } = await exportedSite();
    await write("assets/node_modules/font.ttf", "exported font");
    await write("assets/vendor/font.ttf", "existing asset");

    await expect(prepareWebExport(root)).rejects.toThrow("fresh Expo web export");

    expect(await readFile(join(root, "assets/vendor/font.ttf"), "utf8")).toBe("existing asset");
    expect(await readFile(join(root, "assets/node_modules/font.ttf"), "utf8")).toBe("exported font");
  });
});

describe("web deployment configuration", () => {
  it("removes the trailing slash before Expo embeds the Convex URL", () => {
    expect(normalizeConvexUrl("https://example.convex.cloud/")).toBe("https://example.convex.cloud");
  });

  it("preserves a valid deployment origin", () => {
    expect(normalizeConvexUrl("https://example.convex.cloud")).toBe("https://example.convex.cloud");
  });

  it.each([undefined, "", "not a URL", "http://example.convex.cloud", "https://example.convex.cloud/api", "https://example.convex.cloud?dev=true", "https://example.convex.cloud#dev", "https://user:password@example.convex.cloud"])("rejects invalid deployment configuration before building (%s)", value => {
    expect(() => normalizeConvexUrl(value)).toThrow("EXPO_PUBLIC_CONVEX_URL");
  });
});
