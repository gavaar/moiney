# Backend Contracts

Read for new or modified registered Convex functions and persisted schema
changes. Global security and accounting safeguards are in `../AGENTS.md`;
domain-specific contracts are indexed in [Domain Decisions](domain-decisions.md).
Load the applicable Convex skill as well.

## Function Boundaries

- Expose the smallest public API and return only fields required by the caller.
- Define argument and return validators; type validation does not replace semantic bounds or authorization.
- Use internal functions and generated `internal.*` references for backend-only orchestration.
- Use structured expected errors with stable codes, not client parsing of message text.
- Put multi-step operations that require atomicity in one mutation.
- Use explicit table names with `ctx.db.get`, `patch`, `replace`, and `delete` when touched code supports it.

## Transaction Work

Trace the read/write set before completing a modified function. Reuse documents
already loaded in the invocation and pass them to helpers. Avoid duplicate point
reads and unchanged writes; do not add a cache for a document read only once.
Do not reuse pre-write data when correctness requires post-write state.

Avoid unbounded `.collect()`, post-index database `.filter()`, and unbounded
fan-out mutations. Paginate or batch maintenance work. Narrow reconciliation
only when behavioral tests prove accounting and topology invariants remain
intact; consult [deletion freezes](domain/deletion.md) when changing its scope.

## Persisted Changes

Use the migration skill and widen-migrate-narrow for persisted breaking schema
changes. Plan writes, backfills, fallback reads, and cutover together when adding
an index or denormalized projection for a demonstrated access pattern.

The current-consumer/invariant requirement in `AGENTS.md` also applies to
recovery and observability fields. Remove unused persisted structure when its
consumer disappears, using the same migration discipline where required.

## Deployment And Manual Migrations

App publication and client update policy are defined in [App Updates](app-updates.md).

GitHub Actions deploys the backend and builds the app without running backfills.
Deploy compatible old/new contracts first, then run migrations manually and
verify completion before a follow-up reader cutover or legacy-code removal.
The first deployment must support unmigrated data and installed clients.

Use unique timestamp-prefixed migration names; keep function paths and meanings
stable and never reuse a name. Remove definitions only after completion in every
supported deployment, with no running migration still referencing them.
