import type { DatabaseSync } from 'node:sqlite';
import type { LoopIteration, LoopRun, LoopRunDetail } from '../../core/model/loop-run.ts';
import type { LoopState } from '../../core/loops/verdict.ts';

interface RunRow {
  readonly id: number;
  readonly ticket: string | null;
  readonly repo: string;
  readonly verifier: string;
  readonly spec_path: string;
  readonly baseline_tests: number;
  readonly budget: number;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly outcome: string | null;
  readonly stop_reason: string | null;
  readonly iterations: number;
  readonly latest_state: string | null;
}

interface IterationRow {
  readonly ordinal: number;
  readonly at: string;
  readonly state: string;
  readonly exit_code: number;
  readonly tests: number | null;
  readonly output_tail: string;
}

interface LockRow {
  readonly spec_path: string;
  readonly spec_digest: string;
  readonly config_path: string | null;
  readonly config_digest: string | null;
  readonly baseline_tests: number;
  readonly baseline_suppressions: number;
}

/**
 * Every read goes through this, so the iteration count and the latest state are always derived
 * from `loop_iterations` rather than stored on the run and kept in sync by hand. A denormalized
 * counter is a second source of truth, and the one that drifts.
 */
const SELECT_RUNS = `
  SELECT r.id, r.ticket, r.repo, r.verifier, r.spec_path, r.baseline_tests, r.budget,
         r.started_at, r.finished_at, r.outcome, r.stop_reason,
         (SELECT COUNT(*) FROM loop_iterations i WHERE i.run_id = r.id) AS iterations,
         (SELECT i.state FROM loop_iterations i WHERE i.run_id = r.id
           ORDER BY i.ordinal DESC LIMIT 1) AS latest_state
    FROM loop_runs r`;

function toRun(row: RunRow): LoopRun {
  return {
    id: row.id,
    ticket: row.ticket,
    repo: row.repo,
    verifier: row.verifier,
    specPath: row.spec_path,
    baselineTests: row.baseline_tests,
    budget: row.budget,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    outcome: row.outcome === null ? null : (row.outcome as LoopRun['outcome']),
    stopReason: row.stop_reason,
    iterations: row.iterations,
    latestState: row.latest_state === null ? null : (row.latest_state as LoopState),
  };
}

export interface StartRunInput {
  readonly ticket: string | null;
  readonly repo: string;
  readonly verifier: string;
  readonly specPath: string;
  readonly specDigest: string;
  readonly configPath: string | null;
  readonly configDigest: string | null;
  readonly baselineTests: number;
  readonly baselineSuppressions: number;
  readonly budget: number;
  readonly now: string;
}

