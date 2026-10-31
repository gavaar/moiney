import { execFileSync } from "node:child_process";

export type Changes =
  | { kind: "known"; base: string; paths: string[]; hasDeletionsOrRenames: boolean; hasNewSource: boolean }
  | { kind: "unknown"; reason: string };

export type VerificationPlan = {
  lint: "none" | "changed" | "full";
  lintFiles: string[];
  tests: "none" | "related" | "full";
  typecheck: "none" | "incremental" | "full";
  reason: string;
};

export type TestSelection = { mode: "full"; reason: string } | { mode: "selected"; files: string[] };

export function selectTestFiles(output: string | null): TestSelection {
  try {
    const parsed: unknown = JSON.parse(output ?? "null");
    if (Array.isArray(parsed) && parsed.length > 0) {
      const files = new Set<string>();
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object" || !("file" in entry) || typeof entry.file !== "string" || !/\.test\.[jt]sx?$/.test(entry.file)) {
          return { mode: "full", reason: "Invalid affected-test discovery output" };
        }
        files.add(entry.file);
      }
      return { mode: "selected", files: [...files] };
    }
  } catch {
    // Discovery is only an optimization; its failure must expand verification.
  }
  return { mode: "full", reason: "No trustworthy affected-test selection; running all tests" };
}

export function planVerification(changes: Changes): VerificationPlan {
  if (changes.kind === "unknown") return { lint: "full", lintFiles: [], tests: "full", typecheck: "full", reason: changes.reason };
  const executablePaths = changes.paths.filter(path => !(path.endsWith(".md") && (/^(docs|\.agents)\//.test(path) || !path.includes("/"))));
  if (executablePaths.length > 0) {
    // Vitest's --changed parser cannot decode Git-quoted filenames.
    const unsupported = executablePaths.find(path => !/^(src|domain|convex)\/.*\.[jt]sx?$/.test(path) || path.endsWith(".d.ts") || /[^\x20-\x7e]|["\\]/.test(path));
    if (unsupported) return { lint: "full", lintFiles: [], tests: "full", typecheck: "full", reason: `Shared configuration or unsupported path: ${unsupported}` };
    const lintFiles = executablePaths.filter(path => path.startsWith("src/") && /\.[jt]sx?$/.test(path));
    if (changes.hasDeletionsOrRenames) return { lint: "full", lintFiles: [], tests: "full", typecheck: "incremental", reason: "Deleted or renamed files" };
    const fullTests = changes.hasNewSource || executablePaths.some(path => /^(convex|src\/app)\//.test(path));
    if (fullTests) return { lint: lintFiles.length ? "changed" : "none", lintFiles, tests: "full", typecheck: "incremental", reason: "New production modules, backend changes, or file-based routes" };
    return { lint: lintFiles.length ? "changed" : "none", lintFiles, tests: "related", typecheck: "incremental", reason: "Affected tests and changed-file lint" };
  }
  return { lint: "none", lintFiles: [], tests: "none", typecheck: "none", reason: "No executable changes" };
}

export function readChanges(root: string, baseRef = "HEAD"): Changes {
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const ref = git("rev-parse", "--verify", "--end-of-options", `${baseRef}^{commit}`).trim();
    const base = git("merge-base", "HEAD", ref).trim();
    const paths = new Set<string>();
    let hasDeletionsOrRenames = false;
    let hasNewSource = false;
    const add = (path: string, status: string) => {
      paths.add(path);
      if (status === "A" && /\.[cm]?[jt]sx?$/.test(path) && !/\.test\.[jt]sx?$/.test(path)) hasNewSource = true;
      if (/^[DR]/.test(status)) hasDeletionsOrRenames = true;
    };
    for (const args of [[base, "HEAD"], ["--cached"], []]) {
      const fields = git("diff", "--name-status", "-z", "--find-renames", ...args).split("\0");
      for (let i = 0; i < fields.length - 1;) {
        const status = fields[i++];
        add(fields[i++], status);
        if (/^[RC]/.test(status)) add(fields[i++], status);
      }
    }
    for (const path of git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)) add(path, "A");
    return { kind: "known", base, paths: [...paths].sort(), hasDeletionsOrRenames, hasNewSource };
  } catch {
    return { kind: "unknown", reason: `Cannot compare with ${baseRef}; fetch the base or pass --base <ref>` };
  }
}
