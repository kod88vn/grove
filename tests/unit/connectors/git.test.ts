import { describe, expect, it } from 'vitest';
import { parseBranch } from '../../../src/connectors/git.ts';

/** `git for-each-ref` joins fields with the unit separator, which branch names cannot contain. */
const F = '\u001f';

function line(parts: readonly string[]): string {
  return parts.join(F);
}

const REPO = 'clover/web-storefront-engine';

describe('parseBranch', () => {
  it('reads a branch that is ahead of its upstream', () => {
    const branch = parseBranch(
      line(['feature/WS-1', 'origin/feature/WS-1', '[ahead 3]', '2026-08-30T10:00:00+01:00', '']),
      REPO,
    );
    expect(branch).toEqual({
      repo: REPO,
      name: 'feature/WS-1',
      upstream: 'origin/feature/WS-1',
      upstreamGone: false,
      ahead: 3,
      behind: 0,
      lastCommitAt: '2026-08-30T10:00:00+01:00',
      isCurrent: false,
    });
  });

  it('reads both counts when the branch has diverged', () => {
    const branch = parseBranch(
      line(['main', 'origin/main', '[ahead 2, behind 11]', '2026-08-30T10:00:00Z', '*']),
      REPO,
    );
    expect(branch.ahead).toBe(2);
    expect(branch.behind).toBe(11);
    expect(branch.isCurrent).toBe(true);
  });

  it('does not read "behind" as "ahead" when only behind is present', () => {
    const branch = parseBranch(line(['x', 'origin/x', '[behind 4]', '', '']), REPO);
    expect(branch.ahead).toBe(0);
    expect(branch.behind).toBe(4);
  });

  it('flags a deleted upstream, which is how a merged PR leaves a local branch behind', () => {
    const branch = parseBranch(line(['feature/WS-2', 'origin/feature/WS-2', '[gone]', '', '']), REPO);
    expect(branch.upstreamGone).toBe(true);
    expect(branch.ahead).toBe(0);
    expect(branch.behind).toBe(0);
  });

  it('distinguishes "never pushed" from "upstream deleted"', () => {
    const neverPushed = parseBranch(line(['scratch', '', '', '', '']), REPO);
    expect(neverPushed.upstream).toBeNull();
    expect(neverPushed.upstreamGone).toBe(false);
  });

  it('keeps a branch name containing spaces and brackets intact', () => {
    // Not idiomatic, but git permits it, and a space-delimited format would lose it.
    const branch = parseBranch(line(['fix/odd [name]', '', '', '', '']), REPO);
    expect(branch.name).toBe('fix/odd [name]');
  });
});
