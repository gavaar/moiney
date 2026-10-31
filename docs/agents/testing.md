# Testing Map

The local [TDD skill](../../.agents/skills/tdd/SKILL.md) owns procedure. This
guide selects the repository seam and keeps one behavior from being tested at
every layer.

| Behavior Owned By | Preferred Seam | Example |
| --- | --- | --- |
| Money, transaction, topology, or scheduling policy | Pure `domain/` test | `domain/transactions/accounting.test.ts` |
| Authorization, public validators, persistence, atomicity, or registered API result | `convex-test` boundary test | `convex/boundaries/accounts-sessions-profile.test.ts` |
| Backend operation sequencing not observable through a registered function | Focused operation test | `convex/lib/pipes/delete/operations.test.ts` |
| Feature interaction, accessibility, or visible state | Testing Library feature/component test | `src/components/features/creation/CreateModal.test.tsx` |
| Cache ordering, merge, or persistence policy | Feature-owned store/hook test | `src/components/features/transactions/cache/EventHistoryStore.test.ts` |
| UI primitive contract | Adjacent primitive test | `src/components/ui/Modal/ModalShell.test.tsx` |

## Selection Rules

- Use the highest existing seam that observes the behavior without testing an
  implementation detail.
- Add lower-level tests only for policy or sequencing that the higher seam
  cannot isolate clearly.
- Avoid repeating pure domain examples in Convex suites. Boundary tests should
  prove wiring, authorization, persistence, and atomic outcomes.
- Mock external or framework boundaries, not repository policy. Prefer
  `convex-test` over calling registered handlers through private `_handler`
  properties when the public boundary is the behavior under test.
- Keep test files organized by behavioral contract. Split a file when distinct
  seams or unrelated policies make the intended test location hard to find, not
  to satisfy a line-count target.
- For appearance versus behavioral assertions, follow the
  [UI verification contract](../ui.md#verification), including its text and
  geometry exceptions. Keep tricky domain boundaries in small tests and use
  workflow tests for integration rather than repeating every example at each layer.

## Local Verification And Merge Gates

Run one file with `bun run test <path>`. After focused tests pass, use the slim
completion checks below and report what ran and any fallback.
This runs changed-file lint, affected tests, and incremental project-wide
typechecking; it does not attempt unsound changed-file-only typechecking.

`bun run verify-slim` selects staged, unstaged, and nonignored untracked changes
against `HEAD`. It deliberately excludes already-committed history: otherwise a
previous version bump, tooling change, or deletion can force full checks on every
later local edit until the branch merges. A clean working tree selects no checks;
the default command does not validate the last commit.

At the start of an AI task, record `git rev-parse HEAD`. Before completion, run
`bun run verify-slim --base <task-start-sha>` so commits made during that task are
included, alongside all local edits. Do not replace the captured commit with the
completion-time `HEAD`, which could silently omit committed task work. For an
explicit whole-branch check, use `bun run verify-slim --base origin/main` after
fetching the base; comparison uses its merge base with the current branch.

Uncertainty expands verification: missing baselines, unsupported changes, shared
configuration/dependencies, backend changes, new production modules, and
deletions/renames require full tests. Failed discovery or zero affected tests also
falls back to the full suite, rather than silently passing executable changes.
Documentation-only changes need no executable checks. Focused behavioral tests
remain necessary: dependency selection cannot prove that a change is covered.

PR CI runs full `bun run verify` on opening and every push; the latest revision
must pass before merge. Deployment retains its independent full check. Slim
verification is a local feedback optimization, not a replacement for either gate.
Run full verification locally when requested or when changing verification tooling.
