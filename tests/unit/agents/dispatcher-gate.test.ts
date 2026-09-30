import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseModelLine } from '../../../src/core/model/frontmatter.ts';
import { parseRegistry } from '../../../src/core/model/tiers.ts';

// Selecting loop-dispatcher must start the loop and nothing else. These assertions are the
// gate: the frontmatter is what VS Code enforces, so the frontmatter is what is checked.

const ROOT = resolve(import.meta.dirname, '../../..');
const AGENTS = join(ROOT, '.github/agents');
const DISPATCHER = readFileSync(join(AGENTS, 'loop-dispatcher.agent.md'), 'utf8');
const [, FRONTMATTER = '', BODY = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(DISPATCHER) ?? [];
const ENTRY = /^loop-(architect|judge|analyst)(\.m-[\w-]+)?$/;
const REGISTRY = parseRegistry(JSON.parse(readFileSync(join(ROOT, 'registry/model-tiers.json'), 'utf8')));

function tierOf(model: string) {
  return REGISTRY.tiers.find((tier) => tier.models.includes(model));
}

function modelsOf(agent: string): readonly string[] {
  return parseModelLine(readFileSync(join(AGENTS, `${agent}.agent.md`), 'utf8')) ?? [];
}

function flowList(key: string): string[] | null {
  const line = new RegExp(`^${key}:\\s*(\\[.*\\])\\s*$`, 'm').exec(FRONTMATTER)?.[1];
  return line === undefined ? null : (JSON.parse(line.replace(/'/g, '"')) as string[]);
}

describe('loop-dispatcher gate', () => {
  it('has no edit or terminal tool, so it cannot do the work itself', () => {
    expect(flowList('tools')?.slice().sort()).toEqual(['agent', 'read/readFile']);
  });

  it('can only dispatch loop entry agents, never a generic subagent or the worker', () => {
    const allowed = flowList('agents');
    expect(allowed).not.toBeNull();
    expect(allowed).toContain('loop-architect');
    const files = readdirSync(AGENTS);
    for (const name of allowed ?? []) {
      expect(name).toMatch(ENTRY);
      expect(files).toContain(`${name}.agent.md`);
    }
  });

  it('starts the loop by handing the request verbatim to loop-architect', () => {
    expect(BODY).toMatch(/runSubagent/);
    expect(BODY).toMatch(/agentName[^\n]*loop-architect/);
    expect(BODY).toMatch(/verbatim/i);
  });

  it('runs on the dispatcher tier (tier 2), because relaying is not judgement', () => {
    expect(REGISTRY.agents['loop-dispatcher']).toBe('dispatcher');
    const dispatcher = REGISTRY.tiers.find((tier) => tier.name === 'dispatcher');
    expect(modelsOf('loop-dispatcher')).toEqual(dispatcher?.models);
  });

  it('can only reach agents pinned at architect tier or above', () => {
    const architectRank = REGISTRY.tiers.find((tier) => tier.name === 'architect')?.rank ?? Infinity;
    for (const agent of flowList('agents') ?? []) {
      const models = modelsOf(agent);
      expect(models.length, agent).toBeGreaterThan(0);
      for (const model of models) {
        expect(tierOf(model)?.rank ?? 0, `${agent}: ${model}`).toBeGreaterThanOrEqual(architectRank);
      }
    }
  });

  // From a Gemini caller, a Claude frontmatter pin does not take effect: VS Code silently keeps
  // the caller's model. loop-judge ran on Gemini four times out of four that way, and on Claude
  // the one time `model` was passed (transcripts 9f406dca and cc7a8787, 2026-09-29/30). So every
  // reachable agent is called with its pinned model named explicitly, which throws if unknown.
  it('names the pinned model for every agent it can reach', () => {
    expect(BODY).not.toMatch(/[Nn]ever pass `model`/);
    for (const agent of flowList('agents') ?? []) {
      const pinned = `${modelsOf(agent)[0]} (copilot)`;
      expect(BODY, agent).toContain(`| \`${agent}\` | \`${pinned}\` |`);
    }
  });

  // The dispatcher used to relay any architect return that was not CONSULT_NEEDED or WRONG AGENT
  // straight to the user, which ended the run after one milestone or one launched driver
  // (transcripts cc7a8787 and 99661bf6, 2026-09-30). It now loops until a terminal status.
  it('re-dispatches the architect on CONTINUE and stops only on DONE or BLOCKED', () => {
    expect(BODY).toMatch(/`CONTINUE: /);
    expect(BODY).toMatch(/`DONE: /);
    expect(BODY).toMatch(/`BLOCKED: /);
    expect(BODY).toMatch(/[Oo]riginal request/);
    expect(BODY).not.toMatch(/Anything else → relay/);
  });

  it('holds the architect to the same return statuses the dispatcher routes on', () => {
    const architect = readFileSync(join(AGENTS, 'loop-architect.agent.md'), 'utf8');
    for (const status of ['CONSULT_NEEDED: ', 'WRONG AGENT', 'CONTINUE: resume <KEY>', 'DONE: <KEY>', 'BLOCKED: ']) {
      expect(architect, status).toContain(status);
    }
    expect(architect).toMatch(/## Return contract/);
    expect(architect).not.toMatch(/Run it in a \*\*background terminal\*\*/);
  });

  it('documents the continuation statuses in LOOP.md', () => {
    const loop = readFileSync(join(ROOT, 'LOOP.md'), 'utf8');
    for (const status of ['CONTINUE', 'DONE', 'BLOCKED']) expect(loop, status).toMatch(new RegExp(`\`${status}: `));
  });

  it('no longer routes to the child instance, which does not deliver', () => {
    expect(DISPATCHER).not.toMatch(/code chat/);
    expect(DISPATCHER).not.toMatch(/child VS Code instance/i);
  });
});
