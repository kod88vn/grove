import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { childProfileSettings } from '../../../src/core/policy/terminal-deny.ts';

const REPO = resolve(import.meta.dirname, '../../..');
const CLI = join(REPO, 'node_modules/tsx/dist/cli.mjs');
const ENTRY = join(REPO, 'bin/cc.ts');

function invoke(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ENTRY, 'loop', 'profile', ...args], {
    cwd: REPO, encoding: 'utf8', timeout: 15000,
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('cc loop profile', () => {
  let userDataDir: string;
  let settingsPath: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'cc-child-profile-'));
    settingsPath = join(userDataDir, 'User', 'settings.json');
  });

  afterEach(() => rmSync(userDataDir, { recursive: true, force: true }));

  it('prints the complete managed profile as JSON without writing any settings file by default', () => {
    const output = invoke([`--user-data-dir=${userDataDir}`]);
    expect(output.status).toBe(0);
    expect(JSON.parse(output.stdout)).toEqual(childProfileSettings());
    expect(() => readFileSync(settingsPath)).toThrow();
  });

  it('merges into a temporary profile without deleting foreign settings or consent', () => {
    mkdirSync(join(userDataDir, 'User'));
    writeFileSync(settingsPath, JSON.stringify({
      'workbench.colorTheme': 'Dark+',
      'chat.tools.terminal.autoApprove.warningAccepted': true,
      'chat.agent.sandbox.enabled': 'on',
    }));
    const output = invoke(['--write', `--user-data-dir=${userDataDir}`]);
    expect(output.status).toBe(0);
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({
      'workbench.colorTheme': 'Dark+',
      'chat.tools.terminal.autoApprove.warningAccepted': true,
      ...childProfileSettings(),
    });
    const first = readFileSync(settingsPath, 'utf8');
    expect(invoke(['--write', `--user-data-dir=${userDataDir}`]).status).toBe(0);
    expect(readFileSync(settingsPath, 'utf8')).toBe(first);
  });

  it('detects drift after a managed key is mutated and accepts a restored temporary profile', () => {
    expect(invoke(['--check', `--user-data-dir=${userDataDir}`]).status).toBe(1);
    expect(invoke(['--write', `--user-data-dir=${userDataDir}`]).status).toBe(0);
    expect(invoke(['--check', `--user-data-dir=${userDataDir}`]).status).toBe(0);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    settings['chat.agent.sandbox.enabled'] = 'on';
    writeFileSync(settingsPath, JSON.stringify(settings));
    expect(invoke(['--check', `--user-data-dir=${userDataDir}`]).status).toBe(1);
  });
});