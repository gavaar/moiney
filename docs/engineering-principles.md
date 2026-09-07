# Engineering Principles

This document explains how Moiney applies software-design principles. `AGENTS.md` contains the concise mandatory rules; this document contains the reasoning used when choosing a design.

## Optimize For Understanding

The primary design goal is to make important behavior easy to understand and difficult to misuse.

- Prefer an explicit domain concept over repeated conditional logic.
- Keep interfaces smaller than their implementations.
- Hide indexes, maps, persistence shapes, and sequencing requirements behind deep operations.
- Pull complexity into the module best positioned to resolve it once.
- Avoid making every caller understand the same edge cases.

Before adding an abstraction, identify what complexity it hides. A wrapper that only renames another function is not a deep module.

## Make Invalid States Unrepresentable

Use types and command shapes to prevent invalid combinations where practical.

- Prefer discriminated unions to unrelated optional fields.
- Use explicit patch operations when `unchanged`, `set`, and `clear` differ.
- Represent asynchronous state with explicit states when independent booleans permit contradictions.
- Parse and normalize external data at boundaries before it reaches domain code.

Runtime validation remains necessary at network and database boundaries even when TypeScript types are strict.

## Shared Domain Core

D010 status: Implemented. Pure transaction identity, role involvement,
accounting effects, pipe graph reconciliation, and cron schedule calculations
live under the framework-independent root `domain/` boundary. Convex owns
database I/O, authorization, and scheduling orchestration; UI consumes domain
APIs without importing backend implementation modules. The monetary contract
is [D001](domain/accounting.md#d001-monetary-representation); payer presentation
eligibility is [D010](domain/transactions.md#d010-pay-by-transfer-presentation-eligibility).

Place calculations and decisions in pure functions. Keep framework and database code responsible for I/O and orchestration.

Good candidates for pure modules include:

- money parsing, formatting, arithmetic, and allocation
- transaction classification and command construction
- pipe graph traversal and path reconciliation
- cron occurrence calculations
- deletion planning and accounting conservation

React components should not contain backend accounting policy. Convex handlers should not duplicate pure calculations in multiple mutation branches.

## Information Hiding

- Public Convex functions return purpose-built results, not persistence documents by default.
- Feature components consume application models, not unrestricted generated documents.
- UI primitives receive presentation data and callbacks, not feature contexts.
- Graph consumers request operations such as `descendants` or `rootOf` instead of manipulating internal maps.

When a schema or representation changes, the number of affected modules is a measure of whether the boundary is working.

## Cohesion And Component Size

Line count is a signal, not a rule. Split a module when it combines independent reasons to change, independent state machines, or unrelated policies.

Do not split a cohesive component merely to satisfy a size threshold. Do split when a component combines query ownership, mutation orchestration, domain transitions, validation, and multiple rendering modes.

Prefer extracting a pure model or controller before extracting small visual fragments.

## Dependency Direction

Dependencies should generally flow in this direction:

```text
routes -> features -> UI primitives
features -> typed backend adapters
Convex wrappers -> backend model operations -> database
framework shells -> shared pure domain modules
```

Avoid dependencies from UI primitives to features, from client code to backend implementation modules, or from pure domain code to React/Convex runtime APIs.

## Backend Contracts

Registered Convex functions are security and consistency boundaries: public
inputs are hostile even when only the app currently calls them. The detailed
[backend contracts](backend.md) cover validators, atomicity, bounded transaction
work, and persisted changes.

## Performance Method

Use the sequence Measure, Optimize, Remeasure, Validate.

Collect evidence relevant to the flow:

- React commit count and slow components
- JS and UI frame time
- startup milestones
- active Convex subscriptions
- Convex documents and bytes read or written
- mutation latency and OCC conflicts
- memory after repeated navigation and pagination

Do not use component count or an inline callback as sufficient evidence of a performance problem.

## Testing Strategy

The [TDD skill](../.agents/skills/tdd/SKILL.md) owns test scope and procedure.
Production boundaries should become clear before reorganizing large test files;
test-file size alone is not evidence that a production abstraction is needed.

## Change Discipline

- Make the smallest complete change that establishes the agreed behavior.
- Separate security containment, data migration, architecture movement, and visual changes when they carry different risks.
- Do not mix speculative cleanup into a correctness fix.
- Follow the documentation discipline in `AGENTS.md`; the [decision index](domain-decisions.md) links to canonical contracts rather than accumulating implementation notes.
