---
name: moiney-architecture-review
description: Audit a named Moiney hotspot for deepening opportunities and AI navigability. Use for substantial refactoring or when one concept requires excessive file and test context.
---

# Moiney Architecture Review

Use the `codebase-design` skill's vocabulary and principles. This skill surveys
and proposes; implementation starts only after the user selects an interface.

## 1. Scope The Hotspot

Prefer a module or pain point named by the user. Otherwise use recent history to
identify frequently changed areas before reading broadly. Load
`docs/domain/glossary.md`, `docs/engineering-principles.md`, the applicable
domain contract, and `docs/agents/reference-map.md`.

## 2. Trace The Current Interface

Identify callers, public exports, tests, persistence boundaries, and coupled
modules. Record what each caller must know: invariants, sequencing, error modes,
authorization, compatibility, and performance constraints.

Apply the deletion test. Distinguish deep modules from pass-through wrappers,
and do not propose a new adapter without at least two real implementations or a
current policy it would hide.

## 3. Produce Candidates

For each candidate, report:

- files and callers involved,
- current context or change friction,
- proposed interface and what it hides,
- locality and leverage gained,
- surviving test seam,
- migration or compatibility risk,
- recommendation strength: strong, worth exploring, or speculative.

Prefer the smallest refactor that concentrates a repeated invariant. Do not
split cohesive code by line count or introduce generic service/repository
layers.

## 4. Select Before Editing

Recommend one candidate, show at least one credible alternative, and ask the
user which interface to pursue. Once selected, preserve behavior with focused
tests, move callers to the new seam, remove the replaced path, and run the
verification required by `AGENTS.md`.
