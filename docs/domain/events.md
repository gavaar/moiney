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
