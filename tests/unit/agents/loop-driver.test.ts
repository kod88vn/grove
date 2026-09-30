import { afterEach, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Run 147 (cloverpedia M2-c, 2026-09-30) burned every iteration: the driver's failure filter only
// knew jest, the suite was `node --test`, so `Current verifier output:` went out empty and the
// Luna worker answered WRONG AGENT to all three dispatches. Meanwhile a second driver ran on the
// same repo, and the `suppressed` / `cfg-tampered` verdicts could never fire because the driver
// never reported a suppression count or a config path.

const ROOT = resolve(import.meta.dirname, '../../..');
const LIB = join(ROOT, 'scripts/loop-lib.sh');
const TEMPLATE = readFileSync(join(ROOT, 'scripts/loop.sh'), 'utf8');
const WORKER = readFileSync(join(ROOT, '.github/agents/loop-worker.agent.md'), 'utf8');
const made: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cc-loop-driver-'));
  made.push(dir);
  return dir;
}

function lib(script: string, cwd: string): { out: string; code: number | null } {
  const run = spawnSync('bash', ['-c', `source "${LIB}"\n${script}`], { cwd, encoding: 'utf8' });
  return { out: `${run.stdout}${run.stderr}`, code: run.status };
}

const NODE_TEST_RED = [
  '✔ rejects normalized but nonexistent observation dates (0.87ms)',
  'ℹ tests 34',
  'ℹ pass 31',
  'ℹ fail 3',
  '',
  '✖ failing tests:',
  '',
  'test at tests/consistency.test.mjs:38:1',
  '✖ a credential-shaped skim path is absent from serialized results (2.0ms)',
  '  AssertionError [ERR_ASSERTION]: The input was expected to not match /ghp_/.',
].join('\n');

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the worker always receives the failures', () => {
  it('extracts node --test failures, assertion included', () => {
    const dir = scratch();
    writeFileSync(join(dir, 'verify.txt'), NODE_TEST_RED);
    const { out } = lib('failure_lines verify.txt', dir);
    expect(out).toContain('AssertionError');
    expect(out).toContain('ℹ fail 3');
  });

  it('still extracts jest failures', () => {
    const dir = scratch();
    writeFileSync(join(dir, 'verify.txt'), 'noise\n  ● suite › adds a line\nTests:       1 failed, 4 passed, 5 total\n');
    expect(lib('failure_lines verify.txt', dir).out).toContain('● suite › adds a line');
  });

  it('falls back to the log tail for an unknown runner, and never sends nothing', () => {
    const dir = scratch();
    writeFileSync(join(dir, 'verify.txt'), 'custom runner: 2 broken\n');
    expect(lib('failure_lines verify.txt', dir).out).toContain('custom runner: 2 broken');
    writeFileSync(join(dir, 'empty.txt'), '');
    expect(lib('failure_lines empty.txt', dir).out.trim()).not.toBe('');
  });

  it('keys the worker preflight on a first-line sentinel the driver always sends', () => {
    expect(TEMPLATE).toMatch(/SENTINEL="LOOP DRIVER DISPATCH — /);
    expect(WORKER).toContain('LOOP DRIVER DISPATCH');
    expect(WORKER).not.toMatch(/STOP unless your prompt includes the driver's literal `Current verifier output:`/);
    expect(TEMPLATE).toMatch(/FAILURES="\$\(failure_lines /);
  });
});

describe('one driver per target repo', { timeout: 15000 }, () => {
  it('refuses a second driver while the first holds the repo, and recovers a stale lock', async () => {
    const cc = scratch();
    const repo = scratch();
    const holder = spawn('bash', ['-c', `source "${LIB}"\nacquire_repo_lock "${cc}" "${repo}" || exit 9\necho held\nsleep 3`], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    await new Promise<void>((done) => holder.stdout.once('data', () => done()));

    const second = lib(`acquire_repo_lock "${cc}" "${repo}"`, cc);
    expect(second.code).not.toBe(0);
    expect(second.out).toMatch(/ABORT — another loop driver .* holds/);

    holder.kill('SIGKILL');
    await new Promise((done) => holder.once('exit', done));
    expect(lib(`acquire_repo_lock "${cc}" "${repo}" && echo took-over`, cc).out).toContain('took-over');
  });

  it('acquires the lock before the driver touches the repo', () => {
    expect(TEMPLATE.indexOf('acquire_repo_lock')).toBeGreaterThan(-1);
    expect(TEMPLATE.indexOf('acquire_repo_lock')).toBeLessThan(TEMPLATE.indexOf('install-worker-agent.sh'));
  });
});

describe('a missing repo window is recoverable', () => {
  function fakeCode(dir: string): { code: string; repo: string; calls: string } {
    const code = join(dir, 'code');
    const repo = join(dir, 'grove');
    const calls = join(dir, 'calls');
    mkdirSync(repo);
    writeFileSync(code, `#!/bin/sh
echo "$*" >> "${calls}"
if [ "$1" = --status ]; then
  if [ -f "${dir}/open" ] && [ "\${WINDOW_NEVER_READY:-0}" != 1 ]; then
    echo '  1  window [1] (package.json — grove)'
  else
    echo '  1  window [1] (HOMEWORK_PROGRESS.md — Untitled (Workspace))'
    echo '|    Folder (grove): 2811 files'
  fi
elif [ "$1" = --new-window ]; then
  [ "\${WINDOW_FAIL_OPEN:-0}" != 1 ] || exit 1
  touch "${dir}/open"
fi
`);
    chmodSync(code, 0o755);
    return { code, repo, calls };
  }

  it('opens one dedicated window when Grove exists only inside an Untitled workspace, then reuses it', () => {
    const dir = scratch();
    const { code, repo, calls } = fakeCode(dir);
    const first = lib(`WINDOW_READY_ATTEMPTS=2 WINDOW_READY_DELAY=0 ensure_repo_window "${code}" "${repo}"`, dir);
    expect(first.code).toBe(0);
    const second = lib(`WINDOW_READY_ATTEMPTS=2 WINDOW_READY_DELAY=0 ensure_repo_window "${code}" "${repo}"`, dir);
    expect(second.code).toBe(0);
    expect(readFileSync(calls, 'utf8').split('\n').filter(line => line.startsWith('--new-window'))).toEqual([`--new-window ${repo}`]);
  });

  it('returns a named fault when opening the window fails', () => {
    const dir = scratch();
    const { code, repo, calls } = fakeCode(dir);
    const result = lib(`WINDOW_FAIL_OPEN=1 ensure_repo_window "${code}" "${repo}"`, dir);
    expect(result.code).not.toBe(0);
    expect(result.out).toContain('DRIVER_FAULT=window-launch-failed');
    expect(readFileSync(calls, 'utf8').split('\n').filter(line => line.startsWith('--new-window'))).toHaveLength(1);
  });

  it('does not open another window when the launched window never becomes ready', () => {
    const dir = scratch();
    const { code, repo, calls } = fakeCode(dir);
    const result = lib(`WINDOW_NEVER_READY=1 WINDOW_READY_ATTEMPTS=2 WINDOW_READY_DELAY=0 ensure_repo_window "${code}" "${repo}"`, dir);
    expect(result.code).not.toBe(0);
    expect(result.out).toContain('DRIVER_FAULT=window-not-ready');
    expect(readFileSync(calls, 'utf8').split('\n').filter(line => line.startsWith('--new-window'))).toHaveLength(1);
  });

  it('uses the recovery helper before dispatch rather than aborting for a missing window', () => {
    expect(TEMPLATE).toContain('ensure_repo_window "$CODE" "$REPO"');
    expect(TEMPLATE).not.toContain('ABORT — no open window on');
  });

  it('tells the architect to recover a missing window rather than block on a user action', () => {
    const architect = readFileSync(join(ROOT, '.github/agents/loop-architect.agent.md'), 'utf8');
    expect(architect).toContain('window-launch-failed');
    expect(architect).toContain('driver opens the missing window');
    expect(architect).not.toContain('The driver aborts without an open window.');
  });
});

describe('suppression and config verdicts are reachable', () => {
  it('counts suppressions in tracked and new files', () => {
    const repo = scratch();
    spawnSync('git', ['init', '-q'], { cwd: repo });
    writeFileSync(join(repo, 'a.test.mjs'), "test('ok', () => {});\n");
    expect(lib('count_suppressions .', repo).out.trim()).toBe('0');
    writeFileSync(join(repo, 'b.test.mjs'), "test.skip('x', () => {});\n// eslint-disable-next-line\n");
    expect(lib('count_suppressions .', repo).out.trim()).toBe('2');
  });

  it('reports the suppression count at start and on every record, and locks an optional guard config', () => {
    expect(TEMPLATE).toMatch(/loop start [^\n]*\\\n[^\n]*--suppressions="\$SUPPRESSIONS"/);
    expect(TEMPLATE).toMatch(/loop record [^\n]*\\\n[^\n]*--suppressions="\$\(count_suppressions "\$REPO"\)"/);
    expect(TEMPLATE).toMatch(/GUARD_CONFIG=""/);
    expect(TEMPLATE).toContain('${GUARD_CONFIG:+--config="$GUARD_CONFIG"}');
  });
});

// Run 147 again: the worker refused in three seconds, and the driver polled a red verifier for
// the full six minutes anyway — three times. The driver now watches the chat session its dispatch
// created, so a refusal or a lost dispatch ends the run at once with a named fault, and a worker
// that finished without going green frees the iteration instead of idling out the poll budget.
describe('the driver watches its own dispatch', () => {
  it('turns the watch status into one action', () => {
    const act = (status: string, seconds: number): string =>
      lib(`dispatch_action ${status} ${seconds}`, ROOT).out.trim();
    expect(act('refused', 5)).toBe('refused');
    expect(act('none', 10)).toBe('wait');
    expect(act('none', 60)).toBe('lost');
    expect(act('running', 300)).toBe('wait');
    expect(act('done', 20)).toBe('idle');
    expect(act('pending', 20)).toBe('pending');
    expect(act('garbage', 20)).toBe('wait');
  });

  it('stops on a pending permission rather than marking a red run complete', () => {
    expect(TEMPLATE).toMatch(/pending\)/);
    expect(TEMPLATE).toContain('DRIVER_FAULT=dispatch-pending');
  });

  it('polls the watch beside the verifier and stops on a fault with a machine-readable line', () => {
    expect(TEMPLATE).toMatch(/cc loop watch --repo="\$REPO" --sentinel="\$SENTINEL"/);
    expect(TEMPLATE).toMatch(/-r "\$SENTINEL\n/);
    expect(TEMPLATE).toContain('DRIVER_FAULT=');
    expect(TEMPLATE).toMatch(/refused\|lost\)/);
    expect(TEMPLATE).toMatch(/idle\)/);
  });
});

