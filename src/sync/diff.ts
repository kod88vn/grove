import type { Issue } from '../core/model/issue.ts';
import { hasFailingChecks, type PullRequest } from '../core/model/pull-request.ts';
import type { BotEvent } from '../store/repositories/events.ts';

/**
 * What changed between two syncs.
 *
 * Diffing the mirror is the only way to notice something done outside this system: a PR merged
 * in the GitHub UI, a ticket transitioned by a colleague, a review requested while I was away.
 * Nothing sends us a notification, and a poll that only reads current state can tell you what
 * is true but never what just became true.
 */
export function diffIssue(previous: Issue | null, next: Issue, at: string): BotEvent[] {
  const subject = { subjectKind: 'issue' as const, subjectId: next.key, at };

  if (previous === null) {
    return [{ ...subject, kind: 'issue.appeared', detail: { status: next.status } }];
  }

  const events: BotEvent[] = [];
  if (previous.status !== next.status) {
    events.push({
      ...subject,
      kind: 'issue.status_changed',
      detail: { from: previous.status, to: next.status },
    });
  }
  if (previous.resolution !== next.resolution && next.resolution !== null) {
    events.push({ ...subject, kind: 'issue.resolved', detail: { resolution: next.resolution } });
  }
  if (previous.resolution !== null && next.resolution === null) {
    events.push({ ...subject, kind: 'issue.reopened', detail: { from: previous.resolution } });
  }
  if (previous.assignee?.name !== next.assignee?.name) {
    events.push({
      ...subject,
      kind: 'issue.assignee_changed',
      detail: { from: previous.assignee?.name ?? null, to: next.assignee?.name ?? null },
    });
  }
  if (previous.sprint?.id !== next.sprint?.id) {
    events.push({
      ...subject,
      kind: 'issue.sprint_changed',
      detail: { from: previous.sprint?.name ?? null, to: next.sprint?.name ?? null },
    });
  }
  return events;
}

export function diffPullRequest(
  previous: PullRequest | null,
  next: PullRequest,
  at: string,
): BotEvent[] {
  const subject = {
    subjectKind: 'pull_request' as const,
    subjectId: `${next.repo}#${next.number}`,
    at,
  };

  if (previous === null) {
    return [{ ...subject, kind: 'pr.appeared', detail: { state: next.state, title: next.title } }];
  }

  return [
    ...stateEvents(previous, next, subject),
    ...reviewEvents(previous, next, subject),
    ...healthEvents(previous, next, subject),
  ];
}

type Subject = Pick<BotEvent, 'subjectKind' | 'subjectId' | 'at'>;

function stateEvents(previous: PullRequest, next: PullRequest, subject: Subject): BotEvent[] {
  const events: BotEvent[] = [];
  if (previous.state !== 'MERGED' && next.state === 'MERGED') {
    events.push({ ...subject, kind: 'pr.merged', detail: { mergedAt: next.mergedAt } });
  }
  if (previous.state === 'OPEN' && next.state === 'CLOSED') {
    events.push({ ...subject, kind: 'pr.closed', detail: {} });
  }
  if (previous.isDraft && !next.isDraft) {
    events.push({ ...subject, kind: 'pr.ready_for_review', detail: {} });
  }
  if (previous.headRefOid !== next.headRefOid) {
    events.push({ ...subject, kind: 'pr.pushed', detail: { head: next.headRefOid } });
  }
  return events;
}

function reviewEvents(previous: PullRequest, next: PullRequest, subject: Subject): BotEvent[] {
  const events: BotEvent[] = [];
  if (previous.reviewDecision !== next.reviewDecision) {
    events.push({
      ...subject,
      kind: 'pr.review_decision_changed',
      detail: { from: previous.reviewDecision, to: next.reviewDecision },
    });
  }
  if (previous.myReviewState !== next.myReviewState) {
    events.push({
      ...subject,
      kind: `pr.my_review_${next.myReviewState}`,
      detail: { from: previous.myReviewState },
    });
  }
  return events;
}

function healthEvents(previous: PullRequest, next: PullRequest, subject: Subject): BotEvent[] {
  const events: BotEvent[] = [];
  if (!hasFailingChecks(previous) && hasFailingChecks(next)) {
    events.push({
      ...subject,
      kind: 'pr.checks_failed',
      detail: { failing: next.checks.filter((c) => c.conclusion === 'FAILURE').map((c) => c.name) },
    });
  }
  if (hasFailingChecks(previous) && !hasFailingChecks(next)) {
    events.push({ ...subject, kind: 'pr.checks_recovered', detail: {} });
  }
  // UNKNOWN is "not computed yet", never "fine". Treating a transition out of UNKNOWN as a new
  // conflict would fire on every PR the first time GitHub gets round to computing it.
  if (previous.mergeable !== 'CONFLICTING' && next.mergeable === 'CONFLICTING') {
    events.push({ ...subject, kind: 'pr.conflicted', detail: { base: next.baseRefName } });
  }
  if (previous.mergeable === 'CONFLICTING' && next.mergeable === 'MERGEABLE') {
    events.push({ ...subject, kind: 'pr.conflict_resolved', detail: {} });
  }
  return events;
}
