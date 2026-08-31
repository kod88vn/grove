import { spawnSync } from 'node:child_process';
import { treeDigest, digestOf } from '../executor/tree-digest.ts';
import { evaluateGate, refusalMessage, type WorkStep } from '../core/steps/gate.ts';
import { openDatabase } from '../store/database.ts';
import {
  abandonStep,
  addStep,
  listSteps,
  recordStamp,
  sealStep,
  startStep,
  stampsFor,
  stepInProgress,
} from '../store/repositories/work-steps.ts';
import { loadConfig } from './config.ts';
import type { DatabaseSync } from 'node:sqlite';

/** The command a stamp is evidence of. One command, so there is nothing to choose. */
const GATE_COMMAND = 'npm run verify';
const OUTPUT_TAIL_CHARS = 4000;

function nowIso(): string {
  return new Date().toISOString();
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = openDatabase({ path: loadConfig().databasePath });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

export function stepAdd(title: string, ticket: string | null): number {
  const id = withDb((db) => addStep(db, { title, ticket, now: nowIso() }));
  write(`added step ${id}: ${title}`);
  return 0;
}

export function stepStart(id: number): number {
  return withDb((db) => {
    const current = stepInProgress(db);
    if (current !== null && current.id !== id) {
      process.stderr.write(`step ${current.id} "${current.title}" is already in progress.\n`);
      return 1;
    }
    startStep(db, id, nowIso());
    write(`step ${id} in progress`);
    return 0;
  });
}

export function stepStatus(): number {
  return withDb((db) => {
    const steps = listSteps(db);
    if (steps.length === 0) {
      write('no steps. Add one: npm run cc -- step add "<title>"');
      return 0;
    }
    for (const step of steps) write(formatStep(step));
    return 0;
  });
}

function formatStep(step: WorkStep): string {
  const marks: Record<WorkStep['state'], string> = {
    todo: '[ ]',
    doing: '[~]',
    done: '[x]',
    abandoned: '[-]',
  };
  const ticket = step.ticket === null ? '' : ` ${step.ticket}`;
  const sealed = step.sealedCommit === null ? '' : ` (${step.sealedCommit.slice(0, 7)})`;
  return `${marks[step.state]} ${step.id}${ticket} ${step.title}${sealed}`;
}

/**
 * Run the gate command and, only if it passes, record a stamp.
 *
 * The digest is taken *after* the command finishes, so it describes the tree that was actually
 * verified. Taking it first would let an edit made during a slow test run be covered by a
 * stamp that never saw it.
 */
export async function stepStamp(id: number | null): Promise<number> {
  const repoPath = process.cwd();

  write(`running ${GATE_COMMAND} …`);
  const result = spawnSync('npm', ['run', 'verify'], { cwd: repoPath, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status !== 0) {
    process.stderr.write(output.slice(-OUTPUT_TAIL_CHARS));
    process.stderr.write(`\nNot stamped: ${GATE_COMMAND} exited ${result.status ?? 'null'}.\n`);
    return 1;
  }

  const digest = await treeDigest(repoPath);

  return withDb((db) => {
    const target = id === null ? stepInProgress(db) : { id } as WorkStep;
    if (target === null) {
      process.stderr.write('Not stamped: no step is in progress.\n');
      return 1;
    }
    recordStamp(db, {
      stepId: target.id,
      at: nowIso(),
      command: GATE_COMMAND,
      treeDigest: digest,
      outputDigest: digestOf(output),
      outputTail: output.slice(-OUTPUT_TAIL_CHARS),
    });
    write(`step ${target.id} stamped against tree ${digest.slice(0, 12)}`);
    return 0;
  });
}

/**
 * The pre-commit gate. Exit non-zero and the commit does not happen.
 *
 * This reads the database and compares digests. It does not re-run the tests: a gate that ran
 * the suite on every commit would be turned off within a week, and the stamp already proves
 * the suite passed against this exact tree.
 */
export async function stepGate(): Promise<number> {
  const digest = await treeDigest(process.cwd());

  return withDb((db) => {
    const inProgress = stepInProgress(db);
    const stamps = inProgress === null ? [] : stampsFor(db, inProgress.id);
    const verdict = evaluateGate(inProgress, stamps, digest);

    if (!verdict.ok) {
      process.stderr.write(`\n${refusalMessage(verdict)}\n`);
      return 1;
    }
    return 0;
  });
}

/** The post-commit seal. Completion is recorded from the SHA git produced, never from a claim. */
export function stepSeal(commit: string): number {
  return withDb((db) => {
    const sealed = sealStep(db, commit, nowIso());
    if (sealed !== null) write(`step ${sealed.id} done, sealed at ${commit.slice(0, 7)}`);
    return 0;
  });
}

export function stepAbandon(id: number): number {
  withDb((db) => abandonStep(db, id, nowIso()));
  write(`step ${id} abandoned`);
  return 0;
}
