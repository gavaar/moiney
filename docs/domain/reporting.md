# Reporting

Canonical reporting contracts. See the [decision index and status meanings](../domain-decisions.md#status-meanings),
[accounting](accounting.md), and [transaction identity and edits](transactions.md).

## D008: Presentation Statistics

Status: Implemented

[D008 execution](accounting.md#d008-rule-execution-and-cap-update) owns rule
settlement; this section owns derived pipe-detail statistics.

`expected` shows the monthly spending target from the next rule configuration.
A leaf uses `capUpdateValue`, falling back to current `capacity`. Daily, monthly,
and yearly cron values normalize to monthly integer cents using the current
month and cron interval, rounding fractional cents to the nearest cent. A pipe
with children sums each immediate child's normalized `capUpdateValue` or
fallback capacity. This does not calculate post-rule capacity or include prior
cycle leftover fed.

Left to spend is `capacity - spent`, except for the
[boiler omission](accounting.md#d015-boiler-feed-pipes). Average daily spending
divides current-month spending by current day-of-month. Accumulated spendable
value through today is `expected / daysInMonth * currentDay - spent`, rounded
only at the integer-cent formatting boundary. If negative and daily expected is
positive, detail states how many whole days the precise value needs to become
positive. If that exceeds days remaining in the month, or daily expected cannot
increase it, detail advises against further spending from that pipe this month.
The separate L2S and external settlement presentation is defined by
[D012](accounting.md#d012-pay-by-transfer-liquidity-and-logical-spending).

## D016: Monthly Spending Statistics

Status: Implemented

At 05:00 UTC on each month's first day, a bounded scheduled job captures one
frozen summary per user for the previous UTC calendar month, with inclusive
start and exclusive end. Users without qualifying activity receive zero-valued
rows so retries cannot change an originally empty snapshot.

Negative expenses contribute their absolute value to gross spending; positive
expenses contribute to refunds. Pay-by-transfer counts once through its logical
expense identity. Feeds and transfers do not contribute to expenditure. Feeds,
which have only a `to` role, contribute their value to total income; transfers do
not. Summaries store total income, gross spending, refunds, spending and refund
transaction counts, and the largest spending transaction in integer cents.
Total outcome is gross spending minus refunds. Averages and comparisons are
derived when read, not persisted.

Each new summary freezes two account-wide root values at capture time. Volume
is the sum of `fed - spent` across root feeds and boilers. Produced is the sum of
`(contributedFed ?? fed) - spent` across those roots. Descendants are excluded to
avoid double-counting allocated liquidity. These fields remain optional on
persisted rows because historical snapshots cannot accurately be reconstructed
and are not backfilled. Total income is optional for the same reason on rows
captured before its addition.

The first successful capture is immutable. Subsequent transaction creation,
editing, movement, or deletion does not restate a captured month. User and
transaction traversal is paginated; `(userId, periodStart)` is the logical
identity providing retry idempotency.

Authenticated users can read their newest 24 summaries and open an exact owned
month. Reports derive net spending as gross spending minus refunds. Average
spending divides gross spending by spending transaction count, rounds to the
nearest integer cent, and is zero when there are no spending transactions.
