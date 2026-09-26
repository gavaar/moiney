import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = resolve(__dirname, "../../../.github/scripts/promote-main.sh");
const directories: string[] = [];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "moiney-promotion-"));
  directories.push(directory);
  const remote = join(directory, "remote.git");
  const work = join(directory, "work");
  git(directory, "init", "--bare", "--initial-branch=main", remote);
  git(directory, "clone", remote, work);
  git(work, "config", "user.name", "CI Test");
  git(work, "config", "user.email", "ci@example.com");
  git(work, "commit", "--allow-empty", "-m", "initial");
  git(work, "branch", "-M", "main");
  git(work, "push", "origin", "main");
  const main = git(work, "rev-parse", "HEAD");
  git(work, "switch", "-c", "test");
  git(work, "commit", "--allow-empty", "-m", "release");
  git(work, "push", "origin", "test");
  const test = git(work, "rev-parse", "HEAD");

  return { remote, work, main, test };
}

function promote(work: string, sha: string) {
  return spawnSync("bash", [script], {
    cwd: work,
    env: { ...process.env, GITHUB_SHA: sha },
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("promoting a released test commit", () => {
  it("fast-forwards main to the exact tested commit", () => {
    const { remote, work, test } = fixture();

    expect(promote(work, test).status).toBe(0);
    expect(git(remote, "rev-parse", "refs/heads/main")).toBe(test);
  });

  it("does not promote an obsolete run after test advances", () => {
    const { remote, work, main, test } = fixture();
    git(work, "commit", "--allow-empty", "-m", "newer release");
    git(work, "push", "origin", "test");

    expect(promote(work, test).status).not.toBe(0);
    expect(git(remote, "rev-parse", "refs/heads/main")).toBe(main);
  });

  it("does not rewrite main if it has diverged", () => {
    const { remote, work, main, test } = fixture();
    git(work, "switch", "main");
    git(work, "commit", "--allow-empty", "-m", "main change");
    git(work, "push", "origin", "main");
    const advancedMain = git(work, "rev-parse", "HEAD");
    expect(advancedMain).not.toBe(main);

    expect(promote(work, test).status).not.toBe(0);
    expect(git(remote, "rev-parse", "refs/heads/main")).toBe(advancedMain);
  });
});
