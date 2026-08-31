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
