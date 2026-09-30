import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelsApply } from '../../../src/config/run-models.ts';

const registry = JSON.parse(readFileSync(new URL('../../../registry/model-tiers.json', import.meta.url), 'utf8')) as unknown;
const root = new URL('../../../.github/agents/', import.meta.url);
const agents = ['loop-worker', 'loop-architect', 'loop-judge', 'loop-analyst'];
const scratch: string[] = [];

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cc-single-model-'));
  scratch.push(dir);
  mkdirSync(join(dir, 'registry'));
  mkdirSync(join(dir, '.github/agents'), { recursive: true });
  writeFileSync(join(dir, 'registry/model-tiers.json'), JSON.stringify(registry));
  for (const agent of agents) {
    writeFileSync(join(dir, `.github/agents/${agent}.agent.md`), readFileSync(new URL(`${agent}.agent.md`, root)));
  }
  return dir;
}

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('models apply — single-model variants', () => {
  it('generates exactly eight dot-free, single-model agent files and checks their drift', () => {
    const dir = repo();
    expect(modelsApply(dir, true)).toBe(1);
    expect(modelsApply(dir, false)).toBe(0);
    expect(modelsApply(dir, true)).toBe(0);
    const files = readdirSync(join(dir, '.github/agents')).filter((name) => name.includes('.m-'));
    expect(files).toHaveLength(8);
    expect(files.filter((name) => name.startsWith('loop-worker.'))).toHaveLength(2);
    expect(files.filter((name) => name.startsWith('loop-architect.'))).toHaveLength(4);
    expect(files.filter((name) => name.startsWith('loop-judge.'))).toHaveLength(2);
    expect(files.some((name) => name.startsWith('loop-analyst.'))).toBe(false);
    for (const file of files) {
      const agentName = file.replace(/\.agent\.md$/, '');
      const content = readFileSync(join(dir, '.github/agents', file), 'utf8');
      expect(agentName.slice(agentName.indexOf('.m-') + 1)).not.toContain('.');
      expect(content).toContain(`name: ${agentName}\n`);
      expect(content.match(/^model: \["[^"]+"\]$/m)).not.toBeNull();
    }
    const variant = join(dir, '.github/agents/loop-worker.m-gpt-6-luna.agent.md');
    const original = readFileSync(variant, 'utf8');
    expect(original).toContain('model: ["GPT-6 Luna"]');
    expect(original).toContain('You are the worker in a verified loop.');
    writeFileSync(variant, original.replace('GPT-6 Luna', 'Gemini 3.8 Flash'));
    expect(modelsApply(dir, true)).toBe(1);
    expect(readFileSync(variant, 'utf8')).toContain('model: ["Gemini 3.8 Flash"]');
    expect(modelsApply(dir, false)).toBe(0);
    expect(modelsApply(dir, true)).toBe(0);
    expect(readFileSync(variant, 'utf8')).toBe(original);
  });
});