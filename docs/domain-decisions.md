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

Status: Accepted, not implemented

A transaction involves a pipe when that pipe appears in any of these roles:

- `from`
- `to`
- `paidFrom`

Filtering, grouping, deletion, snapshots, and query projections must account for all applicable roles. The current implementation omits some roles in several paths; these are tracked in the roadmap.

## D004: Username Canonicalization

Status: Pending

The current implementation is effectively case-sensitive and does not consistently normalize whitespace.

Before Update 1, decide whether usernames are canonicalized with `trim().toLowerCase()` or retain case-sensitive identity. Availability, registration, and sign-in must use the same rule.

## D005: Authentication Provider

Status: Pending

The current application uses a custom JWT and refresh-token implementation. Immediate security containment will not depend on replacing it.

After containment, evaluate the current Convex Auth React Native flow in an isolated proof of concept. Convex Auth is currently beta and previously caused integration difficulty for this project. A migration requires demonstrated sign-up, sign-in, persistence, refresh, sign-out, recovery, and web/native compatibility.

If custom auth remains, key correspondence, atomic registration, refresh rotation, replay detection, rate limiting, recovery, and storage policy must be treated as owned production responsibilities.
