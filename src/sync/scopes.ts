import type { Database } from '../store/database.ts';
import type { SyncConfig } from './config.ts';
import { GitHubClient } from '../connectors/github/client.ts';
import { JiraClient } from '../connectors/jira/client.ts';
import { localBranches } from '../connectors/git.ts';
import { appendEvents, type BotEvent } from '../store/repositories/events.ts';
import { readIssue, upsertIssue } from '../store/repositories/issues.ts';
import { readPullRequest, upsertPullRequest } from '../store/repositories/pull-requests.ts';
import { replaceLinks } from '../store/repositories/links.ts';
import { replaceBranches, upsertRepo } from '../store/repositories/branches.ts';
import { replaceSprintIssues, upsertBoard, upsertSprint } from '../store/repositories/sprints.ts';
import { correlate } from './correlate.ts';
import { diffIssue, diffPullRequest } from './diff.ts';

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

const MY_UNRESOLVED_JQL =
  'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

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

  const mine = await deps.jira.searchIssues(MY_UNRESOLVED_JQL, at);
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
  const events: BotEvent[] = [];
  const involved = await discoverInvolvement(deps);
  const configured = new Set(deps.config.repos.map((repo) => repo.fullName));
  let total = 0;

  for (const repo of new Set([...configured, ...involved.keys()])) {
    upsertRepo(deps.db, repo, pathFor(deps, repo), at);
    const hydrated = await deps.github.listOpenPullRequests(repo);
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

  return { counts: { pullRequests: total, repos: configured.size + involved.size }, events };
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

function isMine(pr: { author: string; myReviewState: string }, me: string): boolean {
  // "Mine" means it is on my plate, which includes PRs I must review, not only ones I wrote.
  return pr.author === me || pr.myReviewState !== 'not_requested';
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
