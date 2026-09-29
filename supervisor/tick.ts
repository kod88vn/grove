import type { SupervisorRepository } from '../src/store/repositories/supervisor.ts';
import type { SupervisorResourceRepository } from '../src/store/repositories/supervisor-resources.ts';
import type { SupervisorState } from '../src/core/model/supervisor.ts';
import { CleanupManager } from './cleanup.ts';

export interface TickOptions {
  readonly maxConcurrent?: number;
}

export interface TickSummary {
  readonly itemsChecked: number;
  readonly transitions: readonly { key: string; from: SupervisorState; to: SupervisorState }[];
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

  tick(_options?: TickOptions): TickSummary {
    this.repo.updateHeartbeat(process.pid);

    const items = this.repo.listItems();
    const transitions: { key: string; from: SupervisorState; to: SupervisorState }[] = [];
    let cleanedResources = 0;

    for (const item of items) {
      // Reconcile desired state
      if (item.desired === 'cancelled' && item.state !== 'cancelled') {
        this.repo.updateState(item.key, 'cancelled', 'User cancelled item');
        transitions.push({ key: item.key, from: item.state, to: 'cancelled' });
        const res = this.cleanupManager.teardownItem(item.key);
        cleanedResources += res.filter((r) => r.success).length;
        continue;
      }

      if (item.desired === 'paused' && item.state !== 'paused' && item.state !== 'done' && item.state !== 'cancelled') {
        this.repo.updateState(item.key, 'paused', 'User paused item');
        transitions.push({ key: item.key, from: item.state, to: 'paused' });
        continue;
      }

      if (item.desired === 'run' && item.state === 'paused') {
        this.repo.updateState(item.key, 'queued', 'Resumed item from paused');
        transitions.push({ key: item.key, from: 'paused', to: 'queued' });
        continue;
      }

      // Terminal item cleanup (D7 mandatory teardown)
      if (item.state === 'done' || item.state === 'cancelled') {
        const res = this.cleanupManager.teardownItem(item.key);
        cleanedResources += res.filter((r) => r.success).length;
      }
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
