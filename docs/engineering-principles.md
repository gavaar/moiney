# Engineering Principles

The global code-quality guide for handwritten application, domain, backend, and
test code. Use it when adding or changing a module, not just during large
refactors. Rules concern behavior, readability, ownership, and interfaces;
equivalent syntax choices follow nearby code. `AGENTS.md` routes specialized
work to its canonical contract.

## Optimize For Understanding

The primary design goal is to make important behavior easy to understand and difficult to misuse.

- Prefer an explicit domain concept over repeated conditional logic.
- Keep interfaces smaller than their implementations.
- Hide indexes, maps, persistence shapes, and sequencing requirements behind deep operations.
- Pull complexity into the module best positioned to resolve it once.
- Avoid making every caller understand the same edge cases.

Before adding an abstraction, identify what complexity it hides. A wrapper that only renames another function is not a deep module.

Readability means a reader can find the owner of a decision and understand its
inputs, outputs, and consequences. Name substantive operations for their intent;
keep rendering and orchestration focused on the sequence of those operations.
Comments explain non-obvious invariants and reasons rather than narrating code.

## Strategic Design

Choose the smallest complete design that hides today's complexity. Resolve its
source rather than distributing patches across callers; distinguish urgent
containment from a durable correction. Use these signals when reviewing a design:

- **Change amplification:** one conceptual change requires edits across many modules. Move the shared decision into the module that owns it.
- **Cognitive load:** callers must learn internal representations, sequencing, or repeated edge cases. Hide those requirements behind a simpler interface.
- **Unknown unknowns:** dependencies or consequences are difficult to discover. Make ownership, invariants, and dependency direction explicit so the affected behavior and tests are discoverable.

Prefer coherent operations over caller-specific flags. Generalize only what
actually repeats or varies; add configuration or extension seams when a current
consumer earns their complexity.

## Make Invalid States Unrepresentable

Use types and command shapes to prevent invalid combinations where practical.

- Prefer discriminated unions to unrelated optional fields.
- Use explicit patch operations when `unchanged`, `set`, and `clear` differ.
- Represent asynchronous state with explicit states when independent booleans permit contradictions.
- Parse and normalize external data at boundaries before it reaches domain code.

Runtime validation remains necessary at network and database boundaries even when TypeScript types are strict.

Preserve caller types through collection, renderer, and composition interfaces.
Infer an item's shape from its data and carry it to callbacks; an `any` index
signature is not an extensibility mechanism. Feature-specific item types belong
to the feature, not to a generic UI primitive. Where TypeScript loses a proven
correlation, keep any necessary assertion at the operation that owns it rather
than scattering assertions through callers or rendering.

## Shared Domain Core

Place domain calculations and decisions in framework-independent `domain/`
functions; framework shells own I/O and orchestration. Convex owns database I/O,
authorization, and scheduling execution. UI consumes domain operations, not
backend implementation modules. Keep accounting policy out of React and shared
calculations out of duplicated mutation branches. See
[accounting](domain/accounting.md) and [transactions](domain/transactions.md) for
their domain contracts.

## Information Hiding

- Public Convex functions return purpose-built results, not persistence documents by default.
- Feature components consume application models, not unrestricted generated documents.
- UI primitives receive presentation data and callbacks, not feature contexts.
- Graph consumers request operations such as `descendants` or `rootOf` instead of manipulating internal maps.
- Separate caller-facing props from private coordination signals. Expose a type
  only when a current caller needs it for composition.
- Outside a module, use its deliberate public entry point. Export only current
  caller needs; internal helpers, contexts, and implementation files stay private.
  Inside the module, direct imports are allowed. An entry point does not require
  a barrel in every directory.

When a schema or representation changes, the number of affected modules is a measure of whether the boundary is working.

## Cohesion And Component Size

Split by independent reasons to change, state machines, or policies, not a size
threshold. Query ownership, mutation orchestration, domain transitions, and
rendering may need different owners; a cohesive interaction may not. Prefer a
pure model or controller extraction over arbitrary visual fragments.

