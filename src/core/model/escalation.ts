import type { Registry, Tier, TierName } from './tiers.ts';
import { agentSlug } from './substitute.ts';

/**
 * `code chat --help` (verified 2026-09-29) has no model flag — only `-m/--mode`, which selects
 * an *agent file*, not a model. So a headless worker cannot be escalated with a runtime flag;
 * escalating it means dispatching a different, higher-tier agent file instead. This computes
 * which variant files a managed agent needs, purely from the registry (no hardcoded agent
 * names), so any future headless agent gets the same treatment for free.
 */

export interface EscalationVariant {
  /** Appended to the base agent name and filename, e.g. "t2" for `loop-worker.t2.agent.md`. */
  readonly suffix: string;
  readonly tier: TierName;
  readonly models: readonly string[];
}

/** One variant per tier strictly above the agent's base tier, in ascending rank order, capped at oracle. */
export function escalationVariants(registry: Registry, agentName: string): EscalationVariant[] {
  const ordered = eligibleTiers(registry, agentName);
  const baseTierName = registry.agents[agentName];
  const baseIndex = ordered.findIndex((t) => t.name === baseTierName);
  return ordered.slice(baseIndex + 1).map((tier: Tier): EscalationVariant => ({
    suffix: `t${tier.rank}`,
    tier: tier.name,
    models: tier.models,
  }));
}

function eligibleTiers(registry: Registry, agentName: string): Tier[] {
  if (registry.interactive?.includes(agentName) === true || registry.unmanaged.includes(agentName)) {
    return [];
  }
  const baseTierName = registry.agents[agentName];
  if (baseTierName === undefined) return [];
  const ordered = [...registry.tiers].sort((a, b) => a.rank - b.rank);
  const base = ordered.find((tier) => tier.name === baseTierName);
  return base === undefined ? [] : ordered.filter((tier) => tier.rank >= base.rank);
}

/** Returns one single-model variant for every model in this and higher tiers. */
export function singleModelVariants(registry: Registry, agentName: string): EscalationVariant[] {
  return eligibleTiers(registry, agentName).flatMap((tier) => tier.models.map((model) => ({
    suffix: `m-${agentSlug(model)}`,
    tier: tier.name,
    models: [model],
  })));
}
