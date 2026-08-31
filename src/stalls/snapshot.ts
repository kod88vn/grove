import type { Branch } from '../core/model/branch.ts';
import type { Issue, IssueKey } from '../core/model/issue.ts';
import type { IssuePrLink } from '../core/model/link.ts';
import type { PullRequest, RepoFullName } from '../core/model/pull-request.ts';
import type { Sprint } from '../core/model/sprint.ts';

/** Who "me" is in each system. Passed in rather than read, so rules stay pure. */
export interface Identity {
  readonly jira: string;
  readonly github: string;
}

/**
 * Everything the stall rules are allowed to look at.
 *
 * Assembled by the store and handed over whole. Rules receive plain data and no way to fetch
 * more, which is what keeps them testable: a rule cannot quietly depend on the network, the
 * clock, or a query nobody remembered to index.
 */
export interface Snapshot {
  readonly issues: readonly Issue[];
  readonly pullRequests: readonly PullRequest[];
  readonly branches: readonly Branch[];
  readonly links: readonly IssuePrLink[];
  readonly activeSprint: Sprint | null;
  /** Issue keys in the active sprint. Empty when there is no active sprint. */
  readonly sprintIssueKeys: readonly IssueKey[];
  readonly identity: Identity;
}

/** A pull request together with the issues it is believed to belong to. */
export interface LinkedPullRequest {
  readonly pullRequest: PullRequest;
  readonly issues: readonly Issue[];
}

/** Index of links so rules do not each write their own nested loop. */
export class SnapshotIndex {
  private readonly issuesByKey = new Map<IssueKey, Issue>();
  private readonly prsById = new Map<string, PullRequest>();
  private readonly prKeysByIssue = new Map<IssueKey, string[]>();
  private readonly issueKeysByPr = new Map<string, IssueKey[]>();

  constructor(private readonly snapshot: Snapshot) {
    for (const issue of snapshot.issues) {
      this.issuesByKey.set(issue.key, issue);
    }
    for (const pr of snapshot.pullRequests) {
      this.prsById.set(prId(pr.repo, pr.number), pr);
    }
    for (const link of snapshot.links) {
      const id = prId(link.repo, link.number);
      this.prKeysByIssue.set(link.issueKey, [...(this.prKeysByIssue.get(link.issueKey) ?? []), id]);
      this.issueKeysByPr.set(id, [...(this.issueKeysByPr.get(id) ?? []), link.issueKey]);
    }
  }

  /** Pull requests believed to implement an issue. */
  pullRequestsFor(key: IssueKey): PullRequest[] {
    return (this.prKeysByIssue.get(key) ?? []).flatMap((id) => {
      const pr = this.prsById.get(id);
      return pr === undefined ? [] : [pr];
    });
  }

  /** Issues a pull request claims to implement. */
  issuesFor(repo: RepoFullName, number: number): Issue[] {
    return (this.issueKeysByPr.get(prId(repo, number)) ?? []).flatMap((key) => {
      const issue = this.issuesByKey.get(key);
      return issue === undefined ? [] : [issue];
    });
  }

  hasLink(repo: RepoFullName, number: number): boolean {
    return (this.issueKeysByPr.get(prId(repo, number)) ?? []).length > 0;
  }

  inActiveSprint(key: IssueKey): boolean {
    return this.snapshot.sprintIssueKeys.includes(key);
  }

  /** Local branches for a repo, keyed by branch name. */
  branchesIn(repo: RepoFullName): Branch[] {
    return this.snapshot.branches.filter((branch) => branch.repo === repo);
  }
}

function prId(repo: string, number: number): string {
  return `${repo}#${number}`;
}
