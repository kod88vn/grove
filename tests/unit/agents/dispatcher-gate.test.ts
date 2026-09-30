import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Selecting loop-dispatcher must start the loop and nothing else. These assertions are the
// gate: the frontmatter is what VS Code enforces, so the frontmatter is what is checked.

const ROOT = resolve(import.meta.dirname, '../../..');
const AGENTS = join(ROOT, '.github/agents');
const DISPATCHER = readFileSync(join(AGENTS, 'loop-dispatcher.agent.md'), 'utf8');
const [, FRONTMATTER = '', BODY = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(DISPATCHER) ?? [];
const ENTRY = /^loop-(architect|judge|analyst)(\.m-[\w-]+)?$/;

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

  it('no longer routes to the child instance, which does not deliver', () => {
    expect(DISPATCHER).not.toMatch(/code chat/);
    expect(DISPATCHER).not.toMatch(/child VS Code instance/i);
  });
});
