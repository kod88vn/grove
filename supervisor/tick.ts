import type { SupervisorRepository } from '../src/store/repositories/supervisor.ts';
import type { SupervisorResourceRepository } from '../src/store/repositories/supervisor-resources.ts';
import type { SupervisorItem, SupervisorState } from '../src/core/model/supervisor.ts';
import { CleanupManager } from './cleanup.ts';

export interface TickOptions {
  readonly maxConcurrent?: number;
}

export interface TransitionRecord {
  readonly key: string;
  readonly from: SupervisorState;
  readonly to: SupervisorState;
}

export interface TickSummary {
  readonly itemsChecked: number;
  readonly transitions: readonly TransitionRecord[];
  readonly cleanedResources: number;
}

export class Supervisor {
  private readonly cleanupManager: CleanupManager;

  constructor(
    private readonly repo: SupervisorRepository,
    resourceRepo: SupervisorResourceRepository
  ) {
    this.cleanupManager = new CleanupManager(resourceRepo);
  }

  private async reconcileItem(item: SupervisorItem, transitions: TransitionRecord[]): Promise<number> {
    if (item.desired === 'cancelled' || item.state === 'cancelled') {
      if (item.state !== 'cancelled') {
        this.repo.updateState(item.key, 'cancelled', 'User cancelled item');
        transitions.push({ key: item.key, from: item.state, to: 'cancelled' });
      }
      if (item.loopRunId) {
        this.repo.sealOpenRun(item.loopRunId, 'supervisor:cancelled');
      }
      const res = await this.cleanupManager.teardownItem(item.key);
      return res.filter((r) => r.success).length;
    }

    if (item.desired === 'paused' && item.state !== 'paused' && item.state !== 'done') {
      this.repo.updateState(item.key, 'paused', 'User paused item');
      transitions.push({ key: item.key, from: item.state, to: 'paused' });
      const res = await this.cleanupManager.releaseProcesses(item.key);
      return res.filter((r) => r.success).length;
    }

    if (item.desired === 'run' && item.state === 'paused') {
      this.repo.updateState(item.key, 'queued', 'Resumed item from paused');
      transitions.push({ key: item.key, from: 'paused', to: 'queued' });
      return 0;
    }

    if (item.state === 'paused' || item.state === 'awaiting_approval') {
      const res = await this.cleanupManager.releaseProcesses(item.key);
      return res.filter((r) => r.success).length;
    }

    if (item.state === 'needs_human') {
      if (item.loopRunId) {
        this.repo.sealOpenRun(item.loopRunId, 'supervisor:needs_human');
      }
      const res = await this.cleanupManager.releaseProcesses(item.key);
      return res.filter((r) => r.success).length;
    }

    if (item.state === 'done') {
      const res = await this.cleanupManager.teardownItem(item.key);
      return res.filter((r) => r.success).length;
    }

    return 0;
  }

  async tick(_options?: TickOptions): Promise<TickSummary> {
    this.repo.updateHeartbeat(process.pid);

    const items = this.repo.listItems();
    const transitions: TransitionRecord[] = [];
    let cleanedResources = 0;

    for (const item of items) {
      cleanedResources += await this.reconcileItem(item, transitions);
    }

    return {
      itemsChecked: items.length,
      transitions,
      cleanedResources,
    };
  }

  getCleanupManager(): CleanupManager {
    return this.cleanupManager;
  }
}
