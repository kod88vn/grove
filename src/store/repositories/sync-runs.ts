import type { DatabaseSync } from 'node:sqlite';

export interface SyncRun {
  readonly id: number;
  readonly scope: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly ok: boolean | null;
  readonly error: string | null;
  readonly counts: Record<string, number>;
}

export function startRun(db: DatabaseSync, scope: string, startedAt: string): number {
  db.prepare('INSERT INTO sync_runs (scope, started_at) VALUES (?, ?)').run(scope, startedAt);
  const row = db.prepare('SELECT last_insert_rowid() AS id').get() as unknown as { id: number };
  return row.id;
}

export function finishRun(
  db: DatabaseSync,
  id: number,
  result: { finishedAt: string; ok: boolean; error?: string; counts: Record<string, number> },
): void {
  db.prepare('UPDATE sync_runs SET finished_at = ?, ok = ?, error = ?, counts = ? WHERE id = ?').run(
    result.finishedAt,
    result.ok ? 1 : 0,
    result.error ?? null,
    JSON.stringify(result.counts),
    id,
  );
}

export function readLastRun(db: DatabaseSync, scope?: string): SyncRun | null {
  const row =
    scope === undefined
      ? db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1').get()
      : db.prepare('SELECT * FROM sync_runs WHERE scope = ? ORDER BY id DESC LIMIT 1').get(scope);
  return row === undefined ? null : toRun(row as unknown as RunRow);
}

/**
 * How long ago the last successful sync of this scope finished, in milliseconds.
 *
 * Returns null when there has never been one, which callers must treat as "infinitely stale"
 * rather than "fresh". A first run with no history is exactly when a sync is most needed.
 */
export function millisecondsSinceLastSuccess(
  db: DatabaseSync,
  scope: string,
  now: number,
): number | null {
  const row = db
    .prepare(
      `SELECT finished_at FROM sync_runs
       WHERE scope = ? AND ok = 1 AND finished_at IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(scope) as unknown as { finished_at: string } | undefined;
  return row === undefined ? null : now - Date.parse(row.finished_at);
}

interface RunRow {
  readonly id: number;
  readonly scope: string;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly ok: number | null;
  readonly error: string | null;
  readonly counts: string;
}

function toRun(row: RunRow): SyncRun {
  return {
    id: row.id,
    scope: row.scope,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    ok: row.ok === null ? null : row.ok === 1,
    error: row.error,
    counts: JSON.parse(row.counts) as Record<string, number>,
  };
}

/**
 * Take the single sync lease, or report that somebody else holds it.
 *
 * `BEGIN IMMEDIATE` acquires the write lock before reading, so two processes racing here cannot
 * both observe a free lease. A plain `BEGIN` would let both read, both decide they won, and both
 * sync — which is the bug this table exists to prevent.
 *
 * An expired lease is stolen rather than respected: the usual reason a lease outlives its holder
 * is that the holder was killed, and a crashed process must not lock the bot out forever.
 */
export function acquireLease(
  db: DatabaseSync,
  holder: string,
  now: string,
  leaseUntil: string,
): boolean {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT holder, lease_until FROM sync_lock WHERE id = 1').get() as
      | unknown as { holder: string | null; lease_until: string | null }
      | undefined;
    const heldByOther =
      row !== undefined &&
      row.holder !== null &&
      row.lease_until !== null &&
      Date.parse(row.lease_until) > Date.parse(now);
    if (heldByOther) {
      db.exec('ROLLBACK');
      return false;
    }
    db.prepare('UPDATE sync_lock SET holder = ?, acquired_at = ?, lease_until = ? WHERE id = 1').run(
      holder,
      now,
      leaseUntil,
    );
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function releaseLease(db: DatabaseSync, holder: string): void {
  db.prepare(
    'UPDATE sync_lock SET holder = NULL, acquired_at = NULL, lease_until = NULL WHERE id = 1 AND holder = ?',
  ).run(holder);
}
