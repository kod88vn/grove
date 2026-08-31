import { GitHubClient } from '../connectors/github/client.ts';
import { JiraClient } from '../connectors/jira/client.ts';
import type { IssueKey } from '../core/model/issue.ts';
import type { Stall } from '../core/model/stall.ts';
import { checkAction, execute } from '../executor/executor.ts';
import { prepareResolve } from '../executor/prepare.ts';
import { detect } from '../stalls/detect.ts';
import { openDatabase, type Database } from '../store/database.ts';
import { readSnapshot } from '../store/repositories/snapshot.ts';
import { loadConfig, systemClock, type Config } from './config.ts';

/**
 * Closing the loop on work that shipped but never closed its ticket.
 *
 * This is the failure the whole project was built around: a PR merges, everyone moves on, and
 * the ticket stays Open as a false signal about project state. Until now the only way to fire
 * a resolve was a dashboard button, which means the loop only closed when someone happened to
 * open the dashboard — the same "someone has to remember" gap that let the tickets rot.
 *
 * Candidates come from the `pr-merged-ticket-open` rule rather than a query written here, so
 * there is one definition of "shipped but still open" and the CLI cannot drift from what the
 * dashboard and MCP server report.
 */

/** Named on every audit row written from here. There is no machine-authorized path. */
const AUTHORIZED_BY = 'human:cli';

const STALL_ID = 'pr-merged-ticket-open';

export type ResolveStatus = 'ready' | 'applied' | 'refused' | 'failed' | 'unavailable';

export interface ResolveOutcome {
  readonly issueKey: string;
  readonly status: ResolveStatus;
  readonly detail: string;
}

export interface ResolveOptions {
  /** Off by default: listing is safe, mutating is a decision. */
  readonly apply: boolean;
  /** A single issue key, or null for every candidate. */
  readonly only: string | null;
}

/**
 * Which tickets are shipped-but-open, in mirror order.
 *
 * Deduplicated because one merged PR can carry several keys: WS-6326 and WS-6333 were both
 * closed by copilot-config#15, and proposing the same transition twice is not a second action.
 */
export function resolvable(stalls: readonly Stall[], only: string | null): IssueKey[] {
  const keys = stalls.flatMap((stall) =>
    stall.id === STALL_ID && stall.subject.kind === 'issue' ? [stall.subject.key] : [],
  );
  const unique = [...new Set(keys)];
  return only === null ? unique : unique.filter((key) => key === only);
}

interface ResolveDeps {
  readonly db: Database;
  readonly jira: JiraClient;
  readonly github: GitHubClient;
  readonly config: Config;
}

export async function runResolve(options: ResolveOptions): Promise<ResolveOutcome[]> {
  const config = loadConfig();
  const db = openDatabase({ path: config.databasePath });
  try {
    const snapshot = readSnapshot(db, { jira: config.jira.me, github: config.github.me });
    const keys = resolvable(detect(snapshot, systemClock()), options.only);
    const deps: ResolveDeps = {
      db,
      jira: new JiraClient(
        { baseUrl: config.jira.baseUrl, token: config.jira.token },
        config.jira.boardId,
      ),
      github: new GitHubClient({ me: config.github.me, projectKeys: config.jira.projectKeys }),
      config,
    };
    const outcomes: ResolveOutcome[] = [];
    // Sequential on purpose. Each resolve is several API calls, a failure part-way through
    // should leave a readable trail rather than an interleaved one, and nothing here is
    // urgent enough to justify hammering Jira.
    for (const key of keys) {
      outcomes.push(await resolveOne(deps, key, options.apply));
    }
    return outcomes;
  } finally {
    db.close();
  }
}

async function resolveOne(
  deps: ResolveDeps,
  issueKey: IssueKey,
  apply: boolean,
): Promise<ResolveOutcome> {
  // Read the workflow live. Which transition means "done", and what its screen demands, is
  // per-project configuration that changes without notice.
  const prepared = await prepareResolve(deps.jira, issueKey, deps.config.jira.fixVersion);
  if (prepared === null) {
    return { issueKey, status: 'unavailable', detail: 'no resolve transition on this workflow' };
  }
  if (prepared.unfilled.length > 0) {
    return {
      issueKey,
      status: 'unavailable',
      detail: `screen also requires ${prepared.unfilled.join(', ')} — resolve it by hand`,
    };
  }
  const name =
    prepared.action.capability === 'jira:transition'
      ? prepared.action.payload.transitionName
      : 'resolve';
  if (!apply) {
    // Ask the guards the same question the executor would. Anything else is a preview that
    // promises work it cannot do.
    const refusal = await checkAction(executorDeps(deps), prepared.action);
    return refusal === null
      ? { issueKey, status: 'ready', detail: `would apply "${name}" with resolution Fixed` }
      : { issueKey, status: 'refused', detail: `${refusal.rule}: ${refusal.because}` };
  }
  return applyResolve(deps, issueKey, prepared.action);
}

function executorDeps(deps: ResolveDeps): Parameters<typeof execute>[0] {
  return {
    db: deps.db,
    github: deps.github,
    jira: deps.jira,
    identity: { jira: deps.config.jira.me, github: deps.config.github.me },
    clock: systemClock(),
  };
}

async function applyResolve(
  deps: ResolveDeps,
  issueKey: IssueKey,
  action: Parameters<typeof execute>[1]['action'],
): Promise<ResolveOutcome> {
  const result = await execute(executorDeps(deps), {
    action,
    stallId: STALL_ID,
    authorizedBy: AUTHORIZED_BY,
    reason: 'its pull request is merged',
  });
  if (result.ok) {
    return { issueKey, status: 'applied', detail: result.outcome };
  }
  // The executor reports a remote rejection through the same channel as a guard refusal. They
  // mean different things: one is the system declining, the other is Jira declining.
  const failed = result.refused.rule === 'remote-rejected';
  return {
    issueKey,
    status: failed ? 'failed' : 'refused',
    detail: `${result.refused.rule}: ${result.refused.because}`,
  };
}
