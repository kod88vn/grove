/**
 * What a loop iteration proved, decided from evidence rather than from a report.
 *
 * A loop (LOOP.md) hands an agent a task and then judges the result with the target repo's own
 * verifier, from a driver running outside the chat session. This module is the judgment. It is
 * pure so that every way of faking a pass is a table row in a test rather than a claim about
 * how the bash behaves.
 *
 * The central asymmetry: a non-zero exit code can only mean "not yet", but a zero exit code
 * does *not* mean "done". Four cheap edits turn a red suite green without doing the work —
 * editing the locked spec, deleting tests, raising the guard limits, or suppressing the linter
 * — so integrity is checked first and outranks the exit code.
 */

/** The terminal states of a single iteration. Only one of them is a pass. */
export type LoopState = 'red' | 'green' | 'tampered' | 'shrunk' | 'cfg-tampered' | 'suppressed';

/** How a whole run ended. `failed` covers both cheating and exhausting the budget. */
export type LoopOutcome = 'passed' | 'failed';

/**
 * The facts recorded once, before the first agent turn.
 *
 * Digests are opaque strings. This module never computes one — that needs a filesystem, which
 * layer 0 may not touch — it only compares what the driver reports against what was locked.
 */
export interface LoopLocks {
  /** sha-256 of the executable spec that defines done. */
  readonly specDigest: string;
  /** sha-256 of the guard config, when the loop is unblocking a guard. */
  readonly configDigest: string | null;
  /** Test count before any agent turn. The suite must grow past this, never shrink to it. */
  readonly baselineTests: number;
  /** Count of suppression comments before any agent turn. */
  readonly baselineSuppressions: number;
}

/** What the driver observed after one agent turn. */
export interface IterationEvidence {
  /** Exit code of the verifier command. Zero is necessary, not sufficient. */
  readonly exitCode: number;
  readonly specDigest: string;
  readonly configDigest: string | null;
  /** Total tests the verifier reported, or null when the output could not be parsed. */
  readonly tests: number | null;
  readonly suppressions: number | null;
}

/**
 * Decide what one iteration proved.
 *
 * Integrity is evaluated before the exit code, deliberately. An agent that edited the spec and
 * then passed has produced a green exit code, and reporting that as `green` would record the
 * cheat as a success. Checking digests first makes the exit code unreachable in that case.
 */
export function judge(locks: LoopLocks, evidence: IterationEvidence): LoopState {
  if (evidence.specDigest !== locks.specDigest) {
    return 'tampered';
  }
  if (locks.configDigest !== null && evidence.configDigest !== locks.configDigest) {
    return 'cfg-tampered';
  }
  if (evidence.suppressions !== null && evidence.suppressions > locks.baselineSuppressions) {
    return 'suppressed';
  }
  if (evidence.exitCode !== 0) {
    return 'red';
  }
  // Only reachable on a green verifier: a suite that passes because tests were removed is a
  // failure, and it is the one cheat that leaves every digest intact.
  if (evidence.tests !== null && evidence.tests <= locks.baselineTests) {
    return 'shrunk';
  }
  return 'green';
}

/**
 * Whether this state ends the run.
 *
 * `red` is the only state worth another turn. Every integrity failure stops immediately —
 * feeding "you cheated" back to the agent and letting it try again is how a budget gets burned
 * discovering the same thing four times.
 */
export function isTerminal(state: LoopState): boolean {
  return state !== 'red';
}

/** How a run that reached `state` should be recorded. */
export function outcomeOf(state: LoopState): LoopOutcome {
  return state === 'green' ? 'passed' : 'failed';
}

const REASONS: Readonly<Record<LoopState, string>> = {
  green: 'verifier passed',
  red: 'verifier still failing',
  tampered: 'the locked spec was edited',
  'cfg-tampered': 'the guard config was edited instead of the code',
  suppressed: 'a suppression comment was added instead of a fix',
  shrunk: 'tests were deleted to make the suite pass',
};

/** One line explaining why the run stopped, for the ledger and the dashboard. */
export function stopReason(state: LoopState, iterations: number, budget: number): string {
  if (state === 'red' && iterations >= budget) {
    return `budget exhausted after ${budget} iteration(s), verifier still failing`;
  }
  return REASONS[state];
}

/**
 * Whether iteration 0 justifies starting at all.
 *
 * A spec that is already green proves nothing about the work it claims to cover, so a loop
 * that starts green is aborted rather than recorded as an instant pass. This is the negative
 * control, enforced instead of remembered.
 */
export function startable(state: LoopState): boolean {
  return state !== 'green';
}
