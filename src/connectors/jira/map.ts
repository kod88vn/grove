import type { Issue, IssueUser } from '../../core/model/issue.ts';
import type { Board, Sprint, SprintState } from '../../core/model/sprint.ts';

/**
 * Raw shapes, as observed on `jira.corp.clover.com` on 2026-08-31.
 *
 * Deliberately loose: every field is optional because a Jira field that is empty for an issue
 * type is absent rather than null. Tightening these would produce parse failures on the first
 * issue type nobody thought about.
 */
export interface RawJiraIssue {
  readonly key?: string;
  readonly fields?: Record<string, unknown>;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function named(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return str((value as { name?: unknown }).name);
}

function user(value: unknown): IssueUser | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as { name?: unknown; displayName?: unknown };
  const name = str(record.name);
  if (name === null) {
    return null;
  }
  return { name, displayName: str(record.displayName) ?? name };
}

function stringList(value: unknown, key?: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    const resolved = key === undefined ? str(item) : named(item);
    if (resolved !== null) {
      out.push(resolved);
    }
  }
  return out;
}

/**
 * The sprint an issue is on, from the Agile API's structured `sprint` field.
 *
 * Core `/rest/api/2/search` is not usable here: it omits `sprint` entirely, and its
 * `customfield_10205` returns a GreenHopper `toString` blob rather than JSON. Parsing that
 * blob with a regex is possible and is exactly the kind of fragility this avoids.
 */
function sprintRef(fields: Record<string, unknown>): { id: number; name: string } | null {
  const raw = fields['sprint'];
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as { id?: unknown; name?: unknown };
  if (typeof record.id !== 'number') {
    return null;
  }
  return { id: record.id, name: str(record.name) ?? `Sprint ${record.id}` };
}

function epicKey(fields: Record<string, unknown>): string | null {
  const agile = fields['epic'];
  if (typeof agile === 'object' && agile !== null) {
    const key = str((agile as { key?: unknown }).key);
    if (key !== null) {
      return key;
    }
  }
  return str(fields['customfield_10206']);
}

export function mapIssue(raw: RawJiraIssue, mirroredAt: string): Issue {
  const key = str(raw.key);
  if (key === null) {
    throw new Error('Jira issue has no key');
  }
  const fields = raw.fields ?? {};
  return {
    key,
    summary: str(fields['summary']) ?? '',
    status: named(fields['status']) ?? 'Unknown',
    resolution: named(fields['resolution']),
    issueType: named(fields['issuetype']) ?? 'Unknown',
    priority: named(fields['priority']),
    assignee: user(fields['assignee']),
    reporter: user(fields['reporter']),
    created: str(fields['created']) ?? mirroredAt,
    updated: str(fields['updated']) ?? mirroredAt,
    resolvedAt: str(fields['resolutiondate']),
    epicKey: epicKey(fields),
    sprint: sprintRef(fields),
    labels: stringList(fields['labels']),
    fixVersions: stringList(fields['fixVersions'], 'name'),
  };
}

export function isAssignedTo(issue: Issue, accountName: string): boolean {
  return issue.assignee?.name === accountName;
}

export function mapSprint(raw: unknown, boardId: number): Sprint {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const id = record['id'];
  if (typeof id !== 'number') {
    throw new Error('Jira sprint has no numeric id');
  }
  return {
    id,
    boardId,
    name: str(record['name']) ?? `Sprint ${id}`,
    state: sprintState(record['state']),
    startDate: str(record['startDate']),
    endDate: str(record['endDate']),
    completeDate: str(record['completeDate']),
  };
}

function sprintState(value: unknown): SprintState {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  return text === 'active' || text === 'closed' || text === 'future' ? text : 'future';
}

export function mapBoard(raw: unknown, columns: readonly string[]): Board {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const id = record['id'];
  if (typeof id !== 'number') {
    throw new Error('Jira board has no numeric id');
  }
  return {
    id,
    name: str(record['name']) ?? `Board ${id}`,
    type: str(record['type']) ?? 'unknown',
    columns: [...columns],
  };
}

/** Column names from `/rest/agile/1.0/board/{id}/configuration`, in board order. */
export function mapBoardColumns(raw: unknown): string[] {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const columnConfig = record['columnConfig'];
  if (typeof columnConfig !== 'object' || columnConfig === null) {
    return [];
  }
  return stringList((columnConfig as { columns?: unknown }).columns, 'name');
}
