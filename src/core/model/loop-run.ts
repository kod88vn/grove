import type { LoopOutcome, LoopState } from '../loops/verdict.ts';

/** A loop run as the dashboard and the CLI see it. Storage shape lives in the repository. */
export interface LoopRun {
  readonly id: number;
  readonly ticket: string | null;
  readonly repo: string;
  readonly verifier: string;
  readonly specPath: string;
  readonly baselineTests: number;
  readonly budget: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly outcome: LoopOutcome | null;
  readonly stopReason: string | null;
  /** Iterations recorded so far, counting the iteration-0 negative control. */
  readonly iterations: number;
  /** The most recent verifier observation, or null when only the control has run. */
  readonly latestState: LoopState | null;
}

/** One verifier observation within a run. Ordinal 0 is the pre-agent negative control. */
export interface LoopIteration {
  readonly ordinal: number;
  readonly at: string;
  readonly state: LoopState;
  readonly exitCode: number;
  readonly tests: number | null;
  readonly outputTail: string;
}

/** A run with its full iteration history, for the detail view. */
export interface LoopRunDetail {
  readonly run: LoopRun;
  readonly iterations: readonly LoopIteration[];
}
