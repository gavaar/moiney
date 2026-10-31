import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { planVerification, readChanges, selectTestFiles, type Changes } from "./verify-slim";

const repositories: string[] = [];
const bun = execFileSync("bun", ["--print", "process.execPath"], { encoding: "utf8" }).trim();
const cli = resolve("scripts/verify-slim-cli.ts");

const knownChanges = (paths: string[]): Extract<Changes, { kind: "known" }> => ({
  kind: "known", base: "base-sha", paths, hasDeletionsOrRenames: false, hasNewSource: false,
});

describe("affected-test discovery safety", () => {
  it.each([null, "[]", "not JSON", "{}", '[{"file":42}]'])("requires full tests for failed, empty, or invalid discovery (%s)", output => {
    expect(selectTestFiles(output).mode).toBe("full");
  });

  it("runs each affected file once when discovery succeeds", () => {
    expect(selectTestFiles(JSON.stringify([{ file: "/repo/src/feature.test.tsx" }, { file: "/repo/src/feature.test.tsx" }]))).toEqual({
      mode: "selected", files: ["/repo/src/feature.test.tsx"],
    });
  });
});

function repository() {
  const root = mkdtempSync(join(tmpdir(), "moiney-verify-"));
  repositories.push(root);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  const write = (path: string, content = "export const value = 1;\n") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture");
  };
  git("init", "-qb", "main");
  write(".gitignore", ".test-tools/\n");
  write("src/modified.ts");
  write("src/staged.ts");
  commit();
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  return { root, git, write, commit };
}

function verify(fixture: ReturnType<typeof repository>, options: { discovery?: string; failTask?: string; failDiscovery?: boolean; args?: string[] } = {}) {
  const { root, write } = fixture;
  write(".test-tools/bun", `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(".test-tools/calls.jsonl", JSON.stringify(args) + "\\n");
if (args[0] === "x") {
  if (${options.failDiscovery ?? false}) process.exit(12);
  console.log(${JSON.stringify(options.discovery ?? "[]")});
}
if (args[1] === ${JSON.stringify(options.failTask ?? "")}) process.exit(23);
`);
  chmodSync(join(root, ".test-tools/bun"), 0o755);
  const result = spawnSync(bun, [cli, ...options.args ?? []], {
    cwd: root, env: { ...process.env, PATH: `${join(root, ".test-tools")}:${process.env.PATH}` }, encoding: "utf8",
  });
  const log = join(root, ".test-tools/calls.jsonl");
  const calls: string[][] = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line)) : [];
  return { ...result, calls };
}

afterEach(() => {
  for (const root of repositories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("slim verification workflow", () => {
  it.each(["lint", "test", "typecheck:slim"])("fails immediately when %s fails", failTask => {
    const fixture = repository();
    fixture.write("src/modified.ts", "export const value = 2;\n");
    const result = verify(fixture, { failTask });
    expect(result.status).toBe(23);
    expect(result.calls.at(-1)?.[1]).toBe(failTask);
    expect(result.stdout).not.toContain("Complete in");
    expect(result.calls.filter(args => args[1] === failTask)).toHaveLength(1);
  });

  it("runs affected tests and incremental project checking after changed-file lint", () => {
    const fixture = repository();
    fixture.write("src/modified.ts", "export const value = 2;\n");
    const test = join(fixture.root, "src/modified.test.ts");
    const result = verify(fixture, { discovery: JSON.stringify([{ file: test }]) });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter(args => args[0] === "run")).toEqual([
      ["run", "lint", "src/modified.ts"],
      ["run", "test", "--passWithNoTests=false", test],
      ["run", "typecheck:slim"],
    ]);
  });

  it("does not repeat full checks for unrelated tooling and deletions committed before the current edit", () => {
    const fixture = repository();
    fixture.write("app.json", '{"expo":{"version":"0.6.2"}}\n');
    fixture.write("scripts/previous-task.ts");
    fixture.git("rm", "src/staged.ts");
    fixture.commit();
    fixture.write("src/modified.ts", "export const value = 2;\n");
    const test = join(fixture.root, "src/modified.test.ts");

    const result = verify(fixture, { discovery: JSON.stringify([{ file: test }]) });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter(args => args[0] === "run")).toEqual([
      ["run", "lint", "src/modified.ts"],
      ["run", "test", "--passWithNoTests=false", test],
      ["run", "typecheck:slim"],
    ]);
  });

  it("includes commits made during an AI task when given its starting commit", () => {
    const fixture = repository();
    fixture.write("app.json", '{"expo":{"version":"0.6.2"}}\n');
    fixture.commit();
    const taskStart = fixture.git("rev-parse", "HEAD");
    fixture.write("src/modified.ts", "export const value = 2;\n");
    fixture.commit();
    expect(verify(fixture).calls).toEqual([]);

    const test = join(fixture.root, "src/modified.test.ts");
    const result = verify(fixture, { args: ["--base", taskStart], discovery: JSON.stringify([{ file: test }]) });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter(args => args[0] === "run")).toEqual([
      ["run", "lint", "src/modified.ts"],
      ["run", "test", "--passWithNoTests=false", test],
      ["run", "typecheck:slim"],
    ]);
  });

  it.each([false, true])("falls back to all tests when discovery is empty or fails (failure=%s)", failDiscovery => {
    const fixture = repository();
    fixture.write("src/modified.ts", "export const value = 2;\n");
    const result = verify(fixture, { failDiscovery });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter(args => args[1] === "test")).toEqual([["run", "test"]]);
  });

  it("performs no executable checks for documentation-only work", () => {
    const fixture = repository();
    fixture.write("docs/testing.md", "# Testing\n");
    const result = verify(fixture);
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toEqual([]);
  });

  it("uses full checks when an explicitly requested baseline cannot be resolved", () => {
    const result = verify(repository(), { args: ["--base", "missing"] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toEqual([["run", "lint", "--no-cache"], ["run", "test"], ["run", "typecheck"]]);
  });

  it("does not let a nonempty selection hide a Git-quoted changed test", () => {
    const fixture = repository();
    fixture.write("src/modified.ts", "export const value = 2;\n");
    fixture.write("src/naïve.test.ts");
    const discovery = JSON.stringify([{ file: join(fixture.root, "src/ordinary.test.ts") }]);
    const result = verify(fixture, { discovery });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.filter(args => args[1] === "test")).toEqual([["run", "test"]]);
    expect(result.calls.some(args => args[0] === "x")).toBe(false);
  });
});

