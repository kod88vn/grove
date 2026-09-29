import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { modelsApply, modelsPick, modelsReport } from '../../../src/config/run-models.ts';

const CATALOG = new URL('../../fixtures/models/catalog.json', import.meta.url).pathname;

const WORKER_AGENT = `---
name: loop-worker
model: ["GPT-5.6 Luna", "Claude Sonnet 5"]
---

body unchanged below
`;

const ARCHITECT_AGENT = `---
name: loop-architect
model: ["Claude Sonnet 5"]
---

architect body
`;

const JUDGE_AGENT = `---
name: loop-judge
model: ["Claude Opus 5.5", "Claude Opus 5"]
---

judge body
`;

function makeRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'cc-models-repo-'));
  mkdirSync(join(repoRoot, 'registry'), { recursive: true });
  mkdirSync(join(repoRoot, '.github', 'agents'), { recursive: true });
  writeFileSync(
    join(repoRoot, 'registry', 'model-tiers.json'),
    JSON.stringify({
      tiers: [
        { name: 'worker', rank: 1, maxOutputPrice: 150, models: ['GPT-5.6 Luna', 'GPT-6 Luna'] },
        { name: 'dispatcher', rank: 2, maxOutputPrice: 500, models: ['Claude Haiku 4.5'] },
        { name: 'architect', rank: 3, maxOutputPrice: 1200, models: ['Claude Sonnet 5'] },
        { name: 'oracle', rank: 4, maxOutputPrice: null, models: ['Claude Opus 5.5', 'Claude Opus 5'] },
      ],
      agents: { 'loop-worker': 'worker', 'loop-architect': 'architect', 'loop-judge': 'oracle' },
      unmanaged: [],
    }),
  );
  writeFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.agent.md'), WORKER_AGENT);
  writeFileSync(join(repoRoot, '.github', 'agents', 'loop-architect.agent.md'), ARCHITECT_AGENT);
  writeFileSync(join(repoRoot, '.github', 'agents', 'loop-judge.agent.md'), JUDGE_AGENT);
  return repoRoot;
}

describe('modelsApply --check', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('detects a drifted model line and changes nothing on disk', () => {
    const exitCode = modelsApply(repoRoot, true);
    expect(exitCode).not.toBe(0);
    const content = readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.agent.md'), 'utf8');
    expect(content).toBe(WORKER_AGENT);
  });

  it('reports clean when every agent already matches the registry, including its escalation variants', () => {
    writeFileSync(
      join(repoRoot, '.github', 'agents', 'loop-worker.agent.md'),
      WORKER_AGENT.replace('["GPT-5.6 Luna", "Claude Sonnet 5"]', '["GPT-5.6 Luna", "GPT-6 Luna"]'),
    );
    modelsApply(repoRoot, false);
    expect(modelsApply(repoRoot, true)).toBe(0);
  });
});

describe('modelsApply (write mode)', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('rewrites only the model line for every managed agent', () => {
    expect(modelsApply(repoRoot, false)).toBe(0);
    const workerContent = readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.agent.md'), 'utf8');
    expect(workerContent).toBe(WORKER_AGENT.replace(
      'model: ["GPT-5.6 Luna", "Claude Sonnet 5"]',
      'model: ["GPT-5.6 Luna", "GPT-6 Luna"]',
    ));
    // The architect agent already matched, so its file must be byte-for-byte unchanged.
    const architectContent = readFileSync(join(repoRoot, '.github', 'agents', 'loop-architect.agent.md'), 'utf8');
    expect(architectContent).toBe(ARCHITECT_AGENT);
  });

  it('refuses to write anything when the registry itself is invalid', () => {
    writeFileSync(
      join(repoRoot, 'registry', 'model-tiers.json'),
      JSON.stringify({
        tiers: [
          { name: 'worker', rank: 1, maxOutputPrice: 150, models: ['GPT-5.6 Luna'] },
          { name: 'oracle', rank: 4, maxOutputPrice: null, models: ['GPT-5.6 Luna'] },
        ],
        agents: {},
        unmanaged: [],
      }),
    );
    expect(modelsApply(repoRoot, false)).not.toBe(0);
    const content = readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.agent.md'), 'utf8');
    expect(content).toBe(WORKER_AGENT);
  });
});

