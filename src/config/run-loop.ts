import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  judge,
  outcomeOf,
  startable,
  stopReason,
  type LoopLocks,
} from '../core/loops/verdict.ts';
import { digestOf } from '../executor/tree-digest.ts';
import { openDatabase } from '../store/database.ts';
import {
  finishFailed,
  finishPassed,
  listRuns,
  readLocks,
  readRun,
  recordIteration,
  startRun,
} from '../store/repositories/loop-runs.ts';
import { loadConfig } from './config.ts';

/**
 * The ledger side of a loop (LOOP.md).
 *
 * The bash driver decides *when* to call these; it does not decide what they record. Digests
 * are recomputed here by reading the locked files off disk, so a driver cannot report a spec
 * as intact. Test and suppression counts do come from the driver, because counting them needs
 * a repo-specific command — those are the numbers to distrust if a run ever looks wrong.
 */

const TAIL_CHARS = 4000;

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

function fail(line: string): number {
  process.stderr.write(`${line}\n`);
  return 1;
}

/** Digest a file, or null if it cannot be read. An unreadable lock is a missing lock. */
function digestFile(repo: string, path: string | null): string | null {
  if (path === null) {
    return null;
  }
  const full = isAbsolute(path) ? path : resolve(repo, path);
  try {
    return digestOf(readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

export interface LoopStartInput {
  readonly ticket: string | null;
  readonly repo: string;
  readonly spec: string;
  readonly config: string | null;
  readonly verifier: string;
  readonly baselineTests: number;
  readonly baselineSuppressions: number;
  readonly budget: number;
  readonly exitCode: number;
}

/**
 * Open a run, recording iteration 0 — the negative control.
 *
 * The control is not optional and not a separate call. A loop that starts green proves nothing
 * about the work it claims to cover, so this refuses rather than opening a run that would
 * later render as an instant pass.
 */
export function loopStart(input: LoopStartInput): number {
  const specDigest = digestFile(input.repo, input.spec);
  if (specDigest === null) {
    return fail(`cannot read the spec: ${input.spec}`);
  }
  const configDigest = digestFile(input.repo, input.config);
  const state = judge(locksFrom(input, specDigest, configDigest), {
    exitCode: input.exitCode,
    specDigest,
    configDigest,
    tests: null,
    suppressions: null,
  });
  if (!startable(state)) {
    return fail('refusing to start: the verifier is already green, so nothing would be proved.');
  }

  return withDb((db) => {
    const runId = startRun(db, {
      ticket: input.ticket,
      repo: input.repo,
      verifier: input.verifier,
      specPath: input.spec,
      specDigest,
      configPath: input.config,
      configDigest,
      baselineTests: input.baselineTests,
      baselineSuppressions: input.baselineSuppressions,
      budget: input.budget,
      now: nowIso(),
    });
    recordIteration(db, {
      runId,
      ordinal: 0,
      at: nowIso(),
      state,
      exitCode: input.exitCode,
      specDigest,
      tests: null,
      outputTail: '',
    });
    write(String(runId));
    return 0;
  });
}

function locksFrom(
  input: LoopStartInput,
  specDigest: string,
  configDigest: string | null,
): LoopLocks {
  return {
    specDigest,
    configDigest,
    baselineTests: input.baselineTests,
    baselineSuppressions: input.baselineSuppressions,
  };
}

export interface LoopRecordInput {
  readonly runId: number;
  readonly ordinal: number;
  readonly exitCode: number;
  readonly tests: number | null;
  readonly suppressions: number | null;
  readonly tailFile: string | null;
}

/**
 * Judge one iteration and record it.
 *
 * Prints the state on stdout so the driver can branch on it, which means the driver and the
 * ledger can never disagree about what happened — there is one decision, made here.
 */
export function loopRecord(input: LoopRecordInput): number {
  return withDb((db) => {
    const detail = readRun(db, input.runId);
    const locks = readLocks(db, input.runId);
    if (detail === null || locks === null) {
      return fail(`no loop run ${input.runId}`);
    }
    if (detail.run.outcome !== null) {
      return fail(`loop run ${input.runId} is already closed`);
    }
    // Read off disk, against the path locked at start. The driver reports counts, never digests.
    const specDigest = digestFile(detail.run.repo, locks.specPath) ?? '';
    const state = judge(locks, {
      exitCode: input.exitCode,
      specDigest,
      configDigest: digestFile(detail.run.repo, locks.configPath),
      tests: input.tests,
      suppressions: input.suppressions,
    });
    recordIteration(db, {
      runId: input.runId,
      ordinal: input.ordinal,
      at: nowIso(),
      state,
      exitCode: input.exitCode,
      specDigest,
      tests: input.tests,
      outputTail: tailOf(input.tailFile),
    });
    write(state);
    return 0;
  });
}

function tailOf(path: string | null): string {
  if (path === null) {
    return '';
  }
  try {
    return readFileSync(path, 'utf8').slice(-TAIL_CHARS);
  } catch {
    return '';
  }
}

/**
 * Close a run using the last iteration on record.
 *
 * No outcome is passed in. The caller says which run ended, not how it ended — `finishPassed`
 * re-checks the evidence in SQL and refuses if it is not there.
 */
export function loopFinish(runId: number): number {
  return withDb((db) => {
    const detail = readRun(db, runId);
    if (detail === null) {
      return fail(`no loop run ${runId}`);
    }
    const last = detail.iterations.at(-1);
    if (last === undefined) {
      return fail(`loop run ${runId} has no iterations`);
    }
    const agentTurns = detail.iterations.length - 1;
    const because = stopReason(last.state, agentTurns, detail.run.budget);
    const closed =
      outcomeOf(last.state) === 'passed'
        ? finishPassed(db, { runId, stopReason: because, now: nowIso() })
        : finishFailed(db, { runId, stopReason: because, now: nowIso() });

    if (!closed) {
      return fail(`refused to close run ${runId}: no green iteration on record, or already closed`);
    }
    write(`${outcomeOf(last.state)} — ${because}`);
    return 0;
  });
}

export function loopStatus(): number {
  return withDb((db) => {
    const runs = listRuns(db, 20);
    if (runs.length === 0) {
      write('no loop runs recorded.');
      return 0;
    }
    for (const run of runs) {
      const ticket = run.ticket === null ? '' : ` ${run.ticket}`;
      const state = run.outcome ?? run.latestState ?? 'pending';
      write(`${run.id}${ticket} ${state} — ${run.repo} (${run.iterations - 1}/${run.budget})`);
    }
    return 0;
  });
}
