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
| 7. Independent correctness fixes | Completed | Repair selection, back handling, description clearing, cron diff, input handlers, recent-title selection, and loading states | Relevant focused tests |
| 8. Shared domain core | Completed | Introduce deep pure modules for transaction identity/accounting, pipe graph/reconciliation, and cron schedules without changing monetary representation | D001-D003 |
| 9. Integer cents migration | Completed | Replace floating-point monetary persistence and arithmetic with integer cents | Update 8, D001 |
| 10. Financial mutation semantics | Completed | Define corrections, rule effects, idempotency, and accounting projections | Updates 8-9 |
| 11. Convex model boundaries | Completed | Make registered functions thin, validated, authorized wrappers over deep model operations | Updates 1-3, 8-10 |
| 12. Bounded backend work | Completed | Scope recascade, batch cleanup/crons/deletion, and index hot transaction queries | Updates 6, 10-11 plus measurements |
| 13. Frontend ownership | In progress | Normalize backend models, narrow contexts/subscriptions, restore dependency direction, and move feature behavior out of shared UI and route files | Updates 5, 8, 11 |
| 14. Complex component refactors | Pending | Refactor AmountForm, RuleModal, PipeTreeView, and transaction rows internally by responsibility after their ownership boundaries are established | Updates 5, 8, 13 |
| 15. Measured runtime performance | Pending | Profile and improve virtualization, subscriptions, startup, icons, and repeated modals | Updates 12-14 |
| 16. Maintenance hardening | Pending | Accessibility, observability, dependencies, dead APIs, behavioral tests, and documentation | Prior updates as applicable |

## Confirmed High-Priority Risks

- Backend financial and topology invariants are incomplete.
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

Updates 9 and 10 are complete. The framework-independent money core parses,
validates, and formats integer-cents amounts; backend mutation arguments use
canonical names; and persisted monetary values have been migrated and verified.
Update 10 now includes pay-by-transfer settlement, tree aggregation, deletion
balances, current-period edits, effect-based rule triggers, coalesced cron
catch-up, past-start activation, unchanged-cron-save idempotency, and the
preservation policy for legacy documents.

The `any_spend` to `instant_settlement` migration processed 32 development
pipes. Migration-specific code was removed after completion, while the reusable
migrations component remains installed for future work. Convex transport retry
semantics, atomic cron schedule advancement, and UI submission guards are the
chosen operation-idempotency boundary; no operation IDs are persisted.

Update 11 is complete. Transaction creation and editing delegate from
validated registered mutations to deep operations that own command
normalization, pipe authorization, accounting, rule execution, recascade, and
persistence. Creation also owns title usage; editing owns correction sequencing
and uses an explicit clock. Both mutations have explicit null results.

Transfer creation and value editing enforce the D013 leaf-to-root, cross-tree
contract with structured expected errors before accounting writes. Missing and
foreign referenced pipes use the same non-disclosing error, including when an
owned historical transaction references another user's pipe.

Manual rule execution now delegates to a deep pipe operation that owns pipe
loading, non-disclosing authorization, deletion-state validation, clocked rule
execution, and subtree recalculation. Its registered mutation is authentication,
clock acquisition, and delegation with an explicit null result.

Pipe updates now delegate to the same model module. The operation owns
non-disclosing authorization, deletion-state validation, partial patch
construction, integer-cents capacity validation, and recascade sequencing.

Child-pipe creation now delegates to the pipe model. The operation owns
non-disclosing parent authorization, deletion and user-limit checks,
integer-cents capacity validation, legacy pending-accounting settlement, child
insertion, parent rule clearing, and recascade sequencing.

Rule updates now delegate to the pipe model with an explicit server clock. The
operation owns non-disclosing authorization, deletion-state validation,
same-day cron idempotency, rule patch construction, integer-cents cap updates,
overdue occurrence catch-up, and post-write recascade sequencing.

Root-pipe creation also delegates to the model, which owns initialization and a
shared pipe-limit check bounded to the 500 documents needed to enforce the
contract. Limit failures are stable structured errors for both root and child
creation.

Update 12 is complete. Deployment, static, and repeatable 20/200/500-pipe
measurements are recorded in `docs/update-12-baseline.md`. Deployment insights
report no current health issue. Production-only measurement remains deferred
because no production database exists.

Changed-only recascade writes are complete. Stable scenarios now issue zero
patches instead of 20, 200, or 500, while allocation-changing scenarios retain
all required writes. Whole-user reads and the existing deletion guard remain.

Metadata-only pipe updates now skip reconciliation. At 20, 200, and 500 pipes,
name, icon, and description changes read only the target document instead of 21,
201, or 501 documents. They remain blocked for a frozen target but are allowed
when an unrelated tree is being deleted. Capacity and priority updates continue
through accounting reconciliation.

Root-scoped reconciliation is now established for ordinary expense and feed
creation. At 20, 200, and 500 total user pipes, a standalone affected root reads
two pipe documents instead of 21, 201, or 501. The helper deduplicates affected
roots, reuses cached ancestry, freshly loads post-write trees, validates every
affected member before patches, and retains changed-only writes. Unrelated
frozen roots do not block these one-root transactions.

