import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mapPullRequest } from '../../../src/connectors/github/map.ts';
import { mapChecks, mapReviewRequests, myReviewState } from '../../../src/connectors/github/map-parts.ts';
import { hasFailingChecks, isReadyToMerge } from '../../../src/core/model/pull-request.ts';

/** Unedited `gh pr view --json …` output for clover/web-storefront-engine#2390, 2026-08-31. */
const RAW = JSON.parse(
  readFileSync(new URL('../../fixtures/github/pr-2390.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const CONTEXT = { repo: 'clover/web-storefront-engine', me: 'jay-quach', projectKeys: ['WS'] };

describe('mapPullRequest against the captured PR', () => {
  const pr = mapPullRequest(RAW, CONTEXT);

  it('maps identity and branch fields', () => {
    expect(pr.number).toBe(2390);
    expect(pr.author).toBe('jay-quach');
    expect(pr.state).toBe('OPEN');
    expect(pr.isDraft).toBe(false);
    expect(pr.headRefName).toBe('docs/stack-fact-ledger');
    expect(pr.baseRefName).toBe('main');
  });

  it('finds no Jira key, because this PR genuinely has none', () => {
    expect(pr.issueKeys).toEqual([]);
  });

  it('records the review decision and the requested reviewers, users and teams alike', () => {
    expect(pr.reviewDecision).toBe('REVIEW_REQUIRED');
    expect(pr.reviewRequests).toEqual([
      { kind: 'user', id: 'mani-periyasamy' },
      { kind: 'team', id: 'clover/services-team' },
    ]);
  });

  it('normalises both check shapes and finds the failing one', () => {
    const names = pr.checks.map((c) => c.name);
    // 'JIRA Link' and 'Semantic Title' are StatusContext entries with no `name` key at all.
    expect(names).toContain('JIRA Link');
    expect(names).toContain('Semantic Title');
    expect(names).toContain('SonarQube Code Analysis');
    expect(names).not.toContain('unnamed check');
    expect(hasFailingChecks(pr)).toBe(true);
    expect(pr.checks.find((c) => c.name === 'JIRA Link')?.conclusion).toBe('FAILURE');
  });

  it('is not ready to merge: unapproved, and mergeability was never computed', () => {
    expect(pr.mergeable).toBe('UNKNOWN');
    expect(isReadyToMerge(pr)).toBe(false);
  });

  it('reports auto-merge as disabled when autoMergeRequest is null', () => {
    expect(pr.autoMergeEnabled).toBe(false);
  });
});

describe('mapPullRequest edge cases', () => {
  it('throws rather than guessing when the PR has no number', () => {
    expect(() => mapPullRequest({}, CONTEXT)).toThrow(/no number/);
  });

  it('parses Jira keys from the branch name', () => {
    const pr = mapPullRequest(
      { number: 1, headRefName: 'feature/WS-6316-config', title: 'chore: x', body: '' },
      CONTEXT,
    );
    expect(pr.issueKeys).toEqual(['WS-6316']);
  });

  it('ignores keys from other Jira projects when projectKeys is set', () => {
    const pr = mapPullRequest(
      { number: 1, headRefName: 'main', title: 'relates to SV-4870', body: '' },
      CONTEXT,
    );
    expect(pr.issueKeys).toEqual([]);
  });

  it('treats an unrecognised merge state as UNKNOWN rather than trusting it', () => {
    const pr = mapPullRequest({ number: 1, mergeStateStatus: 'WAT' }, CONTEXT);
    expect(pr.mergeStateStatus).toBe('UNKNOWN');
  });
});

describe('mapChecks', () => {
  it('reports an unfinished CheckRun as pending, not as failure', () => {
    const checks = mapChecks([
      { __typename: 'CheckRun', name: 'build', status: 'IN_PROGRESS', conclusion: null },
    ]);
    expect(checks).toEqual([{ name: 'build', conclusion: 'PENDING' }]);
  });

  it('maps error and timeout conclusions to failure', () => {
    const checks = mapChecks([
      { __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'TIMED_OUT' },
      { __typename: 'StatusContext', context: 'b', state: 'ERROR' },
    ]);
    expect(checks.every((c) => c.conclusion === 'FAILURE')).toBe(true);
  });

  it('returns nothing when the rollup is absent', () => {
    expect(mapChecks(undefined)).toEqual([]);
  });
});

describe('mapReviewRequests', () => {
  it('falls back to a team name when the slug is missing', () => {
    expect(mapReviewRequests([{ __typename: 'Team', name: 'Services Team' }])).toEqual([
      { kind: 'team', id: 'Services Team' },
    ]);
  });
});

describe('myReviewState', () => {
  const me = 'jay-quach';

  it('is not_requested when nobody asked me', () => {
    expect(myReviewState([], [], me, null)).toBe('not_requested');
  });

  it('is requested_not_started when I am a requested reviewer with no review', () => {
    expect(myReviewState([], [{ kind: 'user', id: me }], me, null)).toBe('requested_not_started');
  });

  it('ignores a team request, because a team request is not my personal queue', () => {
    expect(myReviewState([], [{ kind: 'team', id: 'clover/services-team' }], me, null)).toBe(
      'not_requested',
    );
  });

  it('is approved when I approved and nothing has been pushed since', () => {
    const reviews = [{ author: me, state: 'APPROVED' as const, submittedAt: '2026-08-30T00:00:00Z' }];
    expect(myReviewState(reviews, [], me, '2026-08-29T00:00:00Z')).toBe('approved');
  });

  it('is stale_review when the author pushed after I approved', () => {
    const reviews = [{ author: me, state: 'APPROVED' as const, submittedAt: '2026-08-29T00:00:00Z' }];
    expect(myReviewState(reviews, [], me, '2026-08-30T00:00:00Z')).toBe('stale_review');
  });

  it('ignores other people reviews when deciding my state', () => {
    const reviews = [
      { author: 'someone-else', state: 'APPROVED' as const, submittedAt: '2026-08-30T00:00:00Z' },
    ];
    expect(myReviewState(reviews, [], me, null)).toBe('not_requested');
  });
});
