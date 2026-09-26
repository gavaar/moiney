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
expenses group together within the same UTC calendar month. Expenses and
transfers share a title-based group within that month; feeds retain their
structural feed identity and likewise group only within a month. In the currently visible
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

History also contains non-accounting pipe creation events and deleted-pipe
archives. Their membership, overlapping counts, Spent totals, and ancestry
filtering are defined in [D021](history-cache.md#d021-pipe-creation-and-archived-history).

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
Create and repeat use a pipe-selection step followed by transaction details.
Repeat starts on details with the original pipe preselected; selecting another
pipe preserves title, amount, and date while clearing ineligible payer or
destination choices. Feed repeats retain feed semantics and select root
destinations. Edit uses the same two-step picker, starting on details when the
original primary pipe is eligible and on selection otherwise. Returning to the
picker preserves the entered details; edit may select a pipe in another tree.
Transaction selectors with descendant candidates group eligible leaves under
their root, showing root icon, name, and candidate count. A root header expands
independently without selecting a pipe. Candidate ranking is preserved within
roots; roots are ordered by their highest-ranked candidate, except repeat and
edit place the original root first. Create opens its first root; repeat/edit
open the original root when resolvable and otherwise start collapsed. Negative
pay-by-transfer payer choices use the same grouping, opening the current payer's
root or the first eligible root. Root-only feed, transfer destination, and
refund choices remain flat.

Tapping an individual transaction opens repeat. Swiping left reveals a blue
pencil and opens edit after the swipe threshold; the action is also an
accessible button. Repeat identifies the pipe by icon and name. Edit uses a
centered `Edit:` title with pipe icon, pipe name, and transaction title. See
[D018](#d018-quick-transaction-creation) for create/repeat heading values.

Feeds remain structurally fixed but may change their root destination. A
pay-by-transfer expense may change its logical source and payer, but does not
silently become an ordinary expense when a payer becomes ineligible. A
transaction edit must replace any missing, deleted, or no-longer-eligible role;
in particular an expense or transfer source that acquired children cannot be
selected again. An active deletion freeze blocks editing until it completes.

Ordinary expenses and transfers may convert among ordinary expense, transfer,
and pay-by-transfer structures. Structural edits apply the complete old-to-new
accounting transition to the current period, without restating historical
periods or [captured monthly summaries](reporting.md#d016-monthly-spending-statistics).
One net plan applies at most one accounting patch per pipe, triggers rules once
from net logical spending, and reconciles affected roots once. When all old
roles remain eligible, old effects are reversed and new effects applied. When
one or more old roles became invalid, those roles are not reversed and a single
off-by-default choice determines whether the submitted transaction's effects
are applied to their replacements. Surviving roles still receive their normal
old-to-new deltas, including amount differences, regardless of that choice.
The edit warning presents the direct signed changes to `fed`, `spent`,
`pendingFedAdjustment`, and boiler principal as applicable. It does not predict
balances after rules and reconciliation. Historical settlement is not replayed;
the user directs the correction against current balances. Once reassigned, the
transaction's new roles are treated as ordinary roles by subsequent edits and
deletion, regardless of the earlier choice to apply replacement effects.

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
Transaction pipe options use red icons and borders when `spent >= fed` and white
otherwise, including equality as overflow. This is a presentation rule, not an
eligibility filter. Selected rows retain the shared Select's neutral background;
the `None` option is neutral. Owner selection in Add Pipe is independent of this
transaction-specific styling.

## D023: Transaction Deletion

Status: Implemented

Swiping an individual transaction right reveals a red trash action; the action
is also an accessible button. Deletion always requires confirmation. The
confirmation describes every affected pipe when a transfer or pay-by-transfer
transaction can be rolled back, not only the logical source.

When every involved pipe still exists and belongs to the account, deletion
applies the complete inverse transaction effect to the current accounting
period, triggers rules from the inverse logical spending delta, reconciles every
affected tree, and removes the transaction atomically. Current creation
topology is not revalidated: topology may legitimately have changed since the
transaction was recorded. An active deletion freeze in any affected tree blocks
the rollback.

If any `from`, `to`, or `paidFrom` pipe no longer exists, deletion removes
history only. It does not partially roll back surviving roles, because doing so
could create or destroy money. Active
deletion freezes still block history-only removal when a surviving involved
tree is frozen. The confirmation explicitly warns that the transaction's
expenditure, refund, feed, or transfer will not be rolled back. Linked edit
corrections are removed afterward in bounded scheduled batches. Captured monthly
summaries remain immutable under the reporting contract.
