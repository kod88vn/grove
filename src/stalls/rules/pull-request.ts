import { hasFailingChecks, isApproved } from '../../core/model/pull-request.ts';
import type { PullRequest } from '../../core/model/pull-request.ts';
import type { Stall } from '../../core/model/stall.ts';
import type { RuleContext } from '../context.ts';
import { daysSince, humanDays, manual, subjectOf } from '../context.ts';

/** PRs I wrote, which are the only ones whose progress is mine to drive. */
function mine(context: RuleContext): PullRequest[] {
  return context.snapshot.pullRequests.filter(
    (pr) => pr.state === 'OPEN' && pr.author === context.snapshot.identity.github,
  );
}

/**
 * Approved and still sitting there.
 *
 * The single most wasteful state in the whole system: the work is done, the review is done, and
 * nothing happens because merging is nobody's explicit job. This is the stall the project was
 * built for.
 */
export function prApprovedUnmerged(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    const age = daysSince(approvedAt(pr) ?? pr.updatedAt, context.clock);
    if (!isApproved(pr) || pr.isDraft || age < context.thresholds.prUnmergedDays) {
      return [];
    }
    return [
      manual({
        id: 'pr-approved-unmerged',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: age >= 3 ? 'high' : 'medium',
        summary: `approved ${humanDays(age)} ago, still open`,
        move: mergeBlockedBy(pr) ?? `Merge ${pr.repo}#${pr.number}`,
      }),
    ];
  });
}

/** What stands between an approved PR and the merge button, if anything. */
function mergeBlockedBy(pr: PullRequest): string | null {
  if (hasFailingChecks(pr)) {
    return `Fix failing checks on ${pr.repo}#${pr.number}, then merge`;
  }
  if (pr.mergeStateStatus === 'DIRTY') {
    return `Resolve conflicts on ${pr.repo}#${pr.number}, then merge`;
  }
  if (pr.mergeStateStatus === 'BEHIND') {
    return `Update ${pr.repo}#${pr.number} from ${pr.baseRefName}, then merge`;
  }
  return null;
}

function approvedAt(pr: PullRequest): string | null {
  const approvals = pr.latestReviews
    .filter((review) => review.state === 'APPROVED' && review.submittedAt !== '')
    .map((review) => review.submittedAt)
    .sort();
  return approvals[approvals.length - 1] ?? null;
}

/** Nobody has reviewed yet and the clock is running. */
export function prAwaitingReview(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    const age = daysSince(pr.createdAt, context.clock);
    const reviewed = pr.latestReviews.length > 0;
    if (pr.isDraft || reviewed || isApproved(pr)) {
      return [];
    }
    if (pr.reviewRequests.length === 0 || age < context.thresholds.prAwaitingReviewDays) {
      return [];
    }
    return [
      manual({
        id: 'pr-awaiting-review',
        subject: subjectOf(pr),
        owner: 'them',
        ageDays: age,
        severity: age >= 5 ? 'high' : 'medium',
        summary: `open ${humanDays(age)}, no review from ${reviewerNames(pr)}`,
        move: `Nudge ${reviewerNames(pr)} about ${pr.repo}#${pr.number}`,
      }),
    ];
  });
}

function reviewerNames(pr: PullRequest): string {
  const names = pr.reviewRequests.map((request) => request.id);
  return names.length === 0 ? 'nobody' : names.join(', ');
}

/**
 * Open, not draft, and nobody was ever asked.
 *
 * Distinct from `pr-awaiting-review` because the fix is different: there is no one to chase,
 * only a request to send. Left alone these sit forever, since no reviewer is waiting on them.
 */
export function prNoReviewers(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    const age = daysSince(pr.createdAt, context.clock);
    if (pr.isDraft || pr.reviewRequests.length > 0 || pr.latestReviews.length > 0) {
      return [];
    }
    return [
      manual({
        id: 'pr-no-reviewers',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: 'high',
        summary: `open ${humanDays(age)} with no reviewer requested`,
        move: `Request a reviewer on ${pr.repo}#${pr.number}`,
      }),
    ];
  });
}

/** Someone asked for changes; the ball is mine. */
export function prChangesRequested(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    if (pr.reviewDecision !== 'CHANGES_REQUESTED') {
      return [];
    }
    const age = daysSince(pr.updatedAt, context.clock);
    return [
      manual({
        id: 'pr-changes-requested',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: age >= 3 ? 'high' : 'medium',
        summary: `changes requested, untouched for ${humanDays(age)}`,
        move: `Address review comments on ${pr.repo}#${pr.number}`,
      }),
    ];
  });
}

export function prCiFailing(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    if (!hasFailingChecks(pr)) {
      return [];
    }
    const failed = pr.checks.filter((check) => check.conclusion === 'FAILURE');
    const age = daysSince(pr.updatedAt, context.clock);
    return [
      manual({
        id: 'pr-ci-failing',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: 'high',
        summary: `failing: ${failed.map((check) => check.name).join(', ')}`,
        move: `Fix ${failed.map((check) => check.name).join(', ')} on ${pr.repo}#${pr.number}`,
      }),
    ];
  });
}

/** Conflicted branches decay: the longer they sit, the worse the merge gets. */
export function prConflicted(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    if (pr.mergeable !== 'CONFLICTING' && pr.mergeStateStatus !== 'DIRTY') {
      return [];
    }
    const age = daysSince(pr.updatedAt, context.clock);
    return [
      manual({
        id: 'pr-conflicted',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: 'high',
        summary: `conflicts with ${pr.baseRefName}`,
        move: `Rebase ${pr.repo}#${pr.number} on ${pr.baseRefName}`,
      }),
    ];
  });
}

/**
 * A draft nobody will ever look at.
 *
 * Drafts are invisible to reviewers, so an aging one is work that has silently left the queue
 * without anyone deciding to drop it.
 */
export function prDraftAging(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    const age = daysSince(pr.updatedAt, context.clock);
    if (!pr.isDraft || age < context.thresholds.noActivityDays) {
      return [];
    }
    return [
      manual({
        id: 'pr-draft-aging',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: 'medium',
        summary: `draft, untouched for ${humanDays(age)}`,
        move: `Mark ${pr.repo}#${pr.number} ready for review or close it`,
      }),
    ];
  });
}

/**
 * No Jira key anywhere, so this PR can never close a ticket.
 *
 * The organisation enforces a `JIRA Link` status check, which means an unlinked PR is also
 * unmergeable — it is blocked and the reason is easy to miss.
 */
export function prNoJiraLink(context: RuleContext): Stall[] {
  return mine(context).flatMap((pr) => {
    if (context.index.hasLink(pr.repo, pr.number) || pr.issueKeys.length > 0) {
      return [];
    }
    const age = daysSince(pr.createdAt, context.clock);
    return [
      manual({
        id: 'pr-no-jira-link',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: 'high',
        summary: 'no Jira key in the branch, title or body',
        move: `Add a Jira key to ${pr.repo}#${pr.number}`,
      }),
    ];
  });
}
