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

Pipe creation explicitly selects a root source type or an inner pipe's settlement
behavior. Manual inner pipes persist no automatic rule. Creation atomically persists
the pipe, selected rule, eligible contingency, and creation event. Inner-pipe editing
can change behavior but not ownership or root/source type; details, capacity, rule,
and contingency changes are saved atomically. Unchanged fields and rules are omitted so unrelated edits cannot
overwrite live accounting or restart schedules. When capacity and a backdated cron
rule change together, accrued credit is applied after the entered capacity.
Adding a child clears the owner's rule and all its options, including scheduled
deletion. The creation wizard explains that rules must be added to children.
Roots obey the [D020 invariant](#d020-childless-root-settlement).

`instant_settlement` and `spend_overflow` accept the same optional
`capUpdateValue` as cron rules. Without it, execution consolidates
`fed = fed + (pendingFedAdjustment ?? 0) - spent`, clears `spent` and any pending
adjustment, and leaves `capacity` unchanged.

With `capUpdateValue`, settlement rules, including cron, apply:

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

[Settlement history](events.md#settlement-outcomes) records manual, spending-limit,
and scheduled execution without adding expenditure. Automatic instant settlement
remains silent.

## D023: Settlement-time Contingency Coverage

Status: Implemented

Coverage applies at settlement, not when an expense is created.
A source can select a same-tree leaf sibling, or a leaf sibling of one of its
ancestors, as its contingency donor. The selector and authoritative backend
validation must use the same eligible-target list. Missing/cyclic ancestry,
non-leaf sources, and blocked sources, donors, or ancestry are ineligible.
`instant_settlement` sources cannot request coverage. Self-destruct sources may
request coverage for their final settlement before deletion. A donor cannot itself have a contingency donor,
and a pipe already serving as a donor cannot request coverage. Several sources
may share one donor, but contingency chains are prohibited.

The optional `pipes.contingencyPipeId` stores the selection; absence means no
contingency. Pipe edits distinguish omission (unchanged), an eligible pipe ID
(set), and `null` (clear). Configuration does not move money. Becoming a parent
clears the pipe's own selection and selections that name it as donor. Switching
a source to `instant_settlement` clears its selection; donor
deletion clears surviving references at finalization.

For a source and eligible donor, in whole integer cents:

- `demand = max(0, source.spent - source.capacity)`
- `available = max(0, donor.fed - donor.spent)`
- `coverage = min(demand, available)`

Negative capacity can represent historical debt, so coverage is not capped by
current spending and can apply when spending is zero. Pending external payment
adjustments do not increase donor availability.

Coverage subtracts from source `spent` and adds to donor `spent` before applying
the source's settlement rule. It does not additionally transfer `fed`. Original
expenses remain wholly attributed to the source in history and reporting;
coverage is permanent, and subsequent refunds do not reclaim it.

One donor's claims at the same recurring-settlement occurrence and priority share available
funding equally, capped by each claim's demand. Unused shares are redistributed;
integer-cent remainders go to ascending source IDs, independent of input order.
The scheduler owns grouping by occurrence, priority, and donor; the allocator
must not combine unrelated groups. Duplicate source claims are invalid.

Recurring-settlement groups run in ascending occurrence date, then ascending priority.
Coverage for the complete group is applied before its settlement rules, including
a donor's own scheduled rule when it is in that group. Earlier groups consume
liquidity before later groups; redistribution follows all scheduled rule effects.
A cron query page triggers a bounded account snapshot rather than limiting its
claimants, so pagination cannot split a sharing group. Frozen accounting trees
retain their due schedules without coverage or settlement writes.

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
- Current-cycle liquidity is `fed - spent`, intentionally excluding the pending
  adjustment. Nonzero pending adjustment appears separately in detail statistics
  as an external settlement indicator, not extra current-cycle liquidity. The
  pipe-detail "Remaining expected" statistic instead follows
  [D008 presentation](reporting.md#d008-presentation-statistics).
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
pre-edit logical balance while making the new adjustment explicit. Reassigning
roles follows the user-directed current-period corrections in
[D017](transactions.md#d017-transaction-structural-editing); historical
settlement cannot be reconstructed from transaction history.

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
omit "Remaining expected", an exception to [D008 presentation](reporting.md#d008-presentation-statistics).
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

## D020: Childless Root Settlement

Status: Implemented

A childless root always uses `instant_settlement`, without capacity-update options,
so spending consolidates immediately. Other settlement behaviors belong to inner
pipes, not root feeds or boilers. Existing roots are normalized without executing
settlement or changing monetary fields. Root editors expose presentation, not
opening balances, contributed principal, capacity, or rule selection. Adding the
first child settles the former leaf under [D012](#d012-pay-by-transfer-liquidity-and-logical-spending)
and clears its rule and rule options. Deletion finalization restores
`instant_settlement` when deleting the final child makes a root childless.
Nested pipes do not receive this topology-driven default. Roots with children are
ruleless; intermediate pipes group and allocate money but cannot originate new
expenses or transfers or execute a settlement rule of their own. Root parents can
still receive money under the normal root transaction rules.

## D022: Self-destruct Rules

Status: Implemented

Self-destruct is a rule for childless, non-root pipes. It tracks spending without
automatic settlement until its final settlement and scheduled deletion. It has a deletion date, no
capacity update, and no manual rule-execution action. The server normalizes the
selected UTC date to 05:00 UTC and requires that instant to be strictly in the
future when configuring or changing the rule.

The existing schedule fields have rule-specific meanings:

- For `cron`, `cronNextDate` is the next settlement occurrence and `cronInterval`
  is the recurring schedule, configured with a positive whole-number interval.
- For `self_destruct`, `cronNextDate` is the deletion deadline. `cronInterval`
  stores the original countdown duration in fractional days, calculated from
  the deadline and server time when configured. It never drives recurrence.

Changing the deadline restarts the countdown. Saving an unchanged future
deadline preserves its interval. Removing or replacing the rule clears its old
options; adding children cancels the owner's self-destruct deadline as part of
the normal rule reset.

The rule icon is a red MaterialCommunityIcons `bomb` with a red progress ring.
Progress is elapsed time over the stored duration, clamped to zero through one;
it stays full while an overdue deletion is pending. One focused list clock
updates its timed icons once per minute.

The daily 06:00 UTC rule workflow processes recurring settlement before scanning
due self-destruct deadlines through the existing rule/date index. Each due pipe first
applies eligible contingency coverage, then settles, then enters
the [D002 deletion job](deletion.md#d002-pipe-deletion-and-transaction-history)
with history preservation enabled. Settlement and deletion planning/freezing are
atomic; the deletion balance uses the post-coverage, post-settlement snapshot.
Insufficient coverage does not prevent deletion: remaining money or debt returns
to the owner under the normal deletion policy. The final settlement and any donor
coverage are retained in history. Delayed executions run after the deadline.
Automatic deletions are serialized per account and resume after deletion
completion, preserving planned balances without busy-retrying frozen trees.
The retained creation event becomes the ordinary deleted-pipe archive described
by [D021](history-cache.md#d021-pipe-creation-and-archived-history).
