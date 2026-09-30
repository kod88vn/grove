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

  // It was on the dispatcher tier (Gemini 3.8 Flash) while its job was a pure relay. It now reads
  // driver state and decides when the machinery needs repair, which is judgement (2026-09-30).
  it('runs on the architect tier, because keeping watch is judgement', () => {
    expect(REGISTRY.agents['loop-dispatcher']).toBe('architect');
    const architect = REGISTRY.tiers.find((tier) => tier.name === 'architect');
    expect(modelsOf('loop-dispatcher')).toEqual(architect?.models);
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

  // The architect's turn, and with it the driver, died at 09:58:07 on 2026-09-30 and the
  // dispatcher relayed and stopped: nothing on disk said what was left. Recovery now runs from a
  // checkpoint file, and the driver runs detached so a dead turn does not take the work with it.
  it('recovers from a failed or silent architect using the on-disk checkpoint', () => {
    expect(BODY).toMatch(/Checkpoint: /);
    expect(BODY).toMatch(/tmp\/loop-checkpoints\//);
    expect(BODY).toMatch(/error|no response/i);
    expect(BODY).toMatch(/`status:`/);
  });

  it('makes the architect keep the checkpoint and launch the driver detached', () => {
    const architect = readFileSync(join(AGENTS, 'loop-architect.agent.md'), 'utf8');
    expect(architect).toMatch(/Checkpoint/);
    expect(architect).toMatch(/status: /);
    expect(architect).toContain('scripts/loop-detach.sh');
    expect(architect).not.toMatch(/^bash tmp\/<KEY>-loop\.sh$/m);
    expect(readFileSync(join(ROOT, 'LOOP.md'), 'utf8')).toContain('scripts/loop-detach.sh');
  });

  it('no longer routes to the child instance, which does not deliver', () => {
    expect(DISPATCHER).not.toMatch(/code chat/);
    expect(DISPATCHER).not.toMatch(/child VS Code instance/i);
  });

  // Run 147: the worker refused every dispatch and the driver, the architect and the dispatcher
  // all carried on as if it were a red run. The driver now names the fault; the dispatcher reads
  // it after every return and sends the architect to repair it before anything else, DONE included.
  it('watches the driver after every return and routes a fault to an architect repair', () => {
    expect(BODY).toMatch(/\*\*Watch\*\*/);
    expect(BODY).toContain('tmp/<KEY>-loop.exit');
    expect(BODY).toContain('DRIVER_FAULT=');
    expect(BODY).toMatch(/`repair <KEY>: /);
    expect(BODY).toMatch(/outranks every status below,\s+`DONE` included/);
    const architect = readFileSync(join(AGENTS, 'loop-architect.agent.md'), 'utf8');
    expect(architect).toContain('DRIVER_FAULT=');
    expect(architect).toMatch(/dispatch-refused/);
  });

  it('repairs a missing-window BLOCKED reply rather than forwarding it to the user', () => {
    const blockedBranch = BODY.split('   - `BLOCKED: <action>` →')[1]?.split('   - The subagent failed:')[0];
    expect(blockedBranch).toContain('missing repo window');
    expect(blockedBranch).toContain('repair <KEY>');
    expect(blockedBranch).toMatch(/not (?:a )?user-only/);
    expect(blockedBranch?.indexOf('repair <KEY>')).toBeLessThan(blockedBranch?.indexOf('relay it to the user') ?? 0);
  });

  // Both judge consults in session d84d8271 (Claude Opus 5.5, full edit/terminal tool list) read
  // 31 and 24 files, never attempted a write, and answered "I only have read access" — because
  // the contract said "You never edit" and "describe what the caller should do" right beside the
  // instruction to write tmp/<KEY>-judgment.md.
  it('tells the judge to write its judgment file and to say so if the write fails', () => {
    const judge = readFileSync(join(AGENTS, 'loop-judge.agent.md'), 'utf8');
    expect(judge).not.toMatch(/You read files and diffs and may run read-only commands/);
    expect(judge).toMatch(/Writing that file is not\s+a mutation and not optional/);
    expect(judge).toContain('JUDGMENT NOT WRITTEN');
    expect(BODY).toContain('JUDGMENT NOT WRITTEN');
  });
});
