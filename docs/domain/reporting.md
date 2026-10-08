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

Pipe detail bars show fed, expected when nonzero, contributed principal for
boilers when nonzero, and spent unless the rule settles instantly. Operational
capacity is not shown as a bar. The non-boiler "Remaining expected" statistic
is `expected - spent`: it compares the monthly target to spending tracked since
the last settlement, not to available liquidity or historical carry-over
capacity. Pipes without a cap update still use current capacity as their
expected fallback. Boilers omit this statistic under the
[boiler exception](accounting.md#d015-boiler-feed-pipes). Average daily spending
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
The Pipes root bar view displays a live, unsaved report for the current UTC
month; Statistics lists only captured months. Both use the same spending summary
calculation. The [event reporting contract](events.md#reporting-and-usage-ranking)
preserves these metrics during reader cutover. Live Volume and Produced reflect current root balances;
captured values reflect balances at capture time. At 00:00 UTC the live report
switches months; the closed month appears in Statistics only after capture.
The live report subscription remains mounted above the tabs so navigation among
Pipes, History, and the full live report does not restart pagination. It remains
reactive to relevant event and pipe changes while the signed-in tabs are
mounted, including when another tab is visible.

Negative expenses contribute their absolute value to gross spending; positive
expenses contribute to refunds. Pay-by-transfer counts once through its logical
expense identity. Feeds and transfers do not contribute to expenditure. Feeds,
which have only a `to` role, contribute their value to total income; transfers do
not. Summaries store total income, gross spending, refunds, spending and refund
transaction counts, and the largest spending transaction in integer cents.
Total outcome is gross spending minus refunds. Averages and comparisons are
derived when read, not persisted.
Summary cards emphasize Net change: income minus (gross spending minus refunds).
Their separate Income, Outcome, and Refunds figures show income, gross spending,
and refunds respectively. Missing legacy income makes income and net change
unavailable, not zero. Positive net change uses muted primary, negative uses muted
error, and zero is neutral.
New reports also freeze the titles and amounts of the three largest individual
expenses (ties count as separate transactions). Older reports without titles
retain their amount-only ranking. The live and captured cards and details show
the most repeated expense title in the UTC month, counting refunds as occurrences and
subtracting them from that title's total spent. Titles use the canonical
trimmed lowercase identity across pipes; at least two occurrences are needed.
Count wins ties, then net spending, then title. A month with no repeats shows
none; older captures without this metric show it as unavailable. Older captures
without second and third expense values show only the largest amount.

Both live and captured reports rank up to three biggest offenders account-wide:
existing non-root leaves whose monthly net logical-source expense exceeds their
expenditure ceiling `max(capacity, 0)` in cents. Negative capacity represents
debt, not extra overspending; a debt pipe uses a zero ceiling. Net expense
includes refunds, counts a pay-by-transfer expense once against its `from` pipe
(not `paidFrom`), and excludes feeds and
transfers. The excess is net expense minus that ceiling at calculation time;
`capUpdateValue` and cron normalization do not set this ceiling. Rank by excess,
then net expense, then name and pipe ID. The summary card shows the first entry;
detail shows up to three with net expense, capacity, and excess. Cards and detail
show the current pipe icon only while that pipe still exists. When no leaf
exceeds its ceiling, report no offenders. Deleted leaves cannot rank at capture;
the capture freezes offender names, amounts, and ranks. Historical snapshots
without offender data retain an unavailable ranking rather than being rebuilt.

Each new summary freezes two account-wide root values at capture time. Volume
is the sum of `fed - spent` across root feeds and boilers. Produced is the sum of
`(contributedFed ?? fed) - spent` across those roots. Descendants are excluded to
avoid double-counting allocated liquidity. These fields remain optional on
persisted rows because historical snapshots cannot accurately be reconstructed
and are not backfilled. Total income is optional for the same reason on rows
captured before its addition.

The first successful capture is immutable. Subsequent transaction creation,
editing, movement, or deletion does not restate a captured month. User and event
traversal is paginated; `(userId, periodStart)` is the logical identity providing
retry idempotency. During coexistence, already-scheduled transaction capture
continuations retain their original stream; each continuation stops if another
capture chain has already frozen that month.

Authenticated users can read their newest 24 summaries and open an exact owned
month. Reports derive net spending as gross spending minus refunds. Average
spending divides gross spending by spending transaction count, rounds to the
nearest integer cent, and is zero when there are no spending transactions.
