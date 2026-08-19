# Update 12 Backend Baseline

Captured: 2026-08-16

## Production Signal

`bunx convex insights --details` reported no deployment health issues over the
previous 72 hours. The CLI did not return per-function read, write, latency, or
OCC values. Update 12 is therefore preventative work guided by boundedness and
repeatable operation counts, not a response to an active production incident.

## Recascade Harness

Run `bun benchmarks/update12-recascade.ts` to call `recascadeTree` with an
in-memory Convex database adapter. It measures the current operation count and
local orchestration time for a root with `N - 1` children. Times exclude network
and database I/O and must not be interpreted as deployed mutation latency.

| Scenario | Pipes read | Patch calls | P50 local | P95 local |
| --- | ---: | ---: | ---: | ---: |
| Stable accounting, 20 pipes | 20 | 20 | 0.109 ms | 0.374 ms |
| Stable accounting, 200 pipes | 200 | 200 | 0.459 ms | 0.678 ms |
| Stable accounting, 500 pipes | 500 | 500 | 1.164 ms | 3.444 ms |
| Allocation changes, 20 pipes | 20 | 20 | 0.055 ms | 0.138 ms |
| Allocation changes, 200 pipes | 200 | 200 | 0.424 ms | 2.023 ms |
| Allocation changes, 500 pipes | 500 | 500 | 0.818 ms | 4.754 ms |

Stable accounting requires zero `fed` changes, but the current implementation
still patches every pipe. This makes requested writes the strongest initial
signal: 100% of recascade patches are avoidable in the stable scenario.

## Baseline Read/Write Shapes

Let `N` be the user's existing pipe count and `S` an affected subtree size.

| Path | Current database work relevant to Update 12 |
| --- | --- |
| `recascadeTree` | Reads all `N` user pipes and patches all `N`, including unchanged `fed` values. |
| Metadata-only `updatePipe` | One target read and patch, then `N` reads and `N` recascade patches. At 500 pipes this requests 501 patches for a presentation change. |
| `addPipe` | Reads the parent, reads up to 500 pipes for the limit, inserts one child, patches the parent, then reads and patches all `N + 1` pipes. |
| `updatePipeRule` | Reads and patches the target, then reads and patches all `N` user pipes. |
| Transaction create/edit | Performs role accounting reads/writes, then adds `N` user-pipe reads and `N` recascade patches for affected accounting changes. |
| `reconcileAffectedPipeRoots` | Uses ancestor point reads plus one child query per subtree node; deduplicates roots and patches only changed `fed` values. |

The 500-pipe creation limit bounds normal per-user size, but does not remove
write amplification, reactive invalidation, or broad OCC conflict footprints.

## Other Boundedness Baselines

### Scheduled cron rules

`runDueCronRules` reads up to 500 globally overdue candidates through the
existing `by_rule_cronNextDate` index, filters candidates that are not yet due at
the explicit clock, and groups the remaining candidates by user. Each selected
user is loaded once through the bounded `by_userId` index, with the existing
500-pipe user limit as the per-user snapshot bound.

The implementation processes complete user groups until an aggregate snapshot
bound of 2,000 pipes is reached. It resolves roots, deletion freezes, cron
settlements, and affected-tree allocation in memory. Affected roots are
recalculated once, then cron and `fed` changes are merged into one final patch
per pipe. This avoids the previous per-candidate rule patch followed by a
separate reconciliation patch.

Groups that do not fit are carried as transient pipe IDs. Continuations
re-read those IDs, preserve the original explicit clock, and only advance to
the next cursor over the mutating cron index after deferred IDs are handled. Frozen candidates
remain due for the next daily run, while later candidates continue processing.
All patches and continuation scheduling remain atomic, and no persisted
cron-job state was added.

The 500 value is a discovery-page bound, not a guarantee that 500 candidates
fit in one transaction. The aggregate snapshot bound exists because a global
page can contain candidates from many users: 500 candidates could otherwise
expand to 250,000 user-pipe documents. Production candidate counts, snapshot
sizes, mutation reads/writes, latency, and OCC conflicts should still be
measured before changing either bound.

