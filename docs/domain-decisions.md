# Domain Decisions

This is the durable record of product and domain decisions. It distinguishes desired behavior from behavior already implemented in code.

## Status Meanings

| Status | Meaning |
| --- | --- |
| Pending | A decision is still required before implementation |
| Accepted, not implemented | The target behavior is agreed but current code does not yet satisfy it |
| In progress | A migration or implementation is underway and both states may exist |
| Implemented | Code, persisted data, tests, and documentation satisfy the decision |
| Superseded | A later decision replaced this one |

Agents must not describe an accepted target as current behavior until its status is Implemented.

## D001: Monetary Representation

Status: Implemented

All persisted monetary values are whole integer amounts of cents. The completed
data migration converted existing transactions and pipe trees, and the
migration markers and temporary migration machinery were then removed. New
deletion jobs store their accounting values in cents directly.

The accepted target is a single currency represented as whole integer cents. For example, `12.34` is stored as `1234` cents and `-15.99` as `-1599` cents.

The implementation must define and test:

- exact parsing from user-entered decimal text
- rejection of unsupported fractional precision
- deterministic remainder allocation when cents do not divide evenly
- negative amounts and zero policy
- persistence migration or an explicitly approved reset of disposable data
- conservation across feeds, spending, transfers, refunds, and allocation

The migration window is complete. New code must preserve the integer-cents
representation and its conservation, validation, and boundary rules.

## D002: Pipe Deletion And Transaction History

Status: Implemented

Deleting a pipe always deletes the selected pipe and all descendants.

The deletion confirmation includes a checkbox controlling orphaned transaction history:

- When checked, delete only transactions with no surviving involved pipe.
- A feed is orphaned when its `to` pipe does not survive.
- An ordinary expense is orphaned when its `from` pipe does not survive.
- A pay-by-transfer expense is orphaned when neither `from` nor `paidFrom` survives.
- A transfer is orphaned when neither `from` nor `to` survives.
- When unchecked, preserve all transactions and store deleted-role icons directly on the transaction.
- Preserved transactions are view-only.

Before deleting the subtree, compute the selected subtree's aggregate `fed - spent`. Credit that amount exactly once to the immediate parent when one exists. A deleted root has no parent to credit.

The implementation creates an idempotent deletion job, freezes the selected subtree, and processes role-indexed transaction pages and finalization in bounded scheduled batches. Preserved transactions render embedded role icons without additional history reads. The job credits the immediate parent exactly once with the planned subtree balance and records completion for safe retries. Title-usage cleanup remains owned by its existing stale-usage maintenance job.

The freeze blocks writes involving the selected subtree. Presentation-only
name, icon, and description updates in another tree do not perform accounting
reconciliation and remain allowed while deletion is in progress.
Feeds and ordinary expenses in another root likewise reconcile only their
affected tree and remain allowed; every member of the affected tree is still
checked for a deletion freeze.
Transfers and pay-by-transfer expenses in other roots reconcile only their two
affected trees and remain allowed; both trees are fully checked before
reconciliation.
Ordinary expense value edits in another root use the same affected-tree scope
and current-period accounting policy.
Transfer value edits in other roots reconcile only their two affected trees and
apply the same topology and current-period accounting policy.
Pay-by-transfer value edits in other roots reconcile only their two affected
trees and apply the same logical spending, pending liquidity, payer liquidity,
and current-period accounting policy.
Adding a child pipe in another root reconciles only that affected tree and
remains allowed; every member of the affected tree is checked for a deletion
freeze before reconciliation.
Rule updates in another root reconcile only that affected tree and remain
allowed; every member of the affected tree is checked before reconciliation.
Capacity and priority edits in another root reconcile only that affected tree
and remain allowed; every member of the affected tree is checked before
reconciliation.

## D003: Transaction Involvement

Status: Implemented

A transaction involves a pipe when that pipe appears in any of these roles:

- `from`
- `to`
- `paidFrom`

Filtering, grouping, deletion, and snapshot behavior account for all applicable
roles.

## D004: Username Canonicalization

Status: Implemented

Usernames are canonicalized with `trim().toLowerCase()` before availability checks, registration, and sign-in. Canonical lowercase usernames are stored in the database.

Whitespace-only usernames are invalid and are not reported as available. Existing test/development usernames were already lowercase, so no data migration or compatibility path was required.

## D005: Authentication Provider

Status: Pending

The current application uses a custom JWT and refresh-token implementation. Immediate security containment will not depend on replacing it.

Immediate containment now derives JWKS from configured public key material, rejects mismatched signing and verification keys, creates accounts and sessions atomically, and uses typed internal session references. This does not resolve the provider decision or the remaining production responsibilities below.

