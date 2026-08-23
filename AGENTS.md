# Moiney - Financial Companion App

## Source Of Truth

- Verify dependency versions in `package.json`; documentation is descriptive and must be updated after upgrades.
- Read `docs/engineering-principles.md` before changing production code.
- Read `docs/domain-decisions.md` before changing money, transactions, pipes, deletion, scheduling, or authentication.
- Read and update `docs/refactor-roadmap.md` when working on the design-improvement backlog.
- Load the relevant project skill for Convex, Expo, routing, migrations, auth, or performance work.

## Current Stack

- Expo SDK 57, React Native 0.86, React 19
- Expo Router with routes under `src/app/`
- NativeWind v4 and Tailwind CSS v3
- Convex backend under `convex/`
- TypeScript in strict mode
- Bun package manager
- Vitest test runner

## Project Structure

```text
moiney/
|-- src/
|   |-- app/                 # Expo Router route and layout files only
|   |-- components/
|   |   |-- ui/              # Reusable presentation primitives
|   |   `-- features/        # Feature-owned screens, state, and components
|   `-- lib/                 # Cross-feature infrastructure and utilities
|-- convex/
|   |-- _generated/          # Generated Convex code; do not edit manually
|   |-- lib/                 # Existing backend helpers and pure algorithms
|   |-- schema.ts
|   `-- *.ts                 # Registered Convex functions
|-- docs/                    # Engineering rules, decisions, and roadmap
|-- assets/
`-- .agents/skills/          # Project agent skills
```

The current structure contains known boundary violations and oversized modules. Do not treat every existing dependency as an approved pattern. Consult `docs/refactor-roadmap.md` before copying one.

## Commands

- `bun start` or `bun run dev` - start Expo
- `bun run ios` - start iOS
- `bun run android` - start Android
- `bun run web` - start web
- `bun run convex:dev` - start Convex development
- `bun run convex:deploy` - verify, then deploy Convex functions
- `bun run test` - run the test suite; do not use `bun test`
- `bun run typecheck` - run the current type-check baseline
- `bun run verify` - run the full test suite and type check

## Mandatory Workflow

- Follow `.agents/skills/tdd/SKILL.md` for production behavior changes.
- Work on one observable behavior at a time: plan, failing test, minimum implementation, refactor.
- Run the focused test first, then the full suite and type check before completion.
- Prefer behavioral tests over source-text assertions or tests of implementation shape.
- Do not install packages without explicit user approval.
- Keep unrelated changes out of the current update.
- Update domain decisions and roadmap status when behavior or architecture changes.
- Do not add backward-compatibility paths unless persisted data, shipped behavior, or an external consumer requires them.

## Architecture Boundaries

- Keep route files thin: route composition, route parameters, and navigation only.
- Keep tests, helpers, components, and types outside `src/app/`; Expo Router treats matching source files there as routes and bundles them into the application.
- Keep genuine UI primitives independent of feature modules and generated Convex document types.
- Normalize backend data at feature boundaries instead of scattering casts through render code.
- Prefer deep modules that hide representation and invariants over many pass-through wrappers.
- Remove functions that only return a call to another function; call the underlying function directly unless the wrapper adds meaningful behavior or establishes a necessary boundary.
- Keep pure domain calculations separate from React state and Convex database orchestration.
- Split components by responsibility and state ownership, not by a line-count rule alone.
- Keep contexts narrow, fail loudly outside providers, and scope providers to actual consumers.
- Avoid generic `components` or `utils` dumping grounds; ownership must be clear from the path.
- Existing exceptions are tracked in `docs/refactor-roadmap.md`; new code must not deepen them.

## Convex Safety Rules

For every new or modified registered Convex function:

- Expose the smallest public API and return only fields required by the caller.
- Never return credential, password-hash, token, or full account/session documents publicly.
- Treat authentication and resource authorization as separate checks.
- Validate resource ownership before inserting, patching, or deleting anything.
- Validate semantic bounds in addition to Convex value types.
- Use internal functions and generated `internal.*` references for backend-only orchestration.
- Define argument and return validators.
- Prefer structured expected errors over client parsing of error-message text.
- Avoid unbounded `.collect()`, post-index database `.filter()`, and unbounded fan-out mutations.
- Use the smallest correct read/write set. Reuse documents already loaded in the current function, pass them into helpers, avoid duplicate point reads and unchanged writes, and bound every query. Do not add a cache for a document read only once or reuse pre-write data when correctness requires post-write state.
- Use explicit table names with `ctx.db.get`, `patch`, `replace`, and `delete` when touched code supports it.
- Use the migration skill and widen-migrate-narrow for persisted breaking schema changes.
- Do not add persisted fields, indexes, status values, background phases, or API result fields without an identified current consumer or enforced invariant. Future observability or recovery possibilities are not sufficient justification.

Known violations remain in the backlog. Fix them in the agreed order rather than creating parallel compatibility layers.

## Financial Domain Rules

- Consult `docs/domain-decisions.md`; it distinguishes current behavior from accepted target behavior.
- Money is persisted and calculated as whole integer cents.
- Do not introduce another monetary representation or convert integer cents back to major-unit decimals.
- Any accounting mutation must have tests for conservation, negative values, and boundary cases.
- Consider `from`, `to`, and `paidFrom` whenever determining transaction involvement.
- Enforce pipe topology and transaction eligibility on the backend, not only in the UI.
- Scheduling calculations must accept an explicit clock in pure code and be idempotent at execution boundaries.

## React Native And Performance

- Measure before optimizing and remeasure afterward.
- Fix ownership, subscription scope, and list virtualization before adding memoization.
- Use virtualized lists for collections that can grow materially.
- Scope listeners and subscriptions to screen focus when hidden tabs should not remain active.
- Do not add state libraries, caching layers, or memoization without evidence of a real bottleneck.
- Test platform-sensitive navigation, keyboard, modal, and accessibility behavior with native-oriented tools where practical.

## Modal Behavior

- Every modal must be dismissible by tapping its backdrop; use `ModalShell` or an equivalent backdrop-dismissable primitive.
- Never add a close button, close icon, or other dismissal-only control inside modal content. Buttons that perform an action, such as submit or delete, remain allowed.

## Input Component

Application code uses the polymorphic `src/components/ui/Input/Input.tsx` dispatcher rather than importing variants directly.

| `type` | Component folder |
| --- | --- |
| `text` | `TextInput/` |
| `number` | `NumberInput/` |
| `decimal` | `DecimalInput/` |
| `date` | `DateInput/` |
| `icon` | `IconInput/` |
| `checkbox` | `Checkbox/` |
| `select` | `SelectInput/` |
| `text-select` | `TextSelectInput/` |

Each variant remains colocated with its tests and private helpers. Preserve this public dispatcher unless an approved refactor replaces the complete contract.
