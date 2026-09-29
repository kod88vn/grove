import { describe, expect, it } from 'vitest';
import { agentDriftStatus } from '../../../../src/core/model/drift.ts';
import type { Registry } from '../../../../src/core/model/tiers.ts';

const registry: Registry = {
  tiers: [
    { name: 'worker', rank: 1, maxOutputPrice: 150, models: ['GPT-5.6 Luna', 'GPT-6 Luna'] },
    { name: 'oracle', rank: 4, maxOutputPrice: null, models: ['Claude Opus 5.5'] },
  ],
  agents: { 'loop-worker': 'worker' },
  unmanaged: ['probe-astra'],
};

describe('agentDriftStatus', () => {
  it('is ok when the frontmatter model line matches the tier exactly, in order', () => {
    expect(agentDriftStatus(registry, 'loop-worker', ['GPT-5.6 Luna', 'GPT-6 Luna'])).toBe('ok');
  });

  it('is drift when the order differs', () => {
    expect(agentDriftStatus(registry, 'loop-worker', ['GPT-6 Luna', 'GPT-5.6 Luna'])).toBe('drift');
  });

  it('is drift when a model line is missing entirely', () => {
    expect(agentDriftStatus(registry, 'loop-worker', null)).toBe('drift');
  });

  it('is unmanaged for an agent on the unmanaged list, regardless of its model line', () => {
    expect(agentDriftStatus(registry, 'probe-astra', ['GPT-6 Astra'])).toBe('unmanaged');
  });

  it('is unregistered for an agent that is neither managed nor unmanaged', () => {
    expect(agentDriftStatus(registry, 'some-new-agent', ['Whatever'])).toBe('unregistered');
  });
});
