import type { Database } from '../store/database.ts';
import type { SyncConfig } from './config.ts';
import { GitHubClient } from '../connectors/github/client.ts';
import { JiraClient } from '../connectors/jira/client.ts';
import { localBranches } from '../connectors/git.ts';
import { appendEvents, type BotEvent } from '../store/repositories/events.ts';
import { readIssue, upsertIssue } from '../store/repositories/issues.ts';
import {
  readOpenPullRequests,
  readPullRequest,
  upsertPullRequest,
} from '../store/repositories/pull-requests.ts';
import { replaceLinks } from '../store/repositories/links.ts';
import { replaceBranches, upsertRepo } from '../store/repositories/branches.ts';
import { replaceSprintIssues, upsertBoard, upsertSprint } from '../store/repositories/sprints.ts';
import { correlate } from './correlate.ts';
import { diffIssue, diffPullRequest } from './diff.ts';
import { identity, isMine, reconcileVanished } from './reconcile.ts';

export interface SyncDeps {
  readonly db: Database;
  readonly config: SyncConfig;
  readonly jira: JiraClient;
  readonly github: GitHubClient;
  readonly now: () => Date;
}

export interface ScopeResult {
  readonly counts: Record<string, number>;
  readonly events: BotEvent[];
}

/**
 * My tickets, plus anything of mine that closed recently.
 *
 * `resolution = Unresolved` alone is a trap: once a ticket is resolved it stops matching, so
 * it is never fetched again and its mirror row stays frozen at the last unresolved state. The
 * mirror then reports it as Open forever, and the stall engine keeps demanding a move on work
 * that finished. Observed on WS-6114. The date bound keeps the result set small while letting
 * closure propagate — including closures made by someone else, or by a bulk edit.
 */
const MY_ISSUES_JQL =
  'assignee = currentUser() AND (resolution = Unresolved OR resolutiondate >= -30d) ORDER BY updated DESC';

/**
 * Mirror Jira: my open tickets, the board, and the active sprint's contents.
 *
 * The sprint is read through the Agile API even though the tickets are also in the core-search
 * result, because core search returns no sprint field at all — only a legacy blob. Reading both
 * costs one extra request and is the only way the mirror knows what is committed this sprint.
 */
export async function syncJira(deps: SyncDeps): Promise<ScopeResult> {
  const at = deps.now().toISOString();
  const events: BotEvent[] = [];
  const counts: Record<string, number> = { issues: 0, sprintIssues: 0 };

  const board = await deps.jira.board();
  upsertBoard(deps.db, board, at);

  const mine = await deps.jira.searchIssues(MY_ISSUES_JQL, at);
  for (const mirrored of mine) {
    events.push(...diffIssue(readIssue(deps.db, mirrored.value.key), mirrored.value, at));
    upsertIssue(deps.db, mirrored, true);
    counts['issues'] = (counts['issues'] ?? 0) + 1;
  }

  const sprint = await deps.jira.activeSprint();
  if (sprint !== null) {
    upsertSprint(deps.db, sprint, at);
    const issues = await deps.jira.sprintIssues(sprint.id, at);
    for (const mirrored of issues) {
      const isMine = mirrored.value.assignee?.name === deps.config.jira.me;
      events.push(...diffIssue(readIssue(deps.db, mirrored.value.key), mirrored.value, at));
      upsertIssue(deps.db, mirrored, isMine);
    }
    replaceSprintIssues(deps.db, sprint.id, issues.map((m) => m.value.key));
    counts['sprintIssues'] = issues.length;
  }

  return { counts, events };
}

/**
 * Mirror GitHub: every open PR that involves me, wherever it lives.
 *
 * The watched-repo list is a floor, not a boundary. My open PRs span far more repositories
 * than my team's five — 22 at last count — and a mirror limited to the configured list simply
 * cannot see a review request sitting in `web-app-services`. Since the whole point is to catch
 * work falling through gaps, the repo set is discovered per sync and unioned with the
 * configured one.
 *
 * Search cannot supply mergeability, reviews or checks, so it is used only to find out where to
 * look; each repository is then hydrated in a single call.
 */
export async function syncGitHub(deps: SyncDeps): Promise<ScopeResult> {
  const at = deps.now().toISOString();
  const involved = await discoverInvolvement(deps);
  const configured = new Set(deps.config.repos.map((repo) => repo.fullName));
  // Snapshotted before any upsert, so it reflects what the previous sync believed. Every one
  // of these rows must be accounted for by the end of this run or it is a lie left standing.
  const previouslyOpen = readOpenPullRequests(deps.db);

  const swept = await sweepRepos(deps, { involved, configured, at });
  const vanished = await reconcileVanished(deps, previouslyOpen, swept.stillOpen, at);
  const merged = await mirrorMerged(deps, at);

  return {
    counts: {
      pullRequests: swept.total,
      mergedPullRequests: merged.count,
      reconciledPullRequests: vanished.count,
      unreadablePullRequests: vanished.unreadable,
      repos: configured.size + involved.size,
    },
    events: [...swept.events, ...vanished.events, ...merged.events],
  };
}

