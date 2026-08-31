/**
 * The step gate, as a pure function.
 *
 * Everything that decides whether work may proceed lives here, with no database, no clock and
 * no process. That is not tidiness: it means the gate can be exhaustively tested, and that a
 * change to it shows up in a diff rather than in behaviour nobody reproduced.
 */

export type StepState = 'todo' | 'doing' | 'done' | 'abandoned';

export interface WorkStep {
  readonly id: number;
  readonly ticket: string | null;
  readonly title: string;
  readonly state: StepState;
  readonly sealedCommit: string | null;
}

export interface Stamp {
  readonly stepId: number;
  readonly at: string;
  readonly command: string;
  readonly treeDigest: string;
}

/** Why a commit was refused. Each maps to one instruction, never to a suggestion. */
export type RefusalCode =
  | 'no-step-in-progress'
  | 'never-stamped'
  | 'tree-changed-since-stamp';

export interface Refused {
  readonly ok: false;
  readonly code: RefusalCode;
  readonly step: WorkStep | null;
  /** The exact command that clears this refusal. Not advice — the thing to run. */
  readonly remedy: string;
}

export interface Allowed {
  readonly ok: true;
  readonly step: WorkStep;
  readonly stamp: Stamp;
}

export type GateResult = Allowed | Refused;

/**
 * Decide whether the tree may be committed.
 *
 * The rule has no discretion in it. A step is in progress, that step has a stamp, and the
 * stamp was produced against this exact tree — or the commit does not happen.
 */
export function evaluateGate(
  inProgress: WorkStep | null,
  stamps: readonly Stamp[],
  treeDigest: string,
): GateResult {
  if (inProgress === null) {
    return {
      ok: false,
      code: 'no-step-in-progress',
      step: null,
      remedy: 'npm run cc -- step start <id>   (or: npm run cc -- step add "<title>")',
    };
  }

  const forStep = stamps.filter((s) => s.stepId === inProgress.id);
  if (forStep.length === 0) {
    return {
      ok: false,
      code: 'never-stamped',
      step: inProgress,
      remedy: `npm run cc -- step stamp ${inProgress.id}`,
    };
  }

  const match = forStep.find((s) => s.treeDigest === treeDigest);
  if (match === undefined) {
    // The step was verified, then the code moved. This is the case the whole design exists
    // for: the stamp is real, and it is no longer about this tree.
    return {
      ok: false,
      code: 'tree-changed-since-stamp',
      step: inProgress,
      remedy: `npm run cc -- step stamp ${inProgress.id}`,
    };
  }

  return { ok: true, step: inProgress, stamp: match };
}

/** One line, imperative, for a hook's stderr. No hedging and nothing to negotiate with. */
export function refusalMessage(refusal: Refused): string {
  const subject =
    refusal.step === null ? 'no step is in progress' : `step ${refusal.step.id} "${refusal.step.title}"`;

  const because: Record<RefusalCode, string> = {
    'no-step-in-progress': 'Commit refused: no step is in progress.',
    'never-stamped': `Commit refused: ${subject} has never passed verification.`,
    'tree-changed-since-stamp': `Commit refused: ${subject} was verified against a different tree. The code changed after it passed.`,
  };

  return `${because[refusal.code]}\n  Run: ${refusal.remedy}\n`;
}
