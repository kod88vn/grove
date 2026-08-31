import { describe, expect, it } from 'vitest';
import { evaluateGate, refusalMessage, type Stamp, type WorkStep } from '../../../../src/core/steps/gate.ts';

const step: WorkStep = {
  id: 7,
  ticket: 'WS-1234',
  title: 'reconcile vanished pull requests',
  state: 'doing',
  sealedCommit: null,
};

function stamp(overrides: Partial<Stamp> = {}): Stamp {
  return {
    stepId: 7,
    at: '2026-08-31T10:00:00.000Z',
    command: 'npm run verify',
    treeDigest: 'tree-aaa',
    ...overrides,
  };
}

describe('evaluateGate', () => {
  it('refuses when nothing is in progress, naming the command that starts one', () => {
    const result = evaluateGate(null, [stamp()], 'tree-aaa');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('no-step-in-progress');
    expect(result.remedy).toContain('step start');
  });

  it('refuses a step that has never been verified', () => {
    const result = evaluateGate(step, [], 'tree-aaa');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('never-stamped');
    expect(result.remedy).toBe('npm run cc -- step stamp 7');
  });

  it('refuses when the tree changed after the stamp was earned', () => {
    const result = evaluateGate(step, [stamp({ treeDigest: 'tree-aaa' })], 'tree-bbb');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('tree-changed-since-stamp');
  });

  it('ignores a stamp that belongs to a different step', () => {
    const other = stamp({ stepId: 99, treeDigest: 'tree-aaa' });

    const result = evaluateGate(step, [other], 'tree-aaa');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('never-stamped');
  });

  it('allows only when a stamp for this step matches this exact tree', () => {
    const result = evaluateGate(step, [stamp({ treeDigest: 'tree-zzz' }), stamp()], 'tree-aaa');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.id).toBe(7);
    expect(result.stamp.treeDigest).toBe('tree-aaa');
  });

  it('re-opens the gate when an earlier stamp is superseded by an edit', () => {
    const stamps = [stamp({ treeDigest: 'tree-aaa' })];

    expect(evaluateGate(step, stamps, 'tree-aaa').ok).toBe(true);
    expect(evaluateGate(step, stamps, 'tree-edited').ok).toBe(false);
  });
});

describe('refusalMessage', () => {
  it('states the refusal and the command, with no hedging', () => {
    const result = evaluateGate(step, [], 'tree-aaa');
    if (result.ok) throw new Error('expected refusal');

    const message = refusalMessage(result);

    expect(message).toContain('Commit refused');
    expect(message).toContain('npm run cc -- step stamp 7');
    expect(message).not.toMatch(/should|consider|try to|please/i);
  });
});
