export type SupervisorState =
  | 'queued'
  | 'spec_red'
  | 'working'
  | 'judge'
  | 'green'
  | 'stalled'
  | 'pr_open'
  | 'awaiting_approval'
  | 'needs_human'
  | 'paused'
  | 'cancelled'
  | 'done';

export type SupervisorDesired = 'run' | 'paused' | 'cancelled';

export type SupervisorSource = 'manual' | 'plan-file' | 'jira';

export type SupervisorCloseOn = 'merged' | 'ready';

export interface SupervisorItem {
  readonly id: number;
  readonly key: string;
  readonly source: SupervisorSource;
  readonly repo: string;
  readonly state: SupervisorState;
  readonly desired: SupervisorDesired;
  readonly bounceCount: number;
  readonly closeOn: SupervisorCloseOn;
  readonly loopRunId: number | null;
  readonly brief: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupervisorEvent {
  readonly id: number;
  readonly itemKey: string;
  readonly at: string;
  readonly eventType: string;
  readonly fromState: SupervisorState | null;
  readonly toState: SupervisorState | null;
  readonly evidence: string;
  readonly detailsJson?: string | null;
}

export interface SupervisorDispatch {
  readonly id: number;
  readonly itemKey: string;
  readonly dispatchedAt: string;
  readonly sessionPath: string | null;
  readonly tier: string;
  readonly model: string;
  readonly agentVariant: string;
  readonly attempt: number;
  readonly nonce: string;
}

export type ResourceType =
  | 'child_pid'
  | 'watcher_pid'
  | 'portable_dir'
  | 'user_data_dir'
  | 'scratch_dir'
  | 'spec_file'
  | 'session_file'
  | 'log_file'
  | 'other';

export type CleanupStatus = 'pending' | 'cleaned' | 'failed';

export interface SupervisorResource {
  readonly id: number;
  readonly itemKey: string;
  readonly resourceType: ResourceType;
  readonly identifier: string;
  readonly createdAt: string;
  readonly cleanedAt: string | null;
  readonly cleanupStatus: CleanupStatus;
}
