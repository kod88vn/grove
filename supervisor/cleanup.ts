import { existsSync, rmSync } from 'node:fs';
import type { SupervisorResourceRepository } from '../src/store/repositories/supervisor-resources.ts';
import type { SupervisorResource } from '../src/core/model/supervisor.ts';

export interface CleanupResult {
  readonly resourceId: number;
  readonly success: boolean;
  readonly error?: string;
}

export function killPid(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ESRCH') {
      return true;
    }
    return false;
  }
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

  cleanResource(resource: SupervisorResource): CleanupResult {
    let success = false;
    let error: string | undefined;

    switch (resource.resourceType) {
      case 'child_pid':
      case 'watcher_pid': {
        const pid = parseInt(resource.identifier, 10);
        if (!isNaN(pid)) {
          success = killPid(pid, 'SIGTERM');
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

  teardownItem(itemKey: string): readonly CleanupResult[] {
    const pending = this.resourceRepo.listPendingResources(itemKey);
    const results: CleanupResult[] = [];
    for (const res of pending) {
      results.push(this.cleanResource(res));
    }
    return results;
  }

  teardownAllPending(): readonly CleanupResult[] {
    const pending = this.resourceRepo.listPendingResources();
    const results: CleanupResult[] = [];
    for (const res of pending) {
      results.push(this.cleanResource(res));
    }
    return results;
  }
}
