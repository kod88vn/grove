import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../../src/store/database.ts';
import {
  finishFailed,
  finishPassed,
  listRuns,
  openRun,
  readLocks,
  readRun,
  recordIteration,
  startRun,
  type StartRunInput,
} from '../../../src/store/repositories/loop-runs.ts';

const NOW = '2026-09-22T12:00:00.000Z';
const LATER = '2026-09-22T12:10:00.000Z';
const SPEC = 'sha-spec';

function db() {
  return openDatabase({ path: ':memory:' });
}

function run(overrides: Partial<StartRunInput> = {}): StartRunInput {
  return {
    ticket: 'WS-5985',
    repo: '/Users/me/dev/web-storefront-ui',
    verifier: './node_modules/.bin/jest',
    specPath: 'packages/@wse/fragments/src/storybookCoverage.test.tsx',
    specDigest: SPEC,
    configPath: null,
    configDigest: null,
    baselineTests: 787,
    baselineSuppressions: 7,
    budget: 4,
    now: NOW,
    ...overrides,
  };
}

function control(database: ReturnType<typeof db>, runId: number) {
  recordIteration(database, {
    runId,
    ordinal: 0,
    at: NOW,
    state: 'red',
    exitCode: 1,
    specDigest: SPEC,
    tests: 787,
    outputTail: '',
  });
}

function green(database: ReturnType<typeof db>, runId: number, specDigest = SPEC) {
  recordIteration(database, {
    runId,
    ordinal: 1,
    at: LATER,
    state: 'green',
    exitCode: 0,
    specDigest,
    tests: 797,
    outputTail: 'Tests: 797 passed',
  });
}

describe('loop runs', () => {
  it('reads back a run with the locks it was started under', () => {
    const database = db();
    const id = startRun(database, run());

    expect(readLocks(database, id)).toEqual({
      specPath: 'packages/@wse/fragments/src/storybookCoverage.test.tsx',
      specDigest: SPEC,
      configPath: null,
      configDigest: null,
      baselineTests: 787,
      baselineSuppressions: 7,
    });
    database.close();
  });

  it('derives the iteration count and latest state from the iterations themselves', () => {
    const database = db();
    const id = startRun(database, run());
    control(database, id);
    green(database, id);

    const detail = readRun(database, id);
    expect(detail?.run.iterations).toBe(2);
    expect(detail?.run.latestState).toBe('green');
    expect(detail?.iterations.map((i) => i.ordinal)).toEqual([0, 1]);
    database.close();
  });

  describe('closing a run', () => {
    it('passes when a green iteration is on record under the locked digest', () => {
      const database = db();
      const id = startRun(database, run());
      control(database, id);
      green(database, id);

      expect(finishPassed(database, { runId: id, stopReason: 'verifier passed', now: LATER })).toBe(true);
      expect(readRun(database, id)?.run.outcome).toBe('passed');
      database.close();
    });

    /**
     * The point of the whole table. A caller that decided to report a pass it never observed
     * updates nothing — there is no parameter through which success can be asserted.
     */
    it('refuses to pass a run with no green iteration', () => {
      const database = db();
      const id = startRun(database, run());
      control(database, id);

      expect(finishPassed(database, { runId: id, stopReason: 'lying', now: LATER })).toBe(false);
      expect(readRun(database, id)?.run.outcome).toBeNull();
      database.close();
    });

    it('refuses to pass a run whose green iteration ran against a different spec', () => {
      const database = db();
      const id = startRun(database, run());
      control(database, id);
      green(database, id, 'sha-edited');

      expect(finishPassed(database, { runId: id, stopReason: 'cheated', now: LATER })).toBe(false);
      expect(readRun(database, id)?.run.outcome).toBeNull();
      database.close();
    });

    it('fails a run without needing any evidence', () => {
      const database = db();
      const id = startRun(database, run());
      control(database, id);

      expect(finishFailed(database, { runId: id, stopReason: 'budget', now: LATER })).toBe(true);
      expect(readRun(database, id)?.run.stopReason).toBe('budget');
      database.close();
    });

    it('will not close a run twice', () => {
      const database = db();
      const id = startRun(database, run());
      control(database, id);
      finishFailed(database, { runId: id, stopReason: 'budget', now: LATER });

      expect(finishFailed(database, { runId: id, stopReason: 'again', now: LATER })).toBe(false);
      expect(readRun(database, id)?.run.stopReason).toBe('budget');
      database.close();
    });
  });

  it('rejects a green iteration that did not exit zero', () => {
    const database = db();
    const id = startRun(database, run());
    expect(() =>
      recordIteration(database, {
        runId: id,
        ordinal: 0,
        at: NOW,
        state: 'green',
        exitCode: 1,
        specDigest: SPEC,
        tests: 800,
        outputTail: '',
      }),
    ).toThrow();
    database.close();
  });

  it('rejects two iterations claiming the same ordinal', () => {
    const database = db();
    const id = startRun(database, run());
    control(database, id);
    expect(() => control(database, id)).toThrow();
    database.close();
  });

  it('finds the open run for a repo, and stops finding it once closed', () => {
    const database = db();
    const id = startRun(database, run());
    control(database, id);
    expect(openRun(database, '/Users/me/dev/web-storefront-ui')?.id).toBe(id);

    finishFailed(database, { runId: id, stopReason: 'budget', now: LATER });
    expect(openRun(database, '/Users/me/dev/web-storefront-ui')).toBeNull();
    database.close();
  });

  it('lists newest first', () => {
    const database = db();
    const first = startRun(database, run());
    const second = startRun(database, run({ ticket: 'WS-6000' }));

    expect(listRuns(database).map((r) => r.id)).toEqual([second, first]);
    database.close();
  });
});
