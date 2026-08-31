import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../../src/store/database.ts';
import {
  acquireLease,
  finishRun,
  millisecondsSinceLastSuccess,
  readLastRun,
  releaseLease,
  startRun,
} from '../../../src/store/repositories/sync-runs.ts';

function db() {
  return openDatabase({ path: ':memory:' });
}

const NOW = '2026-08-31T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);

describe('sync runs', () => {
  it('records a run from start to finish with its counts', () => {
    const database = db();
    const id = startRun(database, 'jira', NOW);
    finishRun(database, id, {
      finishedAt: '2026-08-31T12:00:05.000Z',
      ok: true,
      counts: { issues: 66 },
    });

    const run = readLastRun(database, 'jira');
    expect(run?.ok).toBe(true);
    expect(run?.counts).toEqual({ issues: 66 });
    database.close();
  });

  it('keeps the error text when a run fails', () => {
    const database = db();
    const id = startRun(database, 'github', NOW);
    finishRun(database, id, {
      finishedAt: NOW,
      ok: false,
      error: 'gh: exit 1',
      counts: {},
    });
    expect(readLastRun(database, 'github')?.error).toBe('gh: exit 1');
    database.close();
  });

  it('treats "never synced" as infinitely stale rather than fresh', () => {
    const database = db();
    expect(millisecondsSinceLastSuccess(database, 'jira', NOW_MS)).toBeNull();
    database.close();
  });

  it('ignores failed runs when measuring freshness', () => {
    const database = db();
    const id = startRun(database, 'jira', NOW);
    finishRun(database, id, { finishedAt: NOW, ok: false, error: 'boom', counts: {} });
    expect(millisecondsSinceLastSuccess(database, 'jira', NOW_MS)).toBeNull();
    database.close();
  });

  it('measures freshness from the last successful run', () => {
    const database = db();
    const id = startRun(database, 'jira', NOW);
    finishRun(database, id, { finishedAt: NOW, ok: true, counts: {} });
    expect(millisecondsSinceLastSuccess(database, 'jira', NOW_MS + 30_000)).toBe(30_000);
    database.close();
  });
});

describe('sync lease', () => {
  const later = '2026-08-31T12:05:00.000Z';

  it('grants the lease when nobody holds it', () => {
    const database = db();
    expect(acquireLease(database, 'pid:1', NOW, later)).toBe(true);
    database.close();
  });

  it('refuses a second holder while the lease is live', () => {
    const database = db();
    acquireLease(database, 'pid:1', NOW, later);
    expect(acquireLease(database, 'pid:2', NOW, later)).toBe(false);
    database.close();
  });

  it('grants the lease again after the holder releases it', () => {
    const database = db();
    acquireLease(database, 'pid:1', NOW, later);
    releaseLease(database, 'pid:1');
    expect(acquireLease(database, 'pid:2', NOW, later)).toBe(true);
    database.close();
  });

  it('steals an expired lease, so a killed process cannot lock later runs out forever', () => {
    const database = db();
    acquireLease(database, 'pid:1', NOW, '2026-08-31T12:00:01.000Z');
    expect(acquireLease(database, 'pid:2', '2026-08-31T12:30:00.000Z', later)).toBe(true);
    database.close();
  });

  it('does not let a stale holder release a lease it no longer owns', () => {
    const database = db();
    acquireLease(database, 'pid:1', NOW, '2026-08-31T12:00:01.000Z');
    acquireLease(database, 'pid:2', '2026-08-31T12:30:00.000Z', '2026-08-31T12:35:00.000Z');
    releaseLease(database, 'pid:1');
    expect(acquireLease(database, 'pid:3', '2026-08-31T12:31:00.000Z', later)).toBe(false);
    database.close();
  });
});
