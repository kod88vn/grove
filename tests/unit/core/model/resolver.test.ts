import { describe, expect, it } from 'vitest';
import {
  pick,
  resolveRole,
  resolveTiers,
  type CatalogueModel,
} from '../../../../src/core/model/resolver.ts';
import type { Registry } from '../../../../src/core/model/tiers.ts';

function registry(): Registry {
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

const catalogue: CatalogueModel[] = [
  { name: 'GPT-5.6 Luna', inputPrice: 20, outputPrice: 120 },
  { name: 'GPT-6 Luna', inputPrice: 10, outputPrice: 50 },
  { name: 'Claude Haiku 4.5', inputPrice: 100, outputPrice: 500 },
  { name: 'Gemini 3.6 Flash', inputPrice: 75, outputPrice: 375 },
  { name: 'Claude Sonnet 5', inputPrice: 200, outputPrice: 1000 },
  { name: 'Claude Opus 5.5', inputPrice: 400, outputPrice: 2000 },
  { name: 'Claude Opus 5', inputPrice: 500, outputPrice: 2500 },
];

describe('resolveTiers', () => {
  it('reports every registered model as ok when present and within band', () => {
    const worker = resolveTiers(registry(), catalogue)[0]!;
    expect(worker.registered).toEqual([
      { name: 'GPT-5.6 Luna', status: 'ok', inputPrice: 20, outputPrice: 120 },
      { name: 'GPT-6 Luna', status: 'ok', inputPrice: 10, outputPrice: 50 },
    ]);
  });

  it('reports missing when a registered model is absent from the catalogue', () => {
    const withoutHaiku = catalogue.filter((m) => m.name !== 'Claude Haiku 4.5');
    const dispatcher = resolveTiers(registry(), withoutHaiku)[1]!;
    expect(dispatcher.registered).toEqual([
      { name: 'Claude Haiku 4.5', status: 'missing', inputPrice: null, outputPrice: null },
    ]);
  });

  it('flags a registered model priced over its own tier band', () => {
    const mispriced = registry();
    const tiers = mispriced.tiers.map((t) =>
      t.name === 'worker' ? { ...t, models: [...t.models, 'Claude Sonnet 5'] } : t,
    );
    const worker = resolveTiers({ ...mispriced, tiers }, catalogue)[0]!;
    const sonnet = worker.registered.find((m) => m.name === 'Claude Sonnet 5');
    expect(sonnet).toEqual({ name: 'Claude Sonnet 5', status: 'over-band', inputPrice: 200, outputPrice: 1000 });
  });

  it('never flags oracle models as over-band, since its band is unbounded', () => {
    const oracle = resolveTiers(registry(), catalogue)[3]!;
    expect(oracle.registered.every((m) => m.status === 'ok')).toBe(true);
  });

  it('lists in-band catalogue models not yet registered as candidates', () => {
    const dispatcher = resolveTiers(registry(), catalogue)[1]!;
    expect(dispatcher.candidates).toEqual([{ name: 'Gemini 3.6 Flash', inputPrice: 75, outputPrice: 375 }]);
  });
});

describe('resolveRole', () => {
  it('resolves an agent name to its registered tier', () => {
    expect(resolveRole(registry(), 'loop-worker')).toBe('worker');
  });

  it('resolves a bare tier name to itself', () => {
    expect(resolveRole(registry(), 'oracle')).toBe('oracle');
  });

  it('returns null for a role that is neither a known agent nor a tier', () => {
    expect(resolveRole(registry(), 'nonexistent')).toBeNull();
  });
});

describe('pick', () => {
  it('returns the first registered, catalogue-present model for the base tier', () => {
    expect(pick(registry(), catalogue, 'worker', 0)).toEqual({
      kind: 'model',
      name: 'GPT-5.6 Luna',
      tier: 'worker',
    });
  });

  it('escalates by the requested number of tiers', () => {
    expect(pick(registry(), catalogue, 'worker', 2)).toEqual({
      kind: 'model',
      name: 'Claude Sonnet 5',
      tier: 'architect',
    });
  });

  it('caps escalation at oracle, the highest tier', () => {
    expect(pick(registry(), catalogue, 'worker', 99)).toEqual({
      kind: 'model',
      name: 'Claude Opus 5.5',
      tier: 'oracle',
    });
  });

  it('returns DECIDE with in-band candidates rather than picking an unregistered model', () => {
    const noWorkerModels = catalogue.filter((m) => !m.name.includes('Luna'));
    const result = pick(registry(), noWorkerModels, 'worker', 0);
    expect(result).toEqual({
      kind: 'decide',
      tier: 'worker',
      candidates: [],
    });
  });

  it('lists real in-band candidates in a DECIDE result', () => {
    const noHaiku = catalogue.filter((m) => m.name !== 'Claude Haiku 4.5');
    const result = pick(registry(), noHaiku, 'dispatcher', 0);
    expect(result).toEqual({
      kind: 'decide',
      tier: 'dispatcher',
      candidates: [{ name: 'Gemini 3.6 Flash', inputPrice: 75, outputPrice: 375 }],
    });
  });

  it('falls through to the second registered model when the primary is absent', () => {
    const noLuna56 = catalogue.filter((m) => m.name !== 'GPT-5.6 Luna');
    expect(pick(registry(), noLuna56, 'worker', 0)).toEqual({
      kind: 'model',
      name: 'GPT-6 Luna',
      tier: 'worker',
    });
  });
});
