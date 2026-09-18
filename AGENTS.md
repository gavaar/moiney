# Moiney - Financial Companion App

## Start Here

Expo/React Native, Expo Router, NativeWind, Convex, strict TypeScript, Bun, and
Vitest. `package.json` owns dependency versions and available scripts.

Read only the guides relevant to the task before editing; do not preload all
references. Follow cross-links when the change touches their contracts.

| Task | Read |
| --- | --- |
| Production behavior change or bug fix | `.agents/skills/tdd/SKILL.md` |
| Architecture, substantial refactoring, or performance | `docs/engineering-principles.md` |
| Convex functions or persisted schema | `docs/backend.md` and the relevant Convex skill |
| Money, allocation, rules, scheduling, boiler balances | `docs/domain/accounting.md` |
| Transaction creation, editing, grouping, or eligibility | `docs/domain/transactions.md` |
| Pipe deletion, freezes, or deletion reconciliation | `docs/domain/deletion.md` |
| Authentication, sessions, or recovery | `docs/domain/auth.md` |
| Transaction caching, history loading, or usage ranking | `docs/domain/history-cache.md` |
| Pipe statistics or monthly summaries | `docs/domain/reporting.md` |
| Input dispatcher or variant changes | `docs/input.md` |
| Decision status or finding a domain contract | `docs/domain-decisions.md` |

Load the relevant project skill for Convex, Expo, routing, migrations, auth, or
performance work. Skills live under `.agents/skills/`.

## Commands

- `bun start` / `bun run dev`: Expo; `bun run ios`, `bun run android`, `bun run web`: platform launch.
- `bun run convex:dev`: backend development; `bun run convex:deploy`: verify then deploy.
- `bun run test`: Vitest suite; do not use `bun test`.
- `bun run typecheck`: TypeScript; `bun run verify`: full tests and type checking.

## Change Safety

- Keep changes scoped; do not install packages without explicit user approval.
- For behavior changes, use a failing test before implementation; follow the TDD skill for scope and procedure.
- Documentation, comments, formatting, and visual-only changes need no Red-Green cycle or source-structure tests; still run relevant existing tests and type checking.
- Run focused tests first, then the full suite and type check before completion.
- Add compatibility paths only for persisted data, shipped behavior, or external consumers, not hypothetical needs.
- Pending and in-progress decisions are not shipped guarantees; check the relevant guide's status.

## Architecture

- `src/app/` contains thin routes: composition, parameters, navigation only. Keep tests, helpers, types, and feature components outside it; Router bundles matching source files as routes.
- `src/components/features/` owns feature UI/state; `src/components/ui/` owns presentation primitives independent of features and generated Convex types.
- `src/lib/` owns cross-feature infrastructure; root `domain/` owns framework-independent calculations; `convex/` owns backend I/O and orchestration.
- Never manually edit `convex/_generated/`.
- Normalize backend data at feature boundaries; avoid casts scattered through rendering.
- Keep pure calculations separate from React state and database orchestration.
- Prefer modules that hide invariants, not pass-through wrappers; split by responsibility and state ownership, not line count.
- Keep contexts narrow, scoped to consumers, and fail loudly outside providers. Make ownership clear rather than adding generic dumping grounds.
- Existing boundary violations are not approved patterns; do not deepen them.

## Security And Accounting

- Never expose credentials, password hashes, tokens, or full account/session documents publicly.
- Authentication and resource authorization are separate checks; validate ownership before any writes.
- Backend APIs enforce semantic bounds, pipe topology, and transaction eligibility, not just client checks.
- Money is persisted and calculated as whole integer cents; do not introduce another representation or convert cents back to major-unit decimals.
- Accounting mutations need conservation, negative-value, and boundary tests.
- Transaction involvement includes `from`, `to`, and `paidFrom`.
- Scheduling uses an explicit clock in pure code and idempotent execution boundaries.
- Bound backend reads and writes. Add persisted fields, indexes, statuses, phases, or API result fields only for an identified current consumer or enforced invariant.

## UI And Performance

- Measure before optimizing and remeasure afterward; fix ownership, subscription scope, and virtualization before adding memoization.
- Virtualize collections that can grow materially; scope subscriptions and listeners to focus when hidden tabs should be inactive.
- Do not add state libraries, caches, or memoization without a demonstrated bottleneck.
- Test platform-sensitive navigation, keyboard, modals, and accessibility with native-oriented tools where practical.
- Every modal dismisses on backdrop tap. No close buttons, close icons, or other dismissal-only controls inside modal content; domain actions remain allowed.
- Application code uses `src/components/ui/Input/Input.tsx`, not direct variant imports. Preserve its public contract unless an approved refactor replaces it completely.

## Documentation Discipline

- Update the canonical guide only for a durable invariant, public contract, compatibility constraint, or meaningful architectural decision. Edit existing text in place and remove what it supersedes.
- Do not append implementation summaries, completed-task notes, or rollout progress. Completed migration history belongs in Git unless it still constrains supported data or operations.
- Keep one authoritative home per detailed rule; link rather than duplicate. Code owns implementation details, tests demonstrate behavior, and docs explain constraints and non-obvious reasons.
- Add a discovery link for new guides, not a global instruction entry. Keep this startup guide around 80-120 lines; move task-specific detail to references rather than removing safeguards.
