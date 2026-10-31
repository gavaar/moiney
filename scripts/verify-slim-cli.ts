import { execFileSync, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { planVerification, readChanges, selectTestFiles } from "./verify-slim";

const { values } = parseArgs({ options: { base: { type: "string" } }, strict: true });
const root = process.cwd();
const changes = readChanges(root, values.base);
const plan = planVerification(changes);
const started = performance.now();

console.log(`[verify-slim] ${plan.reason}`);
if (changes.kind === "known") console.log(`[verify-slim] ${changes.paths.length} changed paths against ${values.base ?? "HEAD"} (merge base ${changes.base.slice(0, 12)}), including local edits`);

function run(args: string[]) {
  const start = performance.now();
  console.log(`[verify-slim] bun ${args.join(" ")}`);
  const result = spawnSync("bun", args, { cwd: root, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`[verify-slim] Passed in ${((performance.now() - start) / 1000).toFixed(2)}s`);
}

if (plan.lint === "full") run(["run", "lint", "--no-cache"]);
if (plan.lint === "changed") run(["run", "lint", ...plan.lintFiles]);

if (plan.tests === "full") run(["run", "test"]);
if (plan.tests === "related" && changes.kind === "known") {
  let output: string | null = null;
  try {
    output = execFileSync("bun", ["x", "--no-install", "vitest", "list", "--filesOnly", "--json", `--changed=${changes.base}`], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BUN_JSC_useFTLJIT: "false" },
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    console.warn("[verify-slim] Affected-test discovery failed");
  }
  const selection = selectTestFiles(output);
  if (selection.mode === "full") {
    console.log(`[verify-slim] ${selection.reason}`);
    run(["run", "test"]);
  } else {
    console.log(`[verify-slim] ${selection.files.length} affected test files`);
    run(["run", "test", "--passWithNoTests=false", ...selection.files]);
  }
}

if (plan.typecheck === "full") run(["run", "typecheck"]);
if (plan.typecheck === "incremental") run(["run", "typecheck:slim"]);
console.log(`[verify-slim] Complete in ${((performance.now() - started) / 1000).toFixed(2)}s; full PR verification is still required`);