Two-root transfer and pay-by-transfer creation now use affected-root
reconciliation. At 20, 200, and 500 total user pipes, two standalone affected
roots read four pipe documents instead of 22, 202, or 502. Both complete trees
are validated before reconciliation writes, transfer cents remain conserved,
pay-by logical and liquidity effects remain intact, and unrelated frozen roots
do not block either transaction shape.

One-root expense and feed edits now use affected-root reconciliation and an
invocation-scoped pipe cache. Two-root transfer and pay-by-transfer edits use
both affected trees. Current-period deltas, correction history, topology
validation, pending liquidity, and automatic rule triggers remain unchanged,
while unrelated frozen roots no longer block these edit shapes.

All transaction creation and edit paths now use affected-root reconciliation.
`addPipe` also uses affected-root reconciliation, preserving parent settlement,
child allocation, and conservation while ignoring unrelated frozen roots.
`updatePipeRule` now uses affected-root reconciliation while preserving cron
catch-up and idempotency.

Accounting-relevant `updatePipe` capacity and priority updates now use
affected-root reconciliation as well. Presentation-only updates continue to
skip reconciliation. All ordinary financial and pipe mutation paths now avoid
whole-user recascade; the remaining broad backend work is scheduled cron,
cleanup, deletion phase sizing, and filtered transaction queries.

The bounded cron slice now reads pages of up to 500 due candidates, groups them
by user, loads each selected user's pipes once, and processes complete user
groups within a 2,000-pipe aggregate snapshot bound. Root resolution, freeze
checks, cron settlement, and affected-root reconciliation happen in memory;
each changed pipe receives one merged accounting patch. Deferred candidate IDs
are carried through atomic continuations with the original clock and mutable
index cursor. Frozen candidates remain due and later candidates are not
 starved.

Expired-session cleanup is now bounded to pages of 100 sessions. It deletes
only rows expired before one captured clock and carries that clock and the
pagination cursor through atomic continuations. The 201-session boundary test
covers multiple pages and the exact expiration boundary. Production-only
measurement is intentionally deferred because no production database exists.
Maximum-size deletion phase sizing is now covered by a local 500-pipe boundary:
transaction pages remain 50 rows, parent credit is conserved, finalization is
retry-safe, and no phase split is required under the current user limit. The
filtered recent transaction list now uses user-scoped role/date indexes for
`from`, `to`, and `paidFrom`, deduplicates multi-role matches, and bounds the
pipe filter to one user's maximum pipe count. The paginated history endpoint is
unfiltered because its current consumer has no pipe filter. Production-only
measurement is deferred because no production database exists.

## Update 13 Progress

Update 13 is in progress. 13.1, the frontend model and adapter slice, is
complete for the current transaction and pipe read paths. Feature-owned
adapters in `src/components/features/transactions/data/transactions.ts` and
`src/components/features/pipes/data/pipes.ts` map persisted Convex documents to
models with domain-facing identifiers and fields, omit backend ownership and
persistence metadata, and preserve all user-visible roles, icons, accounting,
and rule fields.

`TransactionsProvider`, history, pipe selection, transaction grouping, pipe
lists, tree rendering, and transaction repeat/edit presentation now consume
these models.

13.2 is complete for context ownership and subscription scope. The read-only
`PipeCatalogProvider` owns normalized pipe data and indexes, while
`PipeSelectionProvider` owns only selection state. Catalog-only consumers no
longer subscribe to selection state. The Pipes route receives catalog,
selection, and latest-transaction providers through `PipesProviders`; History
receives only the catalog provider; Profile receives neither. 13.3.0a is
complete: same-title expense and transfer activity is grouped while transfers
contribute zero to grouped totals, `paidFrom` participates in expense
visibility, visible participating pipes drive the single-pipe versus
`card-multiple` presentation, feeds remain separate, aggregate values drive row
color, and newest-transaction repeat structure is preserved.

13.3.0b is complete: transaction snapshots are cache-first across app restarts.
History seeds 100 rows and loads later pages in batches of 15 on explicit
demand. The persistent cache stores every loaded row up to 300 unique
transactions, uses separate scope snapshots for pipe selections, clears on
explicit logout, and does not maintain live Convex subscriptions when a valid
snapshot is available. The next frontend slice is
13.3.0c is complete: current-cycle L2S uses `fed - spent`, external pending
adjustments remain outside that calculation, the existing external-adjustment
chip explains the signed settlement amount, and pipe bars show pending
adjustments as accent overlays without changing the raw fed value. The next
frontend slice is 13.3.1: move this feature behavior out of shared UI and
continue thinning route orchestration.

13.3.1 is complete: transaction presentation moved from `src/components/ui`
to `src/components/features/transactions/components` with its behavioral tests,
while grouping, repeat, edit-history, deleted-history, and accessibility
behavior remained unchanged. The remaining ownership slices are planned as
13.3.2 for Pipes and History route extraction, 13.3.3 for moving pipe
presentation such as `PipeBox` under the pipes feature, 13.3.4 for separating
release/update behavior from the generic `ScreenHeader`, and 13.3.5 for moving
login/sign-up screen logic and auth adapters out of route files. Internal
transaction-row decomposition and animation migration remain in Update 14.

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
