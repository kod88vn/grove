import { describe, expect, it } from 'vitest';
import { parseRegistry, validateRegistry, type Registry } from '../../../../src/core/model/tiers.ts';

function validRegistry(): Registry {
  return {
    tiers: [
      { name: 'worker', rank: 1, maxOutputPrice: 150, models: ['GPT-5.6 Luna', 'GPT-6 Luna'] },
      { name: 'dispatcher', rank: 2, maxOutputPrice: 500, models: ['Claude Haiku 4.5'] },
      { name: 'architect', rank: 3, maxOutputPrice: 1200, models: ['Claude Sonnet 5'] },
      { name: 'oracle', rank: 4, maxOutputPrice: null, models: ['Claude Opus 5.5', 'Claude Opus 5'] },
    ],
    agents: { 'loop-worker': 'worker', 'loop-architect': 'architect', 'loop-judge': 'oracle' },
    unmanaged: ['probe-astra'],
  };
}

describe('parseRegistry', () => {
  it('parses a structurally valid registry object', () => {
    const raw = validRegistry();
    expect(parseRegistry(raw)).toEqual(raw);
  });

  it('throws when tiers is not an array', () => {
    expect(() => parseRegistry({ ...validRegistry(), tiers: 'nope' })).toThrow();
  });

  it('throws when a tier is missing its models array', () => {
    const raw = validRegistry();
    const tiers = raw.tiers.map((t) => (t.name === 'worker' ? { name: t.name, rank: t.rank } : t));
    expect(() => parseRegistry({ ...raw, tiers })).toThrow();
  });

  it('throws when agents is not an object', () => {
    expect(() => parseRegistry({ ...validRegistry(), agents: [] })).toThrow();
  });
});

describe('validateRegistry', () => {
  it('accepts a registry with no cross-tier duplicates', () => {
    expect(validateRegistry(validRegistry())).toEqual([]);
  });

  it('rejects a model registered in two tiers — fallbacks must never cross tiers', () => {
    const registry = validRegistry();
    const tiers = registry.tiers.map((t) =>
      t.name === 'architect' ? { ...t, models: [...t.models, 'Claude Opus 5.5'] } : t,
    );
    const errors = validateRegistry({ ...registry, tiers });
    expect(errors.some((e) => e.includes('Claude Opus 5.5'))).toBe(true);
  });

  it('rejects an agents entry that references an unknown tier', () => {
    const registry = validRegistry();
    const errors = validateRegistry({
      ...registry,
      agents: { ...registry.agents, 'ghost-agent': 'legend' as never },
    });
    expect(errors.some((e) => e.includes('ghost-agent'))).toBe(true);
  });

  it('rejects duplicate or out-of-order tier ranks', () => {
    const registry = validRegistry();
    const tiers = registry.tiers.map((t) => (t.name === 'dispatcher' ? { ...t, rank: 1 } : t));
    const errors = validateRegistry({ ...registry, tiers });
    expect(errors.length).toBeGreaterThan(0);
  });
});
