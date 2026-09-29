import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where `registry/model-tiers.json` lives relative to a repo root. */
export function defaultRegistryPath(repoRoot: string): string {
  return join(repoRoot, 'registry', 'model-tiers.json');
}

/** Where managed agent files live relative to a repo root. */
export function defaultAgentsDir(repoRoot: string): string {
  return join(repoRoot, '.github', 'agents');
}

/**
 * Where Copilot Chat writes its model catalogue snapshots. Not a fixed file — callers walk
 * this root for the newest `models.json` (see `findNewestCatalogFile`).
 */
export function defaultCatalogSearchRoot(): string {
  return join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
}
