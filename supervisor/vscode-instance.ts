import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SupervisorResourceRepository } from '../src/store/repositories/supervisor-resources.ts';
import { removePath } from './cleanup.ts';

export interface ChildInstanceSpec {
  readonly itemKey: string;
  readonly repoPath: string;
  readonly baseDir?: string;
}

export interface ActiveInstance {
  readonly itemKey: string;
  readonly repoPath: string;
  readonly portableDir: string;
  readonly userDataDir: string;
  readonly pid?: number;
}

export class VSCodeInstanceManager {
  constructor(
    private readonly resourceRepo: SupervisorResourceRepository,
    private readonly baseDir: string = join(process.cwd(), 'tmp/supervisor')
  ) {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  createInstance(spec: ChildInstanceSpec): ActiveInstance {
    const itemDir = join(this.baseDir, spec.itemKey);
    const portableDir = join(itemDir, 'portable');
    const userDataDir = join(itemDir, 'user-data');

    mkdirSync(portableDir, { recursive: true });
    mkdirSync(userDataDir, { recursive: true });

    this.resourceRepo.registerResource({
      itemKey: spec.itemKey,
      resourceType: 'portable_dir',
      identifier: portableDir,
    });

    this.resourceRepo.registerResource({
      itemKey: spec.itemKey,
      resourceType: 'user_data_dir',
      identifier: userDataDir,
    });

    return {
      itemKey: spec.itemKey,
      repoPath: spec.repoPath,
      portableDir,
      userDataDir,
    };
  }

  destroyInstance(itemKey: string): void {
    const itemDir = join(this.baseDir, itemKey);
    removePath(itemDir);
  }
}
