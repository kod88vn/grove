import type { Database } from '../store/database.ts';
import {
  acquireLease,
  finishRun,
  millisecondsSinceLastSuccess,
  releaseLease,
  startRun,
} from '../store/repositories/sync-runs.ts';
import { recordEvents, syncBranches, syncGitHub, syncJira, type SyncDeps } from './scopes.ts';

export type SyncScope = 'jira' | 'github' | 'branches' | 'all';

export interface SyncOptions {
  readonly scope?: SyncScope;
  /** Skip the run when the last successful one is younger than this. */
  readonly maxAgeMs?: number;
  readonly leaseMs?: number;
}

export type SyncOutcome =
  | { readonly kind: 'ran'; readonly runId: number; readonly counts: Record<string, number>; readonly events: number }
  | { readonly kind: 'skipped'; readonly reason: 'fresh' | 'locked'; readonly ageMs: number | null };

const DEFAULT_LEASE_MS = 5 * 60_000;

/**
 * Run a sync, unless one is unnecessary or already running.
 *
 * Two guards, for two different problems. The staleness gate stops an interactive command from
 * spending seconds on the network to re-read data that is a minute old. The lease stops two
 * processes — a dashboard poll and a terminal command — from syncing the same data at once;
 * the loser reports rather than queues, because a duplicate sync has no value.
 */
export async function sync(deps: SyncDeps, options: SyncOptions = {}): Promise<SyncOutcome> {
  const scope = options.scope ?? 'all';
  const now = deps.now();
  const ageMs = millisecondsSinceLastSuccess(deps.db, scope, now.getTime());

  if (options.maxAgeMs !== undefined && ageMs !== null && ageMs < options.maxAgeMs) {
    return { kind: 'skipped', reason: 'fresh', ageMs };
  }

  const holder = `pid:${process.pid}`;
  const leaseUntil = new Date(now.getTime() + (options.leaseMs ?? DEFAULT_LEASE_MS)).toISOString();
  if (!acquireLease(deps.db, holder, now.toISOString(), leaseUntil)) {
    return { kind: 'skipped', reason: 'locked', ageMs };
  }

  const runId = startRun(deps.db, scope, now.toISOString());
  try {
    const { counts, events } = await runScope(deps, scope);
    recordEvents(deps.db, events, runId);
    finishRun(deps.db, runId, {
      finishedAt: deps.now().toISOString(),
      ok: true,
      counts,
    });
    return { kind: 'ran', runId, counts, events: events.length };
  } catch (error) {
    // The run row is closed as failed before rethrowing, so a crash mid-sync still leaves an
    // honest record. A run left with `ok = NULL` forever would read as "still running".
    finishRun(deps.db, runId, {
      finishedAt: deps.now().toISOString(),
      ok: false,
      error: String(error),
      counts: {},
    });
    throw error;
  } finally {
    releaseLease(deps.db, holder);
  }
}

async function runScope(
  deps: SyncDeps,
  scope: SyncScope,
): Promise<{ counts: Record<string, number>; events: Awaited<ReturnType<typeof syncJira>>['events'] }> {
  if (scope === 'jira') {
    return syncJira(deps);
  }
  if (scope === 'github') {
    return syncGitHub(deps);
  }
  if (scope === 'branches') {
    return syncBranches(deps);
  }

  const jira = await syncJira(deps);
  const github = await syncGitHub(deps);
  const branches = await syncBranches(deps);
  return {
    counts: { ...jira.counts, ...github.counts, ...branches.counts },
    events: [...jira.events, ...github.events, ...branches.events],
  };
}

/** Convenience for callers that only hold a database handle. */
export function lastSyncAgeMs(db: Database, scope: SyncScope, now: number): number | null {
  return millisecondsSinceLastSuccess(db, scope, now);
}
