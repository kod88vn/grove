import { describe, expect, it } from 'vitest';
import { detect } from '../../../src/stalls/detect.ts';
import type { StallId } from '../../../src/core/model/stall.ts';
import type { Snapshot } from '../../../src/stalls/snapshot.ts';
import {
  branch,
  clock,
  daysAgo,
  daysAhead,
  issue,
  link,
  pullRequest,
  snapshot,
  sprint,
} from '../../support/factories.ts';

/** Which stall ids fire for a snapshot. */
function ids(input: Snapshot): StallId[] {
  return detect(input, clock).map((stall) => stall.id);
}

function fires(input: Snapshot, id: StallId): boolean {
  return ids(input).includes(id);
}

describe('pr-merged-ticket-open', () => {
  const merged = pullRequest({ state: 'MERGED', mergedAt: daysAgo(3) });

  it('fires when a merged PR belongs to a still-open ticket', () => {
    const input = snapshot({ issues: [issue()], pullRequests: [merged], links: [link()] });
    expect(fires(input, 'pr-merged-ticket-open')).toBe(true);
  });

  it('does not fire once the ticket is resolved', () => {
    const done = issue({ status: 'Resolved', resolution: 'Fixed', resolvedAt: daysAgo(2) });
    const input = snapshot({ issues: [done], pullRequests: [merged], links: [link()] });
    expect(fires(input, 'pr-merged-ticket-open')).toBe(false);
  });

  it('names the PR that merged, so the next move is actionable without a lookup', () => {
    const input = snapshot({ issues: [issue()], pullRequests: [merged], links: [link()] });
    const stall = detect(input, clock).find((s) => s.id === 'pr-merged-ticket-open');
    expect(stall?.nextMove.description).toContain('clover/web-storefront-engine#1');
    expect(stall?.summary).toContain('merged 3 days ago');
  });
});

describe('ticket-resolved-pr-open', () => {
  it('fires when the ticket is resolved but its PR is still open', () => {
    const done = issue({ status: 'Resolved', resolution: 'Fixed', resolvedAt: daysAgo(2) });
    const input = snapshot({ issues: [done], pullRequests: [pullRequest()], links: [link()] });
    expect(fires(input, 'ticket-resolved-pr-open')).toBe(true);
  });

  it('does not fire while the ticket is still open', () => {
    const input = snapshot({ issues: [issue()], pullRequests: [pullRequest()], links: [link()] });
    expect(fires(input, 'ticket-resolved-pr-open')).toBe(false);
  });
});

describe('ticket-in-progress-no-branch', () => {
  it('fires for an In Progress ticket with no branch and no PR', () => {
    const input = snapshot({ issues: [issue({ updated: daysAgo(5) })] });
    expect(fires(input, 'ticket-in-progress-no-branch')).toBe(true);
  });

  it('does not fire when a branch mentions the key', () => {
    const input = snapshot({
      issues: [issue({ updated: daysAgo(5) })],
      branches: [branch({ name: 'feature/WS-1000-thing' })],
    });
    expect(fires(input, 'ticket-in-progress-no-branch')).toBe(false);
  });

  it('does not fire before the no-activity threshold', () => {
    const input = snapshot({ issues: [issue({ updated: daysAgo(1) })] });
    expect(fires(input, 'ticket-in-progress-no-branch')).toBe(false);
  });
});

describe('ticket-not-in-sprint', () => {
  it('fires for my in-progress ticket missing from the active sprint', () => {
    const input = snapshot({ issues: [issue()], activeSprint: sprint(), sprintIssueKeys: [] });
    expect(fires(input, 'ticket-not-in-sprint')).toBe(true);
  });

  it('does not fire when the ticket is on the board', () => {
    const input = snapshot({
      issues: [issue()],
      activeSprint: sprint(),
      sprintIssueKeys: ['WS-1000'],
    });
    expect(fires(input, 'ticket-not-in-sprint')).toBe(false);
  });
});

