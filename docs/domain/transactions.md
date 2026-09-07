# Transactions

Canonical transaction contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[accounting](accounting.md), [deletion](deletion.md), [history cache](history-cache.md),
and [reporting](reporting.md) for dependent contracts.

## D003: Transaction Involvement

Status: Implemented

A transaction involves a pipe when it appears as `from`, `to`, or `paidFrom`.
Filtering, grouping, deletion, and snapshots account for all applicable roles.

## D009: Transaction Identity And Grouping

Status: Implemented

Transactions have three structural kinds: `feed`, `expense`, and `transfer`.
Pay-by-transfer is an expense with optional `paidFrom` provenance, not a separate
kind. Refunds retain their kind and reverse monetary polarity. Persisted `kind`
is required; there is no deprecated `type` field or legacy fallback.

Expense grouping ignores `paidFrom`; matching ordinary and pay-by-transfer
expenses group together across dates. Expenses and transfers share a title-based
group; feeds retain their structural feed identity. In the currently visible
pipe scope, an expense contributes its value when its logical `from` or
`paidFrom` is visible. A transfer contributes zero because its value duplicates
corresponding expense activity. Transactions with no visible logical pipe are
excluded from the scoped group.

Collapsed groups expose scope-visible participating pipes: one uses its icon,
multiple use `card-multiple`. Neither value nor `paidFrom` is an identity field,
but `paidFrom` counts for scoped visibility and icon selection. Expansion shows
individual transactions with their payer and values preserved.

Titles are canonicalized with `trim().toLowerCase()` before persistence and
title-usage indexing. Whitespace-only titles are rejected.

A dedicated accessible count-and-chevron control and the main group row both
toggle expansion; neither opens a repeat form. Deleted-role snapshots remain
available for group icons, including `paidFrom` and snapshots on older members.
Groups containing preserved history can expand; repeat eligibility and
[view-only restrictions](deletion.md#d002-pipe-deletion-and-transaction-history)
apply to individual rows.

## D010: Pay-by-transfer Presentation Eligibility

Status: Implemented

The shared-core architecture is owned by
[Shared Domain Core](../engineering-principles.md#shared-domain-core).

Presentation eligibility accounts for child membership, root resolution,
missing ancestry, cycles, and deletion-blocked payers. Negative expenses require
an external leaf payer, positive refunds require an external root, and zero
values are ineligible. Eligibility follows the current pipe catalog across rows
and amount-form candidates. Backend authorization and
[accounting](accounting.md#d012-pay-by-transfer-liquidity-and-logical-spending)
remain authoritative.

## D011: Transaction Edit History

Status: Implemented

An edit updates the current snapshot and records one linked correction document
with previous and current title, value, and date. Normal lists show only the
current snapshot and expose an `Edited` history control. Correction history is
paginated, authorized through the owning transaction, and displayed in a
read-only modal. Corrections are not ordinary transaction rows and do not affect
grouping.

Across rule-execution boundaries, edits apply their value delta to the current
accounting period without restating historical periods. A delta changing logical
`spent` uses the same [automatic rule policy](accounting.md#d008-rule-execution-and-cap-update)
as creation. Structural correction contracts are in [D017](#d017-transaction-structural-editing).

## D013: Transfer Pipe Eligibility

Status: Implemented

A transfer starts at an owned leaf and ends at an owned root in another tree.
The backend validates both owners, source leaf status, destination root status,
and tree separation before accounting effects.

Missing and foreign pipes use the same non-disclosing expected error. Invalid
topology uses stable error codes for a non-root destination, a source with
children, and a destination in the source tree. Valid transfers conserve integer
cents and create one transaction and one title-usage update.

## D017: Transaction Structural Editing

Status: In progress

This decision describes the agreed contract under implementation, not a claim
that every part is implemented.

Repeat forms use the same role controls as new transactions. A repeat may
choose ordinary expense, transfer, or pay-by-transfer structure and must show
every selected destination or payer before submission. Group interaction follows
[D009](#d009-transaction-identity-and-grouping), not a group repeat form.

Tapping an individual transaction opens repeat. Swiping left reveals a blue
pencil and opens edit after the swipe threshold; the action is also an
accessible button. Repeat identifies the pipe by icon and name. Edit uses a
centered `Edit:` title with pipe icon, pipe name, and transaction title. See
[D018](#d018-quick-transaction-creation) for create/repeat heading values.

Structural editing fixes the original logical source. Feeds remain structurally
fixed. Existing pay-by-transfer transactions may edit title, value, and date,
but not logical source or payer: legacy accounting cannot reliably be reversed
across the [D012 compatibility boundary](accounting.md#d012-pay-by-transfer-liquidity-and-logical-spending)
and rule-execution boundaries.

Ordinary expenses and transfers may convert among ordinary expense, transfer,
and pay-by-transfer structures. Structural edits apply the complete old-to-new
accounting transition to the current period, without restating historical
periods or [captured monthly summaries](reporting.md#d016-monthly-spending-statistics).
One net plan applies at most one accounting patch per pipe, triggers rules once
from net logical spending, and reconciles the union of old and new affected
roots once.

Correction history records previous and current structure. Loaded
[transaction caches](history-cache.md#d014-transaction-snapshot-cache) update
history and recent entities immediately and invalidate selected-pipe snapshots
affected by either old or new roles.

## D018: Quick Transaction Creation

Status: Implemented

The middle tab-bar action opens creation without leaving the active tab. It
offers only owned, non-deleting leaf pipes, including childless roots. Feeds are
not created here; the backend rejects ordinary expense creation from a source
with children. [D018 ranking](history-cache.md#d018-quick-creation-ranking)
owns ordering and its History-loading policy.

After selection, the normal expense, transfer, and pay-by-transfer form has
empty transaction values. Create and repeat headings display the current primary
pipe as `name (spent / capacity)` with integer-cent presentation formatting.
Create uses a plus marker; repeat retains its repeat marker.
