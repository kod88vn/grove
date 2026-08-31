import type { BotEvent } from '../../src/store/repositories/events.ts';
import type { Issue } from '../../src/core/model/issue.ts';
import type { Sprint } from '../../src/core/model/sprint.ts';
import type { SyncRun } from '../../src/store/repositories/sync-runs.ts';
import { isIssueDone } from '../../src/core/model/issue.ts';
import { empty, escapeHtml, layout, link, section, table } from '../html.ts';

export function sprintPage(
  sprint: Sprint | null,
  issues: readonly Issue[],
  issueUrl: (key: string) => string,
): string {
  if (sprint === null) {
    return layout('Sprint', '/sprint', `<h1>Sprint</h1>${empty('No active sprint.')}`);
  }

  const done = issues.filter(isIssueDone);
  const remaining = issues.filter((issue) => !isIssueDone(issue));
  const ends = sprint.endDate === null ? 'no end date' : `ends ${sprint.endDate.slice(0, 10)}`;

  const body =
    `<p class="age">${escapeHtml(`${sprint.name} — ${ends} — ${done.length}/${issues.length} done`)}</p>` +
    section('Remaining', remaining.length, rows(remaining, issueUrl)) +
    section('Done', done.length, rows(done, issueUrl));

  return layout('Sprint', '/sprint', `<h1>Sprint</h1>${body}`);
}

function rows(issues: readonly Issue[], issueUrl: (key: string) => string): string {
  if (issues.length === 0) {
    return empty('Nothing here.');
  }
  return table(
    ['Key', 'Status', 'Assignee', 'Summary'],
    issues.map((issue) => [
      link(issueUrl(issue.key), issue.key),
      escapeHtml(issue.status),
      escapeHtml(issue.assignee?.displayName ?? 'unassigned'),
      escapeHtml(issue.summary),
    ]),
  );
}

export function activityPage(events: readonly BotEvent[], lastRun: SyncRun | null): string {
  const status =
    lastRun === null
      ? empty('Never synced.')
      : `<p class="age">${escapeHtml(describe(lastRun))}</p>`;

  const body =
    events.length === 0
      ? empty('No activity recorded yet.')
      : table(
          ['When', 'What', 'Subject'],
          events.map((event) => [
            `<span class="age">${escapeHtml(event.at.slice(0, 16).replace('T', ' '))}</span>`,
            escapeHtml(event.kind),
            `<span class="mono">${escapeHtml(event.subjectId)}</span>`,
          ]),
        );

  return layout(
    'Activity',
    '/activity',
    `<h1>Activity</h1>${status}${section('Recent changes', events.length, body)}`,
  );
}

function describe(run: SyncRun): string {
  const when = run.finishedAt ?? run.startedAt;
  const outcome = run.ok === null ? 'in progress' : run.ok ? 'ok' : `failed: ${run.error ?? 'unknown'}`;
  return `last sync: ${run.scope} — ${outcome} at ${when.slice(0, 16).replace('T', ' ')}`;
}
