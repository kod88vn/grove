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
 * Flatten `statusCheckRollup` into one entry per check name.
 *
 * Two problems are handled here. First, the list holds two incompatible shapes: `CheckRun`
 * carries `name`/`conclusion`, while `StatusContext` carries `context`/`state` and has no
 * `name` key at all — reading `.name` alone yields a list of blank-named checks that never
 * match a failure. Second, a name can appear repeatedly, once per workflow run; only the most
 * recent run reflects reality, so an older entry must never outvote it.
 */
export function mapChecks(rollup: unknown): Check[] {
  const latest = new Map<string, Check>();
  for (const entry of list(rollup)) {
    const check = toCheck(entry);
    const existing = latest.get(check.name);
    if (existing === undefined || existing.startedAt <= check.startedAt) {
      latest.set(check.name, check);
    }
  }
  return [...latest.values()];
}

function toCheck(entry: unknown): Check {
  const record = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
    string,
    unknown
  >;
  const isCheckRun = record['__typename'] === 'CheckRun';
  const name = isCheckRun ? str(record['name']) : str(record['context']);
  const verdict = isCheckRun ? record['conclusion'] : record['state'];
  return {
    name: name === '' ? 'unnamed check' : name,
    conclusion: conclusion(verdict, isCheckRun, record),
    // ISO-8601 UTC strings sort lexicographically, so plain comparison orders runs correctly.
    startedAt: str(record['startedAt']),
  };
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

/** Everything needed to decide where I stand on one PR. */
export interface MyReviewContext {
  readonly reviews: readonly Review[];
  readonly requests: readonly ReviewRequest[];
  readonly me: string;
  /** Teams I belong to, as `org/slug`. A request to one of these is a request of me. */
  readonly teams: readonly string[];
  readonly headCommittedAt: string | null;
}

/**
 * Where I stand on a PR.
 *
 * Two cases are easy to get wrong. `stale_review` is the one worth catching: I approved, the
 * author pushed again, and GitHub quietly keeps showing my approval — comparing the head commit
 * against the review timestamp is the only way to notice my verdict no longer covers the diff.
 *
 * The other is team routing. Most review requests here never name me: 94 of 111 arrive
 * addressed to `clover/services-team` (measured 2026-08-31). Matching only on login reported a
 * third of my review queue and silently hid the rest, so team membership counts as a request.
 */
export function myReviewState(context: MyReviewContext): MyReviewState {
  const { reviews, me, headCommittedAt } = context;
  const mine = reviews.find((review) => review.author === me);
  if (mine === undefined) {
    return isRequestedOfMe(context) ? 'requested_not_started' : 'not_requested';
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

/** A review is wanted from me if I am named, or if any team I belong to is. */
export function isRequestedOfMe(context: Pick<MyReviewContext, 'requests' | 'me' | 'teams'>): boolean {
  return context.requests.some((request) =>
    request.kind === 'user'
      ? request.id === context.me
      : context.teams.includes(request.id),
  );
}
