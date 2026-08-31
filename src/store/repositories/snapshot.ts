import type { DatabaseSync } from 'node:sqlite';
import type { Issue, IssueKey } from '../../core/model/issue.ts';
import type { Snapshot, Identity } from '../../stalls/snapshot.ts';
import { readActiveSprint } from './sprints.ts';
import { readAllLinks } from './links.ts';
import { readAllPullRequests } from './pull-requests.ts';
import { readBranches } from './branches.ts';
import { readIssuesInSprint, readMyOpenIssues, readMyResolvedIssues } from './issues.ts';

/** How many recently resolved tickets to carry, newest first. */
const RESOLVED_LIMIT = 200;

/**
 * Assemble everything the stall rules need, in one pass.
 *
 * Read whole rather than queried per rule: the mirror is small enough that loading it is
 * cheaper than eighteen rules each issuing their own SQL, and it guarantees every rule sees the
 * same consistent picture rather than a moving target.
 */
export function readSnapshot(db: DatabaseSync, identity: Identity): Snapshot {
  const activeSprint = readActiveSprint(db);
  const sprintIssues = activeSprint === null ? [] : readIssuesInSprint(db, activeSprint.id);

  return {
    issues: mergeIssues(
      readMyOpenIssues(db),
      sprintIssues,
      readMyResolvedIssues(db, RESOLVED_LIMIT),
    ),
    pullRequests: readAllPullRequests(db),
    branches: readBranches(db),
    links: readAllLinks(db),
    activeSprint,
    sprintIssueKeys: sprintIssues.map((issue) => issue.key),
    identity,
  };
}

/** Union by key; the first occurrence of a key wins. */
function mergeIssues(...groups: readonly Issue[][]): Issue[] {
  const byKey = new Map<IssueKey, Issue>();
  for (const group of groups) {
    for (const issue of group) {
      if (!byKey.has(issue.key)) {
        byKey.set(issue.key, issue);
      }
    }
  }
  return [...byKey.values()];
}
