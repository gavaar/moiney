---
name: moiney-code-review
description: Review a Moiney branch, commit range, or worktree for behavioral defects, domain-contract violations, scope creep, and unnecessary complexity. Use for reviews before handoff or completion.
---

# Moiney Code Review

Review without modifying files. Findings are the output; summaries are
secondary.

## 1. Fix The Review Scope

Use the comparison supplied by the user. If none is supplied and the worktree
is dirty, review `git diff` plus untracked files. Otherwise ask for a branch,
commit, or merge base. Record the file list before investigating.

Classify generated files and unrelated pre-existing changes, but do not review
or revert them unless they are part of the requested change.

## 2. Load Only Applicable Contracts

Always read `AGENTS.md`. Use its task router to load only domain and engineering
guides touched by the diff. Consult `docs/agents/reference-map.md` for canonical
examples and `docs/agents/testing.md` for the expected test seam.

If the user supplied a specification, issue, or acceptance criteria, treat it as
the behavior source. If not, derive intended behavior from changed tests,
canonical domain contracts, and the user's description. State when no separate
specification exists.

## 3. Review In Parallel

Run independent read-only reviews when subagents are available:

- **Behavior and contracts:** missing requirements, incorrect edge cases,
  accounting conservation, negative values, `from`/`to`/`paidFrom`
  involvement, authorization, deletion freezes, migration compatibility, and
  bounded Convex work.
- **Design and tests:** boundary direction, duplicated policy, parallel
  abstractions, speculative generality, caller impact, test-seam choice,
  implementation-coupled tests, and missing regression coverage.

Both reviewers inspect the actual diff and relevant callers. Tooling success is
evidence, not proof of correctness.

## 4. Verify Findings

Re-read the cited hunk and enough surrounding code to establish reachability and
impact. Discard stylistic preferences already handled by tooling and findings
that cannot describe a concrete failure or maintenance cost.

Run the narrowest existing checks needed to confirm uncertain findings. Do not
change production code during review.

## 5. Report

List findings first, ordered by severity, with file and line references. Each
finding states the trigger, observable impact, and violated contract. Then list
open questions, followed by a brief scope and verification summary. If there
are no findings, say so and identify residual testing risks.
