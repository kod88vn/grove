import type { DatabaseSync } from 'node:sqlite';

export interface BranchRecord {
  readonly repo: string;
  readonly name: string;
  readonly upstream: string | null;
  readonly upstreamGone: boolean;
  readonly ahead: number;
  readonly behind: number;
  readonly lastCommitAt: string | null;
}

/**
 * Replace the branch list for one repository.
 *
 * Branches are deleted locally all the time, and a stale row would keep proposing cleanup for
 * a branch that is already gone. Since the whole list is cheap to read, replace it.
 */
export function replaceBranches(
  db: DatabaseSync,
  repo: string,
  branches: readonly BranchRecord[],
  mirroredAt: string,
): void {
  db.prepare('DELETE FROM branches WHERE repo = ?').run(repo);
  const insert = db.prepare(
    `INSERT INTO branches (repo, name, upstream, upstream_gone, ahead, behind, last_commit_at, mirrored_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const branch of branches) {
    insert.run(
      branch.repo,
      branch.name,
      branch.upstream,
      branch.upstreamGone ? 1 : 0,
      branch.ahead,
      branch.behind,
      branch.lastCommitAt,
      mirroredAt,
    );
  }
}

export function readBranches(db: DatabaseSync): BranchRecord[] {
  const rows = db
    .prepare(
      `SELECT repo, name, upstream, upstream_gone, ahead, behind, last_commit_at
       FROM branches ORDER BY repo, name`,
    )
    .all() as unknown as {
    repo: string;
    name: string;
    upstream: string | null;
    upstream_gone: number;
    ahead: number;
    behind: number;
    last_commit_at: string | null;
  }[];
  return rows.map((r) => ({
    repo: r.repo,
    name: r.name,
    upstream: r.upstream,
    upstreamGone: r.upstream_gone === 1,
    ahead: r.ahead,
    behind: r.behind,
    lastCommitAt: r.last_commit_at,
  }));
}

export function upsertRepo(
  db: DatabaseSync,
  fullName: string,
  localPath: string | null,
  mirroredAt: string,
): void {
  db.prepare(
    `INSERT INTO repos (full_name, local_path, mirrored_at) VALUES (?, ?, ?)
     ON CONFLICT(full_name) DO UPDATE SET
       local_path = excluded.local_path, mirrored_at = excluded.mirrored_at`,
  ).run(fullName, localPath, mirroredAt);
}