interface SweepOptions {
  readonly involved: ReadonlyMap<string, ReadonlySet<number>>;
  readonly configured: ReadonlySet<string>;
  readonly at: string;
}

interface SweepResult {
  readonly events: BotEvent[];
  readonly total: number;
  /** Every PR seen open upstream this run, as `repo#number`. The proof a mirrored row is live. */
  readonly stillOpen: ReadonlySet<string>;
}

async function sweepRepos(deps: SyncDeps, options: SweepOptions): Promise<SweepResult> {
  const { involved, configured, at } = options;
  const events: BotEvent[] = [];
  const stillOpen = new Set<string>();
  let total = 0;

  for (const repo of new Set([...configured, ...involved.keys()])) {
    upsertRepo(deps.db, repo, pathFor(deps, repo), at);
    const hydrated = await deps.github.listOpenPullRequests(repo);
    // Recorded from `hydrated`, not `keep`: this is the repo's entire open list, which is what
    // proves a mirrored row is still open regardless of whether we chose to store it.
    for (const mirrored of hydrated) {
      stillOpen.add(identity(mirrored.value.repo, mirrored.value.number));
    }
    // Configured repos are mirrored whole, because their surrounding activity is context I
    // want. Elsewhere only the PRs that involve me are kept, so an incidental repository does
    // not drag in hundreds of unrelated pull requests.
    const keep = configured.has(repo)
      ? hydrated
      : hydrated.filter((m) => involved.get(repo)?.has(m.value.number) === true);

    for (const mirrored of keep) {
      const pr = mirrored.value;
      events.push(...diffPullRequest(readPullRequest(deps.db, pr.repo, pr.number), pr, at));
      upsertPullRequest(deps.db, mirrored, isMine(pr, deps.config.github.me));
      replaceLinks(deps.db, pr.repo, pr.number, correlate(pr, deps.config.jira.projectKeys));
    }
    total += keep.length;
  }
  return { events, total, stillOpen };
}

/**
 * How far back to look for merged pull requests of mine.
 *
 * A ticket left open behind merged code is worth surfacing for a while, but not forever; a
 * month is long enough to catch real oversights and short enough that the search stays cheap.
 */
const MERGED_LOOKBACK_DAYS = 30;

/**
 * Mirror pull requests I merged recently.
 *
 * Merged PRs are immutable for our purposes, so anything already stored as MERGED is skipped.
 * Only the newly-merged are hydrated, which keeps a steady-state sync to one extra search.
 */
async function mirrorMerged(
  deps: SyncDeps,
  at: string,
): Promise<{ count: number; events: BotEvent[] }> {
  const since = new Date(deps.now().getTime() - MERGED_LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const events: BotEvent[] = [];
  let count = 0;

  for (const hit of await deps.github.findMergedPullRequests(since)) {
    const known = readPullRequest(deps.db, hit.repo, hit.number);
    if (known?.state === 'MERGED') {
      continue;
    }
    const mirrored = await deps.github.pullRequest(hit.repo, hit.number);
    const pr = mirrored.value;
    events.push(...diffPullRequest(known, pr, at));
    upsertPullRequest(deps.db, mirrored, true);
    replaceLinks(deps.db, pr.repo, pr.number, correlate(pr, deps.config.jira.projectKeys));
    count += 1;
  }

  return { count, events };
}

/** Which pull requests involve me, grouped by repository. */
async function discoverInvolvement(deps: SyncDeps): Promise<Map<string, Set<number>>> {
  const byRepo = new Map<string, Set<number>>();
  for (const scope of ['authored', 'review-requested', 'reviewed'] as const) {
    const hits = await deps.github.findOpenPullRequests(scope);
    for (const hit of hits) {
      const numbers = byRepo.get(hit.repo) ?? new Set<number>();
      numbers.add(hit.number);
      byRepo.set(hit.repo, numbers);
    }
  }
  return byRepo;
}

function pathFor(deps: SyncDeps, fullName: string): string | null {
  return deps.config.repos.find((repo) => repo.fullName === fullName)?.path ?? null;
}

/** Mirror local branches for every watched repo that has a clone on disk. */
export async function syncBranches(deps: SyncDeps): Promise<ScopeResult> {
  const at = deps.now().toISOString();
  let total = 0;

  for (const repo of deps.config.repos) {
    if (repo.path === null) {
      continue;
    }
    try {
      const branches = await localBranches(repo.path, repo.fullName);
      replaceBranches(deps.db, repo.fullName, branches, at);
      total += branches.length;
    } catch {
      // A missing or broken clone is not a sync failure. Branch stalls simply stay quiet for
      // that repo; the API-derived stalls are unaffected.
      continue;
    }
  }

  return { counts: { branches: total }, events: [] };
}

export function recordEvents(
  db: Database,
  events: readonly BotEvent[],
  syncRunId: number,
): void {
  appendEvents(db, events, syncRunId);
}
