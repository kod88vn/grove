import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { currentVersion, migrate } from '../../../src/store/database.ts';
import { latestVersion, loadMigrations } from '../../../src/store/migrations/index.ts';

function freshDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function tableNames(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  return rows.map((row) => String((row as { name: unknown }).name)).sort();
}

describe('migrations', () => {
  it('starts at version 0 and reaches the latest version', () => {
    const db = freshDatabase();
    expect(currentVersion(db)).toBe(0);
    expect(migrate(db)).toBe(latestVersion());
  });

  it('is idempotent: a second run applies nothing', () => {
    const db = freshDatabase();
    migrate(db);
    const before = tableNames(db);
    expect(migrate(db)).toBe(latestVersion());
    expect(tableNames(db)).toEqual(before);
  });

  it('creates every table the mirror depends on', () => {
    const db = freshDatabase();
    migrate(db);
    const names = tableNames(db);
    for (const expected of [
      'issues',
      'boards',
      'sprints',
      'sprint_issues',
      'repos',
      'pull_requests',
      'pr_reviews',
      'pr_review_requests',
      'pr_checks',
      'issue_pr_links',
      'branches',
      'events',
      'seen',
      'sync_runs',
      'sync_lock',
      'actions',
      'config',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('seeds exactly one sync_lock row, and refuses a second', () => {
    const db = freshDatabase();
    migrate(db);
    const count = db.prepare('SELECT COUNT(*) AS n FROM sync_lock').get() as { n: number };
    expect(count.n).toBe(1);
    expect(() => db.exec('INSERT INTO sync_lock (id) VALUES (2)')).toThrow();
  });

  it('declares migrations in strictly ascending order with no gaps', () => {
    const versions = loadMigrations().map((m) => m.version);
    expect(versions).toEqual(Array.from({ length: versions.length }, (_, i) => i + 1));
  });
});

describe('full-text search', () => {
  it('finds an issue by a word in its summary', () => {
    const db = freshDatabase();
    migrate(db);
    insertIssue(db, 'WS-6316', 'Centralise storefront build and runtime configuration');
    insertIssue(db, 'WS-6229', 'Support LD DD');

    const hits = db
      .prepare('SELECT key FROM issues_fts WHERE issues_fts MATCH ? ORDER BY rank')
      .all('storefront');
    expect(hits.map((r) => (r as { key: string }).key)).toEqual(['WS-6316']);
  });

  it('stops matching the old title after an update', () => {
    const db = freshDatabase();
    migrate(db);
    insertIssue(db, 'WS-6316', 'Centralise storefront build');
    db.prepare('UPDATE issues SET summary = ? WHERE key = ?').run('Something else entirely', 'WS-6316');

    const stale = db
      .prepare('SELECT key FROM issues_fts WHERE issues_fts MATCH ?')
      .all('storefront');
    expect(stale).toEqual([]);

    const current = db
      .prepare('SELECT key FROM issues_fts WHERE issues_fts MATCH ?')
      .all('entirely');
    expect(current).toHaveLength(1);
  });

  it('drops the index entry when the issue is deleted', () => {
    const db = freshDatabase();
    migrate(db);
    insertIssue(db, 'WS-6316', 'Centralise storefront build');
    db.prepare('DELETE FROM issues WHERE key = ?').run('WS-6316');

    const hits = db.prepare('SELECT key FROM issues_fts WHERE issues_fts MATCH ?').all('storefront');
    expect(hits).toEqual([]);
  });
});

function insertIssue(db: DatabaseSync, key: string, summary: string): void {
  db.prepare(
    `INSERT INTO issues (key, summary, status, issue_type, created, updated, raw, mirrored_at)
     VALUES (?, ?, 'Open', 'Task', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '{}', '2026-08-31T00:00:00.000Z')`,
  ).run(key, summary);
}
