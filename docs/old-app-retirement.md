# Old-App Retirement: Removal Inventory

## Scope and baseline

Inspected commit: `84c1cf942804d5f8eae133ed026b5fa10868a9f8`.

All three production event backfills are complete, as confirmed by the user.
Deployment and scheduled-job status have not been independently verified here.

The current app reads operation-linked events for History, Latest, ranking, live
reporting, and new monthly captures. Transaction actions, corrections, pipe
deletion, and cache invalidation still have legacy dependencies.

This inventory distinguishes:

- **Remove now:** obsolete current-app implementation.
- **Remove after retirement:** public compatibility readers.
- **Replace, then remove:** infrastructure still required by the current app.
- **Keep:** current domain behavior and event infrastructure.

“Retired” must mean old clients are explicitly unsupported, not merely that a
newer app has been released. Recheck callers and operational gates against the
current branch before executing this inventory.

Canonical constraints remain in [events](domain/events.md),
[transactions](domain/transactions.md), [deletion](domain/deletion.md),
[accounting](domain/accounting.md), [history cache](domain/history-cache.md),
[reporting](domain/reporting.md), and [backend contracts](backend.md).

## 1. Obsolete client readers: remove now

### Legacy transaction history hook

Remove:

- `src/components/features/transactions/cache/useTransactionHistory.ts`
- Its dedicated tests.

The current History loader is `history/use-mixed-history.ts`, which reads events.

**Dependency to relocate first:** `TransactionHistoryFilters` remains imported by
current History modules. Move that type to an event/history-owned module and
update those imports before deleting the hook file.

### Legacy latest-transactions context

Remove:

- `src/components/features/transactions/context/TransactionsContext.tsx`
- Its dedicated tests.

The inspected code has no current production consumers of `TransactionsProvider`
or `useTransactions`.

Remove obsolete mocks from tests such as `PipesScreen.test.tsx`; do not preserve
an unused context merely because tests still mock it.

### Legacy transaction list composition

Remove:

- `src/components/features/transactions/TransactionListWithHistory.tsx`
- Its dedicated tests.
- `components/TransactionList/TransactionList.tsx`
- Its legacy list helpers and dedicated tests.
- Obsolete exports and mocks referencing those components.

Current History rendering uses `history/history-list.tsx`.

**Do not delete the entire `TransactionList` directory.** Current event History
still uses `components/StackedTransactionItem/StackedTransactionItem.tsx` and its
presentation model. Relocate those surviving presentation components if useful.

### Legacy transaction grouping

Remove the obsolete runtime grouping implementation in:

- `src/components/features/transactions/groupTransactions.ts`

But first:

- Remove the legacy list consumers.
- Detach the surviving stacked-row presentation type from `TransactionGroup`.
- Preserve equivalent event-grouping coverage.
- Update stacked-row tests that currently build fixtures through
  `groupTransactions`.

Keep `history/event-groups.ts` and `history/event-archives.ts`.

## 2. Legacy public readers: remove after old-app retirement

These readers no longer serve current event History, but may still serve installed
old apps.

### Legacy mixed history backend

Remove:

- `convex/history.ts`: `history:list` and `history:archivePage`.
- `convex/lib/historyContracts.ts`
- `convex/lib/historyPaging.ts`

Before deleting helper modules, confirm no surviving imports remain.

These implement superseded transaction-backed history and lifetime archives.

**Keep `convex/lib/historyValidation.ts`.** Current event retrieval uses its
validation.

### Legacy transaction list endpoints

Remove from `convex/transactions.ts`:

- `listTransactions`
- `listTransactionsPaginated`

Their remaining current-code references belong to the obsolete client readers
identified above.

Do **not** yet remove `listTransactionsByIds`. Current pipe-deletion UI still
calls it to reconcile cached transaction entities. Remove that dependency as part
of the cache replacement below.

### Legacy monthly reporting reader

Remove `monthPage` from `convex/monthlySpendingStats.ts`. Current live reporting
uses `eventMonthPage`.

Keep `eventMonthPage`, `listMine`, `getMine`, and existing frozen reports.

## 3. Legacy scheduled capture: remove after job verification

Remove:

- `monthlySpendingStats:captureUserMonth`
- The transaction branch of `readCapturePage`.
- Transaction/event source switching in capture scheduling and orchestration.

Simplify the remaining capture path to events only.

**Required gate:** verify no pending, running, or retryable scheduled invocation
still targets `captureUserMonth`.

