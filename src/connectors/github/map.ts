import { issueKeysForPullRequest } from '../../core/issue-key.ts';
import type {
  Mergeability,
  MergeStateStatus,
  PullRequest,
  PullRequestState,
  ReviewDecision,
} from '../../core/model/pull-request.ts';
import {
  list,
  login,
  mapChecks,
  mapReviewRequests,
  mapReviews,
  myReviewState,
  nullableStr,
  oneOf,
  str,
  type RawPullRequest,
} from './map-parts.ts';

const PR_STATES: ReadonlySet<string> = new Set(['OPEN', 'CLOSED', 'MERGED']);
const MERGEABILITY: ReadonlySet<string> = new Set(['MERGEABLE', 'CONFLICTING', 'UNKNOWN']);
const MERGE_STATES: ReadonlySet<string> = new Set([
  'CLEAN',
  'BLOCKED',
  'BEHIND',
  'DIRTY',
  'DRAFT',
  'HAS_HOOKS',
  'UNSTABLE',
  'UNKNOWN',
]);
const REVIEW_DECISIONS: ReadonlySet<string> = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'REVIEW_REQUIRED',
]);

export interface MapPullRequestContext {
  readonly repo: string;
  /** My GitHub login, e.g. `jay-quach`. Decides `is mine` and `myReviewState`. */
  readonly me: string;
  /** Restrict issue-key parsing to these Jira projects, e.g. `['WS']`. */
  readonly projectKeys?: readonly string[];
}

export function mapPullRequest(raw: RawPullRequest, context: MapPullRequestContext): PullRequest {
  const number = raw['number'];
  if (typeof number !== 'number') {
    throw new Error(`Pull request in ${context.repo} has no number`);
  }
  const title = str(raw['title']);
  const body = str(raw['body']);
  const headRefName = str(raw['headRefName']);
  const reviews = mapReviews(raw['latestReviews']);
  const reviewRequests = mapReviewRequests(raw['reviewRequests']);

  return {
    repo: context.repo,
    number,
    title,
    body,
    url: str(raw['url']),
    state: oneOf<PullRequestState>(raw['state'], PR_STATES, 'OPEN'),
    isDraft: raw['isDraft'] === true,
    author: login(raw['author']),
    headRefName,
    baseRefName: str(raw['baseRefName']),
    headRefOid: str(raw['headRefOid']),
    createdAt: str(raw['createdAt']),
    updatedAt: str(raw['updatedAt']),
    mergedAt: nullableStr(raw['mergedAt']),
    mergeable: oneOf<Mergeability>(raw['mergeable'], MERGEABILITY, 'UNKNOWN'),
    mergeStateStatus: oneOf<MergeStateStatus>(raw['mergeStateStatus'], MERGE_STATES, 'UNKNOWN'),
    reviewDecision: reviewDecision(raw['reviewDecision']),
    reviewRequests,
    latestReviews: reviews,
    checks: mapChecks(raw['statusCheckRollup']),
    // `autoMergeRequest` is null unless auto-merge is armed; its contents do not matter here.
    autoMergeEnabled: raw['autoMergeRequest'] !== null && raw['autoMergeRequest'] !== undefined,
    issueKeys: issueKeysForPullRequest(
      { branch: headRefName, title, body },
      context.projectKeys,
    ),
    myReviewState: myReviewState(reviews, reviewRequests, context.me, headCommittedAt(raw)),
  };
}

function reviewDecision(value: unknown): ReviewDecision {
  return typeof value === 'string' && REVIEW_DECISIONS.has(value)
    ? (value as Exclude<ReviewDecision, null>)
    : null;
}

/**
 * When the head commit landed, used to tell a live approval from a stale one.
 *
 * `gh` returns commits oldest-first, so the head is the last entry. When commits were not
 * requested, fall back to the PR's own `updatedAt`: it moves on push, which is the signal we
 * need, at the cost of also moving on a label change. Over-reporting a stale review is the
 * safe direction.
 */
function headCommittedAt(raw: RawPullRequest): string | null {
  const commits = list(raw['commits']);
  const head = commits.at(-1);
  if (typeof head === 'object' && head !== null) {
    const committedDate = (head as { committedDate?: unknown }).committedDate;
    const resolved = nullableStr(committedDate);
    if (resolved !== null) {
      return resolved;
    }
  }
  return nullableStr(raw['updatedAt']);
}
