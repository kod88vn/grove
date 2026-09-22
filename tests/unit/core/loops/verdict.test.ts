import { describe, expect, it } from 'vitest';
import {
  isTerminal,
  judge,
  outcomeOf,
  startable,
  stopReason,
  type IterationEvidence,
  type LoopLocks,
} from '../../../../src/core/loops/verdict.ts';

const SPEC = 'sha-spec';
const CFG = 'sha-cfg';

const LOCKS: LoopLocks = {
  specDigest: SPEC,
  configDigest: CFG,
  baselineTests: 787,
  baselineSuppressions: 7,
};

/** A green, honest iteration. Each test below breaks exactly one thing about it. */
function passing(): IterationEvidence {
  return { exitCode: 0, specDigest: SPEC, configDigest: CFG, tests: 797, suppressions: 7 };
}

describe('loop verdict', () => {
  it('passes only when the verifier is green, the locks hold and the suite grew', () => {
    expect(judge(LOCKS, passing())).toBe('green');
  });

  it('is red while the verifier still fails', () => {
    expect(judge(LOCKS, { ...passing(), exitCode: 1 })).toBe('red');
  });

  describe('the four ways to fake a pass', () => {
    it('catches the spec being edited to match the code', () => {
      expect(judge(LOCKS, { ...passing(), specDigest: 'sha-other' })).toBe('tampered');
    });

    it('catches the guard config being edited instead of the code', () => {
      expect(judge(LOCKS, { ...passing(), configDigest: 'sha-other' })).toBe('cfg-tampered');
    });

    it('catches a suppression comment being added instead of a fix', () => {
      expect(judge(LOCKS, { ...passing(), suppressions: 8 })).toBe('suppressed');
    });

    it('catches tests being deleted to make the suite pass', () => {
      expect(judge(LOCKS, { ...passing(), tests: 786 })).toBe('shrunk');
    });

    it('treats a suite that merely held steady as shrunk, since nothing was added', () => {
      expect(judge(LOCKS, { ...passing(), tests: 787 })).toBe('shrunk');
    });
  });

  /**
   * The ordering is the security property, not an implementation detail: an agent that edited
   * the spec AND got a green exit code must be reported as a cheat, never as a pass.
   */
  it('reports tampering even when the verifier exited zero', () => {
    const cheated = { ...passing(), specDigest: 'sha-other', exitCode: 0 };
    expect(judge(LOCKS, cheated)).toBe('tampered');
    expect(outcomeOf(judge(LOCKS, cheated))).toBe('failed');
  });

  it('reports tampering ahead of a red verifier, so a cheat is never retried as progress', () => {
    expect(judge(LOCKS, { ...passing(), specDigest: 'sha-other', exitCode: 1 })).toBe('tampered');
  });

  it('ignores the config lock when the loop has none to protect', () => {
    const noConfig: LoopLocks = { ...LOCKS, configDigest: null };
    expect(judge(noConfig, { ...passing(), configDigest: 'anything' })).toBe('green');
  });

  it('does not judge counts it could not parse', () => {
    expect(judge(LOCKS, { ...passing(), tests: null, suppressions: null })).toBe('green');
  });

  describe('stopping', () => {
    it('keeps going only while red', () => {
      expect(isTerminal('red')).toBe(false);
      for (const state of ['green', 'tampered', 'shrunk', 'cfg-tampered', 'suppressed'] as const) {
        expect(isTerminal(state)).toBe(true);
      }
    });

    it('counts only green as a pass', () => {
      expect(outcomeOf('green')).toBe('passed');
      for (const state of ['red', 'tampered', 'shrunk', 'cfg-tampered', 'suppressed'] as const) {
        expect(outcomeOf(state)).toBe('failed');
      }
    });

    it('distinguishes an exhausted budget from a fresh failure', () => {
      expect(stopReason('red', 4, 4)).toContain('budget exhausted');
      expect(stopReason('red', 1, 4)).toBe('verifier still failing');
    });

    it('names the cheat in the stop reason', () => {
      expect(stopReason('shrunk', 1, 4)).toContain('deleted');
      expect(stopReason('cfg-tampered', 1, 4)).toContain('guard config');
    });
  });

  describe('the negative control', () => {
    it('refuses to start a loop whose spec already passes', () => {
      expect(startable('green')).toBe(false);
    });

    it('starts from red, which is the point', () => {
      expect(startable('red')).toBe(true);
    });
  });
});
