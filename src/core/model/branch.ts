import type { RepoFullName } from './pull-request.ts';

/**
 * A branch in a local clone.
 *
 * Local state matters because it is where work exists before anyone else can see it. A branch
 * that is ahead of its upstream with no pull request is invisible to every other system in this
 * project, and that invisibility is exactly the gap work falls into.
 */
export interface Branch {
  readonly repo: RepoFullName;
  readonly name: string;
  /** The tracked remote branch, or `null` when the branch was never pushed. */
  readonly upstream: string | null;
  /** True when an upstream was configured but has since been deleted, usually after a merge. */
  readonly upstreamGone: boolean;
  readonly ahead: number;
  readonly behind: number;
  readonly lastCommitAt: string | null;
}
