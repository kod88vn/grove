import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadMigrations } from '../../../src/store/migrations/index.ts';
import { SupervisorRepository } from '../../../src/store/repositories/supervisor.ts';
import { SupervisorResourceRepository } from '../../../src/store/repositories/supervisor-resources.ts';
import { Supervisor } from '../../../supervisor/tick.ts';
import { CleanupManager } from '../../../supervisor/cleanup.ts';
import { VSCodeInstanceManager } from '../../../supervisor/vscode-instance.ts';

function createDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of loadMigrations()) {
    db.exec(migration.sql);
  }
  return db;
}

describe('Supervisor Core & Cleanup', () => {
  let db: DatabaseSync;
  let repo: SupervisorRepository;
  let resourceRepo: SupervisorResourceRepository;

  afterEach(() => {
    db.close();
  });

  it('performs teardown on item completion or cancellation', () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);
    const supervisor = new Supervisor(repo, resourceRepo);

    repo.addItem({
      key: 'CLEANUP-1',
      source: 'manual',
      repo: 'grove',
      closeOn: 'merged',
    });

    const scratchPath = join(tmpdir(), `test-scratch-${Date.now()}`);
    mkdirSync(scratchPath, { recursive: true });
    writeFileSync(join(scratchPath, 'dummy.txt'), 'hello');

    expect(existsSync(scratchPath)).toBe(true);

    resourceRepo.registerResource({
      itemKey: 'CLEANUP-1',
      resourceType: 'scratch_dir',
      identifier: scratchPath,
    });

    expect(resourceRepo.listPendingResources('CLEANUP-1')).toHaveLength(1);

    // Cancel item and tick
    repo.setDesired('CLEANUP-1', 'cancelled');
    const summary = supervisor.tick();

    expect(summary.cleanedResources).toBe(1);
    expect(existsSync(scratchPath)).toBe(false);
    expect(resourceRepo.listPendingResources('CLEANUP-1')).toHaveLength(0);

    const updated = repo.getItem('CLEANUP-1');
    expect(updated?.state).toBe('cancelled');
  });

  it('allocates and tears down isolated vscode instances', () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);

    repo.addItem({
      key: 'INST-1',
      source: 'manual',
      repo: 'grove',
      closeOn: 'merged',
    });

    const baseDir = join(tmpdir(), `test-instances-${Date.now()}`);
    const instanceMgr = new VSCodeInstanceManager(resourceRepo, baseDir);
    const cleanupMgr = new CleanupManager(resourceRepo);

    const instance = instanceMgr.createInstance({
      itemKey: 'INST-1',
      repoPath: '/tmp/repo-1',
    });

    expect(existsSync(instance.portableDir)).toBe(true);
    expect(existsSync(instance.userDataDir)).toBe(true);

    const pending = resourceRepo.listPendingResources('INST-1');
    expect(pending).toHaveLength(2);

    const results = cleanupMgr.teardownItem('INST-1');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);

    expect(existsSync(instance.portableDir)).toBe(false);
    expect(existsSync(instance.userDataDir)).toBe(false);
  });
});
