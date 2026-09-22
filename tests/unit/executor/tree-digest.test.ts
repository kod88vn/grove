import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { treeDigest } from '../../../src/executor/tree-digest.ts';

const run = promisify(execFile);

/**
 * A throwaway repository, because this is the one behaviour that cannot be faked: the question
 * is what `git ls-files` does, so the test has to ask a real git.
 */
let repo: string;

async function git(...args: readonly string[]): Promise<void> {
  await run('git', [...args], { cwd: repo });
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'cc-digest-'));
  await git('init', '--quiet');
  await git('config', 'user.email', 'test@example.invalid');
  await git('config', 'user.name', 'Test');
  await mkdir(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'package.json'), '{}\n');
  await git('add', '-A');
  await git('commit', '--quiet', '-m', 'initial');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('treeDigest', () => {
  /**
   * The regression. `git ls-files --cached --others` emits untracked entries before tracked
   * ones, so `git add` moved a file within the list without changing a byte of it, and the
   * order-sensitive digest changed. That expired a stamp for staging the work it attested to,
   * which teaches people to route around the gate.
   */
  it('does not change when a new file is staged', async () => {
    writeFileSync(join(repo, 'src', 'z-new.ts'), 'export const z = 1;\n');
    const unstaged = await treeDigest(repo);

    await git('add', 'src/z-new.ts');
    const staged = await treeDigest(repo);

    expect(staged).toBe(unstaged);
  });

  it('does not change when an edit to a tracked file is staged', async () => {
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
    const unstaged = await treeDigest(repo);

    await git('add', 'src/a.ts');
    expect(await treeDigest(repo)).toBe(unstaged);
  });

  it('still changes when the contents change', async () => {
    const before = await treeDigest(repo);
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 3;\n');
    expect(await treeDigest(repo)).not.toBe(before);
  });

  it('still changes when a gated file appears', async () => {
    const before = await treeDigest(repo);
    writeFileSync(join(repo, 'src', 'b.ts'), 'export const b = 1;\n');
    expect(await treeDigest(repo)).not.toBe(before);
  });

  it('ignores files outside the gated roots', async () => {
    const before = await treeDigest(repo);
    writeFileSync(join(repo, 'README.md'), '# docs\n');
    expect(await treeDigest(repo)).toBe(before);
  });
});
