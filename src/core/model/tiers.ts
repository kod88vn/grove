/**
 * The registry (`registry/model-tiers.json`) is the one place model tiers are declared. Every
 * other file — the resolver, the drift checker, `cc models apply` — reads it rather than
 * hardcoding a tier's model list, so a price change or a new model only needs one edit.
 */

export const TIER_NAMES = ['worker', 'dispatcher', 'architect', 'oracle'] as const;
export type TierName = (typeof TIER_NAMES)[number];

export interface Tier {
  readonly name: TierName;
  readonly rank: number;
  /** AIC per 1M output tokens. `null` means unbounded — the oracle tier has no ceiling. */
  readonly maxOutputPrice: number | null;
  readonly models: readonly string[];
}

export interface Registry {
  readonly tiers: readonly Tier[];
  /** Agent name -> tier name, e.g. `{ "loop-worker": "worker" }`. */
  readonly agents: Readonly<Record<string, TierName>>;
  /** Interactive entry agents do not receive generated escalation variants. */
  readonly interactive?: readonly string[];
  /**
   * Agent or tier name -> highest tier it may escalate to. `{ "worker": "worker" }` keeps the
   * worker on cheap models: a referee reject re-specs the work, it does not buy a pricier typist.
   */
  readonly ceilings?: Readonly<Record<string, TierName>>;
  /** Agent names deliberately excluded from `cc models apply` (fixed single-model probes). */
  readonly unmanaged: readonly string[];
}

function isTierName(value: unknown): value is TierName {
  return typeof value === 'string' && (TIER_NAMES as readonly string[]).includes(value);
}

function parseTier(raw: unknown, index: number): Tier {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`registry.tiers[${index}] is not an object`);
  }
  const tier = raw as Record<string, unknown>;
  if (!isTierName(tier.name)) {
    throw new Error(`registry.tiers[${index}].name is not a known tier name`);
  }
  if (typeof tier.rank !== 'number') {
    throw new Error(`registry.tiers[${index}].rank must be a number`);
  }
  if (tier.maxOutputPrice !== null && typeof tier.maxOutputPrice !== 'number') {
    throw new Error(`registry.tiers[${index}].maxOutputPrice must be a number or null`);
  }
  if (!Array.isArray(tier.models) || tier.models.some((m) => typeof m !== 'string')) {
    throw new Error(`registry.tiers[${index}].models must be an array of strings`);
  }
  return {
    name: tier.name,
    rank: tier.rank,
    maxOutputPrice: tier.maxOutputPrice as number | null,
    models: tier.models as string[],
  };
}

function parseAgents(raw: unknown): Readonly<Record<string, TierName>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('registry.agents must be an object mapping agent name to tier name');
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  const agents: Record<string, TierName> = {};
  for (const [agent, tier] of entries) {
    if (typeof tier !== 'string') {
      throw new Error(`registry.agents["${agent}"] must be a tier name string`);
    }
    agents[agent] = tier as TierName;
  }
  return agents;
}

function parseNames(raw: unknown, field: string): readonly string[] {
  if (!Array.isArray(raw) || raw.some((name) => typeof name !== 'string')) {
    throw new Error(`registry.${field} must be an array of strings`);
  }
  return raw as string[];
}

function parseCeilings(raw: unknown): Readonly<Record<string, TierName>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('registry.ceilings must be an object mapping agent name to tier name');
  }
  const ceilings: Record<string, TierName> = {};
  for (const [agent, tier] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTierName(tier)) throw new Error(`registry.ceilings["${agent}"] is not a known tier name`);
    ceilings[agent] = tier;
  }
  return ceilings;
}

/** The highest tier rank a role (agent or tier name) may use, or undefined for no cap. */
export function ceilingRank(registry: Registry, role: string): number | undefined {
  const ceiling = registry.ceilings?.[role] ?? registry.ceilings?.[registry.agents[role] ?? ''];
  return ceiling === undefined ? undefined : registry.tiers.find((t) => t.name === ceiling)?.rank;
}

/** Parses the raw JSON shape into a `Registry`, throwing on any structural mismatch. */
export function parseRegistry(raw: unknown): Registry {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('registry must be an object');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tiers)) {
    throw new Error('registry.tiers must be an array');
  }
  const tiers = obj.tiers.map((t, i) => parseTier(t, i));
  const agents = parseAgents(obj.agents);
  if (!Array.isArray(obj.unmanaged) || obj.unmanaged.some((u) => typeof u !== 'string')) {
    throw new Error('registry.unmanaged must be an array of strings');
  }
  const interactive = obj.interactive === undefined ? {} : { interactive: parseNames(obj.interactive, 'interactive') };
  const ceilings = obj.ceilings === undefined ? {} : { ceilings: parseCeilings(obj.ceilings) };
  return { tiers, agents, ...interactive, ...ceilings, unmanaged: obj.unmanaged as string[] };
}

/**
 * Returns every structural problem with a registry, as human-readable strings. Empty means the
 * registry is safe to apply.
 *
 * The one rule this exists to enforce: **a model must never appear in two tiers.** That is
 * exactly the bug this feature was built to stop — an agent's fallback silently landing on a
 * model from a different, more expensive tier.
 */
export function validateRegistry(registry: Registry): string[] {
  const errors: string[] = [];

  const tierOfModel = new Map<string, string>();
  for (const tier of registry.tiers) {
    for (const model of tier.models) {
      const existing = tierOfModel.get(model);
      if (existing !== undefined && existing !== tier.name) {
        errors.push(`model "${model}" is registered in both "${existing}" and "${tier.name}" tiers`);
      } else {
        tierOfModel.set(model, tier.name);
      }
    }
  }

  const knownTiers = new Set(registry.tiers.map((t) => t.name));
  for (const [agent, tier] of Object.entries(registry.agents)) {
    if (!knownTiers.has(tier)) {
      errors.push(`agent "${agent}" references unknown tier "${tier}"`);
    }
  }

  const ranks = registry.tiers.map((t) => t.rank);
  if (new Set(ranks).size !== ranks.length) {
    errors.push('tier ranks must be unique');
  }

  const rankOf = new Map(registry.tiers.map((t) => [t.name, t.rank] as const));
  for (const [role, ceiling] of Object.entries(registry.ceilings ?? {})) {
    const base = registry.agents[role] ?? (isTierName(role) ? role : undefined);
    if (base === undefined) {
      errors.push(`ceiling for unknown agent or tier "${role}"`);
    } else if ((rankOf.get(ceiling) ?? -Infinity) < (rankOf.get(base) ?? Infinity)) {
      errors.push(`"${role}" has ceiling "${ceiling}" below its tier "${base}"`);
    }
  }

  return errors;
}
