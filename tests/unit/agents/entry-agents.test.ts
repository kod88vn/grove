import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { modelsCommand } from '../../../src/config/models-command.ts';
import { escalationVariants, singleModelVariants } from '../../../src/core/model/escalation.ts';
import { resolveSelf } from '../../../src/core/model/self.ts';
import { parseRegistry } from '../../../src/core/model/tiers.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const CATALOG = join(ROOT, 'tests/fixtures/models/catalog.json');
const REGISTRY = join(ROOT, 'registry/model-tiers.json');
const AGENTS = join(ROOT, '.github/agents');
const scratch: string[] = [];

afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
});

function session(records: readonly unknown[]): string {
  const folder = mkdtempSync(join(tmpdir(), 'cc-session-'));
  scratch.push(folder);
  const store = join(folder, 'workspaceStorage', 'workspace');
  const log = join(store, 'GitHub.copilot-chat', 'debug-logs', 'session-id');
  mkdirSync(log, { recursive: true });
  mkdirSync(join(store, 'chatSessions'), { recursive: true });
  writeFileSync(join(store, 'chatSessions', 'session-id.jsonl'), records.map((r) => JSON.stringify(r)).join('\n'));
  return log;
}

function self(log: string, tier = 'dispatcher'): { code: number; lines: string[] } {
  const lines: string[] = [];
  const code = modelsCommand(
    ['self', `--session-log=${log}`, `--tier=${tier}`, `--catalog=${CATALOG}`],
    { repoRoot: ROOT, write: (line) => lines.push(line) },
  );
  return { code, lines };
}

function priceCatalog(): string {
  const folder = mkdtempSync(join(tmpdir(), 'cc-price-band-'));
  scratch.push(folder);
  const path = join(folder, 'models.json');
  const models = JSON.parse(readFileSync(CATALOG, 'utf8')) as Array<Record<string, unknown>>;
  models.push(
    { id: 'claude-opus-5', name: 'Claude Opus 5', billing: { token_prices: {
      input_price: 500_000_000_000, output_price: 2_500_000_000_000,
    } } },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', billing: { token_prices: {
      input_price: 75_000_000_000, output_price: 450_000_000_000,
    } } },
  );
  writeFileSync(path, JSON.stringify(models));
  return path;
}

function pricedSelf(modelId: string): { code: number; lines: string[] } {
  const lines: string[] = [];
  const log = session([{ kind: 0, v: { requests: [{ modelId }] } }]);
  const code = modelsCommand(
    ['self', `--session-log=${log}`, '--tier=dispatcher', `--catalog=${priceCatalog()}`],
    { repoRoot: ROOT, write: (line) => lines.push(line) },
  );
  return { code, lines };
}

