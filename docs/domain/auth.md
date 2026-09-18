# Authentication

Canonical authentication contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings)
and [account-scoped cache isolation and logout](history-cache.md#d014-transaction-snapshot-cache).

## D004: Username Canonicalization

Status: Implemented

Usernames use `trim().toLowerCase()` before availability checks, registration,
and sign-in. Canonical lowercase usernames are persisted. Whitespace-only
usernames are invalid and are not reported as available.

## D005: Authentication Provider

Status: Pending

The application currently uses custom JWT and refresh tokens. Current controls
derive JWKS from configured public key material, reject mismatched signing and
verification keys, create accounts and sessions atomically, and use typed
internal session references. These controls do not resolve the provider decision
or all production responsibilities.

Evaluate the current Convex Auth React Native flow in an isolated proof of
concept. Migration requires demonstrated sign-up, sign-in, persistence, refresh,
sign-out, recovery, and web/native compatibility.

If custom auth remains, key correspondence, atomic registration, refresh
rotation, replay detection, rate limiting, recovery, and storage policy remain
owned production responsibilities, not a claim that all are resolved.

## D006: Invited-User Account Recovery

Status: Implemented

While invitation-only, recovery is operator-assisted. The operator verifies the
requester through the established invitation channel; unverified requesters
receive no confirmation that an account exists. Any credential reset must
revoke every active session for the account.

There is no public password-recovery endpoint or email reset flow. Before public
release, replace this process with an auditable recovery flow or an
authentication provider demonstrating recovery across native and web.
