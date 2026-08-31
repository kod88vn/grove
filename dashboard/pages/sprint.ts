import type { BotEvent } from '../../src/store/repositories/events.ts';
import type { Issue } from '../../src/core/model/issue.ts';
import type { Sprint } from '../../src/core/model/sprint.ts';
import type { SyncRun } from '../../src/store/repositories/sync-runs.ts';
import { isIssueDone } from '../../src/core/model/issue.ts';
import type { TableQuery, TableRow } from '../html.ts';
import { empty, escapeHtml, formatDate, formatDateTime, layout, link, section, table } from '../html.ts';

export interface SprintPageOptions {
  readonly sprint: Sprint | null;
  readonly issues: readonly Issue[];
  readonly issueUrl: (key: string) => string;
  readonly query?: TableQuery;
}

export function sprintPage(options: SprintPageOptions): string {
  const { sprint, issues, issueUrl, query = { path: '/sprint', sort: null, direction: 'asc', group: null } } = options;
  if (sprint === null) {
    return layout('Sprint', '/sprint', `<h1>Sprint</h1>${empty('No active sprint.')}`);
  }

  const done = issues.filter(isIssueDone);
  const remaining = issues.filter((issue) => !isIssueDone(issue));
  const ends = sprint.endDate === null ? 'no end date' : `ends ${formatDate(sprint.endDate)}`;

  const body =
    `<p class="age">${escapeHtml(`${sprint.name} — ${ends} — ${done.length}/${issues.length} done`)}</p>` +
    section('Remaining', remaining.length, rows(remaining, issueUrl, query)) +
    section('Done', done.length, rows(done, issueUrl, query));

  return layout('Sprint', '/sprint', `<h1>Sprint</h1>${body}`);
}

function rows(issues: readonly Issue[], issueUrl: (key: string) => string, query: TableQuery): string {
  if (issues.length === 0) {
    return empty('Nothing here.');
  }
  return table(
    sprintColumns,
    issues.map((issue): TableRow => ({
      cells: [
        link(issueUrl(issue.key), issue.key),
        escapeHtml(issue.status),
        escapeHtml(issue.assignee?.displayName ?? 'unassigned'),
        escapeHtml(issue.summary),
      ],
      values: [issue.key, issue.status, issue.assignee?.displayName ?? 'unassigned', issue.summary],
      copy: { url: issueUrl(issue.key), label: issue.key },
    })),
    query,
  );
}

export function activityPage(
  events: readonly BotEvent[],
  lastRun: SyncRun | null,
  query: TableQuery = { path: '/activity', sort: null, direction: 'asc', group: null },
): string {
  const status =
    lastRun === null
      ? empty('Never synced.')
      : `<p class="age">${escapeHtml(describe(lastRun))}</p>`;

  const body =
    events.length === 0
      ? empty('No activity recorded yet.')
      : table(
          activityColumns,
          events.map((event): TableRow => ({
            cells: [
              `<span class="age">${escapeHtml(formatDateTime(event.at))}</span>`,
              escapeHtml(event.kind),
              `<span class="mono">${escapeHtml(event.subjectId)}</span>`,
            ],
            values: [event.at, event.kind, event.subjectId],
          })),
          query,
        );

  return layout(
    'Activity',
    '/activity',
    `<h1>Activity</h1>${status}${section('Recent changes', events.length, body)}`,
  );
}

const sprintColumns = [
  { key: 'key', label: 'Key' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'summary', label: 'Summary' },
] as const;

const activityColumns = [
  { key: 'when', label: 'When' },
  { key: 'what', label: 'What' },
  { key: 'subject', label: 'Subject' },
] as const;

function describe(run: SyncRun): string {
  const when = run.finishedAt ?? run.startedAt;
  const outcome = run.ok === null ? 'in progress' : run.ok ? 'ok' : `failed: ${run.error ?? 'unknown'}`;
  return `last sync: ${run.scope} — ${outcome} at ${formatDateTime(when)}`;
}
