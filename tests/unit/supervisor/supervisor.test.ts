import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadMigrations } from '../../../src/store/migrations/index.ts';
import { readRun, startRun, finishPassed, recordIteration } from '../../../src/store/repositories/loop-runs.ts';
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

function isAbsent(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true;
    throw error;
  }
}

describe('Supervisor Core & Cleanup', () => {
  let db: DatabaseSync;
  let repo: SupervisorRepository;
  let resourceRepo: SupervisorResourceRepository;
  const paths: string[] = [];
  const children: ChildProcess[] = [];

  function item(key: string): void {
    repo.addItem({ key, source: 'manual', repo: 'grove', closeOn: 'merged' });
  }

  function scratch(key: string): string {
    const path = mkdtempSync(join(process.cwd(), 'tmp/step51-'));
    paths.push(path);
    writeFileSync(join(path, 'keep.txt'), key);
    resourceRepo.registerResource({ itemKey: key, resourceType: 'scratch_dir', identifier: path });
    return path;
  }

  function child(key: string, type: 'child_pid' | 'watcher_pid' = 'child_pid'): number {
    const proc = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    children.push(proc);
    if (proc.pid === undefined) throw new Error('Fixture process did not start');
    resourceRepo.registerResource({ itemKey: key, resourceType: type, identifier: String(proc.pid) });
    return proc.pid;
  }

  function openRun(key: string): number {
    const id = startRun(db, {
      ticket: key, repo: 'grove', verifier: 'fixture', specPath: 'fixture', specDigest: 'fixture',
      configPath: null, configDigest: null, baselineTests: 0, baselineSuppressions: 0,
      budget: 1, now: new Date().toISOString(),
    });
    db.prepare('UPDATE supervisor_items SET loop_run_id = ? WHERE key = ?').run(id, key);
    return id;
  }

  afterEach(() => {
    for (const proc of children.splice(0)) {
      if (proc.pid !== undefined && !isAbsent(proc.pid)) proc.kill('SIGKILL');
    }
    for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true });
    db?.close();
  });

  it('performs teardown on item completion or cancellation', async () => {
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

    const scratchPath = scratch('CLEANUP-1');

    expect(existsSync(scratchPath)).toBe(true);

    expect(resourceRepo.listPendingResources('CLEANUP-1')).toHaveLength(1);

    // Cancel item and tick
    repo.setDesired('CLEANUP-1', 'cancelled');
    const summary = await supervisor.tick();

    expect(summary.cleanedResources).toBe(1);
    expect(existsSync(scratchPath)).toBe(false);
    expect(resourceRepo.listPendingResources('CLEANUP-1')).toHaveLength(0);

    const updated = repo.getItem('CLEANUP-1');
    expect(updated?.state).toBe('cancelled');
  });

  it('allocates and tears down isolated vscode instances', async () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);

    repo.addItem({
      key: 'INST-1',
      source: 'manual',
      repo: 'grove',
      closeOn: 'merged',
    });

    const baseDir = mkdtempSync(join(process.cwd(), 'tmp/step51-instances-'));
    paths.push(baseDir);
    const instanceMgr = new VSCodeInstanceManager(resourceRepo, baseDir);
    const cleanupMgr = new CleanupManager(resourceRepo);

    const instance = instanceMgr.createInstance({
      itemKey: 'INST-1',
      repoPath: '/tmp/repo-1',
    });

    expect(existsSync(instance.portableDir)).toBe(true);
    expect(existsSync(instance.userDataDir)).toBe(true);

    const pending = resourceRepo.listPendingResources('INST-1');
    expect(pending).toHaveLength(3);

    const results = await cleanupMgr.teardownItem('INST-1');
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);

    expect(existsSync(instance.portableDir)).toBe(false);
    expect(existsSync(instance.userDataDir)).toBe(false);
    expect(existsSync(join(baseDir, 'INST-1'))).toBe(false);
  });

  it('retries a failed directory cleanup and records success only after absence', async () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);
    item('RETRY-1');
    const path = scratch('RETRY-1');
    const resource = resourceRepo.listPendingResources('RETRY-1')[0]!;
    resourceRepo.markResourceCleaned(resource.id, 'failed');

    const results = await new CleanupManager(resourceRepo).teardownItem('RETRY-1');
    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    expect(existsSync(path)).toBe(false);
    expect(db.prepare('SELECT cleanup_status FROM supervisor_resources WHERE id = ?').get(resource.id))
      .toMatchObject({ cleanup_status: 'cleaned' });
  });

  it.each(['paused', 'awaiting_approval', 'needs_human'] as const)(
    '%s terminates child and watcher but retains workspace directories', async (state) => {
      db = createDb();
      repo = new SupervisorRepository(db);
      resourceRepo = new SupervisorResourceRepository(db);
      item('PRESERVE-1');
      const path = scratch('PRESERVE-1');
      const pid = child('PRESERVE-1');
      const watcher = child('PRESERVE-1', 'watcher_pid');
      if (state === 'paused') repo.setDesired('PRESERVE-1', 'paused');
      else repo.updateState('PRESERVE-1', state);

      await new Supervisor(repo, resourceRepo).tick();

      expect(isAbsent(pid)).toBe(true);
      expect(isAbsent(watcher)).toBe(true);
      expect(existsSync(path)).toBe(true);
      expect(resourceRepo.listPendingResources('PRESERVE-1').map((r) => r.resourceType))
        .toEqual(['scratch_dir']);
    },
  );

  it('cancelled terminates processes, deletes directories, and seals only open runs', async () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);
    item('CANCEL-1');
    const pid = child('CANCEL-1');
    const path = scratch('CANCEL-1');
    const runId = openRun('CANCEL-1');
    repo.setDesired('CANCEL-1', 'cancelled');

    await new Supervisor(repo, resourceRepo).tick();

    expect(isAbsent(pid)).toBe(true);
    expect(existsSync(path)).toBe(false);
    expect(readRun(db, runId)?.run).toMatchObject({ outcome: 'failed', stopReason: 'supervisor:cancelled' });
  });

  it('needs_human seals an open run while retaining inspectable workspace', async () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);
    item('HUMAN-1');
    const pid = child('HUMAN-1');
    const path = scratch('HUMAN-1');
    const runId = openRun('HUMAN-1');
    repo.updateState('HUMAN-1', 'needs_human');

    await new Supervisor(repo, resourceRepo).tick();

    expect(isAbsent(pid)).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(readRun(db, runId)?.run).toMatchObject({ outcome: 'failed', stopReason: 'supervisor:needs_human' });
  });

  it('done tears down owned resources without replacing a completed run verdict', async () => {
    db = createDb();
    repo = new SupervisorRepository(db);
    resourceRepo = new SupervisorResourceRepository(db);
    item('DONE-1');
    const path = scratch('DONE-1');
    const runId = openRun('DONE-1');
    recordIteration(db, {
      runId, ordinal: 1, at: new Date().toISOString(), state: 'green', exitCode: 0,
      specDigest: 'fixture', tests: 1, outputTail: 'passed',
    });
    expect(finishPassed(db, { runId, stopReason: 'passed', now: new Date().toISOString() })).toBe(true);
    repo.updateState('DONE-1', 'done');

    await new Supervisor(repo, resourceRepo).tick();

    expect(existsSync(path)).toBe(false);
    expect(readRun(db, runId)?.run).toMatchObject({ outcome: 'passed', stopReason: 'passed' });
  });
});
