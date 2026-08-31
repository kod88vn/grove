import { fixedClock } from '../../src/core/clock.ts';
import type { Branch } from '../../src/core/model/branch.ts';
import type { Issue } from '../../src/core/model/issue.ts';
import type { IssuePrLink } from '../../src/core/model/link.ts';
import type { PullRequest } from '../../src/core/model/pull-request.ts';
import type { Sprint } from '../../src/core/model/sprint.ts';
import type { Snapshot } from '../../src/stalls/snapshot.ts';

export const ME = { jira: 'jay.quach', github: 'jay-quach' } as const;

/** Every test measures against this instant, so ages in the fixtures read as plain arithmetic. */
export const NOW = Date.parse('2026-09-01T12:00:00Z');
export const clock = fixedClock(NOW);

/** An ISO timestamp `days` before NOW. */
export function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString();
}

/** An ISO timestamp `days` after NOW. */
export function daysAhead(days: number): string {
  return new Date(NOW + days * 86_400_000).toISOString();
}

export function issue(over: Partial<Issue> = {}): Issue {
  return {
    key: 'WS-1000',
    summary: 'Something',
    status: 'In Progress',
    resolution: null,
    issueType: 'Task',
    priority: 'Medium',
    assignee: { name: ME.jira, displayName: 'Jay Quach' },
    reporter: { name: ME.jira, displayName: 'Jay Quach' },
    created: daysAgo(30),
    updated: daysAgo(1),
    resolvedAt: null,
    epicKey: null,
    sprint: null,
    labels: [],
    fixVersions: [],
    ...over,
  };
}

export function pullRequest(over: Partial<PullRequest> = {}): PullRequest {
  return {
    repo: 'clover/web-storefront-engine',
    number: 1,
    title: 'Do the thing',
    body: '',
    url: 'https://github.corp.clover.com/clover/web-storefront-engine/pull/1',
    state: 'OPEN',
    isDraft: false,
    author: ME.github,
    headRefName: 'feature/WS-1000-thing',
    baseRefName: 'main',
    headRefOid: 'abc123',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    mergedAt: null,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: 'REVIEW_REQUIRED',
    reviewRequests: [{ kind: 'user', id: 'someone-else' }],
    latestReviews: [],
    checks: [],
    autoMergeEnabled: false,
    issueKeys: ['WS-1000'],
    myReviewState: 'not_requested',
    ...over,
  };
}

export function branch(over: Partial<Branch> = {}): Branch {
  return {
    repo: 'clover/web-storefront-engine',
    name: 'feature/WS-1000-thing',
    upstream: 'origin/feature/WS-1000-thing',
    upstreamGone: false,
    ahead: 0,
    behind: 0,
    lastCommitAt: daysAgo(1),
    ...over,
  };
}

export function sprint(over: Partial<Sprint> = {}): Sprint {
  return {
    id: 12388,
    name: 'Platform_13',
    state: 'active',
    boardId: 1386,
    startDate: daysAgo(10),
    endDate: daysAhead(10),
    completeDate: null,
    ...over,
  };
}

export function link(over: Partial<IssuePrLink> = {}): IssuePrLink {
  return {
    issueKey: 'WS-1000',
    repo: 'clover/web-storefront-engine',
    number: 1,
    source: 'branch',
    ...over,
  };
}

export function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    issues: [],
    pullRequests: [],
    branches: [],
    links: [],
    activeSprint: null,
    sprintIssueKeys: [],
    identity: ME,
    ...over,
  };
}
