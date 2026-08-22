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
subscriptions on app open. History seeds 100 rows and loads additional pages
of 15 only after explicit demand. Every loaded transaction is persisted until
the cache reaches 300 unique transaction entities, after which the least
recently refreshed entries are evicted. History and selected-pipe scopes maintain
separate ordered snapshots over the shared entity cache.

The server remains authoritative. Explicit refresh, cache misses, and load-more
requests use one-shot reads; cached rows are replaced or reconciled with the
server result. Cached data is never used for authorization or mutation
decisions. Explicit logout clears the active account's transaction cache, and
cache entries are isolated by deployment and account identity.
