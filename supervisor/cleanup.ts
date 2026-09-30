import { existsSync, rmSync } from 'node:fs';
import type { SupervisorResourceRepository } from '../src/store/repositories/supervisor-resources.ts';
import type { SupervisorResource } from '../src/core/model/supervisor.ts';

export interface CleanupResult {
  readonly resourceId: number;
  readonly success: boolean;
  readonly error?: string;
}

export function isProcessAbsent(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ESRCH') {
      return true;
    }
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function killPid(pid: number, signal: NodeJS.Signals = 'SIGTERM', timeoutMs = 1500): Promise<boolean> {
  try {
    process.kill(pid, signal);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return true;
    return false;
  }

  const pollIntervalMs = 25;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isProcessAbsent(pid)) return true;
    await sleep(pollIntervalMs);
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return true;
    return false;
  }

  const killDeadline = Date.now() + 500;
  while (Date.now() < killDeadline) {
    if (isProcessAbsent(pid)) return true;
    await sleep(pollIntervalMs);
  }

  return isProcessAbsent(pid);
}

export function removePath(pathStr: string): boolean {
  try {
    if (existsSync(pathStr)) {
      rmSync(pathStr, { recursive: true, force: true });
    }
    return !existsSync(pathStr);
  } catch {
    return false;
  }
}

export class CleanupManager {
  constructor(private readonly resourceRepo: SupervisorResourceRepository) {}

  async cleanResource(resource: SupervisorResource): Promise<CleanupResult> {
    let success = false;
    let error: string | undefined;

    switch (resource.resourceType) {
      case 'child_pid':
      case 'watcher_pid': {
        const pid = parseInt(resource.identifier, 10);
        if (!isNaN(pid)) {
          success = await killPid(pid, 'SIGTERM');
        } else {
          success = true;
        }
        break;
      }
      case 'portable_dir':
      case 'user_data_dir':
      case 'scratch_dir':
      case 'spec_file':
      case 'session_file':
      case 'log_file':
      case 'other': {
        success = removePath(resource.identifier);
        if (!success) {
          error = `Failed to remove path: ${resource.identifier}`;
        }
        break;
      }
      default:
        success = true;
    }

    this.resourceRepo.markResourceCleaned(resource.id, success ? 'cleaned' : 'failed');
    return error ? { resourceId: resource.id, success, error } : { resourceId: resource.id, success };
  }

  async releaseProcesses(itemKey: string): Promise<readonly CleanupResult[]> {
    const pending = this.resourceRepo
      .listPendingResources(itemKey)
      .filter((r) => r.resourceType === 'child_pid' || r.resourceType === 'watcher_pid');
    const results: CleanupResult[] = [];
    for (const res of pending) {
      results.push(await this.cleanResource(res));
    }
    return results;
  }

  async teardownItem(itemKey: string): Promise<readonly CleanupResult[]> {
    const pending = [...this.resourceRepo.listPendingResources(itemKey)].sort(
      (a, b) => b.identifier.length - a.identifier.length
    );
    const results: CleanupResult[] = [];
    for (const res of pending) {
      results.push(await this.cleanResource(res));
    }
    return results;
  }

  async teardownAllPending(): Promise<readonly CleanupResult[]> {
    const pending = [...this.resourceRepo.listPendingResources()].sort(
      (a, b) => b.identifier.length - a.identifier.length
    );
    const results: CleanupResult[] = [];
    for (const res of pending) {
      results.push(await this.cleanResource(res));
    }
    return results;
  }
}
