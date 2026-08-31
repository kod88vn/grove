import { describe, expect, it } from 'vitest';
import { diffIssue, diffPullRequest } from '../../../src/sync/diff.ts';
import type { Issue } from '../../../src/core/model/issue.ts';
import type { Check, PullRequest } from '../../../src/core/model/pull-request.ts';

const AT = '2026-08-31T12:00:00Z';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    key: 'WS-6316',
    summary: 'Adopt shared config',
    status: 'In Progress',
    resolution: null,
    issueType: 'Task',
    priority: 'Major',
    assignee: { name: 'jay.quach', displayName: 'Jay Quach' },
    reporter: { name: 'jay.quach', displayName: 'Jay Quach' },
    created: '2026-08-01T00:00:00Z',
    updated: '2026-08-30T00:00:00Z',
    resolvedAt: null,
    epicKey: 'WS-5801',
    sprint: { id: 12388, name: 'Platform_13' },
    labels: [],
    fixVersions: [],
    ...overrides,
  };
}

function pull(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    repo: 'clover/web-storefront-engine',
    number: 2390,
    title: 'docs: ledger',
    body: '',
    url: '',
    state: 'OPEN',
    isDraft: false,
    author: 'jay-quach',
    headRefName: 'docs/stack-fact-ledger',
    baseRefName: 'main',
    headRefOid: 'aaa',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-30T00:00:00Z',
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

const failing: Check = { name: 'JIRA Link', conclusion: 'FAILURE', startedAt: '2026-08-30T00:00:00Z' };
const passing: Check = { name: 'JIRA Link', conclusion: 'SUCCESS', startedAt: '2026-08-31T00:00:00Z' };

function kinds(events: readonly { kind: string }[]): string[] {
  return events.map((e) => e.kind);
}

describe('diffIssue', () => {
  it('reports a first sighting rather than a pile of changes', () => {
    expect(kinds(diffIssue(null, issue(), AT))).toEqual(['issue.appeared']);
  });

  it('says nothing when nothing changed', () => {
    expect(diffIssue(issue(), issue(), AT)).toEqual([]);
  });

  it('notices a status change made by somebody else', () => {
    const events = diffIssue(issue(), issue({ status: 'In Review' }), AT);
    expect(events[0]?.kind).toBe('issue.status_changed');
    expect(events[0]?.detail).toEqual({ from: 'In Progress', to: 'In Review' });
  });

  it('notices a resolution, which is the signal that a linked PR may be stale', () => {
    const events = diffIssue(issue(), issue({ resolution: 'Fixed', status: 'Resolved' }), AT);
    expect(kinds(events)).toContain('issue.resolved');
  });

  it('notices a reopen, not just a resolve', () => {
    const events = diffIssue(issue({ resolution: 'Fixed' }), issue({ resolution: null }), AT);
    expect(kinds(events)).toEqual(['issue.reopened']);
  });

  it('notices being handed a ticket', () => {
    const events = diffIssue(issue({ assignee: null }), issue(), AT);
    expect(events[0]?.detail).toEqual({ from: null, to: 'jay.quach' });
  });

  it('notices a ticket being pulled out of the sprint', () => {
    const events = diffIssue(issue(), issue({ sprint: null }), AT);
    expect(events[0]?.kind).toBe('issue.sprint_changed');
    expect(events[0]?.detail).toEqual({ from: 'Platform_13', to: null });
  });
});

describe('diffPullRequest', () => {
  it('reports a first sighting only', () => {
    expect(kinds(diffPullRequest(null, pull(), AT))).toEqual(['pr.appeared']);
  });

  it('notices a merge performed in the GitHub UI', () => {
    const merged = pull({ state: 'MERGED', mergedAt: '2026-08-31T09:00:00Z' });
    expect(kinds(diffPullRequest(pull(), merged, AT))).toContain('pr.merged');
  });

  it('distinguishes closed-without-merging from merged', () => {
    const events = kinds(diffPullRequest(pull(), pull({ state: 'CLOSED' }), AT));
    expect(events).toContain('pr.closed');
    expect(events).not.toContain('pr.merged');
  });

  it('notices a push, which is what invalidates an existing approval', () => {
    expect(kinds(diffPullRequest(pull(), pull({ headRefOid: 'bbb' }), AT))).toContain('pr.pushed');
  });

  it('notices a draft becoming ready for review', () => {
    const events = kinds(diffPullRequest(pull({ isDraft: true }), pull(), AT));
    expect(events).toContain('pr.ready_for_review');
  });

  it('notices checks going red, naming the check that broke', () => {
    const events = diffPullRequest(pull(), pull({ checks: [failing] }), AT);
    const failure = events.find((e) => e.kind === 'pr.checks_failed');
    expect(failure?.detail).toEqual({ failing: ['JIRA Link'] });
  });

  it('notices checks recovering', () => {
    const events = diffPullRequest(pull({ checks: [failing] }), pull({ checks: [passing] }), AT);
    expect(kinds(events)).toContain('pr.checks_recovered');
  });

  it('notices a new conflict', () => {
    const events = diffPullRequest(pull(), pull({ mergeable: 'CONFLICTING' }), AT);
    expect(kinds(events)).toContain('pr.conflicted');
  });

  it('does not invent a conflict when GitHub merely finished computing mergeability', () => {
    // UNKNOWN -> MERGEABLE is GitHub catching up, not a change to the PR. Reporting it would
    // fire on almost every PR the first time it is looked at.
    const events = diffPullRequest(pull({ mergeable: 'UNKNOWN' }), pull(), AT);
    expect(kinds(events)).toEqual([]);
  });

  it('notices a review being requested of me', () => {
    const events = diffPullRequest(pull(), pull({ myReviewState: 'requested_not_started' }), AT);
    expect(kinds(events)).toContain('pr.my_review_requested_not_started');
  });

  it('notices my approval going stale', () => {
    const events = diffPullRequest(
      pull({ myReviewState: 'approved' }),
      pull({ myReviewState: 'stale_review', headRefOid: 'bbb' }),
      AT,
    );
    expect(kinds(events)).toEqual(['pr.pushed', 'pr.my_review_stale_review']);
  });

  it('says nothing when nothing changed', () => {
    expect(diffPullRequest(pull(), pull(), AT)).toEqual([]);
  });
});
