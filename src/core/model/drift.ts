import type { Registry } from './tiers.ts';

/**
 * Compares an agent's on-disk `model:` line against what the registry says it should be.
 *
 * This is what `cc models apply --check` gates `npm run verify` on: a hand-edited pin that
 * disagrees with the registry is exactly the failure mode this feature exists to catch, so it
 * must fail the same gate every other change fails.
 */

export type DriftStatus = 'ok' | 'drift' | 'unmanaged' | 'unregistered';

export function agentDriftStatus(
  registry: Registry,
  agentName: string,
  currentModels: readonly string[] | null,
): DriftStatus {
  if (registry.unmanaged.includes(agentName)) {
    return 'unmanaged';
  }
  const tierName = registry.agents[agentName];
  if (tierName === undefined) {
    return 'unregistered';
  }
  const tier = registry.tiers.find((t) => t.name === tierName);
  const expected = tier ? tier.models : [];
  if (currentModels === null) {
    return 'drift';
  }
  const matches = currentModels.length === expected.length && currentModels.every((m, i) => m === expected[i]);
  return matches ? 'ok' : 'drift';
}
