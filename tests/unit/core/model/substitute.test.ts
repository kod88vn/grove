import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { singleModelVariants } from '../../../../src/core/model/escalation.ts';
import { agentSlug, expectedModelId, nextTier, substitute, verifyModel } from '../../../../src/core/model/substitute.ts';
import { parseRegistry } from '../../../../src/core/model/tiers.ts';

const registry = parseRegistry(JSON.parse(readFileSync(new URL('../../../../registry/model-tiers.json', import.meta.url), 'utf8')));

describe('single-model agent variants', () => {
  it('keeps tier rank and model order, with one pinned model and a dot-free name per variant', () => {
    const variants = singleModelVariants(registry, 'loop-worker');
    expect(variants.map(({ suffix }) => suffix)).toEqual([
      'm-gpt-6-luna', 'm-gpt-5-6-luna', 'm-gemini-3-8-flash',
      'm-gpt-6-sol', 'm-gpt-5-6-terra', 'm-claude-opus-5-5', 'm-gpt-6-astra',
    ]);
    expect(variants.every(({ suffix, models }) => !suffix.includes('.') && models.length === 1)).toBe(true);
    expect(variants.map(({ tier }) => tier)).toEqual([
      'worker', 'worker', 'dispatcher', 'architect', 'architect', 'oracle', 'oracle',
    ]);
    expect(singleModelVariants(registry, 'loop-architect')).toHaveLength(4);
    expect(singleModelVariants(registry, 'loop-judge')).toHaveLength(2);
    expect(singleModelVariants(registry, 'loop-analyst')).toEqual([]);
    expect(singleModelVariants(registry, 'probe-astra')).toEqual([]);
    expect(singleModelVariants(registry, 'unregistered')).toEqual([]);
  });
});

describe('pure model substitution and verification', () => {
  it('turns punctuation and whitespace into dot-free, lowercase slugs', () => {
    expect(agentSlug('  GPT-5.6 Luna!! ')).toBe('gpt-5-6-luna');
    expect(agentSlug('Gemini 3.8 Flash')).toBe('gemini-3-8-flash');
  });

  it.each([
    ['GPT-6 Luna', 'copilot/gpt-6-luna'],
    ['Gemini 3.8 Flash', 'copilot/gemini-3.8-flash'],
    ['Claude Opus 5.5', 'copilot/claude-opus-5.5'],
  ])('maps pinned name %s to the observed model ID', (name, modelId) => {
    expect(expectedModelId(name)).toBe(modelId);
    expect(verifyModel(name, modelId)).toBe('match');
  });

  it('flags silent fallback to a different model; missing observation is unknown', () => {
    expect(verifyModel('GPT-6 Luna', 'copilot/gemini-3.8-flash')).toBe('mismatch');
    expect(verifyModel('GPT-6 Luna', null)).toBe('unknown');
  });

  it('selects the next non-excluded model only inside the requested tier', () => {
    expect(substitute(registry, 'worker', ['GPT-5.6 Luna'])).toBe('GPT-6 Luna');
    expect(substitute(registry, 'worker', ['GPT-5.6 Luna', 'GPT-6 Luna'])).toBeNull();
    expect(substitute(registry, 'architect', [])).toBe('GPT-6 Sol');
  });

  it('advances in rank order and stops at the last tier', () => {
    expect(nextTier(registry, 'worker')).toBe('dispatcher');
    expect(nextTier(registry, 'oracle')).toBeNull();
  });
});