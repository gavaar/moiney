# Authentication

Canonical authentication contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings)
and [account-scoped cache isolation and logout](history-cache.md#d014-event-history-snapshot-cache).

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

## Device-Local Biometric Login

Biometric login is a shortcut for password sign-in when the normal workflow
reaches the login screen; it does not gate session restoration or background
resumption. One account's username and password may be saved on a native device,
in biometric-protected, enrollment-bound, device-only secure storage. Device
passcodes are not a fallback. Credentials must never be unlocked or submitted
to a different deployment. Web and devices without supported strong biometrics
do not offer setup.

Successful password sign-in or signup offers setup unless that account already
occupies the device slot or offers are suppressed. Consent explains the
one-account limit; accepting for another account replaces the slot. Dismissal
means not now. Declining permanently suppresses automatic offers device-wide,
but manual setup remains available and requires current password validation.
Setup must prove biometrics before marking the setting enabled.

Ordinary sign-out revokes the session and clears session/cache state, but retains
biometric credentials. Confirmed disabling deletes those credentials and
suppresses offers. Invalid saved passwords or enrollment-invalidated storage
require password sign-in and setup again; cancellation and transient failures
retain the saved credentials. Biometrics authenticate an enrolled device user,
not independently the owner of the saved account.
