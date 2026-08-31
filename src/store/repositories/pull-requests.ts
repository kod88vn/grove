import type { DatabaseSync } from 'node:sqlite';
import type { Mirrored } from '../../core/model/mirrored.ts';
import type {
  Check,
  Mergeability,
  MergeStateStatus,
  MyReviewState,
  PullRequest,
  PullRequestState,
  Review,
  ReviewDecision,
  ReviewRequest,
  ReviewState,
} from '../../core/model/pull-request.ts';

const UPSERT = `
INSERT INTO pull_requests (
  repo, number, title, body, url, state, is_draft, author,
  head_ref, base_ref, head_oid, created_at, updated_at, merged_at,
  mergeable, merge_state_status, review_decision, auto_merge_enabled,
  is_mine, my_review_state, raw, mirrored_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?
)
ON CONFLICT(repo, number) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  url = excluded.url,
  state = excluded.state,
  is_draft = excluded.is_draft,
  author = excluded.author,
  head_ref = excluded.head_ref,
  base_ref = excluded.base_ref,
  head_oid = excluded.head_oid,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  merged_at = excluded.merged_at,
  mergeable = excluded.mergeable,
  merge_state_status = excluded.merge_state_status,
  review_decision = excluded.review_decision,
  auto_merge_enabled = excluded.auto_merge_enabled,
  is_mine = excluded.is_mine,
  my_review_state = excluded.my_review_state,
  raw = excluded.raw,
  mirrored_at = excluded.mirrored_at
`;

const COLUMNS = `
  repo, number, title, body, url, state, is_draft, author,
  head_ref, base_ref, head_oid, created_at, updated_at, merged_at,
  mergeable, merge_state_status, review_decision, auto_merge_enabled, my_review_state
`;

interface PrRow {
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly state: string;
  readonly is_draft: number;
  readonly author: string;
  readonly head_ref: string;
  readonly base_ref: string;
  readonly head_oid: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly merged_at: string | null;
  readonly mergeable: string;
  readonly merge_state_status: string;
  readonly review_decision: string | null;
  readonly auto_merge_enabled: number;
  readonly my_review_state: string;
}

/**
 * Write a pull request and everything hanging off it.
 *
 * Reviews, requests and checks are replaced wholesale rather than merged: a dismissed review
 * and a removed reviewer are both deletions upstream, and an upsert-only strategy would leave
 * them in the mirror forever, which is precisely the kind of ghost that produces a confident
 * wrong answer.
 */
export function upsertPullRequest(
  db: DatabaseSync,
  mirrored: Mirrored<PullRequest>,
  isMine: boolean,
): void {
  const pr = mirrored.value;
  db.prepare(UPSERT).run(
    pr.repo,
    pr.number,
    pr.title,
    pr.body,
    pr.url,
    pr.state,
    pr.isDraft ? 1 : 0,
    pr.author,
    pr.headRefName,
    pr.baseRefName,
    pr.headRefOid,
    pr.createdAt,
    pr.updatedAt,
    pr.mergedAt,
    pr.mergeable,
    pr.mergeStateStatus,
    pr.reviewDecision,
    pr.autoMergeEnabled ? 1 : 0,
    isMine ? 1 : 0,
    pr.myReviewState,
    mirrored.raw,
    new Date().toISOString(),
  );
  replaceChildren(db, pr);
}

function replaceChildren(db: DatabaseSync, pr: PullRequest): void {
  for (const table of ['pr_reviews', 'pr_review_requests', 'pr_checks']) {
    db.prepare(`DELETE FROM ${table} WHERE repo = ? AND number = ?`).run(pr.repo, pr.number);
  }
  const review = db.prepare(
    'INSERT INTO pr_reviews (repo, number, author, state, submitted_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const entry of pr.latestReviews) {
    review.run(pr.repo, pr.number, entry.author, entry.state, entry.submittedAt);
  }
  const request = db.prepare(
    'INSERT INTO pr_review_requests (repo, number, kind, identifier) VALUES (?, ?, ?, ?)',
  );
  for (const entry of pr.reviewRequests) {
    request.run(pr.repo, pr.number, entry.kind, entry.id);
  }
  const check = db.prepare(
    'INSERT INTO pr_checks (repo, number, name, conclusion, started_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const entry of pr.checks) {
    check.run(pr.repo, pr.number, entry.name, entry.conclusion, entry.startedAt);
  }
}

export function readPullRequest(
  db: DatabaseSync,
  repo: string,
  number: number,
): PullRequest | null {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM pull_requests WHERE repo = ? AND number = ?`)
    .get(repo, number);
  return row === undefined ? null : hydrate(db, row as unknown as PrRow);
}

export function readOpenPullRequests(db: DatabaseSync): PullRequest[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM pull_requests WHERE state = 'OPEN' ORDER BY updated_at DESC`)
    .all();
  return rows.map((row) => hydrate(db, row as unknown as PrRow));
}

function hydrate(db: DatabaseSync, row: PrRow): PullRequest {
  return {
    repo: row.repo,
    number: row.number,
    title: row.title,
    body: row.body,
    url: row.url,
    state: row.state as PullRequestState,
    isDraft: row.is_draft === 1,
    author: row.author,
    headRefName: row.head_ref,
    baseRefName: row.base_ref,
    headRefOid: row.head_oid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mergedAt: row.merged_at,
    mergeable: row.mergeable as Mergeability,
    mergeStateStatus: row.merge_state_status as MergeStateStatus,
    reviewDecision: row.review_decision as ReviewDecision,
    autoMergeEnabled: row.auto_merge_enabled === 1,
    myReviewState: row.my_review_state as MyReviewState,
    latestReviews: readReviews(db, row.repo, row.number),
    reviewRequests: readRequests(db, row.repo, row.number),
    checks: readChecks(db, row.repo, row.number),
    issueKeys: readIssueKeys(db, row.repo, row.number),
  };
}

function readReviews(db: DatabaseSync, repo: string, number: number): Review[] {
  const rows = db
    .prepare('SELECT author, state, submitted_at FROM pr_reviews WHERE repo = ? AND number = ?')
    .all(repo, number) as unknown as {
    author: string;
    state: string;
    submitted_at: string;
  }[];
  return rows.map((r) => ({
    author: r.author,
    state: r.state as ReviewState,
    submittedAt: r.submitted_at,
  }));
}

function readRequests(db: DatabaseSync, repo: string, number: number): ReviewRequest[] {
  const rows = db
    .prepare('SELECT kind, identifier FROM pr_review_requests WHERE repo = ? AND number = ?')
    .all(repo, number) as unknown as { kind: string; identifier: string }[];
  return rows.map((r) => ({ kind: r.kind as ReviewRequest['kind'], id: r.identifier }));
}

function readChecks(db: DatabaseSync, repo: string, number: number): Check[] {
  const rows = db
    .prepare('SELECT name, conclusion, started_at FROM pr_checks WHERE repo = ? AND number = ?')
    .all(repo, number) as unknown as { name: string; conclusion: string; started_at: string }[];
  return rows.map((r) => ({
    name: r.name,
    conclusion: r.conclusion as Check['conclusion'],
    startedAt: r.started_at,
  }));
}

function readIssueKeys(db: DatabaseSync, repo: string, number: number): string[] {
  const rows = db
    .prepare('SELECT issue_key FROM issue_pr_links WHERE repo = ? AND number = ? ORDER BY issue_key')
    .all(repo, number) as unknown as { issue_key: string }[];
  return rows.map((r) => r.issue_key);
}
