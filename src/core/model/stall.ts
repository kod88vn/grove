import type { ProposedAction } from './action.ts';
import type { IssueKey } from './issue.ts';
import type { RepoFullName } from './pull-request.ts';

/**
 * Every way work can be stuck.
 *
 * This union is the product specification. Each member is a rule in `src/stalls/`, and each
 * rule owes a positive and a negative test.
 */
export type StallId =
  // Ticket-side
  | 'pr-merged-ticket-open'
  | 'ticket-resolved-pr-open'
  | 'ticket-in-progress-no-branch'
  | 'branch-no-pr'
  | 'ticket-not-in-sprint'
  | 'ticket-stale'
  // PR-side
  | 'pr-approved-unmerged'
  | 'pr-awaiting-review'
  | 'pr-no-reviewers'
  | 'pr-changes-requested'
  | 'pr-ci-failing'
  | 'pr-conflicted'
  | 'pr-draft-aging'
  | 'pr-no-jira-link'
  | 'review-requested-of-me'
  | 'my-review-stale'
  | 'pr-merged-branch-exists'
  // Sprint
  | 'sprint-ending-incomplete';

/**
 * Who has to move next.
 *
 * The whole point of the dashboard split. `them` items are not my backlog; showing them mixed
 * in with `me` items is what makes a review queue feel like a to-do list.
 */
export type MoveOwner = 'me' | 'them';

export type Severity = 'high' | 'medium' | 'low';

export type StallSubject =
  | { readonly kind: 'issue'; readonly key: IssueKey }
  | { readonly kind: 'pull_request'; readonly repo: RepoFullName; readonly number: number }
  | { readonly kind: 'branch'; readonly repo: RepoFullName; readonly branch: string }
  | { readonly kind: 'sprint'; readonly id: number };

export interface NextMove {
  /** Imperative, specific, and naming a person where one is responsible. */
  readonly description: string;
  /** Present only for the two executable moves; `null` means "go do this yourself". */
  readonly action: ProposedAction | null;
}

export interface Stall {
  readonly id: StallId;
  readonly subject: StallSubject;
  readonly owner: MoveOwner;
  /** How long it has been stuck, not how old the item is. */
  readonly ageDays: number;
  readonly severity: Severity;
  /** One line describing the state, e.g. `approved 4 days ago, still open`. */
  readonly summary: string;
  readonly nextMove: NextMove;
}

/**
 * How long something must sit before it counts as stuck.
 *
 * Defaults chosen with the user on 2026-08-31. Zero means "the moment it is true" — a merged
 * PR whose ticket is still open is wrong immediately, not after a grace period.
 */
export interface StallThresholds {
  readonly prUnmergedDays: number;
  readonly prAwaitingReviewDays: number;
  readonly ticketPrMismatchDays: number;
  readonly noActivityDays: number;
  readonly sprintEndingDays: number;
}

export const DEFAULT_THRESHOLDS: StallThresholds = {
  prUnmergedDays: 1,
  prAwaitingReviewDays: 2,
  ticketPrMismatchDays: 0,
  noActivityDays: 3,
  sprintEndingDays: 2,
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Most urgent first: my move before theirs, then severity, then longest-stuck. */
export function compareStalls(a: Stall, b: Stall): number {
  if (a.owner !== b.owner) {
    return a.owner === 'me' ? -1 : 1;
  }
  const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (bySeverity !== 0) {
    return bySeverity;
  }
  return b.ageDays - a.ageDays;
}
