import { allocateContingencyCoverage, calculateContingencyCoverage, prepareContingencyEligibility } from "@domain/pipes";
import type { PipeModel } from "./pipes";

export function prepareContingencyPreview(pipes: readonly PipeModel[]) {
  const byId = new Map(pipes.map(pipe => [pipe.id, pipe]));
  const children = new Map<PipeModel["id"], PipeModel[]>();
  for (const pipe of pipes) {
    if (pipe.parentId === undefined) continue;
    const siblings = children.get(pipe.parentId) ?? [];
    siblings.push(pipe);
    children.set(pipe.parentId, siblings);
  }
  // Settlement reconciles the entire accounting tree, including sibling branches.
  const frozen = new Set<PipeModel["id"]>();
  for (const root of pipes.filter(pipe => pipe.parentId === undefined)) {
    const tree = [root];
    for (let index = 0; index < tree.length; index++) {
      tree.push(...(children.get(tree[index].id) ?? []));
    }
    if (tree.some(pipe => pipe.deletionJobId !== undefined)) {
      for (const pipe of tree) frozen.add(pipe.id);
    }
  }
  const eligible = prepareContingencyEligibility(pipes.map(pipe => ({
    id: pipe.id,
    parentId: pipe.parentId,
    rule: pipe.rule,
    contingencyPipeId: pipe.contingencyPipeId,
    blocked: pipe.deletionJobId !== undefined || frozen.has(pipe.id),
  })));
  const forSource = (sourceId: PipeModel["id"]) => {
    const source = byId.get(sourceId);
    const donor = source?.contingencyPipeId ? byId.get(source.contingencyPipeId) : undefined;
    if (!source || !donor || !eligible(sourceId).includes(donor.id)) return undefined;
    return { donor, amountCents: calculateContingencyCoverage(source, donor) };
  };
  const forDonor = (donorId: PipeModel["id"]) => {
    const donor = byId.get(donorId);
    if (!donor) return undefined;
    const sources = pipes.filter(source => source.contingencyPipeId === donorId && eligible(source.id).includes(donorId));
    if (sources.length === 0) return undefined;
    // Model all eligible sources settling now against one shared pool, not separate promises.
    const allocations = allocateContingencyCoverage(sources.map(source => ({
      sourceId: source.id, capacity: source.capacity, spent: source.spent, rule: source.rule,
    })), donor);
    return { sources, amountCents: allocations.reduce((sum, allocation) => sum + allocation.coverageCents, 0) };
  };
  return { forSource, forDonor };
}
