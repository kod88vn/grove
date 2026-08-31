import type { IssueKey } from './issue.ts';
import type { RepoFullName } from './pull-request.ts';

/**
 * What the executor is allowed to do.
 *
 * Deliberately tiny. Every other next move in the stall catalog is surfaced as text for a
 * human to act on elsewhere; only these two are performed by this system, and only when a
 * human clicks the button. Adding a member here widens the blast radius of the whole
 * project, so it is a design decision, not an implementation detail.
 */
export type Capability = 'github:pr-merge' | 'jira:transition';

export interface MergePullRequestPayload {
  readonly repo: RepoFullName;
  readonly number: number;
  readonly method: 'merge' | 'squash' | 'rebase';
}

export interface TransitionIssuePayload {
  readonly issueKey: IssueKey;
  /**
   * Workflow transition id, e.g. `5` for Resolve Issue on the WS workflow.
   *
   * Always read back from `GET /rest/api/2/issue/<KEY>/transitions` at prepare time. Ids are
   * workflow-specific and a hardcoded one will silently transition the wrong issue type.
   */
  readonly transitionId: string;
  readonly transitionName: string;
  /**
   * Field values for the transition screen, built from live metadata.
   *
   * On the WS workflow only `resolution` is required (verified 2026-08-31); the rest of the
   * screen is optional. The dashboard prefills this and lets me edit before executing.
   */
  readonly fields: Readonly<Record<string, unknown>>;
}

export type ActionPayload =
  | { readonly capability: 'github:pr-merge'; readonly payload: MergePullRequestPayload }
  | { readonly capability: 'jira:transition'; readonly payload: TransitionIssuePayload };

/**
 * A described-but-not-performed mutation.
 *
 * Producing one has no effect. Only the executor turns it into a side effect, and only after
 * the guards pass and a human has asked for it.
 */
export interface ProposedAction {
  readonly id: string;
  readonly action: ActionPayload;
  /** Human-readable justification, shown on the button. */
  readonly reason: string;
}
