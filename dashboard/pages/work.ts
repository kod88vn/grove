import type { Issue } from '../../src/core/model/issue.ts';
import type { PullRequest } from '../../src/core/model/pull-request.ts';
import { empty, escapeHtml, layout, link, section, table } from '../html.ts';

export function ticketsPage(issues: readonly Issue[], issueUrl: (key: string) => string): string {
  const open = issues.filter((issue) => issue.resolution === null);
  const body =
    open.length === 0
      ? empty('No open tickets.')
      : table(
          ['Key', 'Status', 'Type', 'Summary', 'Updated'],
          open.map((issue) => [
            link(issueUrl(issue.key), issue.key),
            escapeHtml(issue.status),
            escapeHtml(issue.issueType),
            escapeHtml(issue.summary),
            `<span class="age">${escapeHtml(issue.updated.slice(0, 10))}</span>`,
          ]),
        );

  return layout('Tickets', '/tickets', `<h1>Tickets</h1>${section('Open', open.length, body)}`);
}

export function pullRequestsPage(pullRequests: readonly PullRequest[], me: string): string {
  const open = pullRequests.filter((pr) => pr.state === 'OPEN');
  const mine = open.filter((pr) => pr.author === me);
  const toReview = open.filter((pr) => pr.author !== me && pr.myReviewState !== 'not_requested');

  const body =
    section('Mine', mine.length, list(mine)) + section('Awaiting my review', toReview.length, list(toReview));

  return layout('Pull requests', '/prs', `<h1>Pull requests</h1>${body}`);
}

function list(pullRequests: readonly PullRequest[]): string {
  if (pullRequests.length === 0) {
    return empty('Nothing here.');
  }
  return table(
    ['PR', 'Title', 'Review', 'Checks', 'Merge', 'Updated'],
    pullRequests.map((pr) => [
      link(pr.url, `${pr.repo}#${pr.number}`),
      escapeHtml(pr.title),
      escapeHtml(pr.reviewDecision ?? '—'),
      escapeHtml(checksLabel(pr)),
      escapeHtml(pr.isDraft ? 'draft' : (pr.mergeStateStatus ?? '—')),
      `<span class="age">${escapeHtml(pr.updatedAt.slice(0, 10))}</span>`,
    ]),
  );
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
