import { parseIssueKeys } from '../core/issue-key.ts';
import type { PullRequest } from '../core/model/pull-request.ts';
import type { IssuePrLink, LinkSource } from '../store/repositories/links.ts';

/**
 * Derive ticket links for a pull request from its text.
 *
 * This instance has no Jira integration — `closingIssuesReferences` is empty on every PR — so
 * parsing is the only bridge that exists. Each source is parsed separately rather than as one
 * blob because the source is itself information: a key in the branch name was a deliberate act
 * at branch-creation time, while a key in the body may be an incidental mention of a related
 * ticket. The strongest source wins when the same key appears twice.
 */
const PRECEDENCE: readonly LinkSource[] = ['branch', 'title', 'body'];

export function correlate(
  pullRequest: PullRequest,
  projectKeys?: readonly string[],
): IssuePrLink[] {
  const bySource: Record<LinkSource, string[]> = {
    branch: parseIssueKeys(pullRequest.headRefName, projectKeys),
    title: parseIssueKeys(pullRequest.title, projectKeys),
    body: parseIssueKeys(pullRequest.body, projectKeys),
  };

  const strongest = new Map<string, LinkSource>();
  for (const source of PRECEDENCE) {
    for (const key of bySource[source]) {
      if (!strongest.has(key)) {
        strongest.set(key, source);
      }
    }
  }

  return [...strongest].map(([issueKey, source]) => ({
    issueKey,
    repo: pullRequest.repo,
    number: pullRequest.number,
    source,
  }));
}
