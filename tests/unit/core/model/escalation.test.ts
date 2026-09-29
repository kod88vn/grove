import { describe, expect, it } from 'vitest';
import { escalationVariants } from '../../../../src/core/model/escalation.ts';
import type { Registry } from '../../../../src/core/model/tiers.ts';

function registry(): Registry {
  return {
    tiers: [
      { name: 'worker', rank: 1, maxOutputPrice: 150, models: ['GPT-5.6 Luna'] },
      { name: 'dispatcher', rank: 2, maxOutputPrice: 500, models: ['Claude Haiku 4.5'] },
      { name: 'architect', rank: 3, maxOutputPrice: 1200, models: ['Claude Sonnet 5'] },
      { name: 'oracle', rank: 4, maxOutputPrice: null, models: ['Claude Opus 5.5'] },
    ],
    agents: { 'loop-worker': 'worker', 'loop-judge': 'oracle' },
    unmanaged: [],
  };
}

describe('escalationVariants', () => {
  it('lists one variant per tier above the base tier, capped at oracle', () => {
    expect(escalationVariants(registry(), 'loop-worker')).toEqual([
      { suffix: 't2', tier: 'dispatcher', models: ['Claude Haiku 4.5'] },
      { suffix: 't3', tier: 'architect', models: ['Claude Sonnet 5'] },
      { suffix: 't4', tier: 'oracle', models: ['Claude Opus 5.5'] },
    ]);
  });

  it('returns no variants for an agent already at the top tier', () => {
    expect(escalationVariants(registry(), 'loop-judge')).toEqual([]);
  });

  it('returns no variants for an unmanaged or unknown agent', () => {
    expect(escalationVariants(registry(), 'probe-astra')).toEqual([]);
  });
});
