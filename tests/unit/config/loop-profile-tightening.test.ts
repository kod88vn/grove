import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO = resolve(import.meta.dirname, '../../..');
const CLI = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const ENTRY = join(REPO, 'bin/cc.ts');

describe('cc loop profile rejects malformed existing settings', () => {
  let userDataDir: string;
  let settingsPath: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'cc-malformed-profile-'));
    settingsPath = join(userDataDir, 'User', 'settings.json');
  });

  afterEach(() => rmSync(userDataDir, { recursive: true, force: true }));

  function invoke(flag: '--write' | '--check') {
    const result = spawnSync(process.execPath, [CLI, ENTRY, 'loop', 'profile', flag, `--user-data-dir=${userDataDir}`], {
      cwd: REPO, encoding: 'utf8', timeout: 15000,
    });
    if (result.error) throw result.error;
    return result;
  }

  it('reports parse errors and leaves malformed settings byte-identical on write', () => {
    mkdirSync(join(userDataDir, 'User'));
    const malformed = '{ // c\n "workbench.colorTheme": "Dark+" }';
    writeFileSync(settingsPath, malformed);
    const result = invoke('--write');
    expect(result.status).not.toBe(0);
    expect(result.stderr.trim().length).toBeGreaterThan(0);
    expect(readFileSync(settingsPath, 'utf8')).toBe(malformed);
    expect(invoke('--check').status).toBe(1);
  });
});