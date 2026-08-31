import type { Stall, StallSubject } from '../../src/core/model/stall.ts';
import { empty, escapeHtml, layout, link, section } from '../html.ts';
import { CSRF_TOKEN } from '../actions.ts';

/**
 * Turns a stall subject into a label and, where one is genuinely known, a URL.
 *
 * Pull request URLs come from the mirror rather than being assembled from a host name, because
 * the host is not something this code should be guessing at.
 */
export interface SubjectLinks {
  readonly issueUrl: (key: string) => string;
  readonly pullRequestUrl: (repo: string, number: number) => string | null;
}

/**
 * The landing page: what has stopped moving, and whose move it is.
 *
 * Grouped by owner first because that is the only division that changes what I do next —
 * my own queue is actionable now, the other list is only worth a nudge.
 */
export function pushPage(stalls: readonly Stall[], links: SubjectLinks): string {
  const mine = stalls.filter((stall) => stall.owner === 'me');
  const theirs = stalls.filter((stall) => stall.owner === 'them');

  const body =
    stalls.length === 0
      ? empty('Nothing is stalled.')
      : [
          section('Your move', mine.length, groups(mine, links)),
          section('Waiting on someone else', theirs.length, groups(theirs, links)),
        ].join('');

  return layout('Needs a push', '/', `<h1>Needs a push</h1>${body}`);
}

/** Group by stall id so a hundred review requests read as one heading, not a hundred rows. */
function groups(stalls: readonly Stall[], links: SubjectLinks): string {
  if (stalls.length === 0) {
    return empty('Nothing here.');
  }
  const byId = new Map<string, Stall[]>();
  for (const stall of stalls) {
    const bucket = byId.get(stall.id) ?? [];
    bucket.push(stall);
    byId.set(stall.id, bucket);
  }

  return [...byId.entries()]
    .map(([id, group]) => {
      const heading = `<h3>${escapeHtml(label(id))} <span class="count">${group.length}</span></h3>`;
      return heading + group.map((stall) => row(stall, links)).join('');
    })
    .join('');
}

function row(stall: Stall, links: SubjectLinks): string {
  const severity = `<span class="sev sev-${escapeHtml(stall.severity)}">${escapeHtml(stall.severity)}</span>`;
  return `<div class="stall">${severity} ${subject(stall.subject, links)} — ${escapeHtml(stall.summary)}
<div class="move">→ ${escapeHtml(stall.nextMove.description)}</div>${button(stall)}</div>`;
}

/**
 * A button appears only where the executor can actually do the thing.
 *
 * Every other stall stays as text. Offering a button that will be refused teaches me to
 * distrust the buttons, which would be worse than having none.
 */
function button(stall: Stall): string {
  if (stall.id === 'pr-approved-unmerged' && stall.subject.kind === 'pull_request') {
    return form('merge', 'Merge it', stall.id, [
      ['repo', stall.subject.repo],
      ['number', String(stall.subject.number)],
    ]);
  }
  if (stall.id === 'pr-merged-ticket-open' && stall.subject.kind === 'issue') {
    return form('resolve', 'Resolve it', stall.id, [['issue', stall.subject.key]]);
  }
  return '';
}

function form(
  action: string,
  caption: string,
  stallId: string,
  fields: readonly (readonly [string, string])[],
): string {
  const hidden = [...fields, ['do', action], ['stall', stallId], ['token', CSRF_TOKEN]]
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name!)}" value="${escapeHtml(value!)}">`)
    .join('');
  return `<form method="post" action="/act" class="act">${hidden}<button type="submit">${escapeHtml(caption)}</button></form>`;
}

function subject(value: StallSubject, links: SubjectLinks): string {
  switch (value.kind) {
    case 'issue':
      return link(links.issueUrl(value.key), value.key);
    case 'pull_request': {
      const label = `${value.repo}#${value.number}`;
      const url = links.pullRequestUrl(value.repo, value.number);
      return url === null ? mono(label) : link(url, label);
    }
    case 'branch':
      return mono(`${value.repo} ${value.branch}`);
    case 'sprint':
      return mono(`sprint ${value.id}`);
  }
}

function mono(text: string): string {
  return `<span class="mono">${escapeHtml(text)}</span>`;
}

/** Human wording for a stall id; unknown ids fall back to the id itself rather than throwing. */
function label(id: string): string {
  return LABELS[id] ?? id;
}

const LABELS: Record<string, string> = {
  'pr-merged-ticket-open': 'Shipped, but the ticket is still open',
  'ticket-resolved-pr-open': 'Ticket closed while its PR is still open',
  'ticket-in-progress-no-branch': 'In progress with nothing to show',
  'ticket-not-in-sprint': 'Not on the board',
  'ticket-stale': 'Gone quiet',
  'pr-approved-unmerged': 'Approved and unmerged',
  'pr-awaiting-review': 'Waiting for a reviewer',
  'pr-no-reviewers': 'Nobody asked to review',
  'pr-changes-requested': 'Changes requested',
  'pr-ci-failing': 'CI failing',
  'pr-conflicted': 'Conflicts with the base branch',
  'pr-draft-aging': 'Draft going stale',
  'pr-no-jira-link': 'No Jira link',
  'review-requested-of-me': 'Waiting on my review',
  'my-review-stale': 'My review is out of date',
  'branch-no-pr': 'Local work with no PR',
  'pr-merged-branch-exists': 'Merged, branch still local',
  'sprint-ending-incomplete': 'Sprint ending with work open',
};
