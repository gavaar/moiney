# History Cache And Ordering

Canonical snapshot and ranking contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[transactions](transactions.md), [deletion](deletion.md), and [authentication](auth.md)
for dependent contracts.

## D014: Transaction Snapshot Cache

Status: Implemented

Transaction lists use account-scoped persistent snapshots as stale, read-only
display sources. A valid snapshot suppresses live Convex query subscriptions on
app open. One shared entity map is keyed by transaction ID, with separate ordered
ID snapshots for history, recent, and selected-pipe scopes. History seeds 100
rows and loads further pages of 30 only on explicit demand. Recent and
selected-pipe queries return at most 30 rows. Every loaded transaction persists
until the cache reaches 300 unique entities, then least recently refreshed
entries are evicted.

Successful creation and editing return purpose-built rows and update the shared
entity map in place. Creation updates only loaded history, recent, and
selected-pipe snapshots relevant to any `from`, `to`, or `paidFrom` role; it does
not create unseen partial snapshots. Editing updates and reorders every loaded
snapshot containing the ID. See [D017](transactions.md#d017-transaction-structural-editing)
for the in-progress structural-edit invalidation contract.

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
persisted snapshot scopes. Clearing all filters restores unfiltered persisted History.

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