After containment, evaluate the current Convex Auth React Native flow in an isolated proof of concept. Convex Auth is currently beta and previously caused integration difficulty for this project. A migration requires demonstrated sign-up, sign-in, persistence, refresh, sign-out, recovery, and web/native compatibility.

If custom auth remains, key correspondence, atomic registration, refresh rotation, replay detection, rate limiting, recovery, and storage policy must be treated as owned production responsibilities.

## D006: Invited-User Account Recovery

Status: Implemented

While Moiney remains invitation-only, account recovery is operator-assisted. The
operator verifies the requester through the established invitation channel; an
unverified requester receives no confirmation that an account exists. Any
credential reset must revoke every active session for the account.

There is no public password-recovery endpoint and no email-based reset flow.
Before a public release, replace this process with an auditable recovery flow or
an authentication provider that demonstrates recovery across native and web.

## D008: Rule Execution And Cap Update

Status: Implemented

`instant_settlement` and `spend_overflow` rules accept the same optional `capUpdateValue` as cron rules, governing how capacity changes when the rule runs.

When a rule runs and `capUpdateValue` is not set, the pipe consolidates to
`fed = fed + pendingFedAdjustment - spent`, clears `spent` and any pending
adjustment, and leaves capacity unchanged at `pipe.capacity`. A missing pending
adjustment is treated as zero.

When `capUpdateValue` is set, the rule applies to every rule kind (including cron):

- `leftoverFed = fed + pendingFedAdjustment - spent`
- `capacity = capacity - spent + capUpdateValue`
- `fed = leftoverFed`
- `spent = 0`
- `pendingFedAdjustment = 0` when the field exists

`spent` accumulates positively for spending on storage, and the formula uses that stored sign.

`instant_settlement` triggers whenever a transaction creation or value edit
changes logical `spent`, in either direction. `spend_overflow` triggers when
positive spending leaves `spent >= capacity`; refunds do not trigger it. Feeds
and transfers currently have zero logical spending effects and therefore do not
trigger these rules.

When a cron execution is overdue for multiple occurrences, it settles the pipe
once and applies `capUpdateValue` multiplied by the number of due occurrences.
It then advances `cronNextDate` once beyond the explicit execution clock.

The pipe detail `expected` presentation shows the monthly spending target from
the next rule configuration. A leaf uses `capUpdateValue` or falls back to its
current `capacity`. Daily, monthly, and yearly cron values are normalized to a
monthly integer-cent amount using the current month and the cron interval;
fractional cents round to the nearest cent. A pipe with children shows the sum
of each immediate child's normalized `capUpdateValue` or fallback capacity.
This presentation intentionally does not calculate post-rule capacity or
include leftover fed from the previous cycle.

Pipe detail statistics present left to spend as `capacity - spent`. Average
daily spending divides current-month spending by the current day-of-month.
Accumulated spendable value through today is
`expected / daysInMonth * currentDay - spent`; its presentation rounds only at
the integer-cent formatting boundary. When this value is negative and the
daily expected amount is positive, its detail states how many whole days are
needed for the precise value to become positive. If that requires more days
than remain in the month, or the daily expected amount cannot increase it, the
detail advises against further spending from the pipe that month.

## D009: (reserved)

Status: Implemented

Transactions use three structural kinds: `feed`, `expense`, and `transfer`.
Pay-by-transfer is an expense with optional `paidFrom` provenance, not a
separate kind. Refunds retain the same structural kind and reverse monetary
polarity.

Expense grouping intentionally ignores `paidFrom`; matching ordinary and
pay-by-transfer expenses group together across dates. Expense and transfer
activity now share a title-based group, while feeds retain their structural
feed identity. A group is evaluated against the currently visible pipe scope:
an expense contributes its value when its logical `from` or `paidFrom` pipe is
visible, while a transfer contributes zero because its value duplicates the
corresponding expense activity. Transactions with no visible logical pipe are
excluded from the scoped group.

Collapsed groups retain the newest transaction's structure for the generic
repeat form and expose the scope-visible participating pipes. One visible pipe
uses its icon; multiple visible pipes use the `card-multiple` icon. Transaction
value is not an identity field, and `paidFrom` is not an identity field but does
count as a participating pipe for scoped visibility and icon selection.
Expanding the group exposes individual transactions that preserve their payer
and values.

Transaction titles are canonicalized with `trim().toLowerCase()` before
persistence and title-usage indexing. Whitespace-only titles are rejected.

Group expansion uses a dedicated accessible count-and-chevron control. Tapping
the main group row continues to open the generic repeat form.

All persisted environments were migrated. `kind` is required, and the
deprecated `type` field and legacy fallback have been removed.