An already-scheduled transaction cursor must not be interpreted as an event
cursor.

Keep:

- `capturePreviousMonth`
- `captureUserEventMonth`, or its event-only successor.
- Bounded pagination.
- Frozen-report checks on every continuation.
- Shared monthly summary calculations.

Do not recapture, overwrite, or enrich existing frozen reports.

## 4. Legacy client cache: replace before deleting

Legacy transaction snapshots no longer power visible History or ranking, but the
cache owner still houses the event cache and mutation invalidation.

### Remove the transaction-only cache machinery

Targets:

- `cache/transactionSnapshot.ts` and its dedicated tests.
- Transaction entity and scope persistence inside `TransactionCacheStore.ts`.
- Transaction-specific context methods: `read`, `replace`, `append`, `mergeHead`,
  `addTransaction`, `updateTransaction`, and `reconcileTransactions`.
- The legacy `cache` value exposed by `TransactionCacheContext`.

### Migrate active callers first

Current callers include:

- `AmountForm/useAmountFormController.ts`
- `TransactionItem/TransactionItem.tsx`
- `DeletePipeConfirmation/DeletePipeConfirmation.tsx`

Replace their transaction-entity updates with an explicit event-history
invalidation/refresh boundary.

Then remove deletion reconciliation through `transactions:listTransactionsByIds`.

### Preserve the current event cache

Do not delete the provider/store wholesale. Preserve:

- Account ownership and hydration.
- Logout/account-switch clearing.
- Mutation notifications.
- Synchronous generation invalidation.
- Rejection of stale in-flight responses.
- Serialized storage writes and clears.
- Event membership and eviction semantics.
- `EventHistoryStore.ts` and `useEventHistory.ts`.
- Event head merging and pagination support.

Storage adapters are shared infrastructure, despite their transaction-oriented
names. Retain or rename them.

## 5. Transaction action bridge: replace before removing legacy storage

The current app still resolves event rows through:

- `transactions:forEventOperation`
- `history/event-transaction-item.tsx`

It then uses real transaction IDs for repeat, edit, delete, and correction history.

### Required replacements

Implement an event-native action boundary that:

- Authorizes the owning account.
- Resolves and validates the complete operation.
- Preserves canonical and surviving counterpart IDs on edits.
- Applies accounting once per logical operation.
- Deletes the complete operation atomically.
- Supports repeat, correction history, and boiler-related workflows.
- Rejects incomplete or broken operations.

Never cast or synthesize a transaction ID from an event ID.

After every current action consumer has migrated, remove:

- `transactions:forEventOperation`
- Transaction-ID-based action adapters.
- Transaction-only branches in `TransactionItem`.
- Legacy transaction models/normalizers that then have no consumers.

The existing `createTransaction`, `editTransaction`, and `deleteTransaction` names
are **not themselves obsolete**. Replace their implementation/contracts or
introduce event-native APIs intentionally; do not delete required user operations.

## 6. Correction history: migrate, do not discard

Current persistence:

- `transactionCorrections.transactionId`
- Index `by_transactionId`

Current APIs:

- `listTransactionCorrectionsPaginated`
- `deleteTransactionCorrectionsBatch`

Correction history remains a supported feature. Before removing transactions:

1. Establish operation-linked correction ownership.
2. Migrate retained correction records through exact transaction-to-operation
   links.
3. Update correction reads, cleanup jobs, and UI identity.
4. Preserve previous/current snapshots and edit timestamps.
5. Resolve any unmappable records explicitly rather than silently dropping them.

Then remove transaction-ID linkage and obsolete APIs/indexes.

### Edited metadata bridge

`convex/events.ts` currently looks up legacy transactions to populate optional
`editedAt`.

Replace this with an event-native source of edit metadata before removing the
legacy lookup and its dependency on `transactions.by_userId_operationId`.

Preserve the shipped `Edited` control.

## 7. Financial dual-writes and transactions table: final removal

Targets:

- Legacy transaction inserts, patches, and deletes in
  `convex/lib/transactions/operations.ts`.
- `transactions.operationId`
- The `transactions` table and its indexes.

**Not removable yet.** Current action, correction, deletion, reconciliation, and
legacy capture paths still depend on it. Before removal, prove every such
dependency has migrated.

Transaction role indexes must remain while deletion jobs or other supported
operations use them.

Purging legacy rows must be a bounded, explicitly approved data operation. It must
not replay accounting, change balances, delete linked current events, destroy
correction history, or modify frozen monthly reports.

