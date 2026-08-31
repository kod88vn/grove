import { randomUUID } from 'node:crypto';
import type { ActionPayload } from '../core/model/action.ts';
import type { Clock } from '../core/clock.ts';
import type { Denial } from '../core/policy/denylist.ts';
import { refuseMerge, refuseResolve } from '../core/policy/preflight.ts';
import type { GitHubClient } from '../connectors/github/client.ts';
import type { JiraClient } from '../connectors/jira/client.ts';
import type { Database } from '../store/database.ts';
import { recordOutcome, recordProposal } from '../store/repositories/actions.ts';
import { readIssue } from '../store/repositories/issues.ts';
import { readLinksForIssue } from '../store/repositories/links.ts';
import { upsertPullRequest } from '../store/repositories/pull-requests.ts';

/**
 * The only place in this system that changes anything outside it.
 *
 * Everything upstream observes and proposes. Concentrating the side effects here means the
 * audit trail cannot be bypassed by accident: there is no second path to a mutation.
 *
 * The sequence is fixed and each step exists for a reason:
 *   1. re-read live state — the mirror may be an hour old, and a reviewer may have objected
 *      in that hour
 *   2. run the guards against what was just read, not against the mirror
 *   3. write the audit row *before* acting, so a crash mid-merge is still recorded
 *   4. act
 *   5. write the outcome
 */

export interface ExecutorDeps {
  readonly db: Database;
  readonly github: GitHubClient;
  readonly jira: JiraClient;
  readonly identity: { readonly jira: string; readonly github: string };
  readonly clock: Clock;
}

export interface ExecuteRequest {
  readonly action: ActionPayload;
  /** The stall rule that proposed this, for the audit row. */
  readonly stallId: string | null;
  /** Names the human decision. There is no machine-authorized path. */
  readonly authorizedBy: string;
  readonly reason: string;
}

export type ExecuteResult =
  | { readonly ok: true; readonly id: string; readonly outcome: string }
  | { readonly ok: false; readonly id: string; readonly refused: Denial };

export async function execute(
  deps: ExecutorDeps,
  request: ExecuteRequest,
): Promise<ExecuteResult> {
  const id = randomUUID();
  const at = new Date(deps.clock.now()).toISOString();
  recordProposal(deps.db, {
    id,
    createdAt: at,
    capability: request.action.capability,
    payload: request.action.payload,
    reason: request.reason,
    stallId: request.stallId,
    authorizedBy: request.authorizedBy,
  });

  const refusal = await preflight(deps, request.action);
  if (refusal !== null) {
    recordOutcome(deps.db, {
      id,
      status: 'refused',
      executedAt: at,
      outcome: refusal.because,
    });
    return { ok: false, id, refused: refusal };
  }

  try {
    const outcome = await perform(deps, request.action);
    recordOutcome(deps.db, {
      id,
      status: 'applied',
      executedAt: new Date(deps.clock.now()).toISOString(),
      outcome,
    });
    return { ok: true, id, outcome };
  } catch (error) {
    const because = error instanceof Error ? error.message : String(error);
    recordOutcome(deps.db, {
      id,
      status: 'failed',
      executedAt: new Date(deps.clock.now()).toISOString(),
      outcome: because,
    });
    return { ok: false, id, refused: { rule: 'remote-rejected', because } };
  }
}

/** Guards, run against state read seconds ago rather than against the mirror. */
async function preflight(deps: ExecutorDeps, action: ActionPayload): Promise<Denial | null> {
  if (action.capability === 'github:pr-merge') {
    const { repo, number } = action.payload;
    const fresh = await deps.github.pullRequest(repo, number);
    // Fold the fresh read back into the mirror. Whatever happens next, what we just learned is
    // more current than what was stored, and discarding it would let the dashboard keep
    // offering an action that has already become invalid.
    upsertPullRequest(deps.db, fresh, true);
    return refuseMerge(fresh.value, deps.identity.github);
  }
  return resolveGuard(deps, action.payload.issueKey);
}

async function resolveGuard(deps: ExecutorDeps, issueKey: string): Promise<Denial | null> {
  const issue = readIssue(deps.db, issueKey);
  if (issue === null) {
    return { rule: 'unknown-issue', because: `${issueKey} is not in the mirror` };
  }
  const links = readLinksForIssue(deps.db, issueKey);
  const fresh = await Promise.all(
    links.map((link) => deps.github.pullRequest(link.repo, link.number)),
  );
  for (const pr of fresh) {
    upsertPullRequest(deps.db, pr, true);
  }
  return refuseResolve(
    issue,
    fresh.map((pr) => pr.value),
    deps.identity.jira,
  );
}

async function perform(deps: ExecutorDeps, action: ActionPayload): Promise<string> {
  if (action.capability === 'github:pr-merge') {
    const { repo, number } = action.payload;
    const output = await deps.github.mergePullRequest(repo, number);
    return output === '' ? `merged ${repo}#${number}` : output;
  }
  const { issueKey, transitionId, transitionName, fields } = action.payload;
  await deps.jira.applyTransition(issueKey, transitionId, { ...fields });
  return `${issueKey} -> ${transitionName}`;
}
