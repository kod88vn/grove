import { describe, expect, it } from 'vitest';
import { denyCommand, isProtectedBranch } from '../../../src/core/policy/denylist.ts';
import { refuseMerge, refuseResolve } from '../../../src/core/policy/preflight.ts';
import { issue, pullRequest, ME } from '../../support/factories.ts';

/**
 * These are the checks standing between a click and a mistake, so they are tested by asserting
 * what they *refuse*. A guard that accidentally returns null is indistinguishable from a guard
 * that was never called, and only a negative test catches it.
 */

const mergeable = pullRequest({
  author: ME.github,
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  reviewDecision: 'APPROVED',
  issueKeys: ['WS-1'],
  checks: [{ name: 'ci', conclusion: 'SUCCESS', startedAt: '2026-09-01T00:00:00Z' }],
});

describe('denyCommand', () => {
  it('refuses flags that bypass a safety mechanism, wherever they appear in the argv', () => {
    for (const flag of ['--no-verify', '--force', '--force-with-lease', '--admin']) {
      expect(denyCommand(['pr', 'merge', '7', flag])?.rule).toBe('forbidden-argument');
    }
  });

  it('permits an ordinary merge', () => {
    expect(denyCommand(['pr', 'merge', '7', '--repo', 'clover/x', '--squash'])).toBeNull();
  });

  it('names the offending flag, so the refusal can be understood without reading the code', () => {
    expect(denyCommand(['push', '--force'])?.because).toContain('--force');
  });
});

describe('isProtectedBranch', () => {
  it('protects the integration branches regardless of case', () => {
    expect(isProtectedBranch('main')).toBe(true);
    expect(isProtectedBranch('MAIN')).toBe(true);
    expect(isProtectedBranch('development')).toBe(true);
  });

  it('leaves feature branches alone', () => {
    expect(isProtectedBranch('feature/WS-1-thing')).toBe(false);
  });
});

describe('refuseMerge', () => {
  it('permits a PR that is mine, approved, green, linked and conflict-free', () => {
    expect(refuseMerge(mergeable, ME.github)).toBeNull();
  });

  it('refuses a PR somebody else wrote — merging their work is not my decision', () => {
    const theirs = pullRequest({ ...mergeable, author: 'someone-else' });
    expect(refuseMerge(theirs, ME.github)?.rule).toBe('not-mine');
  });

  it('refuses when nobody has approved', () => {
    const unreviewed = pullRequest({ ...mergeable, reviewDecision: 'REVIEW_REQUIRED' });
    expect(refuseMerge(unreviewed, ME.github)?.rule).toBe('not-approved');
  });

  it('refuses when a reviewer asked for changes', () => {
    const objected = pullRequest({ ...mergeable, reviewDecision: 'CHANGES_REQUESTED' });
    expect(refuseMerge(objected, ME.github)?.rule).toBe('changes-requested');
  });

  it('refuses while a check is failing', () => {
    const red = pullRequest({
      ...mergeable,
      checks: [{ name: 'ci', conclusion: 'FAILURE', startedAt: '2026-09-01T00:00:00Z' }],
    });
    expect(refuseMerge(red, ME.github)?.rule).toBe('checks-failing');
  });

  it('refuses a PR that names no ticket, which would detach the change from its work', () => {
    const unlinked = pullRequest({ ...mergeable, issueKeys: [] });
    expect(refuseMerge(unlinked, ME.github)?.rule).toBe('no-jira-link');
  });

  it('refuses a draft', () => {
    expect(refuseMerge(pullRequest({ ...mergeable, isDraft: true }), ME.github)?.rule).toBe(
      'draft',
    );
  });

  it('refuses one that conflicts with its base', () => {
    const clashing = pullRequest({ ...mergeable, mergeable: 'CONFLICTING' });
    expect(refuseMerge(clashing, ME.github)?.rule).toBe('conflicting');
  });

  it('refuses one already merged, so a double click cannot act twice', () => {
    expect(refuseMerge(pullRequest({ ...mergeable, state: 'MERGED' }), ME.github)?.rule).toBe(
      'not-open',
    );
  });

  it('refuses when the head branch is itself protected', () => {
    const fromMain = pullRequest({ ...mergeable, headRefName: 'main' });
    expect(refuseMerge(fromMain, ME.github)?.rule).toBe('protected-head');
  });
});

describe('refuseResolve', () => {
  const mine = issue({ key: 'WS-1', status: 'In Progress', assignee: { name: ME.jira, displayName: 'Jay Quach' } });
  const merged = pullRequest({ state: 'MERGED', issueKeys: ['WS-1'] });

  it('permits resolving once every linked PR has merged', () => {
    expect(refuseResolve(mine, [merged], ME.jira)).toBeNull();
  });

  it('refuses while a linked PR is still open — the board would claim work that has not shipped', () => {
    const open = pullRequest({ number: 9, state: 'OPEN', issueKeys: ['WS-1'] });
    expect(refuseResolve(mine, [merged, open], ME.jira)?.rule).toBe('pr-not-merged');
  });

  it('names the unmerged PR so the refusal points at what to fix', () => {
    const open = pullRequest({ repo: 'clover/x', number: 9, state: 'OPEN' });
    expect(refuseResolve(mine, [open], ME.jira)?.because).toContain('clover/x#9');
  });

  it('refuses when no PR references the ticket at all', () => {
    expect(refuseResolve(mine, [], ME.jira)?.rule).toBe('no-linked-pr');
  });

  it('refuses a ticket assigned to somebody else', () => {
    const theirs = issue({ key: 'WS-1', assignee: { name: 'other.person', displayName: 'Other Person' } });
    expect(refuseResolve(theirs, [merged], ME.jira)?.rule).toBe('not-mine');
  });

  it('refuses one that is already resolved, so a stale button is harmless', () => {
    const done = issue({ key: 'WS-1', status: 'Resolved', assignee: { name: ME.jira, displayName: 'Jay Quach' } });
    expect(refuseResolve(done, [merged], ME.jira)?.rule).toBe('already-done');
  });
});
