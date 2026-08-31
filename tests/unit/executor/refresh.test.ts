import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { GitHubClient } from '../../../src/connectors/github/client.ts';
import type { JiraClient } from '../../../src/connectors/jira/client.ts';
import type { Mirrored } from '../../../src/core/model/mirrored.ts';
import { execute, type ExecutorDeps } from '../../../src/executor/executor.ts';
import { migrate } from '../../../src/store/database.ts';
import { readIssue, upsertIssue } from '../../../src/store/repositories/issues.ts';
import { replaceLinks } from '../../../src/store/repositories/links.ts';
import {
  readPullRequest,
  upsertPullRequest,
} from '../../../src/store/repositories/pull-requests.ts';
import { clock, issue, link, ME, pullRequest } from '../../support/factories.ts';

/**
 * The mirror has to reflect the mutation the moment it lands.
 *
 * The executor re-reads live state *before* acting, so what it stores on the way in is the
 * pre-mutation row. Without a second read afterwards the dashboard re-renders the stall that
 * was just cleared and offers the same button for work that is already done — the failure this
 * suite exists to stop from coming back.
 */

function mirrored<T>(value: T): Mirrored<T> {
  return { value, raw: '{}' };
}

function freshDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function deps(db: DatabaseSync, jira: JiraClient, github: GitHubClient): ExecutorDeps {
  return { db, github, jira, identity: ME, clock };
}

function request(action: Parameters<typeof execute>[1]['action']) {
  return { action, stallId: null, authorizedBy: 'human:test', reason: 'test' };
}

const RESOLVE = request({
  capability: 'jira:transition',
  payload: {
    issueKey: 'WS-6114',
    transitionId: '5',
    transitionName: 'Resolve Issue',
    fields: { resolution: { name: 'Fixed' } },
  },
});

/** A ticket the resolve guard will permit: mine, open, and closed by a merged PR. */
function seedResolvableTicket(db: DatabaseSync) {
  const open = issue({ key: 'WS-6114' });
  const merged = pullRequest({ number: 7, state: 'MERGED', issueKeys: ['WS-6114'] });
  upsertIssue(db, mirrored(open), true);
  upsertPullRequest(db, mirrored(merged), true);
  replaceLinks(db, merged.repo, 7, [link({ issueKey: 'WS-6114', number: 7 })]);
  const github = { pullRequest: () => Promise.resolve(mirrored(merged)) } as unknown as GitHubClient;
  return { open, github };
}

describe('execute writes the post-mutation state back to the mirror', () => {
  it('stores the resolved ticket, not the open one it read before transitioning', async () => {
    const db = freshDatabase();
    const { open, github } = seedResolvableTicket(db);

    let transitioned = false;
    const jira = {
      searchIssues: () =>
        Promise.resolve([
          mirrored(
            transitioned
              ? issue({ key: 'WS-6114', status: 'Resolved', resolution: 'Fixed' })
              : open,
          ),
        ]),
      applyTransition: () => {
        transitioned = true;
        return Promise.resolve();
      },
    } as unknown as JiraClient;

    const result = await execute(deps(db, jira, github), RESOLVE);

    expect(result.ok).toBe(true);
    expect(readIssue(db, 'WS-6114')?.status).toBe('Resolved');
    expect(readIssue(db, 'WS-6114')?.resolution).toBe('Fixed');
  });

  it('stores the merged pull request, not the open one the guard read', async () => {
    const db = freshDatabase();
    const open = pullRequest({ number: 7, reviewDecision: 'APPROVED' });

    let mergedNow = false;
    const github = {
      pullRequest: () =>
        Promise.resolve(
          mirrored(
            mergedNow
              ? pullRequest({
                  number: 7,
                  state: 'MERGED',
                  mergedAt: '2026-09-01T00:00:00Z',
                  reviewDecision: 'APPROVED',
                })
              : open,
          ),
        ),
      mergePullRequest: () => {
        mergedNow = true;
        return Promise.resolve('');
      },
    } as unknown as GitHubClient;

    const result = await execute(
      deps(db, {} as JiraClient, github),
      request({
        capability: 'github:pr-merge',
        payload: { repo: open.repo, number: 7, method: 'squash' },
      }),
    );

    expect(result.ok).toBe(true);
    expect(readPullRequest(db, open.repo, 7)?.state).toBe('MERGED');
  });

  it('still reports success when the re-read fails, and names the stale mirror in the outcome', async () => {
    const db = freshDatabase();
    const { open, github } = seedResolvableTicket(db);

    let transitioned = false;
    const jira = {
      searchIssues: () =>
        transitioned
          ? Promise.reject(new Error('jira unreachable'))
          : Promise.resolve([mirrored(open)]),
      applyTransition: () => {
        transitioned = true;
        return Promise.resolve();
      },
    } as unknown as JiraClient;

    const result = await execute(deps(db, jira, github), RESOLVE);

    expect(result.ok).toBe(true);
    const row = db.prepare('SELECT outcome FROM actions WHERE status = ?').get('applied') as
      | { outcome: string }
      | undefined;
    expect(row?.outcome).toContain('mirror not refreshed');
    expect(row?.outcome).toContain('jira unreachable');
  });
});
