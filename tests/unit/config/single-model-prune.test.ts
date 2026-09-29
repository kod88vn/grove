import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelsApply } from '../../../src/config/run-models.ts';

const registryPath = new URL('../../../registry/model-tiers.json', import.meta.url);
const agentsRoot = new URL('../../../.github/agents/', import.meta.url);
const agents = ['loop-worker', 'loop-architect', 'loop-judge', 'loop-analyst'];
const scratch: string[] = [];

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cc-single-model-prune-'));
  scratch.push(dir);
  mkdirSync(join(dir, 'registry'));
  mkdirSync(join(dir, '.github/agents'), { recursive: true });
  writeFileSync(join(dir, 'registry/model-tiers.json'), readFileSync(registryPath));
  for (const agent of agents) {
    writeFileSync(join(dir, `.github/agents/${agent}.agent.md`), readFileSync(new URL(`${agent}.agent.md`, agentsRoot)));
  }
  return dir;
}

function variants(dir: string): string[] {
  return readdirSync(join(dir, '.github/agents')).filter((file) => file.includes('.m-'));
}

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('models apply — single-model pruning', () => {
  it('flags and removes a stale variant whose pin no longer exists', () => {
    const dir = repo();
    expect(modelsApply(dir, false)).toBe(0);
    const original = join(dir, '.github/agents/loop-worker.m-gpt-6-luna.agent.md');
    const stale = join(dir, '.github/agents/loop-worker.m-gpt-4-bogus.agent.md');
    writeFileSync(stale, readFileSync(original, 'utf8').replace('GPT-6 Luna', 'GPT-4 Bogus'));
    expect(modelsApply(dir, true)).toBe(1);
    expect(modelsApply(dir, false)).toBe(0);
    expect(existsSync(stale)).toBe(false);
    expect(modelsApply(dir, true)).toBe(0);
  });

  it('removes only the obsolete worker variant when its model leaves the registry', () => {
    const dir = repo();
    expect(modelsApply(dir, false)).toBe(0);
    const registryFile = join(dir, 'registry/model-tiers.json');
    const registry = JSON.parse(readFileSync(registryFile, 'utf8')) as {
      tiers: { name: string; models: string[] }[];
    };
    const worker = registry.tiers.find((tier) => tier.name === 'worker');
    if (worker === undefined) throw new Error('worker tier missing from fixture');
    worker.models = worker.models.filter((model) => model !== 'GPT-6 Luna');
    writeFileSync(registryFile, JSON.stringify(registry));
    expect(modelsApply(dir, true)).toBe(1);
    expect(modelsApply(dir, false)).toBe(0);
    expect(existsSync(join(dir, '.github/agents/loop-worker.m-gpt-6-luna.agent.md'))).toBe(false);
    expect(variants(dir)).toHaveLength(12);
    for (const file of ['loop-worker.agent.md', 'loop-worker.t2.agent.md']) {
      expect(existsSync(join(dir, '.github/agents', file))).toBe(true);
    }
    for (const name of ['loop-architect']) {
      expect(variants(dir).some((file) => file.startsWith(`${name}.m-`))).toBe(true);
      expect(readdirSync(join(dir, '.github/agents')).some((file) => file.startsWith(`${name}.t`))).toBe(true);
    }
    expect(modelsApply(dir, true)).toBe(0);
  });

  it('pins every generated variant to exactly one registered model', () => {
    const dir = repo();
    expect(modelsApply(dir, false)).toBe(0);
    const registry = JSON.parse(readFileSync(join(dir, 'registry/model-tiers.json'), 'utf8')) as {
      tiers: { models: string[] }[];
    };
    const allowed = new Set(registry.tiers.flatMap((tier) => tier.models));
    expect(variants(dir)).toHaveLength(13);
    for (const file of variants(dir)) {
      const content = readFileSync(join(dir, '.github/agents', file), 'utf8');
      const matches = [...content.matchAll(/^model: \["([^"]+)"\]$/gm)];
      expect(matches).toHaveLength(1);
      expect(matches.map((match) => allowed.has(match[1] ?? ''))).toEqual([true]);
    }
  });

  it('does not prune foreign agent names sharing the worker prefix', () => {
    const dir = repo();
    expect(modelsApply(dir, false)).toBe(0);
    const foreign = join(dir, '.github/agents/loop-workerx.m-foo.agent.md');
    writeFileSync(foreign, 'foreign agent');
    expect(modelsApply(dir, false)).toBe(0);
    expect(existsSync(foreign)).toBe(true);
  });
});