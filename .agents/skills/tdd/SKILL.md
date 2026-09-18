---
name: tdd
description: Use for production behavior changes and bug fixes. Requires a failing behavioral test before implementation and focused Red-Green-Refactor verification.
---

# Test-Driven Development

## Cycle

Work on one observable behavior at a time:

1. Plan: identify the behavior, input, expected result, test file, and test description before writing code.
2. Red: write the smallest behavioral test and run it with `bun run test <path>`. Confirm it fails for the intended reason before changing implementation. A minimal stub is allowed only to make a missing target importable.
3. Green: implement only what the failing test requires. Rerun the focused tests and confirm they pass.
4. Refactor: improve clarity only while green, without adding behavior. Rerun affected tests after changes.

Report the failing and passing test evidence concisely; response state headers
are not required. Use the completion checks in `AGENTS.md` after the final cycle.

## Scope

Tests cover observable contracts, domain calculations, interactions,
accessibility, API contracts, authorization, and persistence behavior. A
regression test must reproduce the defect before the fix.

Supporting details such as imports, types, icon entries, and prop plumbing need
no separate test when they support an already-tested behavior. Documentation,
comments, formatting, and visual-only changes are exempt from Red-Green, as
described in `AGENTS.md`.

Prefer table-driven domain tests, realistic Convex authorization/validation
boundaries, and native-oriented interaction tests. Do not assert production
source text, exact utility classes, registry membership, or only mocked argument
forwarding. Organize tests by behavioral contract rather than arbitrary size.

## Integrity

- Do not restructure production components solely to make them easier to test without user approval. Explain the dependency problem and proposed refactor first.
- Do not add test-only production branches, flags, or hooks unless explicitly requested.
- Mock external boundaries as needed, not the behavior under test; avoid broad shallow mocks that bypass real behavior.
- Do not skip, disable, or remove failing tests to make a suite pass. Fix the implementation, or correct the test when the specification changed.
- Use existing dependencies. If another package is necessary, explain why existing alternatives are insufficient and request approval under `AGENTS.md`.
