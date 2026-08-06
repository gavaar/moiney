# Design Improvement Roadmap

This roadmap persists the whole-project audit beyond any single chat session. Work through updates in order unless a newly discovered security or data-integrity issue requires reprioritization.

## Working Protocol

- Present one update's problem, proposed behavior, tradeoffs, and acceptance criteria to the user.
- Resolve pending product decisions before implementation.
- Implement one observable behavior per Red-Green-Refactor cycle.
- Run focused tests, the full suite, and type checking before completing an update.
- Update this roadmap and `docs/domain-decisions.md` after completion.
- Do not mark an update complete based on intent or partial implementation.

## Status

| Update | Status | Objective | Depends on |
| --- | --- | --- | --- |
| 0. Durable agent context | Completed | Add current project guidance, engineering rules, domain-decision status, and this roadmap | None |
| 1. Account API exposure | Completed | Replace public full-user lookup and insertion with narrow availability and internal operations | D004 username decision |
| 2. Cross-tenant pipe writes | Completed | Authorize and validate parent pipes before any child write | None |
| 3. Authentication integrity | Pending | Align JWT/JWKS, use typed internal references, and make registration/session behavior reliable | Update 1, D005 direction |
| 4. Quality gates | Pending | Require tests and type checking before deploy; improve native and Convex boundary coverage | None |
| 5. Transaction identity | Pending | Model transaction kinds and collision-free grouping, including `paidFrom` | D003 |
| 6. Pipe deletion contract | Pending | Implement optional complete history purge and return subtree balance to the parent | D002, money command contract |
| 7. Independent correctness fixes | Pending | Repair selection, back handling, description clearing, cron diff, input handlers, and loading states | Relevant focused tests |
| 8. Shared domain core | Pending | Introduce deep pure modules for money, transactions, pipe graph, and cron schedules | D001-D003 |
| 9. Integer cents migration | Pending | Replace floating-point monetary persistence and arithmetic with integer cents | Update 8, D001 |
| 10. Financial mutation semantics | Pending | Define corrections, rule effects, idempotency, and accounting projections | Updates 8-9 |
| 11. Convex model boundaries | Pending | Make registered functions thin, validated, authorized wrappers over deep model operations | Updates 1-3, 8-10 |
| 12. Bounded backend work | Pending | Scope recascade, batch cleanup/crons/deletion, and index hot transaction queries | Updates 6, 10-11 plus measurements |
| 13. Frontend ownership | Pending | Normalize backend models, narrow contexts/subscriptions, and restore dependency direction | Updates 5, 8, 11 |
| 14. Complex component refactors | Pending | Refactor AmountForm, RuleModal, PipeTreeView, and transaction rows by responsibility | Updates 5, 8, 13 |
| 15. Measured runtime performance | Pending | Profile and improve virtualization, subscriptions, startup, icons, and repeated modals | Updates 12-14 |
| 16. Maintenance hardening | Pending | Accessibility, observability, dependencies, dead APIs, behavioral tests, and documentation | Prior updates as applicable |

## Confirmed High-Priority Risks

- JWT signing material and served JWKS have independent sources.
- Backend financial and topology invariants are incomplete.
- Transaction involvement is inconsistent across grouping, filtering, and deletion.
- Floating-point monetary arithmetic cannot guarantee exact conservation.
- Several maintenance functions and transaction scans are unbounded.

## Refactor Targets

- `convex/lib/pipes.ts`: separate pure cron, allocation/tree logic, and database orchestration.
- `convex/transactions.ts`: move classification, validation, and accounting operations behind a deep model API.
- `convex/pipes.ts`: extract ownership, topology, deletion planning, and reconciliation.
- `AmountForm.tsx`: use typed drafts, pure transitions, and command construction.
- `RuleModal.tsx`: use a canonical schedule draft and normalized command comparison.
- `PipeTreeView.tsx`: share graph/liquidity logic and virtualize rendering.
- Transaction presentation: move feature-aware rows and lists out of `ui`.
- Auth provider: separate session state, persistence, and remote gateway concerns.

Line count alone is not a refactor requirement. Cohesive components such as the calendar may remain intact.

## Performance Gate

Before architecture-heavy optimization, record representative baselines for 20, 200, and 500 pipes and for growing transaction histories. Measure React commits, frame time, memory, active subscriptions, Convex reads/writes, query scans, mutation latency, and OCC conflicts.

Update 15 must report before-and-after measurements rather than relying only on static predictions.

## Current Next Step

Present Update 3, authentication integrity, for discussion.
