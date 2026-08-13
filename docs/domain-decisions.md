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

Status: In progress

The application code now accepts and calculates new monetary inputs as whole integer cents, and the versioned migration definitions are ready to convert legacy persisted transactions and pipe trees in place. The `pipeDeletionJobs` table is empty in the migration deployment, so it is intentionally excluded from the backfill; new deletion jobs are written in cents and do not carry a migration marker. Existing persisted documents remain mixed until the migration is run and verified.

The accepted target is a single currency represented as whole integer cents. For example, `12.34` is stored as `1234` cents and `-15.99` as `-1599` cents.

The implementation must define and test:

- exact parsing from user-entered decimal text
- rejection of unsupported fractional precision
- deterministic remainder allocation when cents do not divide evenly
- negative amounts and zero policy
- persistence migration or an explicitly approved reset of disposable data
- conservation across feeds, spending, transfers, refunds, and allocation

Until the migration completes, do not claim that every persisted value is cents or remove the migration-window markers and safeguards.

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

`any_spend` and `spend_overflow` rules accept the same optional `capUpdateValue` as cron rules, governing how capacity changes when the rule runs.

When a rule runs and `capUpdateValue` is not set, the pipe consolidates to `fed = fed - spent` and `spent = 0`, leaving capacity unchanged at `pipe.capacity`.

When `capUpdateValue` is set, the rule applies to every rule kind (including cron):

- `leftoverFed = fed - spent`
- `missingCap = capacity - fed`
- `capacity = missingCap + leftoverFed + capUpdateValue`, equivalently `capacity - spent + capUpdateValue`
- `fed = leftoverFed`
- `spent = 0`

`spent` accumulates positively for spending on storage, and the formula uses that stored sign.

## D009: (reserved)

Status: Implemented

Transactions use three structural kinds: `feed`, `expense`, and `transfer`.
Pay-by-transfer is an expense with optional `paidFrom` provenance, not a
separate kind. Refunds retain the same structural kind and reverse monetary
polarity.

Expense grouping intentionally ignores `paidFrom`; matching ordinary and
pay-by-transfer expenses group together across dates. Group identity includes
kind, title, value, `from`, and `to` through a collision-free encoding. A
collapsed expense group repeats a generic expense without `paidFrom`; expanding
the group exposes individual transactions that preserve their payer.

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

This extraction does not change the current monetary representation. Values
remain JavaScript floating-point numbers until D001 is implemented.
