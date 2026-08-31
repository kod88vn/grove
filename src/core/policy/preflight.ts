import type { Issue } from '../model/issue.ts';
import { isIssueDone } from '../model/issue.ts';
import type { PullRequest } from '../model/pull-request.ts';
import { hasFailingChecks, isApproved } from '../model/pull-request.ts';
import type { Denial } from './denylist.ts';
import { isProtectedBranch } from './denylist.ts';

/**
 * The checks that run immediately before a mutation, on freshly re-read state.
 *
 * These are deliberately separate from the stall rules. A stall rule answers "does this look
 * stuck?" from mirrored data that may be minutes old; these answer "is it still safe to act?"
 * from data read seconds ago. A PR can pick up a change request between the two.
 *
 * Every function returns the reason for refusal, or null to permit. Returning a reason rather
 * than throwing means the refusal can be written to the audit trail and shown to me.
 */

/**
 * Refuse to merge unless every one of these holds.
 *
 * The Jira-link requirement is not bureaucracy: an unlinked PR cannot be traced back to the
 * work it belongs to, so merging it silently detaches the change from its ticket.
 */
export function refuseMerge(pr: PullRequest, me: string): Denial | null {
  return (
    refuseMergeState(pr) ??
    refuseMergeOwnership(pr, me) ??
    refuseMergeReview(pr) ??
    refuseMergeLinkage(pr)
  );
}

function refuseMergeState(pr: PullRequest): Denial | null {
  if (pr.state !== 'OPEN') {
    return { rule: 'not-open', because: `it is ${pr.state.toLowerCase()}, not open` };
  }
  if (pr.isDraft) {
    return { rule: 'draft', because: 'it is still a draft' };
  }
  if (pr.mergeable === 'CONFLICTING') {
    return { rule: 'conflicting', because: `it conflicts with ${pr.baseRefName}` };
  }
  if (isProtectedBranch(pr.headRefName)) {
    return {
      rule: 'protected-head',
      because: `its head branch is ${pr.headRefName}, which is protected`,
    };
  }
  return null;
}

function refuseMergeOwnership(pr: PullRequest, me: string): Denial | null {
  if (pr.author !== me) {
    return {
      rule: 'not-mine',
      because: `${pr.author} wrote it; merging someone else's work is not mine to decide`,
    };
  }
  return null;
}

function refuseMergeReview(pr: PullRequest): Denial | null {
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return { rule: 'changes-requested', because: 'a reviewer asked for changes' };
  }
  if (!isApproved(pr)) {
    return { rule: 'not-approved', because: 'nobody has approved it' };
  }
  if (hasFailingChecks(pr)) {
    return { rule: 'checks-failing', because: 'at least one check is failing' };
  }
  return null;
}

function refuseMergeLinkage(pr: PullRequest): Denial | null {
  if (pr.issueKeys.length === 0) {
    return {
      rule: 'no-jira-link',
      because: 'it names no Jira issue, so the merge could not be traced to any ticket',
    };
  }
  return null;
}

/**
 * Refuse to resolve a ticket unless the code it describes has actually shipped.
 *
 * Resolving on the strength of an open PR is the failure this project exists to prevent,
 * inverted: it makes the board look finished while the work is not.
 */
export function refuseResolve(
  issue: Issue,
  linked: readonly PullRequest[],
  me: string,
): Denial | null {
  if (isIssueDone(issue)) {
    return { rule: 'already-done', because: `it is already ${issue.status}` };
  }
  if (issue.assignee?.name !== me) {
    return {
      rule: 'not-mine',
      because: `it is assigned to ${issue.assignee?.displayName ?? 'nobody'}, not to me`,
    };
  }
  if (linked.length === 0) {
    return { rule: 'no-linked-pr', because: 'no pull request references it' };
  }
  const unmerged = linked.filter((pr) => pr.state !== 'MERGED');
  if (unmerged.length > 0) {
    return {
      rule: 'pr-not-merged',
      because: `${describe(unmerged)} still not merged`,
    };
  }
  return null;
}

function describe(prs: readonly PullRequest[]): string {
  const names = prs.map((pr) => `${pr.repo}#${pr.number}`);
  const first = names[0] ?? 'its pull request';
  return names.length === 1 ? `${first} is` : `${first} and ${names.length - 1} more are`;
}