## D010: Shared Domain Core

Status: Implemented

Pure transaction identity, role involvement, accounting effects, pipe graph
reconciliation, and cron schedule calculations live under the framework-
independent root `domain/` boundary. Convex modules retain database reads,
writes, authorization, and scheduling orchestration; UI modules consume the
domain APIs without importing Convex implementation modules.

This extraction uses the integer-cents monetary representation established by
D001.

## D011: Transaction Edit History

Status: Implemented

Editing a transaction updates its current snapshot and records one linked
correction document containing the previous and current title, value, and date.
The normal transaction list shows only the current snapshot and exposes an
`Edited` history control. Correction history is paginated, authorized through
the owning transaction, and displayed in a read-only modal. Correction
documents do not appear as ordinary transaction rows or affect grouping.

Edits across rule-execution boundaries apply their value delta to the current
accounting period; historical periods are not restated. When the delta changes
logical `spent`, edits use the same automatic rule-trigger policy as new
transactions.

## D012: Pay-by-transfer Liquidity And Logical Spending

Status: Implemented

Pay-by-transfer transactions separate the pipe where spending is logically
assigned from the pipe where real liquidity moves. The logical pipe's `fed`
does not change immediately. Its `spent` changes by `-value`, and its
`pendingFedAdjustment` changes by the same amount as the logical pipe's former
`fed` effect. The `paidFrom` pipe's `fed` changes by `value`.

Therefore:

- A negative expense paid elsewhere increases logical `spent` and positive
  `pendingFedAdjustment`, while reducing the payer's `fed`.
- A positive refund received elsewhere decreases logical `spent` and makes
  `pendingFedAdjustment` negative, while increasing the receiving pipe's `fed`.
- Rule settlement computes `fed + pendingFedAdjustment - spent`, then clears
  both `spent` and `pendingFedAdjustment`.
- Capacity updates continue to use logical `spent`, not the pending liquidity
  adjustment.
- The current-cycle L2S presentation is `fed - spent` and intentionally ignores
  `pendingFedAdjustment`. The external adjustment is shown separately because
  it describes settlement that will affect `fed` when the rule runs, not
  additional current-cycle spending capacity.
- Pipe-tree projections aggregate pending adjustments, deletion balances use
  them, and the detailed pipe statistics expose nonzero values as an external
  settlement indicator.

The field remains optional so existing documents remain valid. A missing value
means zero post-cutover pending adjustment; existing `fed` and `spent` values
remain the authoritative legacy baseline. Historical transactions are not
replayed and pending values are not reconstructed, because transaction history
does not record whether an effect crossed a rule boundary. New pipe documents
write an explicit zero, while legacy documents continue to be read as zero
without a data reset or monetary backfill.

When a leaf with pending accounting becomes a parent, its balance is settled as
`fed + pendingFedAdjustment - spent` before `spent` and
`pendingFedAdjustment` are cleared and child allocation runs. Editing a legacy
pay-by-transfer transaction applies only its value difference under the new
model, preserving its pre-edit logical balance while making the new adjustment
explicit.

Convex client mutation retries and atomic cron schedule advancement provide
transport-level idempotency. No operation identifiers are persisted for
separate user submissions; manual rule execution remains intentionally
repeatable.

## D013: Transfer Pipe Eligibility

Status: Implemented

A transfer originates from an owned leaf pipe and terminates at an owned root
pipe in another tree. The backend validates source ownership, destination
ownership, source leaf status, destination root status, and tree separation
before applying accounting effects.

Missing and foreign transfer pipes use the same non-disclosing expected error.
Invalid topology uses stable error codes for a non-root destination, a source
with children, and a destination in the source tree. Valid transfers conserve
integer cents and create one transaction and one title-usage update.

## D014: Transaction Snapshot Cache

Status: Implemented

Transaction lists use an account-scoped persistent snapshot as a stale,
read-only display source. A valid snapshot suppresses live Convex query
subscriptions on app open. The cache stores one shared transaction entity map
keyed by transaction ID and separate ordered ID snapshots for history, recent,
and selected-pipe scopes. History seeds 100 rows and loads additional pages
of 30 only after explicit demand. Recent and selected-pipe queries return at
most 30 rows. Every loaded transaction is persisted until the cache reaches
300 unique transaction entities, after which the least recently refreshed
entries are evicted.

Successful transaction creation and editing return purpose-built transaction
rows and update the shared entity map in place. Creation updates only already
loaded history, recent, and selected-pipe snapshots relevant to any `from`,
`to`, or `paidFrom` role; it does not create unseen partial snapshots. Editing
updates and reorders every loaded snapshot that already contains the ID.
Asynchronous pipe deletion reconciles the currently cached IDs in one bounded
request after completion, updating surviving rows and removing absent IDs from
the entity map and all snapshots.

