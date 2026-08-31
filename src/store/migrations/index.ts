import { readFileSync } from 'node:fs';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * Forward-only migrations, applied in order, tracked by `PRAGMA user_version`.
 *
 * There is no `down`. A rollback of a mirror schema is a re-sync, which is cheap; carrying
 * reversal scripts for a database that can be rebuilt from upstream is cost without benefit.
 *
 * Never edit an entry once it has run anywhere. Add a new one.
 */
const FILES: readonly { version: number; name: string; file: string }[] = [
  { version: 1, name: 'mirror', file: '0001-mirror.sql' },
  { version: 2, name: 'local-state', file: '0002-local-state.sql' },
  { version: 3, name: 'search', file: '0003-search.sql' },
  { version: 4, name: 'branch-upstream', file: '0004-branch-upstream.sql' },
  { version: 5, name: 'check-started-at', file: '0005-check-started-at.sql' },
  { version: 6, name: 'work-steps', file: '0006-work-steps.sql' },
];

export function loadMigrations(): Migration[] {
  return FILES.map(({ version, name, file }) => ({
    version,
    name,
    sql: readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'),
  }));
}

export function latestVersion(): number {
  return FILES.reduce((max, m) => Math.max(max, m.version), 0);
}
