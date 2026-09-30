import { ceilingRank, type Registry, type Tier, type TierName } from './tiers.ts';
import { agentSlug } from './substitute.ts';

/**
 * `code chat` selects an agent file rather than accepting a runtime model override.
 * One file per model lets dispatch choose the exact model for retry or escalation.
 */

export interface EscalationVariant {
  /** Appended to the base agent name and filename. */
  readonly suffix: string;
  readonly tier: TierName;
  readonly models: readonly string[];
}

function eligibleTiers(registry: Registry, agentName: string): Tier[] {
  if (registry.interactive?.includes(agentName) === true || registry.unmanaged.includes(agentName)) {
    return [];
  }
  const baseTierName = registry.agents[agentName];
  if (baseTierName === undefined) return [];
  const ordered = [...registry.tiers].sort((a, b) => a.rank - b.rank);
  const base = ordered.find((tier) => tier.name === baseTierName);
  const ceiling = ceilingRank(registry, agentName) ?? Infinity;
  return base === undefined ? [] : ordered.filter((tier) => tier.rank >= base.rank && tier.rank <= ceiling);
}

/** Returns one single-model variant for every model from this tier up to the agent's ceiling. */
export function singleModelVariants(registry: Registry, agentName: string): EscalationVariant[] {
  return eligibleTiers(registry, agentName).flatMap((tier) => tier.models.map((model) => ({
    suffix: `m-${agentSlug(model)}`,
    tier: tier.name,
    models: [model],
  })));
}
