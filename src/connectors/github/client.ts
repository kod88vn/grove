import { runJson, run, type RunOptions } from '../process.ts';
import { mapPullRequest } from './map.ts';
import type { RawPullRequest } from './map-parts.ts';
import type { PullRequest } from '../../core/model/pull-request.ts';

/**
 * Fields hydrated per pull request.
 *
 * Verified available on GHE 3.21 via `gh pr list --json` (2026-08-31). `closingIssuesReferences`
 * is deliberately absent: it comes back empty on every PR here because there is no Jira
 * integration, so ticket correlation is done by parsing keys instead.
 */
const PR_FIELDS = [
  'number',
  'title',
  'body',
  'url',
  'state',
  'isDraft',
  'author',
  'headRefName',
  'baseRefName',
  'headRefOid',
  'createdAt',
  'updatedAt',
  'mergedAt',
  'mergeable',
  'mergeStateStatus',
  'reviewDecision',
  'reviewRequests',
  'latestReviews',
  'statusCheckRollup',
  'autoMergeRequest',
].join(',');

export interface GitHubConfig {
  /** My GitHub login, e.g. `jay-quach`. */
  readonly me: string;
  /** Jira projects whose keys count as a real link, e.g. `['WS']`. */
  readonly projectKeys: readonly string[];
}

export type PrSearchScope = 'authored' | 'review-requested' | 'reviewed';

interface SearchHit {
  readonly repository?: { readonly nameWithOwner?: string };
  readonly number?: number;
}

export class GitHubClient {
  constructor(
    private readonly config: GitHubConfig,
    private readonly options: RunOptions = {},
  ) {}

  /** `gh auth status`, used by `bot doctor` to prove the CLI is usable before a sync runs. */
  async authStatus(): Promise<string> {
    return run('gh', ['auth', 'status'], this.options);
  }

  /**
   * Find open PRs across every repo I touch, without needing a repo list up front.
   *
   * Returns identifiers only. Search results carry a thin projection, so the fields that
   * decide whether something is stalled — mergeability, checks, reviews — are not present and
   * must be hydrated separately.
   */
  async findOpenPullRequests(scope: PrSearchScope): Promise<{ repo: string; number: number }[]> {
    const hits = await runJson<SearchHit[]>(
      'gh',
      [
        'search',
        'prs',
        '--state=open',
        scopeFlag(scope, this.config.me),
        '--limit=100',
        '--json=repository,number',
      ],
      this.options,
    );
    return hits.flatMap((hit) => {
      const repo = hit.repository?.nameWithOwner;
      return repo === undefined || hit.number === undefined ? [] : [{ repo, number: hit.number }];
    });
  }

  /**
   * Hydrate open PRs for one repo in a single call.
   *
   * One `gh pr list` per repo rather than one `gh pr view` per PR: with 20+ review requests
   * outstanding, the per-PR form turns a sync into dozens of round trips.
   */
  async listOpenPullRequests(repo: string, limit = 100): Promise<PullRequest[]> {
    const raw = await runJson<RawPullRequest[]>(
      'gh',
      ['pr', 'list', '--repo', repo, '--state=open', `--limit=${limit}`, `--json=${PR_FIELDS}`],
      this.options,
    );
    const mapped = raw.map((entry) =>
      mapPullRequest(entry, {
        repo,
        me: this.config.me,
        projectKeys: this.config.projectKeys,
      }),
    );
    return this.resolveUnknownMergeability(repo, mapped);
  }

  async pullRequest(repo: string, number: number): Promise<PullRequest> {
    const raw = await runJson<RawPullRequest>(
      'gh',
      ['pr', 'view', String(number), '--repo', repo, `--json=${PR_FIELDS}`],
      this.options,
    );
    return mapPullRequest(raw, {
      repo,
      me: this.config.me,
      projectKeys: this.config.projectKeys,
    });
  }

  /**
   * Re-read PRs whose mergeability GitHub had not computed yet.
   *
   * GitHub computes the merge commit lazily: the first read of a PR it has not looked at
   * recently returns `UNKNOWN`, and a second read moments later returns the real answer
   * (verified on PR 2390). Without this retry the mirror records conflicts as unknown and the
   * conflict stall never fires.
   */
  private async resolveUnknownMergeability(
    repo: string,
    pullRequests: readonly PullRequest[],
  ): Promise<PullRequest[]> {
    const resolved: PullRequest[] = [];
    for (const pr of pullRequests) {
      resolved.push(pr.mergeable === 'UNKNOWN' ? await this.reread(repo, pr) : pr);
    }
    return resolved;
  }

  private async reread(repo: string, previous: PullRequest): Promise<PullRequest> {
    try {
      return await this.pullRequest(repo, previous.number);
    } catch {
      // A retry that fails is not worth failing the sync over; UNKNOWN simply persists and
      // the mergeability-dependent stalls stay silent for this PR this round.
      return previous;
    }
  }
}

function scopeFlag(scope: PrSearchScope, me: string): string {
  switch (scope) {
    case 'authored':
      return `--author=${me}`;
    case 'review-requested':
      return `--review-requested=${me}`;
    case 'reviewed':
      return `--reviewed-by=${me}`;
  }
}
