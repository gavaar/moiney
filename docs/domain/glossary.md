# Domain Glossary

Use these terms consistently in code, tests, specifications, and reviews. The
linked domain guides own the complete behavioral contracts.

| Term | Meaning |
| --- | --- |
| Pipe | A node in an owned money-allocation tree. Pipes hold local accounting state and may have children. |
| Root | A pipe without a parent. Each root begins an independent accounting tree. |
| Feed | A root through which external money enters an allocation tree. |
| Boiler | A feed whose current liquidity and cumulative contributed principal are tracked separately. |
| Logical pipe | The `from` pipe whose spending is recorded, even when another pipe supplies or receives liquidity. |
| Payer / `paidFrom` | A pipe outside the logical pipe's tree that supplies liquidity for an expense or receives liquidity for a refund. |
| Feed transaction | A transaction with `to` and no `from`. |
| Expense | A transaction with `from` and no `to`; it may include `paidFrom`. |
| Transfer | A transaction with both `from` and `to`. |
| Settlement | Consolidating a pipe's spending and pending external adjustment into its current balance, then resetting the current spending period. |
| Reconciliation | Reallocating liquidity through affected pipe trees after accounting or topology changes. |
| Pending adjustment | Deferred liquidity effect on a logical pipe from pay-by-transfer activity. |
| Frozen subtree | Pipes participating in an active deletion job and unavailable to conflicting writes. |
| Archived history | Preserved transaction or creation-event presentation after referenced pipes are deleted. |

See [Accounting](accounting.md), [Transactions](transactions.md), and
[Deletion](deletion.md) for the authoritative invariants.