Removing obsolete storage is not the same operation as deleting a financial
transaction.

## 8. Legacy lifecycle storage: replace writers, then remove

Targets:

- `pipeCreationEvents` table and its indexes.
- Legacy lifecycle persistence in `convex/lib/pipeHistory.ts`.
- Legacy lifecycle branches in `convex/lib/pipes/delete/operations.ts`.

`pipeHistory.ts` currently also drives event lifecycle synchronization. Therefore,
it cannot simply be deleted.

First make pipe creation, presentation refresh, and deletion write event lifecycle
snapshots directly. Preserve:

- Original creation dates.
- Distinct creation and deletion operations.
- Final retained pipe/parent presentation.
- Root-to-parent ancestry.
- Deleted-descendant archive matching.
- Keep-history versus delete-history policy.

Also detach `PipeLifecycleSnapshot` in `convex/lib/events/lifecycle.ts` from
`Doc<"pipeCreationEvents">`.

Then remove legacy lifecycle writes, purge the old rows safely, and remove the
table.

## 9. Pipe deletion: migrate transaction traversal before cleanup

`convex/lib/pipes/delete/operations.ts` still traverses transactions through
`from`, `to`, and `paidFrom`.

Replace that traversal with event-native operation processing before removing
transactions or role indexes. Preserve:

- Involvement of logical source, destination, and payer.
- Once-only operation processing across multiple perspectives.
- Accounting reconciliation.
- Deletion freezes and authorization.
- Bounded, resumable batches.
- Retained history and lifecycle metadata.

Existing deletion-job cursors may refer to legacy streams. Finish those jobs or
provide an explicit compatible transition before changing their reader.

Do not remove the deletion-job infrastructure merely because its phase names
mention transactions.

## 10. Completed coexistence migrations

Candidates in `convex/migrations.ts`:

- `m20261006_160000_backfillLivePipeEvents`
- `m20261006_160001_backfillLifecycleEvents`
- `m20261006_160002_backfillTransactionEvents`

Remove their definitions and exclusive helper dependencies only after:

- Completion is verified in every supported deployment.
- No scheduled migration work remains.
- Restarting them is no longer a supported recovery operation.

The migrations component/package is not automatically obsolete. Retain it if
needed for subsequent cleanup migrations.

Keep migrations manual; do not add them to normal deployment automation.

## 11. Things that must remain

Do not delete these as “legacy”:

- Event persistence, operation resolution, retrieval, grouping, and archives.
- `eventFinancialContribution`.
- Accounting and transaction domain calculations.
- Whole-integer-cent money representation.
- Boiler principal, settlement, correction, and conservation policies.
- Frozen monthly report rows.
- `transactionTitleUsage`, `listRecentTitles`, and stale-title cleanup: the
  current amount form still uses recent-title suggestions.
- Current source/tree ranking helpers used by event adapters.
- Authentication, authorization, deletion freezes, and bounded job orchestration.
- Current stacked-row UI and correction-history presentation.

Do not make `events.operationId` required merely because backfills finished:
canonical insertion currently relies on its temporary absence inside an atomic
mutation.

Do not manually edit `convex/_generated/`; regenerate it through supported tooling.

## Removal order

1. Delete unused client readers and list composition.
2. Separate the event cache from transaction snapshots; migrate mutation
   invalidation.
3. Retire old-client public history/report readers.
4. Finish legacy capture/deletion jobs before removing their reader branches.
5. Implement event-native actions and migrate correction identity/edited metadata.
6. Migrate pipe lifecycle writers and deletion traversal.
7. Stop financial/lifecycle dual-writes.
8. Purge legacy data with approved bounded migrations.
9. Remove legacy tables, indexes, completed migration definitions, and orphaned
   code.
10. Update canonical documentation and remove superseded compatibility tests.

These are dependency-ordered steps, not authorization to purge or deploy. Keep
changes reviewable and use failing behavioral tests for production behavior
changes. Retain or port accounting and authorization coverage; do not remove
supported invariants merely because their original tests use legacy fixtures.

## Completion criteria

Retirement is complete only when:

- No current application path requires a transaction ID or legacy lifecycle row.
- No supported API/job reads or writes legacy tables.
- No pending cursor depends on a removed reader.
- Corrections and edit indicators remain available.
- Accounting, deletion, archives, ranking, and reporting retain their contracts.
- Event-cache account isolation and stale-response protection remain intact.
- Legacy persisted data is handled explicitly, not silently abandoned.
- Old-app incompatibility is an intentional, approved release decision.
