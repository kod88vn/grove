import type { Iso8601 } from '../clock.ts';

/** A Jira issue key, e.g. `WS-6316`. */
export type IssueKey = string;

/**
 * Issue status, as the name shown in Jira.
 *
 * Deliberately a plain string rather than a union: board 1386's columns are To Do / In
 * Progress / Done, but the WS workflow also reaches In Review, Blocked, Needs Requirements and
 * Stg Testing (verified 2026-08-31 via the transitions endpoint). Enumerating them here would
 * mean a code change every time a workflow gains a step.
 */
export type IssueStatus = string;

export interface IssueUser {
  readonly name: string;
  readonly displayName: string;
}

export interface IssueSprintRef {
  readonly id: number;
  readonly name: string;
}

export interface Issue {
  readonly key: IssueKey;
  readonly summary: string;
  readonly status: IssueStatus;
  /** Present only once the issue is resolved, e.g. `Fixed`. */
  readonly resolution: string | null;
  readonly issueType: string;
  readonly priority: string | null;
  readonly assignee: IssueUser | null;
  readonly reporter: IssueUser | null;
  readonly created: Iso8601;
  readonly updated: Iso8601;
  readonly resolvedAt: Iso8601 | null;
  /** Epic Link (`customfield_10206`), e.g. `WS-5801`. */
  readonly epicKey: IssueKey | null;
  /** The active or most recent sprint. `null` means the issue is not on a sprint at all. */
  readonly sprint: IssueSprintRef | null;
  readonly labels: readonly string[];
  readonly fixVersions: readonly string[];
}

/**
 * Whether an issue is finished.
 *
 * Jira models this two ways and they disagree: a `status` of Resolved/Closed/Done, and a
 * non-null `resolution`. An issue transitioned by a bulk edit can have one without the other,
 * so both are treated as done.
 */
export function isIssueDone(issue: Issue): boolean {
  if (issue.resolution !== null) {
    return true;
  }
  return DONE_STATUSES.has(issue.status.toLowerCase());
}

const DONE_STATUSES: ReadonlySet<string> = new Set(['resolved', 'closed', 'done']);
