import type { Stall } from '../../core/model/stall.ts';
import type { RuleContext } from '../context.ts';
import { daysSince, humanAgo, humanDays, manual } from '../context.ts';

/**
 * Committed work that exists only on this machine.
 *
 * A branch ahead of its upstream with no pull request is invisible to every other person and
 * every other system. If the laptop dies, so does the work.
 */
export function branchNoPr(context: RuleContext): Stall[] {
  const openHeads = new Set(
    context.snapshot.pullRequests
      .filter((pr) => pr.state === 'OPEN')
      .map((pr) => `${pr.repo}#${pr.headRefName}`),
  );

  return context.snapshot.branches.flatMap((branch) => {
    if (branch.ahead === 0 || openHeads.has(`${branch.repo}#${branch.name}`)) {
      return [];
    }
    const age = daysSince(branch.lastCommitAt, context.clock);
    if (age < context.thresholds.noActivityDays) {
      return [];
    }
    return [
      manual({
        id: 'branch-no-pr',
        subject: { kind: 'branch', repo: branch.repo, branch: branch.name },
        owner: 'me',
        ageDays: age,
        severity: branch.upstream === null ? 'high' : 'medium',
        summary:
          branch.upstream === null
            ? `${branch.ahead} unpushed commit(s), last ${humanAgo(age)}`
            : `${branch.ahead} commit(s) ahead of ${branch.upstream}, no PR`,
        move: `Open a PR for ${branch.repo} ${branch.name}, or delete it`,
      }),
    ];
  });
}

/**
 * A local branch left behind after its PR merged.
 *
 * Low stakes on its own, but these accumulate until the branch list is unreadable and it stops
 * being obvious which branches are live work.
 */
export function prMergedBranchExists(context: RuleContext): Stall[] {
  const merged = context.snapshot.pullRequests.filter((pr) => pr.state === 'MERGED');

  return merged.flatMap((pr) => {
    const branch = context.index
      .branchesIn(pr.repo)
      .find((candidate) => candidate.name === pr.headRefName);
    if (branch === undefined) {
      return [];
    }
    const age = daysSince(pr.mergedAt, context.clock);
    return [
      manual({
        id: 'pr-merged-branch-exists',
        subject: { kind: 'branch', repo: pr.repo, branch: branch.name },
        owner: 'me',
        ageDays: age,
        severity: 'low',
        summary: `${pr.repo}#${pr.number} merged ${humanAgo(age)}, local branch remains`,
        move: `Delete local branch ${branch.name} in ${pr.repo}`,
      }),
    ];
  });
}

/**
 * The sprint is nearly over and my work is not.
 *
 * Fires once for the sprint rather than once per ticket: the decision to make is a single one
 * about scope, not a list of individual nags.
 */
export function sprintEndingIncomplete(context: RuleContext): Stall[] {
  const sprint = context.snapshot.activeSprint;
  if (sprint === null || sprint.endDate === null) {
    return [];
  }
  const daysLeft = -daysSince(sprint.endDate, context.clock);
  if (daysLeft < 0 || daysLeft > context.thresholds.sprintEndingDays) {
    return [];
  }
  const incomplete = context.snapshot.issues.filter(
    (issue) =>
      context.index.inActiveSprint(issue.key) &&
      issue.assignee?.name === context.snapshot.identity.jira &&
      issue.resolution === null,
  );
  if (incomplete.length === 0) {
    return [];
  }
  return [
    manual({
      id: 'sprint-ending-incomplete',
      subject: { kind: 'sprint', id: sprint.id },
      owner: 'me',
      ageDays: daysLeft,
      severity: 'medium',
      summary: `${sprint.name} ends in ${humanDays(daysLeft)} with ${incomplete.length} of my tickets open`,
      move: `Close out or carry over: ${incomplete.map((issue) => issue.key).join(', ')}`,
    }),
  ];
}
