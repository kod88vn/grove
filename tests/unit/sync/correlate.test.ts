import { describe, expect, it } from 'vitest';
import { correlate } from '../../../src/sync/correlate.ts';
import type { PullRequest } from '../../../src/core/model/pull-request.ts';

function pr(overrides: Partial<PullRequest>): PullRequest {
  return {
    repo: 'clover/web-storefront-engine',
    number: 1,
    title: '',
    body: '',
    url: '',
    state: 'OPEN',
    isDraft: false,
    author: 'jay-quach',
    headRefName: '',
    baseRefName: 'main',
    headRefOid: 'abc',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    mergedAt: null,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: null,
    reviewRequests: [],
    latestReviews: [],
    checks: [],
    autoMergeEnabled: false,
    issueKeys: [],
    myReviewState: 'not_requested',
    ...overrides,
  };
}

describe('correlate', () => {
  it('links a ticket named in the branch, recording branch as the source', () => {
    expect(correlate(pr({ headRefName: 'feature/WS-6316-guards' }), ['WS'])).toEqual([
      { issueKey: 'WS-6316', repo: 'clover/web-storefront-engine', number: 1, source: 'branch' },
    ]);
  });

  it('prefers the branch over the title when both name the same ticket', () => {
    const links = correlate(
      pr({ headRefName: 'bugfix/WS-1', title: 'fix: thing [WS-1]' }),
      ['WS'],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.source).toBe('branch');
  });

  it('prefers the title over the body', () => {
    const links = correlate(pr({ title: 'fix [WS-2]', body: 'see WS-2' }), ['WS']);
    expect(links[0]?.source).toBe('title');
  });

  it('records several distinct tickets, each with its own source', () => {
    const links = correlate(
      pr({ headRefName: 'feature/WS-1-x', title: 'chore: y [WS-2]', body: 'also WS-3' }),
      ['WS'],
    );
    expect(links.map((l) => [l.issueKey, l.source])).toEqual([
      ['WS-1', 'branch'],
      ['WS-2', 'title'],
      ['WS-3', 'body'],
    ]);
  });

  it('returns nothing for a PR with no Jira reference anywhere', () => {
    // The real clover/web-storefront-engine#2390: this is what the org JIRA Link check fails on.
    expect(correlate(pr({ headRefName: 'docs/stack-fact-ledger', title: 'docs: ledger' }), ['WS']))
      .toEqual([]);
  });

  it('ignores keys from projects that are not being watched', () => {
    expect(correlate(pr({ title: 'relates to SV-4870' }), ['WS'])).toEqual([]);
  });
});
