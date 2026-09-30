import { afterEach, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// A chat turn owns the terminal it runs commands in. When the turn ended at 09:58:07 on
// 2026-09-30, the cloverpedia M2 driver it had launched died in the same second, and nothing
// was left to resume. The driver must outlive whatever launched it, and a second launch must
// re-attach to the running driver instead of starting a duplicate.

const ROOT = resolve(import.meta.dirname, '../../..');
const DETACH = join(ROOT, 'scripts/loop-detach.sh');
const ENV = { ...process.env, LOOP_DETACH_POLL: '0.2' };
const made: string[] = [];

function scratch(driverBody: string): { dir: string; driver: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cc-loop-detach-'));
  made.push(dir);
  const driver = join(dir, 'KEY-loop.sh');
  writeFileSync(driver, `cd "${dir}"\n${driverBody}\n`);
  return { dir, driver };
}

async function until(check: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return check();
}

/** Launch `command` in its own process group, then SIGKILL the whole group — a dying chat turn. */
async function launchThenKillGroup(command: string, ready: () => boolean): Promise<void> {
  const shell = spawn('bash', ['-c', `${command}\nsleep 30`], { detached: true, stdio: 'ignore', env: ENV });
  await until(ready, 5000);
  process.kill(-(shell.pid ?? 0), 'SIGKILL');
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loop driver outlives the chat turn that launched it', { timeout: 15000 }, () => {
  it('control: a plain nohup background job dies with its process group', async () => {
    const { dir, driver } = scratch('echo start >> starts; sleep 1.5; echo ok > marker');
    await launchThenKillGroup(`nohup bash "${driver}" >/dev/null 2>&1 &`, () => existsSync(join(dir, 'starts')));
    expect(await until(() => existsSync(join(dir, 'marker')), 3000)).toBe(false);
  });

  it('keeps running after the launching process group is killed', async () => {
    const { dir, driver } = scratch('echo start >> starts; sleep 1.5; echo ok > marker');
    await launchThenKillGroup(`bash "${DETACH}" "${driver}"`, () => existsSync(join(dir, 'starts')));
    expect(await until(() => existsSync(join(dir, 'marker')), 4000)).toBe(true);
  });

  it('re-attaches to a running driver instead of starting a second copy', async () => {
    const { dir, driver } = scratch('echo start >> starts; sleep 1.5; echo ok > marker');
    await launchThenKillGroup(`bash "${DETACH}" "${driver}"`, () => existsSync(join(dir, 'starts')));
    const again = spawnSync('bash', [DETACH, driver], { encoding: 'utf8', env: ENV });
    expect(again.stdout).toMatch(/attached to running driver/);
    expect(existsSync(join(dir, 'marker'))).toBe(true);
    expect(readFileSync(join(dir, 'starts'), 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('waits for the driver and exits with its exit code', () => {
    const { driver } = scratch('echo from-driver; exit 3');
    const run = spawnSync('bash', [DETACH, driver], { encoding: 'utf8', env: ENV });
    expect(run.status).toBe(3);
    expect(run.stdout).toMatch(/from-driver/);
  });
});
