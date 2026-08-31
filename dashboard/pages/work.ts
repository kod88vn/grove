import type { Issue } from '../../src/core/model/issue.ts';
import type { PullRequest } from '../../src/core/model/pull-request.ts';
import type { TableQuery, TableRow } from '../html.ts';
import { empty, escapeHtml, formatDate, layout, link, section, table } from '../html.ts';

export function ticketsPage(
  issues: readonly Issue[],
  issueUrl: (key: string) => string,
  query: TableQuery = tableQuery('/tickets'),
): string {
  const open = issues.filter((issue) => issue.resolution === null);
  const body =
    open.length === 0
      ? empty('No open tickets.')
      : table(
          columns,
          open.map((issue): TableRow => ({
            cells: [
              link(issueUrl(issue.key), issue.key),
              escapeHtml(issue.status),
              escapeHtml(issue.issueType),
              escapeHtml(issue.summary),
              `<span class="age">${escapeHtml(formatDate(issue.updated))}</span>`,
            ],
            values: [issue.key, issue.status, issue.issueType, issue.summary, issue.updated],
            copy: { url: issueUrl(issue.key), label: issue.key },
          })),
          query,
        );

  return layout('Tickets', '/tickets', `<h1>Tickets</h1>${section('Open', open.length, body)}`);
}

export function pullRequestsPage(
  pullRequests: readonly PullRequest[],
  me: string,
  query: TableQuery = tableQuery('/prs'),
): string {
  const open = pullRequests.filter((pr) => pr.state === 'OPEN');
  const mine = open.filter((pr) => pr.author === me);
  const toReview = open.filter((pr) => pr.author !== me && pr.myReviewState !== 'not_requested');

  const body = section('Mine', mine.length, list(mine, query)) + section('Awaiting my review', toReview.length, list(toReview, query));

  return layout('Pull requests', '/prs', `<h1>Pull requests</h1>${body}`);
}

function list(pullRequests: readonly PullRequest[], query: TableQuery): string {
  if (pullRequests.length === 0) {
    return empty('Nothing here.');
  }
  return table(
    prColumns,
    pullRequests.map((pr): TableRow => ({
      cells: [
        link(pr.url, `${pr.repo}#${pr.number}`),
        escapeHtml(pr.title),
        escapeHtml(pr.reviewDecision ?? '—'),
        escapeHtml(checksLabel(pr)),
        escapeHtml(pr.isDraft ? 'draft' : (pr.mergeStateStatus ?? '—')),
        `<span class="age">${escapeHtml(formatDate(pr.updatedAt))}</span>`,
      ],
      values: [`${pr.repo}#${pr.number}`, pr.title, pr.reviewDecision ?? '—', checksLabel(pr), pr.mergeStateStatus ?? '—', pr.updatedAt],
      copy: { url: pr.url, label: `${pr.repo}#${pr.number}` },
    })),
    query,
  );
}

const columns = [
  { key: 'key', label: 'Key' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'summary', label: 'Summary' },
  { key: 'updated', label: 'Updated' },
] as const;

const prColumns = [
  { key: 'pr', label: 'PR' },
  { key: 'title', label: 'Title' },
  { key: 'review', label: 'Review' },
  { key: 'checks', label: 'Checks' },
  { key: 'merge', label: 'Merge' },
  { key: 'updated', label: 'Updated' },
] as const;

function tableQuery(path: string): TableQuery {
  return { path, sort: null, direction: 'asc', group: null };
}

function checksLabel(pr: PullRequest): string {
  if (pr.checks.length === 0) {
    return '—';
  }
  const failing = pr.checks.filter((check) => check.conclusion === 'FAILURE').length;
  const pending = pr.checks.filter((check) => check.conclusion === 'PENDING').length;
  if (failing > 0) {
    return `${failing} failing`;
  }
  return pending > 0 ? `${pending} running` : 'green';
}
