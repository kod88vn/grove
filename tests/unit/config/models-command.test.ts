import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { modelsCommand } from '../../../src/config/models-command.ts';

const CATALOG = new URL('../../fixtures/models/catalog.json', import.meta.url).pathname;

function makeRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'cc-models-cmd-'));
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
      agents: { 'loop-worker': 'worker' },
      unmanaged: [],
    }),
  );
  writeFileSync(
    join(repoRoot, '.github', 'agents', 'loop-worker.agent.md'),
    '---\nname: loop-worker\nmodel: ["GPT-5.6 Luna", "GPT-6 Luna"]\n---\nbody\n',
  );
  return repoRoot;
}

describe('modelsCommand', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeRepo();
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('parses "pick <role> --escalate=N --catalog=<path>" and dispatches to the pick action', () => {
    const lines: string[] = [];
    const exitCode = modelsCommand(['pick', 'loop-worker', '--escalate=1', `--catalog=${CATALOG}`], {
      repoRoot,
      write: (line) => lines.push(line),
    });
    expect(exitCode).toBe(0);
    expect(lines).toEqual(['Claude Haiku 4.5 (copilot)']);
  });

  it('defaults escalate to 0 when the flag is absent', () => {
    const lines: string[] = [];
    modelsCommand(['pick', 'loop-worker', `--catalog=${CATALOG}`], { repoRoot, write: (line) => lines.push(line) });
    expect(lines).toEqual(['GPT-5.6 Luna (copilot)']);
  });

  it('dispatches "apply --check" to the apply action in check mode', () => {
    modelsCommand(['apply'], { repoRoot, write: () => {} });
    const lines: string[] = [];
    const exitCode = modelsCommand(['apply', '--check'], { repoRoot, write: (line) => lines.push(line) });
    expect(exitCode).toBe(0);
  });

  it('rejects an unknown subcommand with exit code 2', () => {
    const exitCode = modelsCommand(['launch-the-missiles'], { repoRoot, write: () => {} });
    expect(exitCode).toBe(2);
  });
});
