import type { Registry, TierName } from './tiers.ts';

/** Creates the dot-free suffix used by generated single-model agent files. */
export function agentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Converts a pinned display name to the model id observed in session state. */
export function expectedModelId(name: string): string {
  return `copilot/${name.toLowerCase().replace(/\s+/g, '-')}`;
}

export function verifyModel(pinnedName: string, observed: string | null): 'match' | 'mismatch' | 'unknown' {
  if (observed === null) return 'unknown';
  return observed === expectedModelId(pinnedName) ? 'match' : 'mismatch';
}

/** Selects the first unexcluded model in registry order within one tier. */
export function substitute(registry: Registry, tier: TierName, excluded: readonly string[]): string | null {
  const selected = registry.tiers.find((entry) => entry.name === tier);
  if (selected === undefined) return null;
  return selected.models.find((model) => !excluded.includes(model)) ?? null;
}

/** Returns the next tier by rank, or null at the top of the registry. */
export function nextTier(registry: Registry, tier: TierName): TierName | null {
  const current = registry.tiers.find((entry) => entry.name === tier);
  if (current === undefined) return null;
  return registry.tiers
    .filter((entry) => entry.rank > current.rank)
    .sort((a, b) => a.rank - b.rank)[0]?.name ?? null;
}