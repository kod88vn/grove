import type { Database } from '../store/database.ts';
import type { SyncConfig } from './config.ts';
import type { GitHubClient } from '../connectors/github/client.ts';
import type { Mirrored } from '../core/model/mirrored.ts';
import type { PullRequest } from '../core/model/pull-request.ts';
import type { BotEvent } from '../store/repositories/events.ts';
import { upsertPullRequest } from '../store/repositories/pull-requests.ts';
import { replaceLinks } from '../store/repositories/links.ts';
import { correlate } from './correlate.ts';
import { diffPullRequest } from './diff.ts';

/**
 * Keeping the pull-request mirror honest about rows the sweep stopped seeing.
 *
 * The sweep answers "what is open right now". This answers the harder question the sweep
 * cannot: "what did I once call open that nobody has mentioned since". They are separate
 * responsibilities and the second one is where stale state accumulates.
 */

/**
 * Only what reconciliation touches, rather than the whole `SyncDeps`.
 *
 * Declared narrowly so this module does not import the scope module that calls it, which
 * would be a cycle. `SyncDeps` satisfies it structurally, so nothing has to adapt.
 */
export interface ReconcileDeps {
  readonly db: Database;
  readonly config: SyncConfig;
  readonly github: Pick<GitHubClient, 'pullRequest'>;
}

export interface ReconcileResult {
  readonly events: BotEvent[];
  /** Rows whose true state was read back and written. */
  readonly count: number;
  /** Rows that could not be re-read and were therefore left as they were. */
  readonly unreadable: number;
}

/** A stable key for a pull request across repositories, e.g. `clover/web-lib-RRS#468`. */
export function identity(repo: string, number: number): string {
  return `${repo}#${number}`;
}

export function isMine(pr: { author: string; myReviewState: string }, me: string): boolean {
  // "Mine" means it is on my plate, which includes PRs I must review, not only ones I wrote.
  return pr.author === me || pr.myReviewState !== 'not_requested';
}

/**
 * Settle every mirrored PR that this run did not see in an open listing.
 *
 * Driven by the mirror rather than by the repositories swept this run, and that distinction is
 * the whole point. The repo set is discovered from *open* PRs, so when the last open PR in an
 * incidental repository closes, the repository itself drops out of the sweep — 27 repos became
 * 25 across three runs — and any row it left behind is never looked at again. Reconciling only
 * within visited repositories therefore fixes the common case while stranding the exact rows
 * that prompted this: `web-app-dashboard-navigation#659` and `clover-highly-available#287`
 * both sat OPEN in the mirror while GitHub reported CLOSED, raising `pr-no-jira-link` on work
 * that was already finished.
 *
 * A PR that cannot be re-read is counted and skipped rather than thrown. Access to a
 * repository can be lost and repositories get archived; failing the whole sync over one
 * unreadable row would strand every other correction in the run behind it.
 */
export async function reconcileVanished(
  deps: ReconcileDeps,
  previouslyOpen: readonly PullRequest[],
  stillOpen: ReadonlySet<string>,
  at: string,
): Promise<ReconcileResult> {
  const events: BotEvent[] = [];
  let count = 0;
  let unreadable = 0;

  for (const pr of previouslyOpen) {
    if (stillOpen.has(identity(pr.repo, pr.number))) {
      continue;
    }
    const fresh = await reread(deps, pr);
    if (fresh === null) {
      unreadable += 1;
      continue;
    }
    events.push(...diffPullRequest(pr, fresh.value, at));
    upsertPullRequest(deps.db, fresh, isMine(fresh.value, deps.config.github.me));
    replaceLinks(deps.db, pr.repo, pr.number, correlate(fresh.value, deps.config.jira.projectKeys));
    count += 1;
  }
  return { events, count, unreadable };
}

async function reread(
  deps: ReconcileDeps,
  pr: PullRequest,
): Promise<Mirrored<PullRequest> | null> {
  try {
    return await deps.github.pullRequest(pr.repo, pr.number);
  } catch {
    return null;
  }
}