describe('models self — selected model, not backend-served model', () => {
  it('folds root, set and append records, using the latest request and warning on a higher tier', () => {
    const log = session([
      { kind: 0, v: { requests: [{ modelId: 'copilot/gemini-3.8-flash' }] } },
      { kind: 2, k: ['requests'], v: [{ modelId: 'copilot/gpt-6-sol' }] },
      { kind: 1, k: ['requests', 1, 'modelId'], v: 'copilot/claude-opus-5.5' },
    ]);
    const result = self(log);
    expect(result.code).toBe(0);
    expect(result.lines.join('\n')).toMatch(/selected model.*Claude Opus 5\.5/i);
    expect(result.lines.join('\n')).toMatch(/oracle.*dispatcher|dispatcher.*oracle/i);
    expect(result.lines.join('\n')).toMatch(/Gemini 3\.8 Flash/);
    expect(result.lines.join('\n')).toMatch(/warn/i);
  });

  it.each(['copilot/auto', 'copilot/not-in-the-catalogue'])('%s reports unknown cost and a recommendation', (modelId) => {
    const result = self(session([{ kind: 0, v: { requests: [] } }, {
      kind: 2, k: ['requests'], v: [{ modelId }],
    }]));
    expect(result.code).toBe(0);
    expect(result.lines.join('\n')).toMatch(/unknown/i);
    expect(result.lines.join('\n')).toContain('Gemini 3.8 Flash');
  });

  it('fails explicitly if the matching persisted session cannot be found', () => {
    const result = self(session([]));
    expect(result.code).not.toBe(0);
  });

  it('warns when the selected model costs more than its own tier ceiling', () => {
    const folder = mkdtempSync(join(tmpdir(), 'cc-prices-'));
    scratch.push(folder);
    const catalog = join(folder, 'models.json');
    const models = JSON.parse(readFileSync(CATALOG, 'utf8')) as Array<Record<string, unknown>>;
    const luna = models.find((model) => model.id === 'gpt-5.6-luna');
    if (luna === undefined) throw new Error('missing fixture model');
    luna.billing = { token_prices: { input_price: 20_000_000_000, output_price: 900_000_000_000 } };
    writeFileSync(catalog, JSON.stringify(models));
    const lines: string[] = [];
    const code = modelsCommand([
      'self', `--session-log=${session([{ kind: 0, v: { requests: [{ modelId: 'copilot/gpt-5.6-luna' }] } }])}`,
      '--tier=worker', `--catalog=${catalog}`,
    ], { repoRoot: ROOT, write: (line) => lines.push(line) });
    expect(code).toBe(0);
    expect(lines.join('\n')).toMatch(/warning.*(price|band|cost)/i);
  });

  it('A1 warns on price above the requested band for an unregistered model', () => {
    const result = pricedSelf('copilot/claude-opus-5');
    const output = result.lines.join('\n');
    expect(result.code).toBe(0);
    expect(output).toMatch(/selected model: Claude Opus 5\b/);
    expect(output).toMatch(/warning.*(price|band)/i);
    expect(output).toContain('dispatcher');
    expect(output).toContain('Gemini 3.8 Flash');
    expect(output).not.toMatch(/cost is unknown/i);
    expect(output).not.toContain('null');
  });

  it('A2 does not warn for an unregistered model within the requested band', () => {
    const result = pricedSelf('copilot/gpt-5.4-mini');
    expect(result.code).toBe(0);
    expect(result.lines).not.toEqual(expect.arrayContaining([expect.stringMatching(/^warning/i)]));
  });

  it('A3 compares unregistered model price with the requested tier ceiling', () => {
    const registry = parseRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')) as unknown);
    const report = resolveSelf(registry, [
      { id: 'claude-opus-5', name: 'Claude Opus 5', inputPrice: 500, outputPrice: 2500 },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', inputPrice: 50, outputPrice: 300 },
    ], 'copilot/claude-opus-5', 'dispatcher');
    expect(report.tier).toBeNull();
    expect(report.higherTier).toBe(false);
    expect(report.exceedsCeiling).toBe(true);
  });

  it('A4 does not warn on price when the requested tier has no ceiling', () => {
    const registry = parseRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')) as unknown);
    const report = resolveSelf(registry, [
      { id: 'claude-opus-5', name: 'Claude Opus 5', inputPrice: 500, outputPrice: 2500 },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', inputPrice: 50, outputPrice: 300 },
    ], 'copilot/claude-opus-5', 'oracle');
    expect(report.exceedsCeiling).toBe(false);
  });
});

describe('rank-based variants and registry', () => {
  it('uses the target tier rank, even when the base tier is architect', () => {
    const registry = parseRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')) as unknown);
    expect(escalationVariants(registry, 'loop-architect').map((v) => v.suffix)).toEqual(['t4']);
    expect(escalationVariants(registry, 'loop-worker').map((v) => v.suffix)).toEqual(['t2', 't3', 't4']);
  });

  it('registers the analyst without generating interactive-agent variants', () => {
    const registry = parseRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')) as unknown);
    expect(registry.agents['loop-analyst']).toBe('architect');
    expect(registry.interactive).toContain('loop-analyst');
    expect(escalationVariants(registry, 'loop-analyst')).toEqual([]);
  });
});

describe('entry agent contracts', () => {
  it('preflights both entry agents and keeps handoff targets resolvable', () => {
    for (const name of ['loop-architect', 'loop-analyst']) {
      const content = readFileSync(join(AGENTS, `${name}.agent.md`), 'utf8');
      expect(content).toContain('## Preflight');
      expect(content).toContain('WRONG AGENT');
      expect(content).toContain('models self');
      for (const target of content.matchAll(/agent:\s*(loop-[\w-]+)/g)) {
        expect(readdirSync(AGENTS)).toContain(`${target[1]}.agent.md`);
      }
    }
  });

  it('stops leaf agents outside their own dispatch contract', () => {
    expect(readFileSync(join(AGENTS, 'loop-worker.agent.md'), 'utf8')).toContain('Current verifier output:');
    expect(readFileSync(join(AGENTS, 'loop-judge.agent.md'), 'utf8')).toContain('tmp/<KEY>-consult.md');
    expect(readFileSync(join(ROOT, '.github/prompts/loop.prompt.md'), 'utf8')).toContain('Preflight');
  });

  it('accounts for every picker-visible local agent as managed, generated or probe', () => {
    const registry = parseRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')) as unknown);
    const expected = new Set([...Object.keys(registry.agents), ...registry.unmanaged]);
    for (const name of Object.keys(registry.agents)) {
      for (const variant of escalationVariants(registry, name)) expected.add(`${name}.${variant.suffix}`);
      for (const variant of singleModelVariants(registry, name)) expected.add(`${name}.${variant.suffix}`);
    }
    const actual = readdirSync(AGENTS).filter((name) => name.endsWith('.agent.md'))
      .map((name) => name.slice(0, -'.agent.md'.length));
    expect(new Set(actual)).toEqual(expected);
  });
});