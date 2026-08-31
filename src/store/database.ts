import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadMigrations } from './migrations/index.ts';

export interface OpenOptions {
  /** Absolute path to the database file, or `:memory:` for tests. */
  readonly path: string;
  /** How long a writer waits for a competing lock before failing. */
  readonly busyTimeoutMs?: number;
}

const DEFAULT_BUSY_TIMEOUT_MS = 5_000;

/**
 * Open the database, apply pragmas, and migrate to the latest schema.
 *
 * WAL matters here beyond performance: the dashboard server reads on an interval while a
 * terminal command may be writing. In the default rollback journal those block each other and
 * the reader sees SQLITE_BUSY. In WAL, readers never block and never see a partial write.
 */
export function openDatabase(options: OpenOptions): DatabaseSync {
  if (options.path !== ':memory:') {
    mkdirSync(dirname(options.path), { recursive: true });
  }
  const db = new DatabaseSync(options.path);
  applyPragmas(db, options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS);
  migrate(db);
  return db;
}

function applyPragmas(db: DatabaseSync, busyTimeoutMs: number): void {
  // An in-memory database has no file to journal, and asking for WAL there silently leaves
  // journal_mode as `memory`, which is fine but not worth the round trip.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  // Off by default in SQLite, and every table here has a real parent/child relationship.
  db.exec('PRAGMA foreign_keys = ON');
  // NORMAL is the right trade in WAL: durable against process crash, not against power loss.
  // This is a rebuildable mirror, so a lost final transaction costs one re-sync.
  db.exec('PRAGMA synchronous = NORMAL');
}

export function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  return row?.user_version ?? 0;
}

/**
 * Apply every migration newer than the recorded version.
 *
 * Each runs in its own transaction with `user_version` bumped inside it, so an interrupted
 * upgrade leaves the database at the last fully applied version rather than half-way through.
 */
export function migrate(db: DatabaseSync): number {
  const from = currentVersion(db);
  const pending = loadMigrations().filter((m) => m.version > from);
  for (const migration of pending) {
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      // PRAGMA does not accept a bound parameter; the value is a number from our own table.
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (cause) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${migration.version} (${migration.name}) failed`, { cause });
    }
  }
  return currentVersion(db);
}
