# Accounting

Canonical accounting contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[transaction eligibility and editing](transactions.md), [deletion](deletion.md),
and [reporting](reporting.md) for dependent contracts.

## D001: Monetary Representation

Status: Implemented

All persisted monetary values, including deletion-job accounting, are whole
integer cents in a single currency. For example, `12.34` is stored as `1234`
cents and `-15.99` as `-1599` cents. Calculations preserve this representation.

The implementation must define and test exact parsing from decimal text,
rejection of unsupported fractional precision, deterministic remainder
allocation, negative amounts and zero policy, and conservation across feeds,
spending, transfers, refunds, and allocation.

## D008: Rule Execution And Cap Update

Status: Implemented

This section owns execution; [D008 presentation statistics](reporting.md#d008-presentation-statistics)
owns the derived pipe-detail display.

`instant_settlement` and `spend_overflow` accept the same optional
`capUpdateValue` as cron rules. Without it, execution consolidates
`fed = fed + (pendingFedAdjustment ?? 0) - spent`, clears `spent` and any pending
adjustment, and leaves `capacity` unchanged.

With `capUpdateValue`, every rule kind, including cron, applies:

- `leftoverFed = fed + (pendingFedAdjustment ?? 0) - spent`
- `capacity = capacity - spent + capUpdateValue`
- `fed = leftoverFed`
- `spent = 0`
- `pendingFedAdjustment = 0` when the field exists

Stored `spent` accumulates positively for spending; the formula uses that sign.
`instant_settlement` triggers whenever transaction creation or a value edit
changes logical `spent`, in either direction. `spend_overflow` triggers when
positive spending leaves `spent >= capacity`; refunds do not trigger it. Feeds
and transfers have zero logical spending effects and do not trigger these rules.

An overdue cron execution settles once, applies `capUpdateValue` multiplied by
the number of due occurrences, and advances `cronNextDate` once beyond the
explicit execution clock.

## D012: Pay-by-transfer Liquidity And Logical Spending

Status: Implemented

Pay-by-transfer separates logical spending from real liquidity movement. The
logical pipe's `fed` does not change immediately. Its `spent` and
`pendingFedAdjustment` each change by `-value`; the `paidFrom` pipe's `fed`
changes by `value`.

- A negative expense increases logical `spent` and positive pending adjustment,
  while reducing payer liquidity.
- A positive refund decreases logical `spent` and makes the pending adjustment
  negative, while increasing receiving-pipe liquidity.
- Settlement and capacity updates follow [D008](#d008-rule-execution-and-cap-update),
  using logical spending rather than the pending adjustment for capacity.
- Current-cycle L2S is `fed - spent`, intentionally excluding the pending
  adjustment. Nonzero pending adjustment appears separately in detail statistics
  as an external settlement indicator, not extra current-cycle spending capacity.
- Pipe-tree projections aggregate pending adjustments;
  [deletion balances](deletion.md#d002-pipe-deletion-and-transaction-history) use them.

`pendingFedAdjustment` remains optional for existing documents. Missing means
zero post-cutover pending adjustment; stored `fed` and `spent` remain the
authoritative legacy baseline. Historical transactions are not replayed and
pending values are not reconstructed, because history does not record whether
an effect crossed a rule boundary. New pipes write explicit zero; legacy pipes
read as zero without a data reset or monetary backfill.

When a leaf becomes a parent, settle its balance as
`fed + (pendingFedAdjustment ?? 0) - spent`, then clear `spent` and
`pendingFedAdjustment` before child allocation. Editing a legacy pay-by-transfer
transaction applies only its value difference under this model, preserving its
pre-edit logical balance while making the new adjustment explicit. See
[D017](transactions.md#d017-transaction-structural-editing) for structural-edit restrictions.

Convex client mutation retries and atomic cron schedule advancement provide
transport-level idempotency. No operation identifiers are persisted for separate
user submissions; manual rule execution remains intentionally repeatable.

## D015: Boiler Feed Pipes

Status: Implemented

A boiler is a root feed whose current liquidity may grow or shrink relative to
cumulative contributions. It otherwise follows ordinary root-feed topology,
transaction eligibility, rules, reconciliation, deletion, and authorization.

`fed` is mutable current liquidity. `contributedFed` is cumulative externally
contributed principal in integer cents, separate from operational `capacity`.
Capacity must not be used as boiler principal.

A positive feed transaction increases both `fed` and `contributedFed`; editing
it applies its value delta to both. A transfer to a boiler applies the same
signed destination delta to both; editing it applies only its signed value
difference, including reversals. Refunds, expenses, rules, reconciliation,
explicit current corrections, and transfers where the boiler is not the
destination affect `fed` under their existing policies without changing principal.

The contribution boundary accepts an optional exact current balance. Omitted,
a positive contribution is added to the latest current balance. Supplied, it
sets the aggregate tree balance to that value while the positive contribution
still increases principal. Zero contribution is valid only with a changed exact
current balance and creates no transaction history. Current corrections are not
recorded separately. Aggregate corrections account for descendant liquidity
before reconciliation so they do not create money.

Growth is `(fed - contributedFed) / contributedFed * 100`: zero and positive
growth are blue, negative growth is red, and growth is unavailable when
principal is zero. Liquidity bars use principal as their baseline without
modifying capacity; detail bars label it `contributed`. Boiler detail statistics
omit left to spend, an exception to [D008 presentation](reporting.md#d008-presentation-statistics).
Spent-bar visibility follows the rule, not source type; childless boilers omit
it through their automatic `instant_settlement` rule.

`sourceType` and `contributedFed` remain optional persisted fields for existing
data. Roots without `sourceType` are ordinary feeds. New roots write explicit
`feed` or `boiler`, and new boilers write `contributedFed`. Root creation accepts
a nonnegative opening current balance without transaction history. Boiler
creation also accepts independent nonnegative opening principal. Each omitted
opening value defaults to zero; explicit values need not be zero or equal.
Current balances cannot safely reconstruct historical contributions, and no
principal backfill is required for pre-boiler data.

## D020: Childless Root Settlement Default

Status: Implemented

A childless root acts as both feed and drain. New ordinary feeds and boilers
default to `instant_settlement` so spending consolidates immediately. Adding the
first child settles the former leaf under [D012](#d012-pay-by-transfer-liquidity-and-logical-spending)
and clears its rule and rule options. Deletion finalization restores
`instant_settlement` when deleting the final child makes a root childless.
Nested pipes do not receive this topology-driven default.
