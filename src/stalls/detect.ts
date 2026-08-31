import type { Clock } from '../core/clock.ts';
import type { Stall, StallThresholds } from '../core/model/stall.ts';
import { compareStalls, DEFAULT_THRESHOLDS } from '../core/model/stall.ts';
import type { Rule } from './context.ts';
import { buildContext } from './context.ts';
import type { Snapshot } from './snapshot.ts';
import { branchNoPr, prMergedBranchExists, sprintEndingIncomplete } from './rules/branch.ts';
import {
  prApprovedUnmerged,
  prAwaitingReview,
  prChangesRequested,
  prCiFailing,
  prConflicted,
  prDraftAging,
  prNoJiraLink,
  prNoReviewers,
} from './rules/pull-request.ts';
import { myReviewStale, reviewRequestedOfMe } from './rules/review.ts';
import {
  prMergedTicketOpen,
  ticketInProgressNoBranch,
  ticketNotInSprint,
  ticketResolvedPrOpen,
  ticketStale,
} from './rules/ticket.ts';

/**
 * Every rule in the catalog.
 *
 * Order here is irrelevant — results are sorted by urgency — but completeness is not. Each
 * `StallId` must appear exactly once, which `detect` asserts is true.
 */
export const RULES: readonly Rule[] = [
  prMergedTicketOpen,
  ticketResolvedPrOpen,
  ticketInProgressNoBranch,
  ticketNotInSprint,
  ticketStale,
  prApprovedUnmerged,
  prAwaitingReview,
  prNoReviewers,
  prChangesRequested,
  prCiFailing,
  prConflicted,
  prDraftAging,
  prNoJiraLink,
  reviewRequestedOfMe,
  myReviewStale,
  branchNoPr,
  prMergedBranchExists,
  sprintEndingIncomplete,
];

/**
 * Run every rule over a snapshot and return what is stuck, most urgent first.
 *
 * Pure: the same snapshot, thresholds and instant always produce the same list.
 */
export function detect(
  snapshot: Snapshot,
  clock: Clock,
  thresholds: StallThresholds = DEFAULT_THRESHOLDS,
): Stall[] {
  const context = buildContext(snapshot, thresholds, clock);
  return RULES.flatMap((rule) => rule(context)).sort(compareStalls);
}