### Pipe deletion

Transaction processing is already bounded to 50 role-indexed rows per scheduled
mutation. Planning still reads all user pipes and freezes every subtree member
atomically. Finalization reads all user pipes, deletes every member, reconciles
survivors, and completes the job atomically. The normal 500-pipe limit is the
current size bound for those phases.

The maximum-size local boundary uses 500 user pipes: one surviving parent and a
499-member deleted subtree. It completes with the planned balance credited
exactly once, conservation preserved, all deleted members removed, and a retry
leaving the completed result unchanged. The no-history case schedules 1,497
role-processing invocations (three roles for each deleted member) followed by
one finalization invocation; the test harness uses a 2,000-iteration ceiling
for this synthetic chain. Planning and finalization remain within the enforced
500-pipe user bound, so no production phase split is justified without a
larger persisted-size requirement.

### Transaction lists

The filtered recent transaction list now reads through user-scoped role/date
indexes for `from`, `to`, and `paidFrom`. It fetches at most 12 candidates per
requested role stream, deduplicates transactions that match multiple roles,
sorts the merged result by date, and returns the newest 12 rows. The maximum
500-pipe filter therefore creates at most 1,500 bounded role streams instead of
scanning the user's full transaction history. The paginated history endpoint is
unfiltered because its current consumer does not provide pipe IDs.

The old post-index filter path was removed; no transaction data migration was
required for the new indexes.

### Maintenance jobs

- Stale title usage is indexed and processed in batches of 100.
- Expired-session cleanup now paginates sessions in batches of 100, deletes only
  rows expired before one captured clock, and carries the cursor through atomic
  continuations. No persisted cleanup-job state was added.
- Profile-picture cleanup collects every user and may scan all storage records,
  although it deletes at most 100 files per run.

Production-only measurement for this maintenance path is deferred because no
production database exists yet.

## Measurement Gaps

Before migration-heavy indexes or persisted projections, collect production
distributions for:

- user pipe counts and affected root sizes
- mutation documents/bytes read and written
- requested versus changed recascade writes
- mutation latency and OCC conflicts by caller
- overdue cron candidates, roots, and backlog age
- transaction rows scanned versus returned and `pipeIds` cardinality
- deletion subtree sizes, role-page counts, and finalization work
- total and expired sessions, users, storage rows, and orphan yield

## First Optimization Result

`recascadeTree` now compares calculated `fed` values with the documents already
loaded and patches only changed values, matching `reconcileAffectedPipeRoots`.
The whole-user read and deletion guard remain unchanged.

| Scenario | Pipes read | Patches before | Patches after | P50 local after | P95 local after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stable accounting, 20 pipes | 20 | 20 | 0 | 0.089 ms | 0.381 ms |
| Stable accounting, 200 pipes | 200 | 200 | 0 | 0.379 ms | 0.563 ms |
| Stable accounting, 500 pipes | 500 | 500 | 0 | 0.907 ms | 1.250 ms |
| Allocation changes, 20 pipes | 20 | 20 | 20 | 0.086 ms | 0.132 ms |
| Allocation changes, 200 pipes | 200 | 200 | 200 | 0.470 ms | 2.036 ms |
| Allocation changes, 500 pipes | 500 | 500 | 500 | 0.985 ms | 1.934 ms |

Stable scenarios eliminate 100% of recascade writes. Allocation-changing
scenarios retain every required write. Reads are unchanged, so the next
independent decision is whether metadata-only pipe updates should skip
reconciliation and its current user-wide deletion guard.

## Metadata-Only Update Result

Name, icon, and description changes now patch the authorized target without
calling `recascadeTree`. Capacity and priority changes continue to reconcile.

| User pipe count | Documents read before | Documents read after | Patches before | Patches after |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 21 | 1 | 1 | 1 |
| 200 | 201 | 1 | 1 | 1 |
| 500 | 501 | 1 | 1 | 1 |

The "before" values include one target point read plus the whole-user recascade
query after changed-only recascade writes were implemented. The target patch is
required in both cases; the eliminated work is the unrelated user-pipe read.