describe("verification scope", () => {
  it("requires all checks when the comparison baseline is unavailable", () => {
    const { root } = repository();
    const changes = readChanges(root, "missing-branch");
    expect(changes.kind).toBe("unknown");
    expect(planVerification(changes)).toMatchObject({ lint: "full", tests: "full", typecheck: "full" });
  });

  it("limits frontend checks to changed-file lint and affected tests while checking project-wide types", () => {
    expect(planVerification(knownChanges(["src/feature with spaces.tsx", "src/feature.test.tsx", "docs/ui.md"]))).toMatchObject({
      lint: "changed",
      lintFiles: ["src/feature with spaces.tsx", "src/feature.test.tsx"],
      tests: "related",
      typecheck: "incremental",
    });
  });

  it("selects domain tests without expanding the existing frontend lint scope", () => {
    expect(planVerification(knownChanges(["domain/money/money.ts"]))).toMatchObject({
      lint: "none", tests: "related", typecheck: "incremental",
    });
  });

  it("invalidates static-check shortcuts for dependency and configuration changes", () => {
    expect(planVerification(knownChanges(["eslint.config.js"]))).toMatchObject({
      lint: "full", tests: "full", typecheck: "full",
    });
  });

  it.each([
    knownChanges(["package.json"]),
    knownChanges(["bun.lock"]),
    knownChanges(["vitest.setup.ts"]),
    knownChanges(["tsconfig.json"]),
    knownChanges(["scripts/verify-slim.ts"]),
    knownChanges(["convex/financialOperations.ts"]),
    knownChanges(["src/app/(main)/index.tsx"]),
    knownChanges(["src/types.d.ts"]),
    knownChanges(["assets/logo.png"]),
    knownChanges(["src/content.md"]),
    knownChanges(['src/quoted"file.test.ts']),
    knownChanges(["src/back\\slash.test.ts"]),
    { ...knownChanges(["src/deleted.ts"]), hasDeletionsOrRenames: true },
    { ...knownChanges(["src/new.ts"]), hasNewSource: true },
  ])("expands uncertain changes to the full test suite ($paths)", changes => {
    expect(planVerification(changes).tests).toBe("full");
  });
});

describe("local verification change discovery", () => {
  it("includes committed branch work, staged edits, unstaged edits, and untracked files", () => {
    const { root, git, write, commit } = repository();
    write("src/committed.ts");
    commit();
    write("src/staged.ts", "export const staged = true;\n");
    git("add", "src/staged.ts");
    write("src/modified.ts", "export const modified = true;\n");
    write("src/new file.ts");

    expect(readChanges(root, "origin/main")).toEqual({
      kind: "known",
      base: git("rev-parse", "origin/main"),
      paths: ["src/committed.ts", "src/modified.ts", "src/new file.ts", "src/staged.ts"],
      hasDeletionsOrRenames: false,
      hasNewSource: true,
    });
  });

  it("retains deletion and rename information, including paths containing newlines", () => {
    const { root, git } = repository();
    git("mv", "src/modified.ts", "src/renamed\nfeature.ts");
    git("rm", "src/staged.ts");
    const changes = readChanges(root);
    expect(changes).toMatchObject({
      kind: "known",
      paths: ["src/modified.ts", "src/renamed\nfeature.ts", "src/staged.ts"],
      hasDeletionsOrRenames: true,
    });
    expect(planVerification(changes).tests).toBe("full");
  });

  it("does not include ignored caches or test tools", () => {
    const { root, write } = repository();
    write(".test-tools/cache.ts");
    expect(readChanges(root)).toMatchObject({ kind: "known", paths: [] });
  });

  it("compares branch work from the merge base rather than including new upstream work", () => {
    const { root, git, write, commit } = repository();
    const base = git("rev-parse", "HEAD");
    write("src/modified.ts", "export const value = 2;\n");
    commit();
    git("switch", "-qc", "upstream", "origin/main");
    write("src/upstream.ts");
    commit();
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("switch", "-q", "main");
    expect(readChanges(root, "origin/main")).toEqual({ kind: "known", base, paths: ["src/modified.ts"], hasDeletionsOrRenames: false, hasNewSource: false });
  });

  it("allows a new behavioral test to select itself without treating it as a new production module", () => {
    const { root, write } = repository();
    write("src/new.test.ts");
    const changes = readChanges(root);
    expect(changes).toMatchObject({ kind: "known", paths: ["src/new.test.ts"], hasNewSource: false });
    expect(planVerification(changes).tests).toBe("related");
  });
});
