import { runJson, run, type RunOptions } from '../process.ts';
import { mapPullRequest } from './map.ts';
import type { RawPullRequest } from './map-parts.ts';
import type { PullRequest } from '../../core/model/pull-request.ts';
import type { Mirrored } from '../../core/model/mirrored.ts';

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

interface RawTeam {
  readonly slug?: string;
  readonly organization?: { readonly login?: string };
}

export class GitHubClient {
  private teams: readonly string[] = [];
  private loading: Promise<readonly string[]> | null = null;

  constructor(
    private readonly config: GitHubConfig,
    private readonly options: RunOptions = {},
  ) {}

  /**
   * Teams I belong to, as `org/slug`, cached for the life of the process.
   *
   * Needed because review requests are usually addressed to a team: 94 of 111 outstanding
   * requests name `clover/services-team` rather than me (measured 2026-08-31). A failure here
   * is deliberately not swallowed — degrading to an empty list would quietly shrink my review
   * queue to a third of its real size, which is the exact bug this call exists to prevent.
   */
  async myTeams(): Promise<readonly string[]> {
    this.loading ??= this.fetchTeams();
    this.teams = await this.loading;
    return this.teams;
  }

  private async fetchTeams(): Promise<readonly string[]> {
    const raw = await runJson<RawTeam[]>(
      'gh',
      ['api', 'user/teams', '--paginate'],
      this.options,
    );
    return raw.flatMap((team) =>
      team.organization?.login === undefined || team.slug === undefined
        ? []
        : [`${team.organization.login}/${team.slug}`],
    );
  }

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
  async listOpenPullRequests(repo: string, limit = 100): Promise<Mirrored<PullRequest>[]> {
    await this.myTeams();
    const raw = await runJson<RawPullRequest[]>(
      'gh',
      ['pr', 'list', '--repo', repo, '--state=open', `--limit=${limit}`, `--json=${PR_FIELDS}`],
      this.options,
    );
    const mapped = raw.map((entry) => this.mirror(repo, entry));
    return this.resolveUnknownMergeability(repo, mapped);
  }

  async pullRequest(repo: string, number: number): Promise<Mirrored<PullRequest>> {
    await this.myTeams();
    const raw = await runJson<RawPullRequest>(
      'gh',
      ['pr', 'view', String(number), '--repo', repo, `--json=${PR_FIELDS}`],
      this.options,
    );
    return this.mirror(repo, raw);
  }

  private mirror(repo: string, raw: RawPullRequest): Mirrored<PullRequest> {
    return {
      value: mapPullRequest(raw, {
        repo,
        me: this.config.me,
        projectKeys: this.config.projectKeys,
        teams: this.teams,
      }),
      raw: JSON.stringify(raw),
    };
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
    pullRequests: readonly Mirrored<PullRequest>[],
  ): Promise<Mirrored<PullRequest>[]> {
    const resolved: Mirrored<PullRequest>[] = [];
    for (const pr of pullRequests) {
      resolved.push(pr.value.mergeable === 'UNKNOWN' ? await this.reread(repo, pr) : pr);
    }
    return resolved;
  }

  private async reread(
    repo: string,
    previous: Mirrored<PullRequest>,
  ): Promise<Mirrored<PullRequest>> {
    try {
      return await this.pullRequest(repo, previous.value.number);
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
