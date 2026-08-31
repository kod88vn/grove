import type { DatabaseSync } from 'node:sqlite';
import type { Stamp, WorkStep } from '../../core/steps/gate.ts';

interface StepRow {
  readonly id: number;
  readonly ticket: string | null;
  readonly title: string;
  readonly state: string;
  readonly sealed_commit: string | null;
}

interface StampRow {
  readonly step_id: number;
  readonly at: string;
  readonly command: string;
  readonly tree_digest: string;
}

function toStep(row: StepRow): WorkStep {
  return {
    id: row.id,
    ticket: row.ticket,
    title: row.title,
    state: row.state as WorkStep['state'],
    sealedCommit: row.sealed_commit,
  };
}

export function addStep(
  db: DatabaseSync,
  input: { title: string; ticket: string | null; now: string },
): number {
  const result = db
    .prepare('INSERT INTO work_steps (ticket, title, created_at) VALUES (?, ?, ?)')
    .run(input.ticket, input.title, input.now);
  return Number(result.lastInsertRowid);
}

export function listSteps(db: DatabaseSync): readonly WorkStep[] {
  const rows = db
    .prepare('SELECT id, ticket, title, state, sealed_commit FROM work_steps ORDER BY id')
    .all() as unknown as StepRow[];
  return rows.map(toStep);
}

export function stepInProgress(db: DatabaseSync): WorkStep | null {
  const row = db
    .prepare(`SELECT id, ticket, title, state, sealed_commit FROM work_steps WHERE state = 'doing'`)
    .get() as unknown as StepRow | undefined;
  return row === undefined ? null : toStep(row);
}

/**
 * Move a step to `doing`.
 *
 * The partial unique index on `state = 'doing'` means a second concurrent step raises rather
 * than quietly becoming the new focus, so "start" is also the check for "am I already on
 * something".
 */
export function startStep(db: DatabaseSync, id: number, now: string): void {
  db.prepare(`UPDATE work_steps SET state = 'doing', started_at = ? WHERE id = ? AND state = 'todo'`)
    .run(now, id);
}

export function stampsFor(db: DatabaseSync, stepId: number): readonly Stamp[] {
  const rows = db
    .prepare('SELECT step_id, at, command, tree_digest FROM step_stamps WHERE step_id = ? ORDER BY at DESC')
    .all(stepId) as unknown as StampRow[];
  return rows.map((row) => ({
    stepId: row.step_id,
    at: row.at,
    command: row.command,
    treeDigest: row.tree_digest,
  }));
}

export interface StampInput {
  readonly stepId: number;
  readonly at: string;
  readonly command: string;
  readonly treeDigest: string;
  readonly outputDigest: string;
  readonly outputTail: string;
}

/**
 * Record passing evidence.
 *
 * There is no `exitCode` parameter. The column is constrained to zero and this function hard
 * codes it, so there is no signature through which a failure could be filed as a pass — the
 * caller's only option on failure is not to call this at all.
 */
export function recordStamp(db: DatabaseSync, input: StampInput): void {
  db.prepare(
    `INSERT INTO step_stamps (step_id, at, command, exit_code, tree_digest, output_digest, output_tail)
     VALUES (?, ?, ?, 0, ?, ?, ?)`,
  ).run(input.stepId, input.at, input.command, input.treeDigest, input.outputDigest, input.outputTail);
}

/**
 * Seal the in-progress step against the commit git just made.
 *
 * Called only from the post-commit hook, with a SHA that already exists. This is the only
 * writer of `state = 'done'`, and the CHECK constraint in 0006 means even this one cannot do
 * it without a commit to point at.
 */
export function sealStep(db: DatabaseSync, commit: string, now: string): WorkStep | null {
  const step = stepInProgress(db);
  if (step === null) return null;

  db.prepare(`UPDATE work_steps SET state = 'done', finished_at = ?, sealed_commit = ? WHERE id = ?`)
    .run(now, commit, step.id);

  return { ...step, state: 'done', sealedCommit: commit };
}

export function abandonStep(db: DatabaseSync, id: number, now: string): void {
  db.prepare(`UPDATE work_steps SET state = 'abandoned', finished_at = ? WHERE id = ? AND state <> 'done'`)
    .run(now, id);
}
