# Testing Map

The local [TDD skill](../../.agents/skills/tdd/SKILL.md) owns procedure. This
guide selects the repository seam and keeps one behavior from being tested at
every layer.

| Behavior Owned By | Preferred Seam | Example |
| --- | --- | --- |
| Money, transaction, topology, or scheduling policy | Pure `domain/` test | `domain/transactions/accounting.test.ts` |
| Authorization, public validators, persistence, atomicity, or registered API result | `convex-test` boundary test | `convex/boundaries/accounts-sessions-profile.test.ts` |
| Backend operation sequencing not observable through a registered function | Focused operation test | `convex/lib/pipes/delete/operations.test.ts` |
| Feature interaction, accessibility, or visible state | Testing Library feature/component test | `src/components/features/creation/CreateModal.test.tsx` |
| Cache ordering, merge, or persistence policy | Feature-owned store/hook test | `src/components/features/transactions/cache/TransactionCacheStore.test.ts` |
| UI primitive contract | Adjacent primitive test | `src/components/ui/Modal/ModalShell.test.tsx` |

## Selection Rules

- Use the highest existing seam that observes the behavior without testing an
  implementation detail.
- Add lower-level tests only for policy or sequencing that the higher seam
  cannot isolate clearly.
- Avoid repeating pure domain examples in Convex suites. Boundary tests should
  prove wiring, authorization, persistence, and atomic outcomes.
- Mock external or framework boundaries, not repository policy. Prefer
  `convex-test` over calling registered handlers through private `_handler`
  properties when the public boundary is the behavior under test.
- Keep test files organized by behavioral contract. Split a file when distinct
  seams or unrelated policies make the intended test location hard to find, not
  to satisfy a line-count target.

## Commands

Run one file with `bun run test <path>`. After focused tests pass, run
`bun run verify`.
