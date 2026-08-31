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
    const direct = requestedByName(pr, context.snapshot.identity.github);
    return [
      manual({
        id: 'review-requested-of-me',
        subject: subjectOf(pr),
        owner: 'me',
        ageDays: age,
        severity: severityFor(age, direct),
        summary: direct
          ? `${pr.author} has been waiting ${humanDays(age)} for my review`
          : `waiting ${humanDays(age)} on my team, not on me by name`,
        move: `Review ${pr.repo}#${pr.number} — ${pr.title}`,
      }),
    ];
  });
}

/** Whether a human chose me, rather than my membership of a team catching the request. */
function requestedByName(pr: PullRequest, me: string): boolean {
  return pr.reviewRequests.some((request) => request.kind === 'user' && request.id === me);
}

/**
 * A request addressed to me by name outranks one my team happened to receive.
 *
 * Nearly all of these arrive through a team, and treating those as equally urgent buries the
 * handful where someone actually asked for me. Team-routed requests stay visible but never
 * outrank work that is unambiguously mine.
 */
function severityFor(age: number, direct: boolean): Stall['severity'] {
  if (!direct) {
    return 'low';
  }
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
