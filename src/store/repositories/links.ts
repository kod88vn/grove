import type { DatabaseSync } from 'node:sqlite';

/** Which text yielded the key. Branch is strongest: it is chosen deliberately, once. */
export type LinkSource = 'branch' | 'title' | 'body';

export interface IssuePrLink {
  readonly issueKey: string;
  readonly repo: string;
  readonly number: number;
  readonly source: LinkSource;
}

/**
 * Replace every link for one pull request.
 *
 * Links are derived entirely from text, so a retitled PR can drop a key it used to mention.
 * Adding without removing would leave a ticket permanently believing it has a PR.
 */
export function replaceLinks(
  db: DatabaseSync,
  repo: string,
  number: number,
  links: readonly IssuePrLink[],
): void {
  db.prepare('DELETE FROM issue_pr_links WHERE repo = ? AND number = ?').run(repo, number);
  const insert = db.prepare(
    'INSERT OR REPLACE INTO issue_pr_links (issue_key, repo, number, source) VALUES (?, ?, ?, ?)',
  );
  for (const link of links) {
    insert.run(link.issueKey, link.repo, link.number, link.source);
  }
}

export function readLinksForIssue(db: DatabaseSync, issueKey: string): IssuePrLink[] {
  const rows = db
    .prepare('SELECT issue_key, repo, number, source FROM issue_pr_links WHERE issue_key = ?')
    .all(issueKey) as unknown as {
    issue_key: string;
    repo: string;
    number: number;
    source: string;
  }[];
  return rows.map((r) => ({
    issueKey: r.issue_key,
    repo: r.repo,
    number: r.number,
    source: r.source as LinkSource,
  }));
}

export function readAllLinks(db: DatabaseSync): IssuePrLink[] {
  const rows = db
    .prepare('SELECT issue_key, repo, number, source FROM issue_pr_links')
    .all() as unknown as { issue_key: string; repo: string; number: number; source: string }[];
  return rows.map((r) => ({
    issueKey: r.issue_key,
    repo: r.repo,
    number: r.number,
    source: r.source as LinkSource,
  }));
}
