import type { CatalogueModel } from './catalog.ts';
import { ceilingRank, type Registry, type Tier, type TierName } from './tiers.ts';

export type { CatalogueModel } from './catalog.ts';

/**
 * The read side of the registry: what does the catalogue say about the models we have
 * registered, and — the point of the whole feature — what happens when a role's registered
 * models are all missing or the requester wants a higher tier for a task that raised doubts.
 */

export type ModelStatus = 'ok' | 'missing' | 'over-band';

export interface RegisteredModelReport {
  readonly name: string;
  readonly status: ModelStatus;
  readonly inputPrice: number | null;
  readonly outputPrice: number | null;
}

export interface TierReport {
  readonly tier: TierName;
  readonly registered: readonly RegisteredModelReport[];
  readonly candidates: readonly CatalogueModel[];
}

export type PickResult =
  | { readonly kind: 'model'; readonly name: string; readonly tier: TierName }
  | { readonly kind: 'decide'; readonly tier: TierName; readonly candidates: readonly CatalogueModel[] };

function fitsBand(tier: Tier, model: CatalogueModel): boolean {
  return tier.maxOutputPrice === null || model.outputPrice <= tier.maxOutputPrice;
}

function allRegisteredNames(registry: Registry): Set<string> {
  const names = new Set<string>();
  for (const tier of registry.tiers) {
    for (const model of tier.models) {
      names.add(model);
    }
  }
  return names;
}

function candidatesFor(
  tier: Tier,
  catalogue: readonly CatalogueModel[],
  registered: ReadonlySet<string>,
): CatalogueModel[] {
  return catalogue
    .filter((m) => !registered.has(m.name) && fitsBand(tier, m))
    .sort((a, b) => a.outputPrice - b.outputPrice);
}

function reportFor(
  tier: Tier,
  catalogue: readonly CatalogueModel[],
  registered: ReadonlySet<string>,
): TierReport {
  const byName = new Map(catalogue.map((m) => [m.name, m] as const));
  const registeredReports = tier.models.map((name): RegisteredModelReport => {
    const found = byName.get(name);
    if (found === undefined) {
      return { name, status: 'missing', inputPrice: null, outputPrice: null };
    }
    const status: ModelStatus = fitsBand(tier, found) ? 'ok' : 'over-band';
    return { name, status, inputPrice: found.inputPrice, outputPrice: found.outputPrice };
  });
  return { tier: tier.name, registered: registeredReports, candidates: candidatesFor(tier, catalogue, registered) };
}

/** For every tier in registry order: which registered models are ok/missing/over-band, and what unregistered catalogue models would fit. */
export function resolveTiers(registry: Registry, catalogue: readonly CatalogueModel[]): TierReport[] {
  const registered = allRegisteredNames(registry);
  return registry.tiers.map((tier) => reportFor(tier, catalogue, registered));
}

/** Resolves an agent name to its registered tier, or accepts a bare tier name. Null if neither. */
export function resolveRole(registry: Registry, role: string): TierName | null {
  const viaAgent = registry.agents[role];
  if (viaAgent !== undefined) {
    return viaAgent;
  }
  const viaTier = registry.tiers.find((t) => t.name === role);
  return viaTier ? viaTier.name : null;
}

function tiersByRank(registry: Registry): Tier[] {
  return [...registry.tiers].sort((a, b) => a.rank - b.rank);
}

/**
 * Picks the model to use for a role, escalating `escalate` tiers up from its base tier and
 * capping at the role's registry ceiling, else at the highest tier (oracle).
 *
 * Falls through a tier's registered models in order before giving up. If none of them are in
 * the catalogue, returns a `decide` result with in-band, unregistered candidates rather than
 * silently reaching for a model nobody registered.
 */
export function pick(
  registry: Registry,
  catalogue: readonly CatalogueModel[],
  role: string,
  escalate: number,
): PickResult {
  const baseTier = resolveRole(registry, role);
  if (baseTier === null) {
    throw new Error(`unknown role: ${role}`);
  }
  const ordered = tiersByRank(registry);
  const baseIndex = ordered.findIndex((t) => t.name === baseTier);
  const ceiling = ceilingRank(registry, role) ?? Infinity;
  const topIndex = ordered.filter((t) => t.rank <= ceiling).length - 1;
  const targetIndex = Math.max(baseIndex, Math.min(baseIndex + escalate, topIndex));
  const tier = ordered[targetIndex];
  if (tier === undefined) {
    throw new Error(`registry has no tiers to pick from`);
  }

  const byName = new Map(catalogue.map((m) => [m.name, m] as const));
  for (const name of tier.models) {
    if (byName.has(name)) {
      return { kind: 'model', name, tier: tier.name };
    }
  }

  const registered = allRegisteredNames(registry);
  return { kind: 'decide', tier: tier.name, candidates: candidatesFor(tier, catalogue, registered) };
}
