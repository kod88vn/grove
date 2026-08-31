import type { IssueKey } from './issue.ts';
import type { RepoFullName } from './pull-request.ts';

/**
 * Which text yielded the key.
 *
 * Ranked by how deliberate it is. A branch name is chosen once, on purpose, and rarely lies. A
 * title is usually right. A body mention is often just a cross-reference to somebody else's
 * ticket, so it is the weakest evidence that this PR is the work for that issue.
 */
export type LinkSource = 'branch' | 'title' | 'body';

/**
 * A believed correspondence between an issue and a pull request.
 *
 * Inferred, never authoritative: GitHub Enterprise reports no Jira relationship of its own
 * (`closingIssuesReferences` is always empty here), so every link is parsed out of text.
 */
export interface IssuePrLink {
  readonly issueKey: IssueKey;
  readonly repo: RepoFullName;
  readonly number: number;
  readonly source: LinkSource;
}