describe('ticket-stale', () => {
  it('fires after a long silence with no open PR', () => {
    const input = snapshot({ issues: [issue({ status: 'Open', updated: daysAgo(30) })] });
    expect(fires(input, 'ticket-stale')).toBe(true);
  });

  it('does not fire while an open PR is carrying the work', () => {
    const input = snapshot({
      issues: [issue({ status: 'Open', updated: daysAgo(30) })],
      pullRequests: [pullRequest()],
      links: [link()],
    });
    expect(fires(input, 'ticket-stale')).toBe(false);
  });
});

describe('pr-approved-unmerged', () => {
  const approved = pullRequest({
    reviewDecision: 'APPROVED',
    latestReviews: [{ author: 'someone-else', state: 'APPROVED', submittedAt: daysAgo(4) }],
  });

  it('fires when an approved PR of mine is still open', () => {
    expect(fires(snapshot({ pullRequests: [approved] }), 'pr-approved-unmerged')).toBe(true);
  });

  it('does not fire when the approval is younger than the threshold', () => {
    const fresh = pullRequest({
      reviewDecision: 'APPROVED',
      latestReviews: [{ author: 'someone-else', state: 'APPROVED', submittedAt: daysAgo(0) }],
    });
    expect(fires(snapshot({ pullRequests: [fresh] }), 'pr-approved-unmerged')).toBe(false);
  });

  it('says what is blocking the merge rather than just "merge it"', () => {
    const blocked = pullRequest({
      reviewDecision: 'APPROVED',
      latestReviews: [{ author: 'someone-else', state: 'APPROVED', submittedAt: daysAgo(4) }],
      mergeStateStatus: 'BEHIND',
    });
    const stall = detect(snapshot({ pullRequests: [blocked] }), clock).find(
      (s) => s.id === 'pr-approved-unmerged',
    );
    expect(stall?.nextMove.description).toContain('Update');
    expect(stall?.nextMove.description).toContain('main');
  });
});

describe('pr-awaiting-review', () => {
  it('fires when a reviewer was asked and nobody has reviewed', () => {
    const input = snapshot({ pullRequests: [pullRequest({ createdAt: daysAgo(4) })] });
    expect(fires(input, 'pr-awaiting-review')).toBe(true);
  });

  it('does not fire once someone has reviewed', () => {
    const reviewed = pullRequest({
      createdAt: daysAgo(4),
      latestReviews: [{ author: 'someone-else', state: 'COMMENTED', submittedAt: daysAgo(1) }],
    });
    expect(fires(snapshot({ pullRequests: [reviewed] }), 'pr-awaiting-review')).toBe(false);
  });

  it('is owned by them, because the next move is not mine', () => {
    const input = snapshot({ pullRequests: [pullRequest({ createdAt: daysAgo(4) })] });
    const stall = detect(input, clock).find((s) => s.id === 'pr-awaiting-review');
    expect(stall?.owner).toBe('them');
  });
});

describe('pr-no-reviewers', () => {
  it('fires when nobody was ever asked', () => {
    const input = snapshot({ pullRequests: [pullRequest({ reviewRequests: [] })] });
    expect(fires(input, 'pr-no-reviewers')).toBe(true);
  });

  it('does not fire when a reviewer is pending', () => {
    expect(fires(snapshot({ pullRequests: [pullRequest()] }), 'pr-no-reviewers')).toBe(false);
  });

  it('does not fire for a draft, which is not asking for review yet', () => {
    const draft = pullRequest({ reviewRequests: [], isDraft: true });
    expect(fires(snapshot({ pullRequests: [draft] }), 'pr-no-reviewers')).toBe(false);
  });
});

describe('pr-changes-requested', () => {
  it('fires when a reviewer asked for changes', () => {
    const input = snapshot({ pullRequests: [pullRequest({ reviewDecision: 'CHANGES_REQUESTED' })] });
    expect(fires(input, 'pr-changes-requested')).toBe(true);
  });

  it('does not fire when review is merely required', () => {
    expect(fires(snapshot({ pullRequests: [pullRequest()] }), 'pr-changes-requested')).toBe(false);
  });
});

