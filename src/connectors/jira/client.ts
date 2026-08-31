import { jiraRequest, paginate, type JiraCredentials } from './http.ts';
import {
  mapBoard,
  mapBoardColumns,
  mapIssue,
  mapSprint,
  type RawJiraIssue,
} from './map.ts';
import type { Issue } from '../../core/model/issue.ts';
import type { Board, Sprint } from '../../core/model/sprint.ts';

/**
 * Fields requested on every issue read.
 *
 * `sprint` and `epic` are supplied by the Agile API as structured objects. Core search omits
 * both and offers only `customfield_10205`, which returns a GreenHopper `toString` blob rather
 * than JSON (verified 2026-08-31) — so sprint-aware reads must go through the Agile endpoints.
 */
const ISSUE_FIELDS = [
  'summary',
  'status',
  'resolution',
  'resolutiondate',
  'issuetype',
  'priority',
  'assignee',
  'reporter',
  'created',
  'updated',
  'labels',
  'fixVersions',
  'sprint',
  'epic',
  'customfield_10206',
] as const;

const PAGE_SIZE = 50;

export interface JiraTransition {
  readonly id: string;
  readonly name: string;
  readonly to: string;
  /** Field ids the transition screen marks `required`. Empty for most transitions. */
  readonly requiredFields: readonly string[];
}

export class JiraClient {
  constructor(
    private readonly credentials: JiraCredentials,
    private readonly boardId: number,
  ) {}

  /**
   * Issues matching a JQL query, via core search.
   *
   * Use this for anything outside the board — a ticket can be assigned to me and sit on no
   * board at all, and the Agile endpoint would never return it.
   */
  async searchIssues(jql: string, mirroredAt: string): Promise<Issue[]> {
    const raw = await paginate<RawJiraIssue>(
      (startAt) =>
        jiraRequest(this.credentials, {
          method: 'POST',
          path: '/rest/api/2/search',
          body: { jql, startAt, maxResults: PAGE_SIZE, fields: [...ISSUE_FIELDS] },
        }),
      (page) => (Array.isArray(page['issues']) ? (page['issues'] as RawJiraIssue[]) : []),
      PAGE_SIZE,
    );
    return raw.map((issue) => mapIssue(issue, mirroredAt));
  }

  /** Issues on the board matching a JQL query. Returns sprint and epic, unlike core search. */
  async boardIssues(jql: string, mirroredAt: string): Promise<Issue[]> {
    const raw = await paginate<RawJiraIssue>(
      (startAt) =>
        jiraRequest(this.credentials, {
          method: 'GET',
          path: `/rest/agile/1.0/board/${this.boardId}/issue?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${PAGE_SIZE}`,
        }),
      (page) => (Array.isArray(page['issues']) ? (page['issues'] as RawJiraIssue[]) : []),
      PAGE_SIZE,
    );
    return raw.map((issue) => mapIssue(issue, mirroredAt));
  }

  async sprintIssues(sprintId: number, mirroredAt: string): Promise<Issue[]> {
    const raw = await paginate<RawJiraIssue>(
      (startAt) =>
        jiraRequest(this.credentials, {
          method: 'GET',
          path: `/rest/agile/1.0/board/${this.boardId}/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${PAGE_SIZE}`,
        }),
      (page) => (Array.isArray(page['issues']) ? (page['issues'] as RawJiraIssue[]) : []),
      PAGE_SIZE,
    );
    return raw.map((issue) => mapIssue(issue, mirroredAt));
  }

  /** The sprint currently running, or null between sprints. */
  async activeSprint(): Promise<Sprint | null> {
    const sprints = await this.sprints('active');
    return sprints[0] ?? null;
  }

  async sprints(state: 'active' | 'closed' | 'future'): Promise<Sprint[]> {
    const values = await paginate<unknown>(
      (startAt) =>
        jiraRequest(this.credentials, {
          method: 'GET',
          path: `/rest/agile/1.0/board/${this.boardId}/sprint?state=${state}&startAt=${startAt}&maxResults=${PAGE_SIZE}`,
        }),
      (page) => (Array.isArray(page['values']) ? page['values'] : []),
      PAGE_SIZE,
    );
    return values.map((value) => mapSprint(value, this.boardId));
  }

  async board(): Promise<Board> {
    const [raw, configuration] = await Promise.all([
      jiraRequest<unknown>(this.credentials, {
        method: 'GET',
        path: `/rest/agile/1.0/board/${this.boardId}`,
      }),
      jiraRequest<unknown>(this.credentials, {
        method: 'GET',
        path: `/rest/agile/1.0/board/${this.boardId}/configuration`,
      }),
    ]);
    return mapBoard(raw, mapBoardColumns(configuration));
  }

  /**
   * Transitions available on an issue right now, with the fields each one demands.
   *
   * Always read this before building a transition payload. Which fields are required is a
   * per-project screen configuration that changes without notice: on WS today, `Resolve Issue`
   * requires `resolution` alone, though a stale note claimed it also needed `fixVersions` and
   * an epic link. A hardcoded payload is a 400 waiting to happen.
   */
  async transitions(issueKey: string): Promise<JiraTransition[]> {
    const response = await jiraRequest<{ transitions?: unknown }>(this.credentials, {
      method: 'GET',
      path: `/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions?expand=transitions.fields`,
    });
    const raw = Array.isArray(response.transitions) ? response.transitions : [];
    return raw.map((entry) => toTransition(entry));
  }

  /** Whoever the token belongs to. Used by `bot doctor` to prove the token works. */
  async myself(): Promise<{ name: string; displayName: string }> {
    const raw = await jiraRequest<{ name?: string; displayName?: string }>(this.credentials, {
      method: 'GET',
      path: '/rest/api/2/myself',
    });
    return { name: raw.name ?? '', displayName: raw.displayName ?? '' };
  }
}

function toTransition(entry: unknown): JiraTransition {
  const record = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
    string,
    unknown
  >;
  const to = record['to'];
  const toName =
    typeof to === 'object' && to !== null ? String((to as { name?: unknown }).name ?? '') : '';
  return {
    id: String(record['id'] ?? ''),
    name: String(record['name'] ?? ''),
    to: toName,
    requiredFields: requiredFieldIds(record['fields']),
  };
}

function requiredFieldIds(fields: unknown): string[] {
  if (typeof fields !== 'object' || fields === null) {
    return [];
  }
  return Object.entries(fields as Record<string, unknown>)
    .filter(([, meta]) => typeof meta === 'object' && meta !== null && (meta as { required?: unknown }).required === true)
    .map(([id]) => id);
}
