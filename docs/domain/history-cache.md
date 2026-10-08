# History Cache And Ordering

Canonical snapshot and ranking contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[transactions](transactions.md), [deletion](deletion.md), and [authentication](auth.md)
for dependent contracts.

## D014: Event History Snapshot Cache

Status: Implemented

The client persists one account-scoped, read-only raw-event History snapshot.
History and usage ranking share it; filtered History and Latest do not create
separate persistent scopes. The visible History loading contract is in
[D021](#d021-pipe-creation-and-archived-history).

The server remains authoritative. Explicit refresh, cache misses, and load-more
use one-shot event reads. Cache data never authorizes or decides mutations.
Entries are isolated by deployment and account identity. Account changes expose
only the new account's snapshot and clear the retired account's stored entries.
Logout clears the active snapshot after any queued writes finish. Previously
shipped transaction-only keys are removed per account during hydration; existing
event snapshots keep their storage location.

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

The snapshot retains distinct entry IDs even
when entries share an operation ID; consumers collapse operations, not the cache.
It seeds 100 stored entries and pages 30 at a time, retaining at most 300 entries
by last refresh. Eviction invalidates membership so a missing recent head cannot
silently become an older ranking window. Cursors are not persisted: load-more
after hydration reseeds the head and deduplicates overlapping entry IDs. A head
refresh preserves a valid loaded tail; an invalidated snapshot or an exhausted
server head replaces membership instead.

Financial creation, editing, direct deletion, and completed pipe deletion
invalidate event snapshot membership through an explicit history-invalidation
boundary, without reconciling transaction entities. Generation invalidation and
mutation notifications are synchronous, before device persistence completes.
Mounted enabled consumers then reload authoritative entries. Older generations,
including delayed hydration, cannot restore invalidated membership; retired-account
callbacks cannot publish or persist new entries. Device-cache failures do not
prevent event data from loading or turn a successful mutation into a failure.

## D018: Quick Creation Ranking

Status: Implemented

[Quick creation](transactions.md#d018-quick-transaction-creation) orders eligible
pipes by source frequency across the first 100 unfiltered stored event entries.
A valid cached event History snapshot supplies them without a request; otherwise
the event loader seeds it. [Operation collapse](events.md#reporting-and-usage-ranking)
counts logical sources once, not feed destinations, transfer destinations, or
pay-by-transfer payers. Ties retain most-recent source order, followed by unused
pipes in catalog order.

## D019: Feed List Tree-Usage Ordering

Status: Implemented

The feed bar list orders roots by financial activity across every event entry
currently available in the unfiltered event History snapshot. It collapses loaded
entries to operations before counting tree involvement under the
[event usage contract](events.md#reporting-and-usage-ranking). Cross-tree transfers
and externally paid expenses count once for each involved live root.

Descending operation count determines order. Ties retain most-recent tree
involvement order; unused feeds retain catalog current-liquidity order. This
does not change root order in the pipe tree view.

A missing event History snapshot causes no request and leaves feed order unchanged.
An existing invalidated snapshot, or one with fewer than 100 stored entries while
more history is available, makes the event loader refresh its 100-entry head.
Ranking then uses all entries available in the snapshot.

## D021: Pipe Creation And Archived History

Status: In progress

The [unified event contract](events.md#monthly-event-archives) owns monthly
grouping and loaded-entry-only archive behavior.

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

Deletion preserves the last pipe and parent presentation. An archive expands
into its loaded members instead of navigating. When its month contains no loaded
financial operations, it remains a non-expandable muted record dated by its
loaded lifecycle entry. Each operation appears once per involved pipe's archive
and may appear in multiple archives; shared operations with surviving own-pipe
perspectives also remain in ordinary history. Missing legacy lifecycle history
does not justify inventing creation dates or ancestry.

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

Mixed lists use focus-scoped one-shot event reads and refresh on local financial
writes, pipe lifecycle/presentation changes, and explicit refresh. Loaded rows
remain visible during a same-scope refresh. Group rows and archive summaries are
mounted-view state, not persisted entities. Unfiltered main History pages populate
the raw-entry snapshot used by ranking; filtered and Latest windows do not overwrite
it. A hydrated snapshot avoids a financial head read; deletion metadata is still
read independently. Main History retains all loaded entries even beyond the
persistent cache's 300-entry limit. Account/filter changes and unmounting invalidate
in-flight reads.

During backfill, existing live pipes may lack creation events; their financial
history remains available. Backfill is idempotent, uses original creation times,
and captures the surviving ancestry. Frozen pipes are captured by deletion before
removal. Pipes deleted before event support cannot generally be reconstructed.
