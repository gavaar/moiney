import type { PipeRule } from "./rules";

type CoverageSource = { capacity: number; spent: number; rule?: PipeRule };
type CoverageDonor = { fed: number; spent: number };

function cents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Coverage requires safe integer cents");
  return value;
}

function demand(source: CoverageSource): number {
  const shortfall = cents(cents(source.spent) - cents(source.capacity));
  return source.rule === "instant_settlement" || source.rule === "self_destruct" ? 0 : Math.max(0, shortfall);
}

function availableFunding(donor: CoverageDonor): number {
  return Math.max(0, cents(cents(donor.fed) - cents(donor.spent)));
}

export function calculateContingencyCoverage(source: CoverageSource, donor: CoverageDonor): number {
  return Math.min(demand(source), availableFunding(donor));
}

export type ContingencyClaim<PipeId extends string> = CoverageSource & { sourceId: PipeId };

/** Caller groups one donor's claims by scheduled occurrence and priority first. */
export function allocateContingencyCoverage<PipeId extends string>(
  claims: readonly ContingencyClaim<PipeId>[], donor: CoverageDonor,
): { sourceId: PipeId; coverageCents: number }[] {
  if (new Set(claims.map(claim => claim.sourceId)).size !== claims.length) throw new Error("Duplicate contingency source");
  let remaining = availableFunding(donor);
  let active = claims.map(claim => ({ sourceId: claim.sourceId, demandCents: demand(claim) }))
    .filter(claim => claim.demandCents > 0)
    .sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  const allocations = new Map<PipeId, number>();

  while (remaining > 0 && active.length > 0) {
    const share = Math.floor(remaining / active.length);
    const capped = active.filter(claim => claim.demandCents <= share);
    if (capped.length > 0) {
      for (const claim of capped) {
        allocations.set(claim.sourceId, claim.demandCents);
        remaining -= claim.demandCents;
      }
      active = active.filter(claim => claim.demandCents > share);
      continue;
    }
    const remainder = remaining % active.length;
    active.forEach((claim, index) => allocations.set(claim.sourceId, share + (index < remainder ? 1 : 0)));
    break;
  }
  return [...allocations].filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([sourceId, coverageCents]) => ({ sourceId, coverageCents }));
}
