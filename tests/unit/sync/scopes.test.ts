import { describe, expect, it } from 'vitest';
import type { GitHubClient } from '../../../src/connectors/github/client.ts';
import type { JiraClient } from '../../../src/connectors/jira/client.ts';
import type { Mirrored } from '../../../src/core/model/mirrored.ts';
import type { PullRequest } from '../../../src/core/model/pull-request.ts';
import { openDatabase } from '../../../src/store/database.ts';
import { readAllPullRequests, upsertPullRequest } from '../../../src/store/repositories/pull-requests.ts';
import { syncGitHub, type SyncDeps } from '../../../src/sync/scopes.ts';

const REPO = 'clover/web-storefront-engine';

function basePr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    repo: REPO,
    number: 2388,
    title: 'fix: something',
    body: '',
    url: `https://github.corp.clover.com/${REPO}/pull/2388`,
    state: 'OPEN',
    isDraft: false,
    author: 'jay-quach',
    headRefName: 'fix/x',
    baseRefName: 'main',
    headRefOid: 'abc123',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
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

function mirrored(pr: PullRequest): Mirrored<PullRequest> {
  return { value: pr, raw: '{}' };
}

/** A stand-in for the calls syncGitHub makes. Fake, not a mock: it answers, asserts nothing. */
function fakeGitHub(options: {
  open: readonly PullRequest[];
  reread?: PullRequest;
}): GitHubClient {
  return {
    findOpenPullRequests: () => Promise.resolve([]),
    findMergedPullRequests: () => Promise.resolve([]),
    listOpenPullRequests: (repo: string) =>
      Promise.resolve(options.open.filter((pr) => pr.repo === repo).map(mirrored)),
    pullRequest: (repo: string, number: number) =>
      Promise.resolve(
        mirrored(options.reread ?? { ...basePr(), repo, number, state: 'CLOSED' }),
      ),
  } as unknown as GitHubClient;
}

function deps(github: GitHubClient, db: ReturnType<typeof openDatabase>): SyncDeps {
  return {
    db,
    config: {
      jira: { me: 'jay.quach', projectKeys: ['WS'] },
      github: { me: 'jay-quach' },
      repos: [{ fullName: REPO, path: null }],
    },
    jira: {} as unknown as JiraClient,
    github,
    now: () => new Date('2026-08-31T12:00:00.000Z'),
  };
}

describe('syncGitHub reconciling vanished pull requests', () => {
  it('re-reads a PR that fell out of the open list and records its real state', async () => {
    const db = openDatabase({ path: ':memory:' });
    upsertPullRequest(db, mirrored(basePr()), true);

    await syncGitHub(deps(fakeGitHub({ open: [] }), db));

    const stored = readAllPullRequests(db).find((pr) => pr.number === 2388);
    expect(stored?.state).toBe('CLOSED');
    db.close();
  });

  it('leaves a still-open PR alone when it is still in the fresh listing', async () => {
    const db = openDatabase({ path: ':memory:' });
    upsertPullRequest(db, mirrored(basePr()), true);

    await syncGitHub(deps(fakeGitHub({ open: [basePr()] }), db));

    const stored = readAllPullRequests(db).find((pr) => pr.number === 2388);
    expect(stored?.state).toBe('OPEN');
    db.close();
  });
});
