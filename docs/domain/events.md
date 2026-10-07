# Operation-Centered History Events

Status: In progress

This is the domain contract for unified event history. The existing persisted
[transaction contracts](transactions.md) remain authoritative for legacy readers
and writers until cutover. Event entries are current history snapshots, not an
event-sourcing log from which balances can be reconstructed.

## Identity And Ownership

An **operation** is one financial or pipe lifecycle action. An **event entry**
records that action from one pipe's perspective. Each entry has its own ID,
account owner, `pipeId`, and occurrence date. All entries in an operation share
the canonical entry's ID as `operationId`. Convex assigns the canonical ID on
insert, so the schema permits an absent `operationId` only for the initial
insert within a mutation. Persistence fills it before committing; readers reject
an entry missing it rather than treating incomplete identity as legacy data.

While legacy transactions and events coexist, a legacy transaction's optional
`operationId` links it to the canonical event. This link, not mutable titles,
dates, or amounts, identifies the same action across both representations.
Legacy public APIs retain transaction IDs until client cutover; the link is not
part of their response contract.

An edit keeps the canonical entry's ID and replaces the complete operation
snapshot atomically. A retained counterpart keeps its ID; changing between
single-entry and paired structures adds or removes the counterpart. During
coexistence, a meaningful edit to an unlinked legacy transaction materializes
its current event snapshot without replaying historical accounting. A broken
existing link is rejected rather than silently creating a replacement operation.
Direct transaction deletion removes the complete linked operation in the same
mutation as the legacy transaction. The inverse financial effect is applied
once under the [transaction deletion contract](transactions.md#d023-transaction-deletion),
not independently for each event entry.

Feeds, ordinary expenses/refunds, creations, and deletions have one entry.
Transfers and externally paid expenses/refunds have two. Creation and deletion
are separate operations; archived history relates them through pipe identity,
not a shared operation ID.

The transfer's canonical entry belongs to its original structural source,
regardless of monetary polarity. Its target remains the structural destination.
This preserves the [boiler contribution contract](accounting.md#d015-boiler-feed-pipes)
when a transfer reverses direction. For external expenses/refunds, the canonical
entry belongs to the logical spender, not the payer/receiver.

Full operation resolution requires the canonical entry and every counterpart.
Partial history pages may contain only one entry and must remain independently
readable; they are not complete operations suitable for accounting writes.

## Entry Types And Financial Meaning

| Type | Meaning | `targetPipeId` | Income/spending contribution |
| --- | --- | --- | --- |
| `feed` | External contribution to a root | Forbidden | Income |
| `transaction` without target | Ordinary expense or refund | Absent | Logical spending/refund |
| `transaction` with target | External payer/receiver's counterpart | Required | Neither |
| `third_party_transaction` | Externally paid logical expense/refund | Required | Logical spending/refund |
| `transfer` | One side of an internal transfer | Required | Neither |
| `pipe_creation` | Non-accounting pipe creation | Forbidden | Neither |
| `pipe_deletion` | Non-accounting pipe deletion | Forbidden | Neither |

Financial values use the existing [integer-cent bounds](accounting.md#d001-monetary-representation).
Feeds are positive. Logical expenses are negative and refunds positive; other
financial entries are nonzero. Root refunds remain transactions, not feeds:
financial meaning cannot depend on looking up a live pipe.

Paired entries have distinct IDs, the same account, operation ID, occurrence
date and title, reversed pipe/target identities, and opposite values. Their
values are signed history values, **not** independent accounting deltas. The
existing [external settlement contract](accounting.md#d012-pay-by-transfer-liquidity-and-logical-spending)
still governs financial effects. Income/spending classification uses each
entry's own facts and never requires a mirror lookup.

## Reporting And Usage Ranking

Account-wide monthly reports aggregate stored entries in bounded pages over an
inclusive-start, exclusive-end UTC month. Each entry contributes under the table
above: only logical spending entries count as expenses/refunds, even if their
payer counterpart is on a different page. Reporting never projects a mirror-only
page into another financial contribution, and retained entries do not require a
live pipe to contribute. Unlike loaded-window archive summaries, reports exhaust
the account/month stream before presenting complete totals.

The [monthly report metrics and capture policy](reporting.md#d016-monthly-spending-statistics)
remain unchanged. Event backfills and reader cutover do not restate frozen reports
or fill unavailable historical metrics. Legacy capture remains authoritative until
backend cutover; event-backed reads require completed event backfills.

Usage ranking collapses loaded entries by operation before applying the existing
[source and tree usage rules](history-cache.md#d019-feed-list-ordering): a source is
the original structural transfer source or logical spender, not a loaded payer
counterpart. Feeds have no source usage; lifecycle entries have no usage. Each
financial operation counts once per involved live root, including feeds and
externally paid operations. Ties use recent operation order; unused roots retain
their catalog order. No missing operation members are fetched for ranking.

## Responsibilities

The backend owns authorization, eligibility, accounting, and atomic operation
integrity. The client owns labels, operation grouping, and monthly archive
presentation. These responsibilities do not change the existing boiler,
settlement, correction, or captured-report accounting policies.

Lifecycle entries retain pipe presentation and ancestry under the
[archive contract](history-cache.md#d021-pipe-creation-and-archived-history).
Each pipe has at most one creation and one deletion operation. Both retained
snapshots carry the final pipe and parent presentation after deletion; creation
keeps the original occurrence date, while deletion uses the removal date.
Lifecycle entries do not carry monetary values or transaction titles.

## Client Grouping

The client collapses loaded entries by exact `operationId` before applying the
[same-title/UTC-month grouping rules](transactions.md#d009-transaction-identity-and-grouping).
Counts represent loaded operations, not mirror entries; lifecycle operations
remain separate from financial title groups. Grouped amounts follow that scoped
presentation contract, not global reporting contributions.

A mirror-only page can project the original structural source, target, and value
for display. A payment counterpart projects its logical expense/refund, keeping
that sign even in a payer-only scope. This is a presentation model, not an invented
persisted canonical event or a complete operation suitable for accounting writes.
The operation row key is its `operationId`, whether its canonical entry is loaded
or not. Loaded canonical snapshots take precedence when both perspectives exist;
repeated entry IDs retain the last supplied snapshot rather than adding counts.

## Retrieval

`events:latest` returns at most 30 stored entries for the account or one exact
`pipeId`, ordered by occurrence date descending and then storage creation order.
It does not expand operations, collapse mirrors, group titles, or build archives;
the client may display fewer rows after grouping. A cutoff can split an operation.

`events:list` pages the same global or single-pipe indexed stream, with inclusive
date bounds and a page size of 1–100 (default 30). Text matching is case-insensitive
against financial titles or retained lifecycle names and occurs within the stored
page, not by scanning until it fills. Empty matching pages can have a continuation
cursor; clients must use `isDone`, not the number of returned entries, to stop.

Both queries return required event/operation IDs and `createdAt` for stable
client ordering at tied occurrence dates, but omit database metadata and account
ownership fields. Entries are independent read snapshots: a page does not resolve
mirrors or require live pipes. Lifecycle presentation is the retained snapshot;
the client uses its live pipe catalog for current presentation. A single-pipe
query selects that pipe's own perspectives, not its target roles or descendants.
Client scope expansion and preserved lifecycle ancestry own descendant/archive
matching; callers can page separate pipe streams without an unbounded backend
fan-out. Legacy history APIs remain unchanged until client cutover.

## Monthly Event Archives

Deleted-pipe entries form client archives keyed by pipe identity and UTC month,
not one lifetime archive positioned in its newest transaction month. Each loaded
entry belongs to its own occurrence month, including creation and deletion;
lifecycle entries remain non-accounting rows inside their archive. Retained
deletion snapshots supply final presentation and root-to-parent ancestry even
when the financial date window excludes the deletion itself.

`events:deletedPipes` pages that account's retained deletion catalog independently
of financial filters, using a type index and the same 1–100 page bounds. Catalog
records supply metadata, not extra visible rows. An archive matches its own pipe
or any preserved ancestor; ancestry does not become a monetary role. Shared
operations can appear in multiple deleted-pipe archives and in ordinary history
for surviving own-pipe perspectives. Those overlapping archive totals are not
global totals.

Archive counts include financial operations once per pipe, including feeds and
transfers. Spent is net logical expense spending, including payer-visible
expenses/refunds with their logical sign; feeds, transfers, and lifecycle entries
contribute zero. Summary date bounds describe matching financial operations.
Title grouping remains inside each archive under the client grouping contract.

Archives use only the entries already returned by the main history loader.
Latest groups only its 30 stored entries; missing operation or archive members
outside that window are not fetched. History groups all currently loaded entries,
and its normal load-more operation grows those groups. Expanding a group or
archive reveals loaded members without another financial query.

Counts, Spent, and date bounds describe loaded matching members, not the complete
pipe/month history. No separate archive reader, pagination, or full-summary scan
is needed. Deletion-catalog reads supply identity and ancestry metadata only.
The existing screens retain legacy archive behavior until client cutover.

## Backfill During Coexistence

The migrations component owns pagination, resumability, and status. Run these
internal migrations in order after deploying the dual-writers:

1. `migrations:m20261006_160000_backfillLivePipeEvents` captures live creation snapshots.
2. `migrations:m20261006_160001_backfillLifecycleEvents` copies retained lifecycle history.
3. `migrations:m20261006_160002_backfillTransactionEvents` materializes and links legacy financial
   operations, including ones involving deleted pipes.

Use `bunx convex run <name> '{"dryRun":true}'` to check a batch before running
`bunx convex run <name>`. A dry run rolls back all writes, including event
insertions. It checks only one batch, not the complete dataset. Component status
is available through `bunx convex run --component migrations lib:getStatus`.
Use the CLI's `--prod` flag only when intentionally targeting production.
Do not switch readers until all three migrations report completion.

The passes are safe to resume or restart: lifecycle identity is per pipe/type,
and existing transaction links are validated and retained. Invalid financial
rows or broken links fail the batch atomically rather than being skipped or
silently replaced. Backfill never replays accounting, resets balances or boiler
principal, or alters correction records.

For a retained snapshot whose pipe no longer exists and whose deletion date is
missing, use the newest retained transaction date across `from`, `to`, and
`paidFrom`, no earlier than creation; without retained transactions, use creation.
Persist that inferred date so retries and later history edits do not move it.
Retain known dates, final presentation, and deleted-descendant ancestry.

Production backfills follow the
[manual migration workflow](../backend.md#deployment-and-manual-migrations).
