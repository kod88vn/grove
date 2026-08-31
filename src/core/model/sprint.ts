import type { Iso8601 } from '../clock.ts';
import type { IssueKey } from './issue.ts';

export type SprintState = 'future' | 'active' | 'closed';

export interface Sprint {
  readonly id: number;
  readonly name: string;
  readonly state: SprintState;
  readonly boardId: number;
  readonly startDate: Iso8601 | null;
  readonly endDate: Iso8601 | null;
  readonly completeDate: Iso8601 | null;
}

export interface Board {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  /** Column names in board order, e.g. `To Do`, `In Progress`, `Done`. */
  readonly columns: readonly string[];
}

export interface SprintMembership {
  readonly sprintId: number;
  readonly issueKey: IssueKey;
}
