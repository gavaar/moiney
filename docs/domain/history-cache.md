# History Cache And Ordering

Canonical snapshot and ranking contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[transactions](transactions.md), [deletion](deletion.md), and [authentication](auth.md)
for dependent contracts.

## D014: Transaction Snapshot Cache

Status: Implemented

Transaction-only loaders and usage ranking use account-scoped persistent
snapshots as stale, read-only sources. A valid snapshot suppresses live Convex
query subscriptions on app open. One shared entity map is keyed by transaction
ID, with separate ordered ID snapshots for history, recent, and selected-pipe
scopes. Transaction-only History seeds 100 rows and loads further pages of 30
on demand. Recent and selected-pipe transaction queries return at most 30 rows.
Snapshot transactions persist until the cache reaches 300 unique entities, then
least recently refreshed entries are evicted. Mixed History has the separate
loading contract in [D021](#d021-pipe-creation-and-archived-history).

Successful creation and editing return purpose-built rows and update the shared
entity map in place. Creation updates only loaded history, recent, and
selected-pipe snapshots relevant to any `from`, `to`, or `paidFrom` role; it does
not create unseen partial snapshots. Editing updates and reorders every loaded
snapshot containing the ID. See [D017](transactions.md#d017-transaction-structural-editing)
for the in-progress structural-edit invalidation contract. Successful direct
transaction deletion removes its ID from the entity map and every loaded
snapshot and refreshes mounted mixed-history views.

After asynchronous pipe deletion completes, one bounded request reconciles
currently cached IDs, updates surviving rows, and removes absent IDs from the
entity map and all snapshots.

The server remains authoritative. Explicit refresh, cache misses, and load-more
use one-shot reads and replace or reconcile cached rows with server results.
Cache data never authorizes or decides mutations. Explicit logout clears the
active account's cache. Entries are isolated by deployment and account identity.

History filters apply to complete server history, not just the snapshot. They
may combine an inclusive date range, case-insensitive title substring, and exact
pipe involvement across all [D003 roles](transactions.md#d003-transaction-involvement).
Filtered pages use bounded server reads and Convex query caching but are not
persisted snapshot scopes. History initially applies a From date of the first day
of the current UTC month. An untouched default advances at UTC month rollover;
explicitly applied or cleared filters remain unchanged. Clearing all filters
removes that default and restores unfiltered History.
[D021](#d021-pipe-creation-and-archived-history) extends pipe
matching to archived ancestry and creation-event names.

Pagination completes without an error when the server reports completion, an
unfiltered page is empty, or the continuation cursor stops advancing. Empty
filtered pages are scanned while their cursors advance so later matches remain
visible. Unfiltered exhaustion is persisted in the snapshot. Failed load-more
requests do not retry automatically on scroll; explicit refresh allows recovery.

## D018: Quick Creation Ranking

Status: Implemented

[Quick creation](transactions.md#d018-quick-transaction-creation) orders eligible
pipes by source frequency across the first 100 unfiltered History rows. A valid
cached History scope supplies them without a request; otherwise the normal
History loader seeds it. Only logical `from` contributes, not feed destinations,
transfer destinations, or pay-by-transfer payers. Ties retain most-recent source
order, followed by unused pipes in catalog order.

## D019: Feed List Tree-Usage Ordering

Status: Implemented

The feed bar list orders roots by activity across every row currently available
in the unfiltered History snapshot. A transaction involves a tree when any
`from`, `to`, or `paidFrom` resolves to that root. Each transaction counts once
per involved tree; cross-tree transfers and pay-by-transfer expenses count once
for each involved root.

Descending transaction count determines order. Ties retain most-recent tree
involvement order; unused feeds retain catalog current-liquidity order. This
does not change root order in the pipe tree view.

A missing History snapshot causes no request and leaves feed order unchanged.
An existing incomplete snapshot, or one with fewer than 100 rows while more
history is available, makes the normal loader refresh its 100-row head. Ranking
then uses all History rows available in the shared cache.

## D021: Pipe Creation And Archived History

Status: In progress

The [unified event contract](events.md#monthly-event-archives) owns the target
monthly grouping and loaded-entry-only archive behavior. Existing transaction-backed
screens still use legacy lifetime archives until client cutover; their separate
archive reads are not part of the event-based contract.

Creation is a non-accounting event stored separately from transactions. The event
is written atomically with a new pipe and uses its original creation timestamp.
It stores ancestor IDs in root-to-immediate-parent order, excluding the pipe
itself; roots have an empty array. The immediate parent is derived from the last
ancestor, without a redundant parent ID. Ancestry survives deletion of any
ancestor. Reparenting is not supported.

Live creation rows show the current parent, current pipe icon and name, and
creation date. They navigate to the pipe. Surface backgrounds and type-colored
borders distinguish them: blue boiler, green feed, white child. Opening balances
and capacities are not event fields and are not reconstructed from transactions.

Deletion preserves the last pipe and parent presentation and marks retained
events deleted. A deleted event expands into its retained transactions instead
of navigating. When an archive has no matching transactions, it remains a
non-expandable muted deletion record showing the deletion date. Every `from`,
`to`, and `paidFrom` involvement belongs to that
pipe's archive; a transaction appears once within an archive and may appear in
multiple archives. Shared transactions with surviving involved pipes also remain
in ordinary history. Orphaned legacy transactions without recoverable creation
events remain readable without inventing creation dates or ancestry.

Archive counts, Spent, and date bounds describe loaded matching members under the
[event archive contract](events.md#monthly-event-archives), not complete lifetime
totals. Title grouping remains available within each expanded archive and follows
the [same-month grouping rule](transactions.md#d009-transaction-identity-and-grouping).

Archive scope matching and month membership follow the event archive contract.
Title and date filters select main-loader entries before grouping; loaded lifecycle
entries participate in archive ordering as well as financial entries. History's
pipe picker includes live parents as well as leaves.

Mixed History and Latest show UTC month headings; event archives are keyed by
deleted pipe and UTC month under the event archive contract. Expanded rows are
indented by nesting depth.

The main history loader owns pagination without discarding unconsumed rows.
Latest groups only its 30 stored entries, and History groups currently loaded
entries. Expansion performs no additional financial reads; only loading more
main History entries grows archive membership. Growing lists remain virtualized.

Mixed lists use focus-scoped one-shot reads and refresh on local transaction
writes, pipe lifecycle/presentation changes, and explicit refresh. Loaded rows
remain visible during a same-scope refresh. Mixed rows and archive summaries are
mounted-view state, not persisted transaction entities. Unfiltered transaction
source pages still populate the shared financial snapshot, preserving transaction
ranking independently of creation events and duplicate archive appearances.
Account/filter changes and unmounting invalidate in-flight reads.

During backfill, existing live pipes may lack creation events; their financial
history remains available. Backfill is idempotent, uses original creation times,
and captures the surviving ancestry. Frozen pipes are captured by deletion before
removal. Pipes deleted before event support cannot generally be reconstructed.
