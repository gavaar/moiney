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

Status: Accepted, not implemented

Moiney currently stores and calculates monetary values with JavaScript floating-point numbers.

The accepted target is a single currency represented as whole integer cents. For example, `12.34` is stored as `1234` cents and `-15.99` as `-1599` cents.

The implementation must define and test:

- exact parsing from user-entered decimal text
- rejection of unsupported fractional precision
- deterministic remainder allocation when cents do not divide evenly
- negative amounts and zero policy
- persistence migration or an explicitly approved reset of disposable data
- conservation across feeds, spending, transfers, refunds, and allocation

Until implemented, do not add another monetary representation and do not claim that persisted values are cents.

## D002: Pipe Deletion And Transaction History

Status: Accepted, not implemented

Deleting a pipe always deletes the selected pipe and all descendants.

The deletion confirmation includes a checkbox controlling transaction history:

- When checked, delete every transaction involving the selected subtree through `from`, `to`, or `paidFrom`.
- When unchecked, preserve those transactions and enough pipe snapshot data to render meaningful history after the pipes are gone.

Before deleting the subtree, compute the selected subtree's aggregate `fed - spent`. Credit that amount exactly once to the immediate parent when one exists. A deleted root has no parent to credit.

The operation must preserve accounting conservation, clean related derived records when history is purged, and use bounded work for large histories.

## D003: Transaction Involvement

Status: In progress

A transaction involves a pipe when that pipe appears in any of these roles:

- `from`
- `to`
- `paidFrom`

Filtering and grouping account for all applicable roles. Deletion and snapshot
behavior remain pending in Update 6.

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

## D007: Transaction Identity And Grouping

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
