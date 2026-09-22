import { describe, expect, it } from 'vitest';
import type { LoopRun, LoopRunDetail } from '../../../src/core/model/loop-run.ts';
import { loopRunPage, loopsPage } from '../../../dashboard/pages/loops.ts';

function aRun(overrides: Partial<LoopRun> = {}): LoopRun {
  return {
    id: 1,
    ticket: 'WS-5985',
    repo: '/Users/me/dev/web-storefront-ui',
    verifier: './node_modules/.bin/jest',
    specPath: 'packages/@wse/fragments/src/storybookCoverage.test.tsx',
    baselineTests: 787,
    budget: 4,
    startedAt: '2026-09-22T12:00:00.000Z',
    finishedAt: null,
    outcome: null,
    stopReason: null,
    iterations: 1,
    latestState: 'red',
    ...overrides,
  };
}

describe('loops page', () => {
  it('says where to start when nothing has run', () => {
    expect(loopsPage([])).toContain('No loop runs recorded');
  });

  it('shows the outcome once a run is closed', () => {
    const page = loopsPage([aRun({ outcome: 'passed', finishedAt: '2026-09-22T12:10:00.000Z' })]);
    expect(page).toContain('passed');
  });

  it('marks an unfinished run with its latest observation', () => {
    expect(loopsPage([aRun({ latestState: 'red' })])).toContain('red (running)');
  });

  /**
   * Iteration 0 is the negative control, not an attempt. Counting it would report every run as
   * having spent one more turn than it did, which is the number a budget is judged against.
   */
  it('excludes the iteration-0 control from the turn count', () => {
    expect(loopsPage([aRun({ iterations: 3, budget: 4 })])).toContain('2/4');
  });

  it('never reports a negative turn count for a run with no iterations yet', () => {
    expect(loopsPage([aRun({ iterations: 0 })])).toContain('0/4');
  });

  it('escapes a stop reason rather than rendering it', () => {
    const page = loopsPage([aRun({ stopReason: '<script>alert(1)</script>' })]);
    expect(page).not.toContain('<script>alert(1)</script>');
    expect(page).toContain('&lt;script&gt;');
  });

  it('offers no control that would start a loop', () => {
    const page = loopsPage([aRun()]);
    expect(page).not.toContain('<form');
    expect(page).not.toContain('chat');
  });
});

describe('loop run detail', () => {
  function detail(): LoopRunDetail {
    return {
      run: aRun({ iterations: 2, latestState: 'green', outcome: 'passed', finishedAt: '2026-09-22T12:10:00.000Z', stopReason: 'verifier passed' }),
      iterations: [
        { ordinal: 0, at: '2026-09-22T12:00:00.000Z', state: 'red', exitCode: 1, tests: 787, outputTail: '' },
        { ordinal: 1, at: '2026-09-22T12:01:30.000Z', state: 'green', exitCode: 0, tests: 797, outputTail: 'Tests: 797 passed' },
      ],
    };
  }

  it('labels iteration 0 as the control', () => {
    expect(loopRunPage(detail())).toContain('0 (control)');
  });

  it('shows the verifier output from the last iteration', () => {
    expect(loopRunPage(detail())).toContain('Tests: 797 passed');
  });

  it('shows the locked spec and the verifier that judged the run', () => {
    const page = loopRunPage(detail());
    expect(page).toContain('storybookCoverage.test.tsx');
    expect(page).toContain('jest');
  });

  it('renders a run that has no iterations without throwing', () => {
    const page = loopRunPage({ run: aRun({ iterations: 0, latestState: null }), iterations: [] });
    expect(page).toContain('No iterations recorded');
    expect(page).toContain('pending');
  });
});
