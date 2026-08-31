import type {
  Check,
  CheckConclusion,
  MyReviewState,
  Review,
  ReviewRequest,
  ReviewState,
} from '../../core/model/pull-request.ts';

/** Raw `gh pr view --json …` output. Every field optional: `gh` omits what it cannot resolve. */
export type RawPullRequest = Record<string, unknown>;

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function login(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  return str((value as { login?: unknown }).login);
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const REVIEW_STATES: ReadonlySet<string> = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
  'PENDING',
]);

export function oneOf<T extends string>(
  value: unknown,
  allowed: ReadonlySet<string>,
  fallback: T,
): T {
  return typeof value === 'string' && allowed.has(value) ? (value as T) : fallback;
}

/**
 * Flatten `statusCheckRollup`, which holds two incompatible shapes.
 *
 * `CheckRun` carries `name`, `status` and `conclusion`; `StatusContext` carries `context` and
 * `state` and has no `name` key at all (verified 2026-08-31 on PR 2390). Reading `.name` alone
 * silently produces a list of empty-named checks that never match a failure.
 */
export function mapChecks(rollup: unknown): Check[] {
  return list(rollup).map((entry) => {
    const record = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    const isCheckRun = record['__typename'] === 'CheckRun';
    const name = isCheckRun ? str(record['name']) : str(record['context']);
    const verdict = isCheckRun ? record['conclusion'] : record['state'];
    return { name: name === '' ? 'unnamed check' : name, conclusion: conclusion(verdict, isCheckRun, record) };
  });
}

function conclusion(verdict: unknown, isCheckRun: boolean, record: Record<string, unknown>): CheckConclusion {
  // A CheckRun that has not finished has a null conclusion; its `status` says why.
  if (isCheckRun && typeof verdict !== 'string' && record['status'] !== 'COMPLETED') {
    return 'PENDING';
  }
  switch (typeof verdict === 'string' ? verdict.toUpperCase() : '') {
    case 'SUCCESS':
      return 'SUCCESS';
    case 'FAILURE':
    case 'ERROR':
    case 'TIMED_OUT':
    case 'ACTION_REQUIRED':
      return 'FAILURE';
    case 'SKIPPED':
    case 'NEUTRAL':
      return 'SKIPPED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

/** Requested reviewers. Users and teams share one list, discriminated by `__typename`. */
export function mapReviewRequests(raw: unknown): ReviewRequest[] {
  const out: ReviewRequest[] = [];
  for (const entry of list(raw)) {
    const request = toReviewRequest(entry);
    if (request !== null) {
      out.push(request);
    }
  }
  return out;
}

function toReviewRequest(entry: unknown): ReviewRequest | null {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  if (record['__typename'] === 'Team') {
    const slug = nullableStr(record['slug']) ?? nullableStr(record['name']);
    return slug === null ? null : { kind: 'team', id: slug };
  }
  const user = nullableStr(record['login']);
  return user === null ? null : { kind: 'user', id: user };
}

export function mapReviews(raw: unknown): Review[] {
  const out: Review[] = [];
  for (const entry of list(raw)) {
    const record = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    const author = login(record['author']);
    if (author === '') {
      continue;
    }
    out.push({
      author,
      state: oneOf<ReviewState>(record['state'], REVIEW_STATES, 'COMMENTED'),
      submittedAt: str(record['submittedAt']),
    });
  }
  return out;
}

/**
 * Where I stand on a PR.
 *
 * `stale_review` is the case worth catching: I approved, the author pushed again, and GitHub
 * quietly keeps showing my approval. Comparing the head commit against the review timestamp is
 * the only way to notice that my verdict no longer covers the diff.
 */
export function myReviewState(
  reviews: readonly Review[],
  requests: readonly ReviewRequest[],
  me: string,
  headCommittedAt: string | null,
): MyReviewState {
  const mine = reviews.find((review) => review.author === me);
  if (mine === undefined) {
    return requests.some((r) => r.kind === 'user' && r.id === me)
      ? 'requested_not_started'
      : 'not_requested';
  }
  if (headCommittedAt !== null && mine.submittedAt !== '' && Date.parse(headCommittedAt) > Date.parse(mine.submittedAt)) {
    return 'stale_review';
  }
  switch (mine.state) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    default:
      return 'commented';
  }
}
