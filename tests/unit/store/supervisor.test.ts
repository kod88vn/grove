import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { loadMigrations } from '../../../src/store/migrations/index.ts';
import { SupervisorRepository } from '../../../src/store/repositories/supervisor.ts';
import { SupervisorResourceRepository } from '../../../src/store/repositories/supervisor-resources.ts';

function createDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of loadMigrations()) {
    db.exec(migration.sql);
  }
  return db;
}

describe('SupervisorRepository', () => {
  let db: DatabaseSync;
  let repo: SupervisorRepository;
  let resourceRepo: SupervisorResourceRepository;

  afterEach(() => {
    db.close();
  });

  it('adds and retrieves supervisor items', () => {
    db = createDb();
    repo = new SupervisorRepository(db);

    const item = repo.addItem({
      key: 'TEST-100',
      source: 'manual',
      repo: 'grove',
      closeOn: 'merged',
      brief: 'Test item',
    });

    expect(item.key).toBe('TEST-100');
    expect(item.state).toBe('queued');
    expect(item.desired).toBe('run');
    expect(item.closeOn).toBe('merged');

    const fetched = repo.getItem('TEST-100');
    expect(fetched).not.toBeNull();
    expect(fetched?.key).toBe('TEST-100');
  });

  it('updates state and records event', () => {
    db = createDb();
    repo = new SupervisorRepository(db);

    repo.addItem({
      key: 'TEST-101',
      source: 'plan-file',
      repo: 'bot',
      closeOn: 'ready',
    });

    repo.updateState('TEST-101', 'working', 'started iteration 1');
    const item = repo.getItem('TEST-101');
    expect(item?.state).toBe('working');

    const events = repo.listEvents('TEST-101');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.fromState).toBe('queued');
    expect(events[0]!.toState).toBe('working');
    expect(events[0]!.evidence).toBe('started iteration 1');
  });

  it('tracks resources and cleanups for teardown', () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);

    repo.addItem({
      key: 'TEST-102',
      source: 'manual',
      repo: 'grove',
      closeOn: 'merged',
    });

    const res = resourceRepo.registerResource({
      itemKey: 'TEST-102',
      resourceType: 'scratch_dir',
      identifier: '/tmp/scratch-102',
    });

    expect(res.cleanupStatus).toBe('pending');

    const pending = resourceRepo.listPendingResources('TEST-102');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.identifier).toBe('/tmp/scratch-102');

    resourceRepo.markResourceCleaned(res.id, 'cleaned');

    const pendingAfter = resourceRepo.listPendingResources('TEST-102');
    expect(pendingAfter).toHaveLength(0);
  });

  it('records dispatches and heartbeat', () => {
    db = createDb();
    repo = new SupervisorRepository(db);

    repo.addItem({
      key: 'TEST-103',
      source: 'jira',
      repo: 'grove',
      closeOn: 'merged',
    });

    repo.addDispatch({
      itemKey: 'TEST-103',
      tier: 'worker',
      model: 'GPT-5.6 Luna',
      agentVariant: 'loop-worker',
      nonce: 'nonce-1234',
    });

    const dispatches = repo.listDispatches('TEST-103');
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]!.nonce).toBe('nonce-1234');

    repo.updateHeartbeat(12345);
    const hb = repo.getHeartbeat();
    expect(hb?.pid).toBe(12345);
  });
});