describe('temporary loop artifacts stay in the target project', () => {
  it('creates a fresh, ignored project-local output directory for each run', () => {
    const repo = scratch();
    spawnSync('git', ['init', '-q'], { cwd: repo });
    const first = lib(`prepare_loop_output "${repo}" M6a`, repo);
    const second = lib(`prepare_loop_output "${repo}" M6a`, repo);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const a = first.out.trim();
    const b = second.out.trim();
    expect(a).not.toBe(b);
    expect(a).toMatch(new RegExp(`^${repo}/tmp/loop-M6a\\.`));
    expect(b).toMatch(new RegExp(`^${repo}/tmp/loop-M6a\\.`));
    expect(spawnSync('git', ['check-ignore', '-q', a], { cwd: repo }).status).toBe(0);
    expect(TEMPLATE).toContain('OUT="$(prepare_loop_output "$REPO" "$TICKET")"');
    expect(WORKER).toMatch(/test (?:results|output).*inside the target repo/i);
    for (const variant of ['loop-worker.m-gpt-6-luna', 'loop-worker.m-gpt-5-6-luna']) {
      expect(readFileSync(join(ROOT, `.github/agents/${variant}.agent.md`), 'utf8')).toContain(
        'Keep test results and diagnostic output inside the target repo',
      );
    }
  });

  it('rejects a symlink from the project output directory to an external location', () => {
    const repo = scratch();
    const outside = scratch();
    spawnSync('git', ['init', '-q'], { cwd: repo });
    symlinkSync(outside, join(repo, 'tmp'));
    const result = lib(`prepare_loop_output "${repo}" M6a`, repo);
    expect(result.code).not.toBe(0);
    expect(result.out).toContain('ABORT');
  });
});
