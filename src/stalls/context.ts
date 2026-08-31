import type { Clock } from '../core/clock.ts';
import { ageInDays } from '../core/clock.ts';
import type { Severity, Stall, StallId, StallSubject, StallThresholds } from '../core/model/stall.ts';
import type { PullRequest } from '../core/model/pull-request.ts';
import type { Issue } from '../core/model/issue.ts';
import type { Snapshot } from './snapshot.ts';
import { SnapshotIndex } from './snapshot.ts';

/** Everything a rule may use. No I/O, no ambient clock. */
export interface RuleContext {
  readonly snapshot: Snapshot;
  readonly index: SnapshotIndex;
  readonly thresholds: StallThresholds;
  readonly clock: Clock;
}

export type Rule = (context: RuleContext) => Stall[];

export function buildContext(
  snapshot: Snapshot,
  thresholds: StallThresholds,
  clock: Clock,
): RuleContext {
  return { snapshot, index: new SnapshotIndex(snapshot), thresholds, clock };
}

/**
 * Days since a timestamp, treating a missing one as "unknown, so not yet stuck".
 *
 * Returning 0 rather than Infinity is deliberate: a rule should never fire *because* data is
 * missing. A stall reported on absent evidence cannot be acted on and destroys trust in the
 * whole list.
 */
export function daysSince(at: string | null, clock: Clock): number {
  return at === null || at === '' ? 0 : ageInDays(at, clock);
}

export function subjectOf(pr: PullRequest): StallSubject {
  return { kind: 'pull_request', repo: pr.repo, number: pr.number };
}

export function issueSubject(issue: Issue): StallSubject {
  return { kind: 'issue', key: issue.key };
}

export interface StallDraft {
  readonly id: StallId;
  readonly subject: StallSubject;
  readonly owner: Stall['owner'];
  readonly ageDays: number;
  readonly severity: Severity;
  readonly summary: string;
  readonly move: string;
}

/** Build a stall whose next move is manual. The two executable moves are attached in R7. */
export function manual(draft: StallDraft): Stall {
  return {
    id: draft.id,
    subject: draft.subject,
    owner: draft.owner,
    ageDays: round(draft.ageDays),
    severity: draft.severity,
    summary: draft.summary,
    nextMove: { description: draft.move, action: null },
  };
}

function round(days: number): number {
  return Math.round(days * 10) / 10;
}

/** `4 days`, `1 day`, `today` — used in summaries, so they read like a sentence. */
export function humanDays(days: number): string {
  const whole = Math.floor(days);
  if (whole <= 0) {
    return 'today';
  }
  return whole === 1 ? '1 day' : `${whole} days`;
}

/**
 * The same span, phrased as a point in the past.
 *
 * Separate from `humanDays` because "today" is already a complete phrase: appending "ago" at
 * the call site produced "merged today ago" on every PR merged within 24 hours.
 */
export function humanAgo(days: number): string {
  const spoken = humanDays(days);
  return spoken === 'today' ? 'today' : `${spoken} ago`;
}
