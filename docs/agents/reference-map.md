# Canonical Reference Map

Use this map after the root task router. Read the named implementation and its
test before introducing another pattern; follow linked contracts for behavior.

| Task | Canonical Implementation | Canonical Test / Contract |
| --- | --- | --- |
| Thin Expo route | `src/app/(main)/(tabs)/history.tsx` | `AGENTS.md` architecture rules |
| Feature screen composition | `src/components/features/statistics/StatisticsScreen/StatisticsScreen.tsx` | Adjacent `StatisticsScreen.test.tsx` |
| Backend-to-feature model normalization | `src/components/features/pipes/data/pipes.ts` | Adjacent `pipes.test.ts` |
| Narrow feature context | `src/components/features/pipes/context/PipeCatalogContext.tsx` | Adjacent `PipeCatalogContext.test.tsx` |
| Pure domain policy plus feature adapter | `domain/transactions/paidFromEligibility.ts` and `src/components/features/pipes/data/paidFromEligibility.ts` | `domain/transactions/paidFromEligibility.test.ts` |
| Registered Convex wrapper and operation | `convex/transactions.ts` and `convex/lib/transactions/operations.ts` | `convex/boundaries/transactions-transfer-history.test.ts` |
| Persisted schema or migration | `convex/schema.ts` and `convex/migrations.ts` | `docs/backend.md` and migration skill |
| Bounded maintenance continuation | `convex/sessions.ts` | `convex/sessions.test.ts` |
| Transaction cache ownership | `src/components/features/transactions/cache/TransactionCacheStore.ts` | Adjacent `TransactionCacheStore.test.ts` and `docs/domain/history-cache.md` |
| Shared input | `src/components/ui/Input/Input.tsx` | `src/components/ui/Input/Input.test.tsx` and `docs/input.md` |
| Shared modal shell | `src/components/ui/Modal/ModalShell.tsx` | Adjacent `ModalShell.test.tsx` and `docs/ui.md` |
| Money parsing and validation | `domain/money/money.ts` | Adjacent `money.test.ts` and `docs/domain/accounting.md` |
| Pipe allocation and reconciliation calculation | `domain/pipes/pipes.ts` | `domain/pipes/pipes.test.ts` |
| Explicit-clock scheduling calculation | `domain/scheduling/scheduling.ts` | Adjacent `scheduling.test.ts` |

The examples show ownership and seam placement, not code to copy verbatim.
Prefer the closest example in the same feature when one exists.
