import type { PullRequest } from '../../core/model/pull-request.ts';
import type { Stall } from '../../core/model/stall.ts';
import type { RuleContext } from '../context.ts';
import { daysSince, humanDays, manual, subjectOf } from '../context.ts';

/**
 * Someone is waiting on me.
 *
 * Most of these arrive addressed to a team rather than to me by name, which is why the mirror
 * resolves team membership; without it this rule reports about a sixth of its true size.
 */
export function reviewRequestedOfMe(context: RuleContext): Stall[] {
  return context.snapshot.pullRequests.flatMap((pr) => {
    if (pr.state !== 'OPEN' || pr.myReviewState !== 'requested_not_started') {
      return [];
    }
    if (pr.author === context.snapshot.identity.github || pr.isDraft) {
      return [];
    }
    const age = daysSince(pr.createdAt, context.clock);
    if (age < context.thresholds.prAwaitingReviewDays) {
      return [];
    }
    return [
      manual({
        id: 'review-requested-of-me',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: severityFor(age),
        summary: `${pr.author} has been waiting ${humanDays(age)} for my review`,
        move: `Review ${pr.repo}#${pr.number} — ${pr.title}`,
      }),
    ];
  });
}

function severityFor(age: number): Stall['severity'] {
  if (age >= 7) {
    return 'high';
  }
  return age >= 3 ? 'medium' : 'low';
}

/**
 * My approval no longer covers the diff.
 *
 * GitHub keeps displaying an approval after the author pushes again, so this is invisible in
 * the UI: the author believes they are approved and waits, while nobody has actually looked at
 * the current code.
 */
export function myReviewStale(context: RuleContext): Stall[] {
  return context.snapshot.pullRequests.flatMap((pr) => {
    if (pr.state !== 'OPEN' || pr.myReviewState !== 'stale_review') {
      return [];
    }
    const age = daysSince(pr.updatedAt, context.clock);
    return [
      manual({
        id: 'my-review-stale',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: 'medium',
        summary: `${pr.author} pushed after I approved`,
        move: `Re-review ${pr.repo}#${pr.number}; my approval predates the current commit`,
      }),
    ];
  });
}

export function isOpenAndNotMine(pr: PullRequest, me: string): boolean {
  return pr.state === 'OPEN' && pr.author !== me;
}
