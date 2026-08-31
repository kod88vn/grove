import type { DatabaseSync } from 'node:sqlite';
import type { Issue } from '../../core/model/issue.ts';
import type { Mirrored } from '../../core/model/mirrored.ts';

const UPSERT = `
INSERT INTO issues (
  key, summary, status, resolution, issue_type, priority,
  assignee_name, assignee_display, reporter_name, reporter_display,
  created, updated, resolved_at, epic_key, sprint_id, sprint_name,
  labels, fix_versions, is_mine, raw, mirrored_at
) VALUES (
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?
)
ON CONFLICT(key) DO UPDATE SET
  summary = excluded.summary,
  status = excluded.status,
  resolution = excluded.resolution,
  issue_type = excluded.issue_type,
  priority = excluded.priority,
  assignee_name = excluded.assignee_name,
  assignee_display = excluded.assignee_display,
  reporter_name = excluded.reporter_name,
  reporter_display = excluded.reporter_display,
  created = excluded.created,
  updated = excluded.updated,
  resolved_at = excluded.resolved_at,
  epic_key = excluded.epic_key,
  -- A sprint read from core search is absent, not empty. Overwriting a known sprint with NULL
  -- would erase what the Agile endpoint told us moments earlier in the same sync.
  sprint_id = COALESCE(excluded.sprint_id, issues.sprint_id),
  sprint_name = COALESCE(excluded.sprint_name, issues.sprint_name),
  labels = excluded.labels,
  fix_versions = excluded.fix_versions,
  is_mine = excluded.is_mine,
  raw = excluded.raw,
  mirrored_at = excluded.mirrored_at
`;

const SELECT_COLUMNS = `
  key, summary, status, resolution, issue_type, priority,
  assignee_name, assignee_display, reporter_name, reporter_display,
  created, updated, resolved_at, epic_key, sprint_id, sprint_name,
  labels, fix_versions
`;

interface IssueRow {
  readonly key: string;
  readonly summary: string;
  readonly status: string;
  readonly resolution: string | null;
  readonly issue_type: string;
  readonly priority: string | null;
  readonly assignee_name: string | null;
  readonly assignee_display: string | null;
  readonly reporter_name: string | null;
  readonly reporter_display: string | null;
  readonly created: string;
  readonly updated: string;
  readonly resolved_at: string | null;
  readonly epic_key: string | null;
  readonly sprint_id: number | null;
  readonly sprint_name: string | null;
  readonly labels: string;
  readonly fix_versions: string;
}

export function upsertIssue(db: DatabaseSync, mirrored: Mirrored<Issue>, isMine: boolean): void {
  const issue = mirrored.value;
  db.prepare(UPSERT).run(
    issue.key,
    issue.summary,
    issue.status,
    issue.resolution,
    issue.issueType,
    issue.priority,
    issue.assignee?.name ?? null,
    issue.assignee?.displayName ?? null,
    issue.reporter?.name ?? null,
    issue.reporter?.displayName ?? null,
    issue.created,
    issue.updated,
    issue.resolvedAt,
    issue.epicKey,
    issue.sprint?.id ?? null,
    issue.sprint?.name ?? null,
    JSON.stringify(issue.labels),
    JSON.stringify(issue.fixVersions),
    isMine ? 1 : 0,
    mirrored.raw,
    // `mirrored_at` is when we looked, not when Jira changed. Both are needed: the first
    // decides whether the mirror is stale, the second decides whether the work is stale.
    new Date().toISOString(),
  );
}

export function readIssue(db: DatabaseSync, key: string): Issue | null {
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM issues WHERE key = ?`).get(key);
  return row === undefined ? null : toIssue(row as unknown as IssueRow);
}

export function readMyOpenIssues(db: DatabaseSync): Issue[] {
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM issues
       WHERE is_mine = 1 AND resolution IS NULL
       ORDER BY updated DESC`,
    )
    .all();
  return rows.map((row) => toIssue(row as unknown as IssueRow));
}

export function readIssuesInSprint(db: DatabaseSync, sprintId: number): Issue[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM issues WHERE sprint_id = ? ORDER BY key`)
    .all(sprintId);
  return rows.map((row) => toIssue(row as unknown as IssueRow));
}

function toIssue(row: IssueRow): Issue {
  return {
    key: row.key,
    summary: row.summary,
    status: row.status,
    resolution: row.resolution,
    issueType: row.issue_type,
    priority: row.priority,
    assignee:
      row.assignee_name === null
        ? null
        : { name: row.assignee_name, displayName: row.assignee_display ?? row.assignee_name },
    reporter:
      row.reporter_name === null
        ? null
        : { name: row.reporter_name, displayName: row.reporter_display ?? row.reporter_name },
    created: row.created,
    updated: row.updated,
    resolvedAt: row.resolved_at,
    epicKey: row.epic_key,
    sprint:
      row.sprint_id === null ? null : { id: row.sprint_id, name: row.sprint_name ?? '' },
    labels: JSON.parse(row.labels) as string[],
    fixVersions: JSON.parse(row.fix_versions) as string[],
  };
}
