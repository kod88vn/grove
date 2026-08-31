export interface JiraCredentials {
  /** e.g. `https://jira.corp.clover.com` — no trailing slash. */
  readonly baseUrl: string;
  /** Bearer token. Held in memory only; never logged, never returned in a response. */
  readonly token: string;
}

export class JiraRequestError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly httpStatus: number,
    readonly body: string,
  ) {
    super(`Jira ${method} ${path} failed with ${httpStatus}: ${truncate(body)}`);
    this.name = 'JiraRequestError';
  }
}

function truncate(text: string): string {
  return text.length <= 400 ? text : `${text.slice(0, 400)}…`;
}

/**
 * One Jira REST call.
 *
 * A non-2xx response keeps its body, because Jira puts the actionable detail there: a rejected
 * transition names the field it wanted in `errors`. Discarding that turns a fixable problem
 * into "it returned 400".
 */
export async function jiraRequest<T>(
  credentials: JiraCredentials,
  request: { method: 'GET' | 'POST'; path: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${credentials.baseUrl}${request.path}`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      Accept: 'application/json',
      ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new JiraRequestError(request.method, request.path, response.status, text);
  }
  // A successful transition answers 204 with no body. Parsing that threw "Unexpected end of
  // JSON input", which the executor could only read as a failed mutation — so the audit trail
  // recorded `failed` for a change Jira had already applied. A mutation log that is wrong
  // about what happened is worse than no mutation log.
  if (text === '') {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

interface PageShape {
  readonly startAt?: number;
  readonly maxResults?: number;
  readonly total?: number;
  readonly isLast?: boolean;
}

/**
 * Walk a paged Jira collection to exhaustion.
 *
 * The two APIs disagree about how a caller knows it has finished: the Agile API returns
 * `isLast`, while core search returns only `total` and expects arithmetic. Handling just one
 * of them silently truncates the other at the first page.
 */
export async function paginate<TItem>(
  fetchPage: (startAt: number) => Promise<PageShape & Record<string, unknown>>,
  extract: (page: Record<string, unknown>) => TItem[],
  pageSize = 50,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let startAt = 0;

  for (;;) {
    const page = await fetchPage(startAt);
    const batch = extract(page);
    items.push(...batch);

    if (page.isLast === true || batch.length === 0) {
      return items;
    }
    startAt += batch.length;
    if (page.total !== undefined && startAt >= page.total) {
      return items;
    }
    // Neither marker present and the page came back full: keep going, but never spin forever
    // on a server that ignores startAt.
    if (batch.length < pageSize && page.isLast === undefined && page.total === undefined) {
      return items;
    }
  }
}
