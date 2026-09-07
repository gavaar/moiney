# Deletion

Canonical deletion contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[accounting](accounting.md), [transaction involvement](transactions.md#d003-transaction-involvement),
and [cache reconciliation](history-cache.md#d014-transaction-snapshot-cache).

## D002: Pipe Deletion And Transaction History

Status: Implemented

Deleting a pipe always deletes it and all descendants. The confirmation checkbox
controls orphaned transaction history:

- Checked: delete only transactions with no surviving involved pipe.
- A feed is orphaned when its `to` does not survive.
- An ordinary expense is orphaned when its `from` does not survive.
- A pay-by-transfer expense is orphaned when neither `from` nor `paidFrom` survives.
- A transfer is orphaned when neither `from` nor `to` survives.
- Unchecked: preserve all transactions and embed deleted-role icons on them.
- Preserved transactions are view-only.

Before deletion, compute the selected subtree's aggregate
`fed + (pendingFedAdjustment ?? 0) - spent`, using the derived subtree totals,
not only the selected pipe's local values. Credit that signed balance exactly
once to the immediate parent, if any. A deleted root has no parent to credit.
This includes [D012 pending accounting](accounting.md#d012-pay-by-transfer-liquidity-and-logical-spending).

An idempotent job freezes the subtree and processes role-indexed transaction
pages and finalization in bounded scheduled batches. Embedded icons require no
additional history reads. The job records completion for safe retries and
credits the planned balance exactly once. Title-usage cleanup remains owned by
the existing stale-usage maintenance job. Finalization follows the
[childless-root default](accounting.md#d020-childless-root-settlement-default).

The freeze blocks writes involving the selected subtree. The following
operations remain allowed in unrelated trees, with the stated scope:

- Presentation-only name, icon, and description updates do not reconcile accounting.
- Feed and ordinary expense creation and value edits reconcile only their one
  affected tree.
- Transfer and pay-by-transfer creation and value edits reconcile only their
  two affected trees.
- Child creation, rule updates, and capacity or priority edits reconcile only
  their one affected tree.

Every member of each affected accounting tree is checked for a freeze before
reconciliation. Value edits retain current-period accounting, transfer topology,
and pay-by-transfer logical spending, pending adjustment, and payer-liquidity
policies from [transactions](transactions.md) and [accounting](accounting.md).
This list does not assert unrelated-tree support for every operation; in
particular, [structural editing](transactions.md#d017-transaction-structural-editing)
remains an in-progress contract with its own affected-root union.
