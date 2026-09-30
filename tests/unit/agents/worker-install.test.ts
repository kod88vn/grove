import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// `code chat -m <agent>` looks the agent up in the TARGET repo's window, not in central-command.
// When it is missing there, VS Code silently runs plain agent mode on the window's model — which
// is how a Luna worker ran on GPT-6 Sol (cloverpedia, 2026-09-30). The driver must install the
// agent where VS Code looks, keep it out of the target's git status, and abort if it is absent.

const ROOT = resolve(import.meta.dirname, '../../..');
const INSTALL = join(ROOT, 'scripts/install-worker-agent.sh');
const made: string[] = [];

function targetRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'cc-worker-install-'));
  made.push(repo);
  execFileSync('git', ['init', '-q', repo]);
  return repo;
}

function install(repo: string, agent: string): string {
  return execFileSync('bash', [INSTALL, ROOT, repo, agent], { encoding: 'utf8' });
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('worker agent is installed where code chat looks for it', () => {
  it('copies the pinned worker file into the target repo .github/agents', () => {
    const repo = targetRepo();
    install(repo, 'loop-worker.m-gpt-6-luna');
    const installed = join(repo, '.github/agents/loop-worker.m-gpt-6-luna.agent.md');
    expect(readFileSync(installed, 'utf8')).toBe(
      readFileSync(join(ROOT, '.github/agents/loop-worker.m-gpt-6-luna.agent.md'), 'utf8'),
    );
  });

  it('leaves the target repo git status clean', () => {
    const repo = targetRepo();
    install(repo, 'loop-worker');
    expect(existsSync(join(repo, '.github/agents/loop-worker.agent.md'))).toBe(true);
    expect(execFileSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' })).toBe('');
  });

  it('refuses an agent that central-command does not define', () => {
    const repo = targetRepo();
    expect(() => install(repo, 'loop-worker.m-no-such-model')).toThrow();
    expect(existsSync(join(repo, '.github/agents/loop-worker.m-no-such-model.agent.md'))).toBe(false);
  });

  it('the driver installs the agent into $REPO before dispatching, and checks it there', () => {
    const driver = readFileSync(join(ROOT, 'scripts/loop.sh'), 'utf8');
    const installAt = driver.indexOf('install-worker-agent.sh');
    expect(installAt).toBeGreaterThan(-1);
    expect(installAt).toBeLessThan(driver.indexOf('"$CODE" chat -m'));
    expect(driver).toMatch(/AGENT="\$REPO\/\.github\/agents\/\$WORKER_AGENT\.agent\.md"/);
  });
});