Presentation-only updates remain blocked when the target pipe itself is frozen,
but they no longer fail because a different tree is undergoing deletion.

## One-Root Reconciliation Results

Ordinary expense creation and editing, plus feed creation, now resolve and
reconcile only the root containing the involved `from` or `to` pipe. Root
ancestry can reuse each operation's invocation cache, while the reconciler
freshly loads post-accounting root and descendant state before validating
deletion safety and calculating changed-only patches.

The benchmark's `one-affected-root` scenario keeps the affected root size at one
while increasing unrelated user pipes:

| Total user pipes | Pipe-document reads before | Point reads after | Child queries after | Child documents after | Reconciliation patches |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 21 | 2 | 1 | 0 | 0 |
| 200 | 201 | 2 | 1 | 0 | 0 |
| 500 | 501 | 2 | 1 | 0 | 0 |

The two point reads after include the operation's initial role read and the
required fresh post-write root read. The ancestry lookup reuses the initial
document. At 500 pipes this removes 499 unrelated document reads for a
standalone-root expense. An unrelated frozen root no longer blocks the expense;
the affected root and all of its descendants are still checked before any
reconciliation patch.

Ordinary expense and feed creation and editing use this helper. Two-root
transfer and pay-by-transfer edits also use it. Accounting-relevant pipe
mutations retain their previous reconciliation paths until their own behavioral
contracts are established.

The edit operation now also uses a promise-valued invocation cache for role
authorization, topology checks, and accounting reads. Reconciliation still
performs a deliberate fresh root read after writes. Current-period value deltas,
correction history, and automatic rule triggers are unchanged for ordinary
expense, feed, transfer, and pay-by-transfer edits.

For a standalone edited root, the same scope applies as creation: one initial
role read, one fresh post-write root read, and one child query, independent of
the number of unrelated user pipes. Edits remain blocked if any member of the
affected tree is frozen.

## Two-Root Transaction Results

Transfer and pay-by-transfer creation pass their two involved pipe IDs to the
same helper. It resolves and deduplicates both roots, loads both post-accounting
trees, validates deletion safety across both trees, and only then issues changed
`fed` patches.

| Total user pipes | Pipe-document reads before | Point reads after | Child queries after | Child documents after | Reconciliation patches |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 22 | 4 | 2 | 0 | 0 |
| 200 | 202 | 4 | 2 | 0 | 0 |
| 500 | 502 | 4 | 2 | 0 | 0 |

The after count consists of two role reads plus one fresh post-write read for
each standalone root. Unrelated user pipes do not affect the read set. An
unrelated frozen root no longer blocks either transaction shape, while a freeze
anywhere inside either affected tree rejects before reconciliation patches.
Pay-by-transfer retains logical `spent`, `pendingFedAdjustment`, and payer
liquidity effects under the narrower reconciliation scope.

Transfer and pay-by-transfer edits use the same two-root scope as creation. The
source, destination, logical, and payer trees are loaded and freeze-validated
before reconciliation; the edit delta and correction document are committed
atomically with the updated transaction snapshot. Pay-by edits retain logical
`spent`, `pendingFedAdjustment`, and payer liquidity effects.

## Root-Scoped Child Creation

`addPipe` now reconciles only the root containing its parent. Parent settlement,
rule clearing, child allocation, and integer-cent conservation remain unchanged.
An unrelated frozen root does not block child creation; the complete affected
tree is still loaded and freeze-validated before reconciliation patches.

## Root-Scoped Rule Updates

Rule updates now reconcile only the updated pipe's root. Non-cron rule fields,
cap updates, cron catch-up capacity, and same-day idempotency remain unchanged.
An unrelated frozen root does not block the rule update; the complete affected
tree is still validated before reconciliation writes.

## Root-Scoped Pipe Updates

Capacity and priority updates now reconcile only the updated pipe's root.
Metadata-only updates continue to skip reconciliation entirely. Capacity,
priority, and metadata changes in an unrelated tree remain allowed while another
tree is frozen; updates targeting a frozen member remain blocked.
