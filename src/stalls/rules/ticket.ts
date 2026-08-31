import { isIssueDone } from '../../core/model/issue.ts';
import type { Issue } from '../../core/model/issue.ts';
import type { PullRequest } from '../../core/model/pull-request.ts';
import type { Stall } from '../../core/model/stall.ts';
import type { RuleContext } from '../context.ts';
import { daysSince, humanAgo, humanDays, issueSubject, manual } from '../context.ts';

function myOpenIssues(context: RuleContext): Issue[] {
  return context.snapshot.issues.filter(
    (issue) =>
      issue.assignee?.name === context.snapshot.identity.jira &&
      issue.resolution === null &&
      !isIssueDone(issue),
  );
}

/**
 * The code shipped but the ticket never closed.
 *
 * This is the exact gap the project exists to close: two systems each believe the other will
 * notice. No grace period, because the moment the PR merges the ticket is simply wrong.
 */
export function prMergedTicketOpen(context: RuleContext): Stall[] {
  return myOpenIssues(context).flatMap((issue) => {
    const merged = context.index
      .pullRequestsFor(issue.key)
      .filter((pr) => pr.state === 'MERGED' && pr.mergedAt !== null);
    const last = latestMerge(merged);
    if (last === null) {
      return [];
    }
    const age = daysSince(last.mergedAt, context.clock);
    if (age < context.thresholds.ticketPrMismatchDays) {
      return [];
    }
    return [
      manual({
        id: 'pr-merged-ticket-open',
        subject: issueSubject(issue),
        owner: 'me',
        ageDays: age,
        severity: 'high',
        summary: `${last.repo}#${last.number} merged ${humanAgo(age)}, ticket still ${issue.status}`,
        move: `Resolve ${issue.key} — its PR ${last.repo}#${last.number} is merged`,
      }),
    ];
  });
}

function latestMerge(prs: readonly PullRequest[]): { repo: string; number: number; mergedAt: string } | null {
  const merges = prs
    .flatMap((pr) => (pr.mergedAt === null ? [] : [{ repo: pr.repo, number: pr.number, mergedAt: pr.mergedAt }]))
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
  return merges[merges.length - 1] ?? null;
}

/**
 * The ticket is closed but its PR is still open.
 *
 * Usually means the ticket was resolved optimistically. Either unmerged code is about to be
 * forgotten, or an abandoned PR is cluttering someone's review queue.
 */
export function ticketResolvedPrOpen(context: RuleContext): Stall[] {
  return context.snapshot.issues.flatMap((issue) => {
    if (issue.assignee?.name !== context.snapshot.identity.jira) {
      return [];
    }
    if (issue.resolution === null && !isIssueDone(issue)) {
      return [];
    }
    const open = context.index.pullRequestsFor(issue.key).filter((pr) => pr.state === 'OPEN');
    return open.map((pr) =>
      manual({
        id: 'ticket-resolved-pr-open',
        subject: issueSubject(issue),
        owner: 'me',
        ageDays: daysSince(issue.resolvedAt ?? issue.updated, context.clock),
        severity: 'medium',
        summary: `${issue.key} is ${issue.status} but ${pr.repo}#${pr.number} is still open`,
        move: `Merge or close ${pr.repo}#${pr.number}, or reopen ${issue.key}`,
      }),
    );
  });
}

/**
 * In progress with nothing to show for it.
 *
 * No branch, no PR — either work has not actually started, or it is happening somewhere this
 * system cannot see. Both are worth knowing.
 */
export function ticketInProgressNoBranch(context: RuleContext): Stall[] {
  return myOpenIssues(context).flatMap((issue) => {
    if (issue.status.toLowerCase() !== 'in progress') {
      return [];
    }
    if (context.index.pullRequestsFor(issue.key).length > 0 || hasBranch(context, issue)) {
      return [];
    }
    const age = daysSince(issue.updated, context.clock);
    if (age < context.thresholds.noActivityDays) {
      return [];
    }
    return [
      manual({
        id: 'ticket-in-progress-no-branch',
        subject: issueSubject(issue),
        owner: 'me',
        ageDays: age,
        severity: 'medium',
        summary: `In Progress for ${humanDays(age)} with no branch or PR`,
        move: `Start ${issue.key} or move it back to To Do`,
      }),
    ];
  });
}

function hasBranch(context: RuleContext, issue: Issue): boolean {
  return context.snapshot.branches.some((branch) => branch.name.includes(issue.key));
}

/** Assigned, unresolved, and absent from the sprint board. */
export function ticketNotInSprint(context: RuleContext): Stall[] {
  const sprint = context.snapshot.activeSprint;
  if (sprint === null) {
    return [];
  }
  return myOpenIssues(context).flatMap((issue) => {
    if (context.index.inActiveSprint(issue.key) || issue.status.toLowerCase() === 'open') {
      return [];
    }
    return [
      manual({
        id: 'ticket-not-in-sprint',
        subject: issueSubject(issue),
        owner: 'me',
        ageDays: daysSince(issue.updated, context.clock),
        severity: 'low',
        summary: `${issue.status} but not in ${sprint.name}`,
        move: `Add ${issue.key} to ${sprint.name} or park it`,
      }),
    ];
  });
}

/** Nothing has happened for a long time and nobody has said why. */
export function ticketStale(context: RuleContext): Stall[] {
  return myOpenIssues(context).flatMap((issue) => {
    const age = daysSince(issue.updated, context.clock);
    if (age < context.thresholds.noActivityDays * 3) {
      return [];
    }
    if (context.index.pullRequestsFor(issue.key).some((pr) => pr.state === 'OPEN')) {
      return [];
    }
    return [
      manual({
        id: 'ticket-stale',
        subject: issueSubject(issue),
        owner: 'me',
        ageDays: age,
        severity: 'low',
        summary: `no activity for ${humanDays(age)}`,
        move: `Update or close ${issue.key}`,
      }),
    ];
  });
}