export function startRun(db: DatabaseSync, input: StartRunInput): number {
  const result = db
    .prepare(
      `INSERT INTO loop_runs
         (ticket, repo, verifier, spec_path, spec_digest, config_path, config_digest,
          baseline_tests, baseline_suppressions, budget, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.ticket,
      input.repo,
      input.verifier,
      input.specPath,
      input.specDigest,
      input.configPath,
      input.configDigest,
      input.baselineTests,
      input.baselineSuppressions,
      input.budget,
      input.now,
    );
  return Number(result.lastInsertRowid);
}

export interface RunLocks {
  readonly specPath: string;
  readonly specDigest: string;
  readonly configPath: string | null;
  readonly configDigest: string | null;
  readonly baselineTests: number;
  readonly baselineSuppressions: number;
}

/** The locks recorded at start, so an iteration can be judged against them. */
export function readLocks(db: DatabaseSync, runId: number): RunLocks | null {
  const row = db
    .prepare(
      `SELECT spec_path, spec_digest, config_path, config_digest,
              baseline_tests, baseline_suppressions
         FROM loop_runs WHERE id = ?`,
    )
    .get(runId) as unknown as LockRow | undefined;

  return row === undefined
    ? null
    : {
        specPath: row.spec_path,
        specDigest: row.spec_digest,
        configPath: row.config_path,
        configDigest: row.config_digest,
        baselineTests: row.baseline_tests,
        baselineSuppressions: row.baseline_suppressions,
      };
}

export interface IterationInput {
  readonly runId: number;
  readonly ordinal: number;
  readonly at: string;
  readonly state: LoopState;
  readonly exitCode: number;
  readonly specDigest: string;
  readonly tests: number | null;
  readonly outputTail: string;
}

export function recordIteration(db: DatabaseSync, input: IterationInput): void {
  db.prepare(
    `INSERT INTO loop_iterations
       (run_id, ordinal, at, state, exit_code, spec_digest, tests, output_tail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.runId,
    input.ordinal,
    input.at,
    input.state,
    input.exitCode,
    input.specDigest,
    input.tests,
    input.outputTail,
  );
}

/**
 * Close a run as passed.
 *
 * The `EXISTS` clause is the whole point: a run reaches `passed` only if a green iteration is
 * already on record whose spec digest still matches the one locked at start. There is no
 * parameter through which a caller could assert success, so a driver that decided to report a
 * pass it did not observe would update zero rows.
 *
 * Returns false when no such evidence exists, or when the run is already closed.
 */
export function finishPassed(
  db: DatabaseSync,
  input: { runId: number; stopReason: string; now: string },
): boolean {
  const result = db
    .prepare(
      `UPDATE loop_runs
          SET outcome = 'passed', finished_at = ?, stop_reason = ?
        WHERE id = ? AND outcome IS NULL
          AND EXISTS (
            SELECT 1 FROM loop_iterations i
             WHERE i.run_id = loop_runs.id
               AND i.state = 'green'
               AND i.exit_code = 0
               AND i.spec_digest = loop_runs.spec_digest
          )`,
    )
    .run(input.now, input.stopReason, input.runId);
  return Number(result.changes) > 0;
}

/** Close a run as failed. Always allowed: failure needs no evidence beyond stopping. */
export function finishFailed(
  db: DatabaseSync,
  input: { runId: number; stopReason: string; now: string },
): boolean {
  const result = db
    .prepare(
      `UPDATE loop_runs SET outcome = 'failed', finished_at = ?, stop_reason = ?
        WHERE id = ? AND outcome IS NULL`,
    )
    .run(input.now, input.stopReason, input.runId);
  return Number(result.changes) > 0;
}

export function listRuns(db: DatabaseSync, limit = 50): readonly LoopRun[] {
  const rows = db
    .prepare(`${SELECT_RUNS} ORDER BY r.id DESC LIMIT ?`)
    .all(limit) as unknown as RunRow[];
  return rows.map(toRun);
}

export function readRun(db: DatabaseSync, id: number): LoopRunDetail | null {
  const row = db.prepare(`${SELECT_RUNS} WHERE r.id = ?`).get(id) as unknown as RunRow | undefined;
  if (row === undefined) {
    return null;
  }
  const iterations = db
    .prepare(
      `SELECT ordinal, at, state, exit_code, tests, output_tail
         FROM loop_iterations WHERE run_id = ? ORDER BY ordinal`,
    )
    .all(id) as unknown as IterationRow[];

  return {
    run: toRun(row),
    iterations: iterations.map(
      (i): LoopIteration => ({
        ordinal: i.ordinal,
        at: i.at,
        state: i.state as LoopState,
        exitCode: i.exit_code,
        tests: i.tests,
        outputTail: i.output_tail,
      }),
    ),
  };
}

/** The run a driver should be appending to, so the bash does not have to carry an id. */
export function openRun(db: DatabaseSync, repo: string): LoopRun | null {
  const row = db
    .prepare(`${SELECT_RUNS} WHERE r.repo = ? AND r.outcome IS NULL ORDER BY r.id DESC LIMIT 1`)
    .get(repo) as unknown as RunRow | undefined;
  return row === undefined ? null : toRun(row);
}