describe('modelsApply (write mode) — escalation variants', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('generates one variant file per tier above the base tier, with only name and model swapped', () => {
    modelsApply(repoRoot, false);
    const t2 = readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.t2.agent.md'), 'utf8');
    expect(t2).toBe(
      WORKER_AGENT
        .replace('name: loop-worker', 'name: loop-worker.t2')
        .replace('model: ["GPT-5.6 Luna", "Claude Sonnet 5"]', 'model: ["Claude Haiku 4.5"]'),
    );
    const t3 = readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.t3.agent.md'), 'utf8');
    expect(t3).toContain('name: loop-worker.t3');
    expect(t3).toContain('model: ["Claude Sonnet 5"]');
    const t4 = readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.t4.agent.md'), 'utf8');
    expect(t4).toContain('name: loop-worker.t4');
    expect(t4).toContain('model: ["Claude Opus 5.5", "Claude Opus 5"]');
  });

  it('writes no variant files for an agent already at the top (oracle) tier', () => {
    modelsApply(repoRoot, false);
    expect(() => readFileSync(join(repoRoot, '.github', 'agents', 'loop-judge.t2.agent.md'), 'utf8')).toThrow();
  });
});

describe('modelsApply --check — escalation variants', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('flags drift when a variant file is missing, and writes nothing', () => {
    expect(modelsApply(repoRoot, true)).not.toBe(0);
    expect(() => readFileSync(join(repoRoot, '.github', 'agents', 'loop-worker.t2.agent.md'), 'utf8')).toThrow();
  });

  it('reports clean once every variant file matches the registry', () => {
    modelsApply(repoRoot, false);
    expect(modelsApply(repoRoot, true)).toBe(0);
  });
});

describe('modelsPick', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('prints the picked model in runSubagent format and exits 0', () => {
    const lines: string[] = [];
    const exitCode = modelsPick({ repoRoot, catalogPath: CATALOG }, 'loop-worker', 0, (line) => lines.push(line));
    expect(exitCode).toBe(0);
    expect(lines).toEqual(['GPT-5.6 Luna (copilot)']);
  });

  it('escalates by tier and accepts a bare tier name as the role', () => {
    const lines: string[] = [];
    const exitCode = modelsPick({ repoRoot, catalogPath: CATALOG }, 'worker', 2, (line) => lines.push(line));
    expect(exitCode).toBe(0);
    expect(lines).toEqual(['Claude Sonnet 5 (copilot)']);
  });

  it('prints DECIDE with candidates and exits 2 when no registered model is present', () => {
    const lines: string[] = [];
    const raw = JSON.parse(readFileSync(CATALOG, 'utf8')) as unknown[];
    const withoutHaiku = raw.filter((m) => (m as { name?: string }).name !== 'Claude Haiku 4.5');
    const trimmedCatalog = join(repoRoot, 'no-haiku.json');
    writeFileSync(trimmedCatalog, JSON.stringify(withoutHaiku));

    const exitCode = modelsPick(
      { repoRoot, catalogPath: trimmedCatalog },
      'dispatcher',
      0,
      (line) => lines.push(line),
    );
    expect(exitCode).toBe(2);
    expect(lines[0]).toBe('DECIDE: dispatcher');
    expect(lines.some((l) => l.includes('Gemini 3.6 Flash'))).toBe(true);
  });
});

describe('modelsReport', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('lists every tier and flags the agent whose frontmatter disagrees with the registry', () => {
    const lines: string[] = [];
    const exitCode = modelsReport({ repoRoot, catalogPath: CATALOG }, (line) => lines.push(line));
    expect(exitCode).toBe(0);
    const text = lines.join('\n');
    expect(text).toContain('worker');
    expect(text).toContain('dispatcher');
    expect(text).toContain('architect');
    expect(text).toContain('oracle');
    expect(text).toContain('loop-worker');
    expect(text.toLowerCase()).toContain('drift');
  });
});
