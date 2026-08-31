import type { Iso8601 } from '../clock.ts';
import type { IssueKey } from './issue.ts';

/** `owner/name`, e.g. `clover/web-storefront-engine`. */
export type RepoFullName = string;

export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED';

/**
 * GitHub's aggregate review verdict.
 *
 * `null` when no review is required and none has been given.
 */
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

/**
 * Whether the branch can be merged at all.
 *
 * `UNKNOWN` is returned on the first read of a PR because GitHub computes mergeability
 * lazily (verified 2026-08-31 on PR 2390: first read UNKNOWN, second read MERGEABLE). It
 * means "not computed yet", never "no" — no stall may be raised from it.
 */
export type Mergeability = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';

/**
 * Why a mergeable branch still cannot be merged.
 *
 * `BLOCKED` is the interesting one: the branch is clean but a required check or review is
 * missing. `CLEAN` is the only value that means "merging would succeed right now".
 */
export type MergeStateStatus =
  | 'CLEAN'
  | 'BLOCKED'
  | 'BEHIND'
  | 'DIRTY'
  | 'DRAFT'
  | 'HAS_HOOKS'
  | 'UNSTABLE'
  | 'UNKNOWN';

export type ReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING';

export interface Review {
  readonly author: string;
  readonly state: ReviewState;
  readonly submittedAt: Iso8601;
}

/** A requested reviewer. GitHub mixes users and teams in one list, keyed by `__typename`. */
export interface ReviewRequest {
  readonly kind: 'user' | 'team';
  /** A user login, or a team slug such as `clover/services-team`. */
  readonly id: string;
}

export type CheckConclusion = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'SKIPPED' | 'CANCELLED';

/**
 * One entry of `statusCheckRollup`, normalised.
 *
 * The raw list holds two different shapes: `CheckRun` carries `name`/`status`/`conclusion`,
 * while `StatusContext` carries `context`/`state` and no `name` at all (verified 2026-08-31).
 * Connectors flatten both into this.
 */
export interface Check {
  readonly name: string;
  readonly conclusion: CheckConclusion;
}

/** How I stand in relation to a PR someone asked me to look at. */
export type MyReviewState =
  | 'not_requested'
  | 'requested_not_started'
  | 'approved'
  | 'changes_requested'
  | 'commented'
  /** I reviewed it, then the author pushed more commits. My verdict no longer covers the diff. */
  | 'stale_review';

export interface PullRequest {
  readonly repo: RepoFullName;
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly state: PullRequestState;
  readonly isDraft: boolean;
  readonly author: string;
  readonly headRefName: string;
  readonly baseRefName: string;
  readonly headRefOid: string;
  readonly createdAt: Iso8601;
  readonly updatedAt: Iso8601;
  readonly mergedAt: Iso8601 | null;
  readonly mergeable: Mergeability;
  readonly mergeStateStatus: MergeStateStatus;
  readonly reviewDecision: ReviewDecision;
  readonly reviewRequests: readonly ReviewRequest[];
  readonly latestReviews: readonly Review[];
  readonly checks: readonly Check[];
  readonly autoMergeEnabled: boolean;
  /**
   * Jira keys parsed out of the branch name, title and body.
   *
   * GitHub's own `closingIssuesReferences` is always empty here because there is no Jira/GHE
   * integration on this instance (verified 2026-08-31), so correlation is ours to do.
   */
  readonly issueKeys: readonly IssueKey[];
  readonly myReviewState: MyReviewState;
}

export function isApproved(pr: PullRequest): boolean {
  return pr.reviewDecision === 'APPROVED';
}

export function hasFailingChecks(pr: PullRequest): boolean {
  return pr.checks.some((check) => check.conclusion === 'FAILURE');
}

/** True only when merging would succeed right now. `UNKNOWN` deliberately yields false. */
export function isReadyToMerge(pr: PullRequest): boolean {
  return (
    pr.state === 'OPEN' &&
    !pr.isDraft &&
    pr.mergeable === 'MERGEABLE' &&
    pr.mergeStateStatus === 'CLEAN' &&
    isApproved(pr)
  );
}
