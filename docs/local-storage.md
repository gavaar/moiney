# Local Storage

Read before adding or changing client-side persistence. Local storage has three
different lifetimes; sharing a directory registry does not make their cleanup
or security policies interchangeable.

## Choose The Storage Class

| Data | Native storage | Constraint |
| --- | --- | --- |
| Rebuildable server data | `Paths.cache` | May disappear at any time; a miss must recover from the server. |
| Durable device-local preferences | `Paths.document` | Must survive cache cleanup and app restarts; sign-out behavior belongs to the preference's contract. |
| Credentials and session secrets | Auth-owned secure storage | Never store secrets in these ordinary files or browser preference/cache keys. |

`Paths.document` is durable across ordinary restarts and cache eviction, not a
guarantee against uninstall, explicit data clearing, or storage failure. Local
financial snapshots are read-only conveniences, never an authority for mutations.

## Directory And Feature Ownership

`src/lib/storage/directories.native.ts` is the authoritative registry of native
cache and preference directories. Native storage adapters import its named
exports rather than constructing their own directories. Declaring a directory
does not create it on disk; adapters create it when writing.

The feature owns file names, serialization, validation, reads, writes, and
cleanup. Keep native filesystem code in native modules and browser persistence
in web adapters. Browser adapters use namespaced `localStorage` keys; native
directory exports must not enter the web import graph. This registry is not a
generic storage framework or a shared owner of feature state.

Existing paths and browser keys are compatibility constraints. Moving a
directory, changing an account-key prefix, or renaming a file can make existing
data unreachable. Preserve shipped locations unless an intentional migration
or cache invalidation is part of the change. The registry owns exact native
paths; do not duplicate a path inventory here.

## Isolation, Loading, And Failures

- Scope account-owned data by deployment and canonical account identity. Use
  the auth-provided `accountKey`, not a separate username normalization scheme;
  encode it before using it in a file name or browser key.
- Treat persisted content as untrusted: validate its shape and default or reload
  safely when it is missing, corrupt, or unreadable.
- Do not expose another account's state during account changes. Ignore delayed
  reads and callbacks belonging to a retired account.
- Distinguish loading from a loaded default when it affects visible behavior.
  Hydration must not overwrite saved preferences with initial defaults.
- Optional cache/preference failures must not block navigation or turn successful
  server operations into failures. Secure-storage failures follow the auth
  contract rather than silently bypassing authentication.
- Choose write ordering and cleanup according to the actual adapter and feature
  contract. Current native preference file writes and browser `localStorage`
  writes complete synchronously; promise-returning methods alone do not require
  a write queue. History has its own queued-write and invalidation requirements.

## Feature Contracts And Verification

Do not infer cleanup behavior from the storage class alone:

- [History cache](domain/history-cache.md#d014-event-history-snapshot-cache) owns
  snapshot limits, invalidation, account retirement, logout cleanup, and write
  ordering.
- [UI preferences](ui.md#shared-primitives) owns pipe-view preference persistence and
  pruning.
- [Monthly reporting](domain/reporting.md#d016-monthly-spending-statistics) owns
  monthly-card preference scope and visibility.
- [Authentication](domain/auth.md#device-local-biometric-login) owns biometric
  credential protection, consent, and retention. Auth code owns session storage.

Test through the owning storage adapter or state owner, not source-text checks
or assertions about registry membership. Cover account isolation, corrupt/missing
data, storage failures, and relevant restart/logout behavior. When reorganizing
storage, verify that previously written files or keys remain readable and that
cleanup cannot delete unrelated durable data. Native location compatibility is
exercised by `src/lib/storage/nativeStorage.integration.test.ts` using an in-memory
filesystem adapter; actual platform filesystem and secure-storage behavior still
need native-oriented verification where practical.
