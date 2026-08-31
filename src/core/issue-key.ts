import type { IssueKey } from './model/issue.ts';

/**
 * Jira key pattern: an uppercase project key, a hyphen, a number.
 *
 * Anchored with `\b` on both sides so `WS-123` is found inside `feature/WS-123-thing` but
 * `AWS-1` inside `PAWS-1` is not.
 */
const ISSUE_KEY_PATTERN = /\b([A-Z][A-Z0-9]+)-(\d+)\b/g;

/**
 * Pull Jira keys out of free text, preserving first-seen order and dropping duplicates.
 *
 * This is the only link between a PR and a ticket. GitHub's `closingIssuesReferences` is
 * always empty on this instance because there is no Jira integration (verified 2026-08-31),
 * so branch name, PR title and PR body are all the evidence there is.
 */
export function parseIssueKeys(text: string, allowedProjects?: readonly string[]): IssueKey[] {
  const allowed = allowedProjects === undefined ? null : new Set(allowedProjects);
  const found = new Set<IssueKey>();
  for (const match of text.matchAll(ISSUE_KEY_PATTERN)) {
    const project = match[1];
    if (project === undefined) {
      continue;
    }
    if (allowed !== null && !allowed.has(project)) {
      continue;
    }
    found.add(match[0]);
  }
  return [...found];
}

/**
 * Collect keys from every place a PR might carry one.
 *
 * Branch name first: it is the most reliable signal because the branch is named before the PR
 * exists, and the convention (`feature/WS-1234-description`) is enforced by habit rather than
 * by a template that people paste over.
 */
export function issueKeysForPullRequest(
  parts: { branch: string; title: string; body: string },
  allowedProjects?: readonly string[],
): IssueKey[] {
  const text = `${parts.branch}\n${parts.title}\n${parts.body}`;
  return parseIssueKeys(text, allowedProjects);
}