The server remains authoritative. Explicit refresh, cache misses, and load-more
requests use one-shot reads; cached rows are replaced or reconciled with the
server result. Cached data is never used for authorization or mutation
decisions. Explicit logout clears the active account's transaction cache, and
cache entries are isolated by deployment and account identity.

History filters apply to the complete server history rather than only the
persisted snapshot. An active filter can combine an inclusive date range, a
case-insensitive title substring, and exact pipe involvement across `from`,
`to`, and `paidFrom`. Filtered pages use bounded server reads and Convex query
caching but are not persisted as transaction snapshot scopes. Clearing all
filters restores the unfiltered persisted History snapshot.

## D015: Boiler Feed Pipes

Status: Implemented

A boiler is a root feed pipe whose current liquidity can grow or shrink relative
to the cumulative value contributed to it. Boiler pipes otherwise have the same
topology, transaction eligibility, rules, reconciliation, deletion, and
authorization behavior as ordinary root feeds.

`fed` remains current mutable liquidity and participates in normal accounting.
`contributedFed` is cumulative externally contributed principal in integer
cents. It is separate from `capacity`, which remains mutable allocation and rule
state and must not be used as boiler principal. New boilers start with both
values at zero. A positive feed transaction to a boiler increases both `fed`
and `contributedFed`; editing that feed transaction applies its value delta to
both fields. A transfer whose `to` pipe is a boiler applies the same signed
destination delta to both `fed` and `contributedFed`; editing the transfer
applies only its signed value difference, including reversals. Refunds,
expenses, rules, reconciliation, explicit current corrections, and transfers
where the boiler is not the destination affect `fed` under their existing
policies without changing `contributedFed`.

The boiler contribution boundary accepts an optional exact current balance. If
it is omitted, a positive contribution is added to the latest current balance.
If supplied, the boiler's aggregate tree balance is set to that value while the
positive contribution still increases principal. A zero contribution is valid
only with a changed exact current balance and creates no transaction history.
Current corrections are not recorded separately. Aggregate corrections account
for descendant liquidity before reconciliation so they do not create money.

Boiler growth is `(fed - contributedFed) / contributedFed * 100`. Zero and
positive growth are presented in blue and negative growth in red. Growth is not
available when `contributedFed` is zero. Boiler liquidity bars use
`contributedFed` as their presentation baseline without replacing or modifying
the pipe's operational `capacity`. Boiler detail statistics omit left to spend,
and boiler liquidity bars omit spent because those spending presentations are
not relevant to boiler pipes.

`sourceType` and `contributedFed` are optional persisted fields for compatibility
with existing data. Existing roots without `sourceType` are ordinary feeds; new
roots always write an explicit `feed` or `boiler` type, and new boilers always
write `contributedFed`. No backfill of principal is required because no boilers
predated this decision, and current balances cannot safely reconstruct
historical contributions.

## D016: Monthly Spending Statistics

Status: Implemented

At 05:00 UTC on the first day of each month, a bounded scheduled job captures
one frozen spending summary per user for the previous UTC calendar month. A
month uses an inclusive start and exclusive end. Users without qualifying
activity receive a zero-valued row so retries cannot later change an originally
empty snapshot.

Negative expense values contribute their absolute value to gross spending.
Positive expense values contribute to refunds. Pay-by-transfer expenses count
once through their logical expense identity, while feeds and transfers do not
contribute to expenditure. Feed transactions, which have only a `to` role,
contribute their value to total income; transfers do not. The summary stores
total income, gross spending, refunds, spending and refund transaction counts,
and the largest spending transaction in integer cents. Total outcome is derived
as gross spending minus refunds. Averages and comparisons are also derived when
read rather than persisted.

Each new summary also freezes two account-wide root-pipe values at capture
time. Volume is the sum of `fed - spent` across the user's root feeds and
boilers. Produced is the sum of `(contributedFed ?? fed) - spent` across those
same roots. Descendants are excluded to avoid double-counting allocated
liquidity. These values are optional on persisted rows because historical
snapshots cannot be reconstructed accurately and are not backfilled. Total
income is optional for the same reason on rows captured before it was added.

The summary is immutable after its first successful capture. Transactions
created, edited, moved, or deleted afterward do not restate a captured month.
User and transaction traversal is paginated, and `(userId, periodStart)` is the
logical identity used to make retries idempotent.

Authenticated users can read their newest 24 summaries and open an exact
owned month. The report derives net spending as gross spending minus refunds.
Average spending divides gross spending by the spending transaction count,
rounds to the nearest integer cent, and is zero when there are no spending
transactions.
