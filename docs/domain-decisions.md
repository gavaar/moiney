# Domain Decisions

Decision and status index. Canonical contracts live in the linked topic guides;
split decisions link to each owning section rather than repeating their bodies.
Architecture for D010 is owned by engineering principles.

## Status Meanings

| Status | Meaning |
| --- | --- |
| Pending | A decision is still required before implementation |
| Accepted, not implemented | The target behavior is agreed but current code does not yet satisfy it |
| In progress | A migration or implementation is underway and both states may exist |
| Implemented | Code, persisted data, tests, and documentation satisfy the decision |
| Superseded | A later decision replaced this one |

Do not describe an accepted target as current behavior until its status is
Implemented. In particular, D017 remains In progress.

## Decision Index

| ID | Decision And Canonical Contract | Status |
| --- | --- | --- |
| D001 | [Monetary representation](domain/accounting.md#d001-monetary-representation) | Implemented |
| D002 | [Pipe deletion and transaction history](domain/deletion.md#d002-pipe-deletion-and-transaction-history) | Implemented |
| D003 | [Transaction involvement](domain/transactions.md#d003-transaction-involvement) | Implemented |
| D004 | [Username canonicalization](domain/auth.md#d004-username-canonicalization) | Implemented |
| D005 | [Authentication provider](domain/auth.md#d005-authentication-provider) | Pending |
| D006 | [Invited-user account recovery](domain/auth.md#d006-invited-user-account-recovery) | Implemented |
| D008 | [Rule execution and cap update](domain/accounting.md#d008-rule-execution-and-cap-update); [presentation statistics](domain/reporting.md#d008-presentation-statistics) | Implemented |
| D009 | [Transaction identity and grouping](domain/transactions.md#d009-transaction-identity-and-grouping) | Implemented |
| D010 | [Shared domain core architecture](engineering-principles.md#shared-domain-core); [payer eligibility](domain/transactions.md#d010-pay-by-transfer-presentation-eligibility) | Implemented |
| D011 | [Transaction edit history](domain/transactions.md#d011-transaction-edit-history) | Implemented |
| D012 | [Pay-by-transfer liquidity and logical spending](domain/accounting.md#d012-pay-by-transfer-liquidity-and-logical-spending) | Implemented |
| D013 | [Transfer pipe eligibility](domain/transactions.md#d013-transfer-pipe-eligibility) | Implemented |
| D014 | [Transaction snapshot cache](domain/history-cache.md#d014-transaction-snapshot-cache) | Implemented |
| D015 | [Boiler feed pipes](domain/accounting.md#d015-boiler-feed-pipes) | Implemented |
| D016 | [Monthly spending statistics](domain/reporting.md#d016-monthly-spending-statistics) | Implemented |
| D017 | [Transaction structural editing](domain/transactions.md#d017-transaction-structural-editing) | In progress |
| D018 | [Quick creation interaction](domain/transactions.md#d018-quick-transaction-creation); [ranking](domain/history-cache.md#d018-quick-creation-ranking) | Implemented |
| D019 | [Feed list tree-usage ordering](domain/history-cache.md#d019-feed-list-tree-usage-ordering) | Implemented |
| D020 | [Childless root settlement default](domain/accounting.md#d020-childless-root-settlement-default) | Implemented |
