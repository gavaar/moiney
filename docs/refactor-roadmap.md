# Design Improvement Roadmap

This roadmap persists the whole-project audit beyond any single chat session. Work through updates in order unless a newly discovered security or data-integrity issue requires reprioritization.

## Working Protocol

- Present one update's problem, proposed behavior, tradeoffs, and acceptance criteria to the user.
- Resolve pending product decisions before implementation.
- Implement one observable behavior per Red-Green-Refactor cycle.
- Run focused tests, the full suite, and type checking before completing an update.
- Update this roadmap and `docs/domain-decisions.md` after completion.
- Do not mark an update complete based on intent or partial implementation.

## Status

| Update | Status | Objective | Depends on |
| --- | --- | --- | --- |
| 0. Durable agent context | Completed | Add current project guidance, engineering rules, domain-decision status, and this roadmap | None |
| 1. Account API exposure | Completed | Replace public full-user lookup and insertion with narrow availability and internal operations | D004 username decision |
| 2. Cross-tenant pipe writes | Completed | Authorize and validate parent pipes before any child write | None |
| 3A. Authentication containment | Completed | Align JWT/JWKS, use typed internal references, and make registration/session behavior reliable | Update 1 |
| 3B. Authentication provider decision | Deferred | Reevaluate managed auth before a public release | Update 3A |
| 3C. Custom-auth hardening | Completed | Add rotation, replay detection, rate limits, recovery, and storage policy | Update 3A |
| 4. Quality gates | Completed | Require tests and type checking before deploy; improve native and Convex boundary coverage | None |
| 5. Transaction identity | Completed | Model transaction kinds and collision-free grouping, including `paidFrom` | D003, D007 |
| 6. Pipe deletion contract | Completed | Process orphaned history in bounded pages, preserve deleted-role icons, and return subtree balance to the parent | D002, money command contract |
| 6a. Pipe module boundaries | Completed | Separate shared pipe logic and deletion operations while preserving Convex registration paths | Update 6 |
| 7. Independent correctness fixes | Pending | Repair selection, back handling, description clearing, cron diff, input handlers, and loading states | Relevant focused tests |
| 8. Shared domain core | Pending | Introduce deep pure modules for money, transactions, pipe graph, and cron schedules | D001-D003 |
| 9. Integer cents migration | Pending | Replace floating-point monetary persistence and arithmetic with integer cents | Update 8, D001 |
| 10. Financial mutation semantics | Pending | Define corrections, rule effects, idempotency, and accounting projections | Updates 8-9 |
| 11. Convex model boundaries | Pending | Make registered functions thin, validated, authorized wrappers over deep model operations | Updates 1-3, 8-10 |
| 12. Bounded backend work | Pending | Scope recascade, batch cleanup/crons/deletion, and index hot transaction queries | Updates 6, 10-11 plus measurements |
| 13. Frontend ownership | Pending | Normalize backend models, narrow contexts/subscriptions, and restore dependency direction | Updates 5, 8, 11 |
| 14. Complex component refactors | Pending | Refactor AmountForm, RuleModal, PipeTreeView, and transaction rows by responsibility | Updates 5, 8, 13 |
| 15. Measured runtime performance | Pending | Profile and improve virtualization, subscriptions, startup, icons, and repeated modals | Updates 12-14 |
| 16. Maintenance hardening | Pending | Accessibility, observability, dependencies, dead APIs, behavioral tests, and documentation | Prior updates as applicable |

## Confirmed High-Priority Risks

- Backend financial and topology invariants are incomplete.
- Transaction involvement is inconsistent across grouping, filtering, and deletion.
- Floating-point monetary arithmetic cannot guarantee exact conservation.
- Several maintenance functions and transaction scans are unbounded.

## Refactor Targets

- `convex/lib/pipes.ts`: separate pure cron, allocation/tree logic, and database orchestration.
- `convex/transactions.ts`: move classification, validation, and accounting operations behind a deep model API.
- `convex/pipes.ts`: extract ownership, topology, deletion planning, and reconciliation.
- `AmountForm.tsx`: use typed drafts, pure transitions, and command construction.
- `RuleModal.tsx`: use a canonical schedule draft and normalized command comparison.
- `PipeTreeView.tsx`: share graph/liquidity logic and virtualize rendering.
- Transaction presentation: move feature-aware rows and lists out of `ui`.
- Auth provider: separate session state, persistence, and remote gateway concerns.

Line count alone is not a refactor requirement. Cohesive components such as the calendar may remain intact.

## Performance Gate

Before architecture-heavy optimization, record representative baselines for 20, 200, and 500 pipes and for growing transaction histories. Measure React commits, frame time, memory, active subscriptions, Convex reads/writes, query scans, mutation latency, and OCC conflicts.

Update 15 must report before-and-after measurements rather than relying only on static predictions.

## Current Next Step

Update 6 is complete: orphaned transaction history is processed in bounded
role-indexed pages, preserved transactions store deleted-role icons directly,
and subtree balance is credited to the immediate parent. Update 6a keeps the
implementation under `convex/lib/pipes/` and `convex/lib/pipes/delete/` while
preserving Convex registration paths. The next roadmap update requires user
approval before work begins.

## Completed Accessibility Layout Work

Implemented ahead of Update 16 to keep large-font layouts usable. **Prune this
section when Update 16 is marked Completed.**

- `PipeTreeView` rows now give the name column all available horizontal space (`flex-1`) with a fixed right-side mini bar, and pipe names clamp via `numberOfLines={1}` instead of wrapping or overflowing a precomputed fixed width.
- The leaf `AmountForm` in `InnerPipesScreen` scrolls within its bounded region so expanding `Paid from another pipe?` no longer bleeds into the Latest transactions section.
- The Latest transactions section is collapsible. The title row is a full-width `bg-surface` bar (accessible disclosure button, `expanded` state) that defaults to open; when collapsed the pipe area reclaims the vertical space. The chevron rotates with `react-native-reanimated` (`LinearTransition` + `FadeInDown`/`FadeOutUp`). The pipe area and transaction section both carry a layout transition so the collapse animates both regions together instead of snapping the feed list. In tree view the section is minimized (collapsed) rather than removed: switching to tree collapses it and switching back to list view re-opens it.

Verified with behavioral tests in `src/app-tests/main/pipes.test.tsx` and a source-structure layout assertion in `PipeTreeView.test.tsx` (matching the `AddPipeModal.test.tsx` precedent). Full suite and type check are green.

## Animation Approach

`react-native-reanimated` is the standard animation library. `vitest.setup.ts`
provides a lightweight Reanimated mock so existing and new animation tests run
in jsdom. Migrate remaining built-in RN `Animated` usages (e.g.,
`StackedTransactionItem` disclosure) to Reanimated incrementally as their
components are touched.

Worklets `bundleMode` is disabled (`babel.config.js` and `metro.config.js`
use plain `react-native-worklets/plugin`) because worklets 0.10.1's Bundle
Mode crashes Android startup under Expo OTA/Expo Go ("Bundle Mode + Expo OTA
startup crash on Android", fixed upstream in worklets 0.10.2). Expo Go freezes
the native side at worklets 0.10.1 / reanimated 4.5.1 and both packages enforce
exact JS=native version equality, so the fix is unreachable without a native
build. Re-enable `bundleMode` only once the SDK-pinned worklets includes the
0.10.2 fix or the project moves to a development build. The
`patches/metro@0.84.4.patch` stays in place defensively (only relevant to
bundle mode's `.worklets/*.js` indexing); classic mode does not need it.
