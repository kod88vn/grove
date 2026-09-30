import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The loop has one entry: select loop-dispatcher. Every live doc, agent and the driver must
// agree on that, and must not point at the repo's old location (~/dev/bot), which no longer
// exists — a driver built from it aborts before the worker ever runs.

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

function filesIn(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name).slice(ROOT.length + 1));
}

const LIVE = ['AGENTS.md', 'LOOP.md', 'LOOP.html', 'scripts/loop.sh', ...filesIn('.github')];

describe('loop docs agree with the implementation', () => {
  it('no live doc, agent or driver points at the old ~/dev/bot location', () => {
    const stale = LIVE.filter((path) => /dev\/bot\b|bot\/tmp\b/.test(read(path)));
    expect(stale).toEqual([]);
  });

  // These files are reused on other machines, so they must never assume where this repo or a
  // home directory lives. Refer to "this workspace root" or a placeholder instead.
  it('no live doc, agent or driver hardcodes a home directory or this repo\'s location', () => {
    const pinned = LIVE.filter((path) => /\/Users\/[\w.-]+|\/home\/[\w.-]+\/|~\/dev\/cc\b/.test(read(path)));
    expect(pinned).toEqual([]);
  });

  it('the driver locates cc relative to itself, not by an absolute path', () => {
    expect(read('scripts/loop.sh')).toMatch(/CC_ROOT=.*dirname "\$0"/);
  });

  it('names loop-dispatcher as the entry you select', () => {
    for (const path of ['AGENTS.md', 'LOOP.md', 'LOOP.html', '.github/prompts/loop.prompt.md']) {
      expect(read(path), path).toMatch(/[Ss]elect[^\n]{0,40}loop-dispatcher/);
    }
  });

  it('carries no leftover merge-conflict markers', () => {
    const marked = LIVE.filter((path) => /^(<{7}|={7}|>{7})( |$)/m.test(read(path)));
    expect(marked).toEqual([]);
  });

  // A requirement comes from a Jira ticket OR straight from the prompt. Neither is a fallback,
  // and a prompt requirement must not be forced into Jira just to have a key.
  it('treats a Jira ticket and a plain prompt as equal sources of a requirement', () => {
    const entry = [
      '.github/agents/loop-architect.agent.md',
      '.github/prompts/loop.prompt.md',
      'LOOP.md',
      'LOOP.html',
    ];
    for (const path of entry) {
      expect(read(path), path).toMatch(/Jira ticket or (straight|directly)[^\n]{0,20}prompt/);
    }
    expect(read('.github/agents/loop-architect.agent.md')).not.toMatch(
      /description, create the ticket \*\*now\*\*/,
    );
  });
});