describe('pr-ci-failing', () => {
  it('fires on a failing check and names it', () => {
    const failing = pullRequest({
      checks: [{ name: 'JIRA Link', conclusion: 'FAILURE', startedAt: daysAgo(1) }],
    });
    const stall = detect(snapshot({ pullRequests: [failing] }), clock).find(
      (s) => s.id === 'pr-ci-failing',
    );
    expect(stall?.summary).toContain('JIRA Link');
  });

  it('does not fire when checks are green or still running', () => {
    const green = pullRequest({
      checks: [
        { name: 'build', conclusion: 'SUCCESS', startedAt: daysAgo(1) },
        { name: 'lint', conclusion: 'PENDING', startedAt: daysAgo(1) },
      ],
    });
    expect(fires(snapshot({ pullRequests: [green] }), 'pr-ci-failing')).toBe(false);
  });
});

describe('pr-conflicted', () => {
  it('fires when the branch conflicts with its base', () => {
    const dirty = pullRequest({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' });
    expect(fires(snapshot({ pullRequests: [dirty] }), 'pr-conflicted')).toBe(true);
  });

  it('does not fire on UNKNOWN, which only means GitHub has not computed it yet', () => {
    const unknown = pullRequest({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' });
    expect(fires(snapshot({ pullRequests: [unknown] }), 'pr-conflicted')).toBe(false);
  });
});

describe('pr-draft-aging', () => {
  it('fires for a draft nobody has touched', () => {
    const stale = pullRequest({ isDraft: true, updatedAt: daysAgo(10) });
    expect(fires(snapshot({ pullRequests: [stale] }), 'pr-draft-aging')).toBe(true);
  });

  it('does not fire for a draft still being worked on', () => {
    const active = pullRequest({ isDraft: true, updatedAt: daysAgo(1) });
    expect(fires(snapshot({ pullRequests: [active] }), 'pr-draft-aging')).toBe(false);
  });
});

describe('pr-no-jira-link', () => {
  it('fires when no key appears anywhere', () => {
    const unlinked = pullRequest({ issueKeys: [], headRefName: 'docs/stack-ledger' });
    expect(fires(snapshot({ pullRequests: [unlinked] }), 'pr-no-jira-link')).toBe(true);
  });

  it('does not fire when a key was parsed out', () => {
    expect(fires(snapshot({ pullRequests: [pullRequest()] }), 'pr-no-jira-link')).toBe(false);
  });
});

describe('review-requested-of-me', () => {
  const waiting = pullRequest({
    author: 'someone-else',
    myReviewState: 'requested_not_started',
    createdAt: daysAgo(4),
  });

  it('fires when someone is waiting on my review', () => {
    expect(fires(snapshot({ pullRequests: [waiting] }), 'review-requested-of-me')).toBe(true);
  });

  it('does not fire for my own PR', () => {
    const own = pullRequest({ myReviewState: 'requested_not_started', createdAt: daysAgo(4) });
    expect(fires(snapshot({ pullRequests: [own] }), 'review-requested-of-me')).toBe(false);
  });

  it('escalates with age, so a week-old request outranks a fresh one', () => {
    const old = pullRequest({ ...waiting, number: 2, createdAt: daysAgo(9) });
    const stalls = detect(snapshot({ pullRequests: [waiting, old] }), clock).filter(
      (s) => s.id === 'review-requested-of-me',
    );
    expect(stalls[0]?.severity).toBe('high');
  });
});

describe('my-review-stale', () => {
  it('fires when the author pushed after I approved', () => {
    const stale = pullRequest({ author: 'someone-else', myReviewState: 'stale_review' });
    expect(fires(snapshot({ pullRequests: [stale] }), 'my-review-stale')).toBe(true);
  });

  it('does not fire while my approval still covers the diff', () => {
    const fine = pullRequest({ author: 'someone-else', myReviewState: 'approved' });
    expect(fires(snapshot({ pullRequests: [fine] }), 'my-review-stale')).toBe(false);
  });
});

describe('branch-no-pr', () => {
  it('fires for committed work with no pull request', () => {
    const ahead = branch({ ahead: 2, lastCommitAt: daysAgo(6) });
    expect(fires(snapshot({ branches: [ahead] }), 'branch-no-pr')).toBe(true);
  });

  it('does not fire when an open PR already has that head', () => {
    const ahead = branch({ ahead: 2, lastCommitAt: daysAgo(6) });
    const input = snapshot({ branches: [ahead], pullRequests: [pullRequest()] });
    expect(fires(input, 'branch-no-pr')).toBe(false);
  });

  it('treats never-pushed work as the more serious case', () => {
    const local = branch({ ahead: 2, upstream: null, lastCommitAt: daysAgo(6) });
    const stall = detect(snapshot({ branches: [local] }), clock).find((s) => s.id === 'branch-no-pr');
    expect(stall?.severity).toBe('high');
    expect(stall?.summary).toContain('unpushed');
  });
});

describe('pr-merged-branch-exists', () => {
  it('fires when a merged PR left its local branch behind', () => {
    const merged = pullRequest({ state: 'MERGED', mergedAt: daysAgo(2) });
    const input = snapshot({ pullRequests: [merged], branches: [branch()] });
    expect(fires(input, 'pr-merged-branch-exists')).toBe(true);
  });

  it('does not fire once the branch is gone', () => {
    const merged = pullRequest({ state: 'MERGED', mergedAt: daysAgo(2) });
    expect(fires(snapshot({ pullRequests: [merged] }), 'pr-merged-branch-exists')).toBe(false);
  });
});

describe('sprint-ending-incomplete', () => {
  it('fires when the sprint is about to end with my work open', () => {
    const input = snapshot({
      issues: [issue()],
      activeSprint: sprint({ endDate: daysAhead(1) }),
      sprintIssueKeys: ['WS-1000'],
    });
    expect(fires(input, 'sprint-ending-incomplete')).toBe(true);
  });

  it('does not fire while the sprint has room left', () => {
    const input = snapshot({
      issues: [issue()],
      activeSprint: sprint({ endDate: daysAhead(9) }),
      sprintIssueKeys: ['WS-1000'],
    });
    expect(fires(input, 'sprint-ending-incomplete')).toBe(false);
  });

  it('reports once for the sprint, not once per ticket', () => {
    const input = snapshot({
      issues: [issue(), issue({ key: 'WS-1001' }), issue({ key: 'WS-1002' })],
      activeSprint: sprint({ endDate: daysAhead(1) }),
      sprintIssueKeys: ['WS-1000', 'WS-1001', 'WS-1002'],
    });
    const fired = ids(input).filter((id) => id === 'sprint-ending-incomplete');
    expect(fired).toHaveLength(1);
  });
});

describe('detect', () => {
  it('returns nothing for an empty snapshot', () => {
    expect(detect(snapshot(), clock)).toEqual([]);
  });

  it('puts my move ahead of theirs', () => {
    const theirs = pullRequest({ number: 1, createdAt: daysAgo(4) });
    const mine = pullRequest({ number: 2, reviewDecision: 'CHANGES_REQUESTED' });
    const stalls = detect(snapshot({ pullRequests: [theirs, mine] }), clock);
    expect(stalls[0]?.owner).toBe('me');
    expect(stalls[stalls.length - 1]?.owner).toBe('them');
  });

  it('never reports a stall on missing timestamps', () => {
    // A rule firing because data is absent produces an item nobody can act on.
    const input = snapshot({ branches: [branch({ ahead: 3, lastCommitAt: null })] });
    expect(detect(input, clock)).toEqual([]);
  });
});
