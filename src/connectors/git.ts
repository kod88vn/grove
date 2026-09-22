import { run, type RunOptions } from './process.ts';

export interface LocalBranch {
  readonly repo: string;
  readonly name: string;
  readonly upstream: string | null;
  /** The upstream existed and has since been deleted on the remote — usually a merged PR. */
  readonly upstreamGone: boolean;
  readonly ahead: number;
  readonly behind: number;
  readonly lastCommitAt: string;
  readonly isCurrent: boolean;
}

/** Unit separator. Branch names cannot contain it, unlike every printable character. */
const FIELD = '\u001f';

const FORMAT = [
  '%(refname:short)',
  '%(upstream:short)',
  '%(upstream:track)',
  '%(committerdate:iso-strict)',
  '%(HEAD)',
].join(FIELD);

/**
 * Local branches with their divergence from upstream.
 *
 * Read-only and offline: no `git fetch`. Fetching would make an interactive command wait on the
 * network and would mutate the user's repository as a side effect of looking at it. The counts
 * are therefore as of the last fetch the user performed, which is the right trade for spotting
 * a branch that never got a PR.
 */
export async function localBranches(repoPath: string, repo: string): Promise<LocalBranch[]> {
  const options: RunOptions = { cwd: repoPath };
  const stdout = await run(
    'git',
    ['for-each-ref', '--format', FORMAT, 'refs/heads/'],
    options,
  );

  return stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => parseBranch(line, repo));
}

/** Exported for testing: the format string and the track grammar are the fragile parts. */
export function parseBranch(line: string, repo: string): LocalBranch {
  const [name = '', upstream = '', track = '', committerDate = '', head = ''] = line.split(FIELD);
  return {
    repo,
    name,
    upstream: upstream === '' ? null : upstream,
    upstreamGone: track.includes('gone'),
    ahead: trackCount(track, 'ahead'),
    behind: trackCount(track, 'behind'),
    lastCommitAt: committerDate,
    isCurrent: head === '*',
  };
}

/**
 * Pull a count out of git's `upstream:track` string, e.g. `[ahead 2, behind 1]`.
 *
 * The field is also `[gone]` when the upstream was deleted — which is exactly the
 * `pr-merged-branch-exists` case — and empty when there is no upstream at all. Both yield zero
 * here; `upstream` and `upstreamGone` are what distinguish them.
 */
function trackCount(track: string, direction: 'ahead' | 'behind'): number {
  const match = new RegExp(`${direction} (\\d+)`).exec(track);
  return match === null ? 0 : Number(match[1]);
}

export async function currentBranch(repoPath: string): Promise<string> {
  const stdout = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath });
  return stdout.trim();
}

export async function headCommit(repoPath: string): Promise<string> {
  const stdout = await run('git', ['rev-parse', 'HEAD'], { cwd: repoPath });
  return stdout.trim();
}

/**
 * Content hashes for every source file git can see, tracked or not.
 *
 * `--cached --others --exclude-standard` is the combination that matters: `--cached` catches
 * tracked files, `--others` catches a brand new file that has not been added yet, and
 * `--exclude-standard` keeps `data/` and `node_modules/` out via .gitignore. Missing the
 * untracked case would let a new module appear after verification without invalidating it.
 *
 * The hashing is `git hash-object`, not a filesystem read, so this layer needs no crypto and
 * the result is the same object id git itself would compute.
 */
export async function sourceFileHashes(
  repoPath: string,
  roots: readonly string[],
): Promise<readonly string[]> {
  const listed = await run(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...roots],
    { cwd: repoPath },
  );

  const paths = listed.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  // Sort, because git's own order is not stable across `git add`: `--others` entries are
  // emitted before `--cached` ones, so staging a file moves it in the list without changing
  // a byte of it. The digest is order-sensitive, so that alone expired a stamp — a gate that
  // fires when you stage your work is a gate people learn to route around.
  paths.sort();
  if (paths.length === 0) return [];

  const hashed = await run('git', ['hash-object', '--', ...paths], { cwd: repoPath });
  const hashes = hashed.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  // Pair each hash with its path before returning. Order is the sort above, not git's, so the
  // digest depends on names and contents alone. The path has to be in the digest too:
  // renaming a file without changing its bytes is a change.
  return paths.map((path, index) => `${hashes[index] ?? ''}  ${path}`);
}