Extract substantive transformations or policy with an independent reason to
change; leave trivial transformations and cohesive interaction state local.
Neither a `hooks/` directory nor a controller hook is mandatory.

## Folder Structure

- Each standalone React component module has a matching PascalCase folder and
  implementation basename, even when it starts as one file. Keep component-owned
  configuration, helpers, types, and tests directly beside that implementation.
- Put child component modules under their owner's `components/`, each in its own
  matching folder. A single-owner child stays nested with that owner; shared
  children belong under their nearest common owning module's `components/`.
- Put shared helpers, orchestration, and protocols at the nearest common owning
  module within the correct architectural layer. A provider creating a context
  does not make its shared contract private to that provider's component folder.
  Keep the provider's private state and rendering with the provider.
- Promote files only for actual consumers. Avoid root-level `shared/` dumping
  grounds and automatic `hooks/`, `types/`, or `utils/` buckets. Companion files
  should describe their responsibility; create no empty scaffold files/folders.
- Use module-per-folder, not function-per-folder, for non-React code: colocate a
  cohesive responsibility and its companions, without wrapping each function or
  hook in another directory. A shared hook may be a direct owner-local file.
- Small private components may remain inside their owner's implementation file.
  Extracting one into a standalone module gives it its own folder. Identify
  component modules by their role, not just `.tsx`: JSX-producing configuration
  still belongs with its owner, and exporting a component from a config/helper
  file does not evade the component-folder rule.
- Platform implementations of one logical module stay together, for example
  `Picker/Picker.native.tsx` and `Picker/Picker.web.tsx`. Tests and local fixtures
  stay with the behavior they verify, not in a parallel component tree.

```text
Owner/
  Owner.tsx
  Owner.test.tsx
  model.ts
  model.test.ts
  components/
    Child/
      Child.tsx
      Child.test.tsx
```

Existing layouts are not exceptions. Correct mismatches within the agreed scope
rather than copying them. A framework-required filename or location must have a
demonstrated requirement; keep that entry thin and place implementation and
companions with their owner instead of exempting the entire subtree. Folder
ownership does not make every folder public or require an `index.ts` barrel.

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

Collect evidence relevant to the flow: React commits, JS/UI frame time, startup
milestones, active subscriptions, documents/bytes read or written, mutation
latency/OCC conflicts, or memory after repeated navigation and pagination.

Do not use component count or an inline callback as sufficient evidence of a performance problem.

Use memoization when it has an identifiable benefit: avoiding meaningful repeated
work or preserving identity for a consumer that actually benefits from it.
Caching a cheap expression is not itself a benefit. Keep correctness independent
of `useMemo`/`useCallback` caches, and do not add or remove memoization merely to
make neighboring modules look alike. Virtualize materially growing collections
and fix state/subscription ownership before adding caches or memoization.

## Testing Strategy

The [TDD skill](../.agents/skills/tdd/SKILL.md) owns test scope and procedure.
Production boundaries should become clear before reorganizing large test files;
test-file size alone is not evidence that a production abstraction is needed.
The [testing map](agents/testing.md) owns seam selection and mocking rules;
[UI contracts](ui.md) own accessibility, theme, and platform verification.

## Enforcement

ESLint and TypeScript enforce mechanical constraints; review checks ownership,
depth, cohesion, readability, and whether an optimization earns its complexity.
A passing linter is not proof of those qualities. The
[lint plan](agents/lint-plan.md) identifies additional mechanical guardrails;
it does not replace this guide or describe already-enabled enforcement.

## Change Discipline

- Make the smallest complete change that establishes the agreed behavior.
- Separate security containment, data migration, architecture movement, and visual changes when they carry different risks.
- Do not mix speculative cleanup into a correctness fix.
- Follow the documentation discipline in `AGENTS.md`; the [decision index](domain-decisions.md) links to canonical contracts rather than accumulating implementation notes.
