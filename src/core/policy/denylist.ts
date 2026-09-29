/**
 * Prohibitions that no configuration can switch off.
 *
 * These live in code rather than config on purpose. A denylist that config can edit is a
 * denylist that will eventually be edited by whatever is trying to get past it. Every entry
 * here is a thing this system must never do, regardless of who asks.
 *
 * This is the only module permitted to contain these strings; the quality guard rejects them
 * anywhere else under `src/`.
 */

/** Command-line flags that bypass a safety mechanism. */
export const FORBIDDEN_ARGUMENTS: readonly string[] = [
  '--no-verify',
  '--force',
  '--force-with-lease',
  '--admin',
  'reset --hard',
];

/** Branches that must never be pushed to or committed on directly. */
const PROTECTED_BRANCHES: readonly string[] = ['main', 'master', 'development'];

export interface Denial {
  /** Short identifier for the rule, recorded in the audit row. */
  readonly rule: string;
  readonly because: string;
}

/**
 * Check a command about to be executed.
 *
 * Applied to the assembled argument list rather than to the caller's intent, so a flag that
 * arrives through a variable is caught just the same.
 */
export function denyCommand(argv: readonly string[]): Denial | null {
  const joined = argv.join(' ');
  for (const forbidden of FORBIDDEN_ARGUMENTS) {
    if (joined.includes(forbidden)) {
      return {
        rule: 'forbidden-argument',
        because: `\`${forbidden}\` bypasses a safety mechanism and is never permitted`,
      };
    }
  }
  return null;
}

/** Whether a branch is one this system must never write to. */
export function isProtectedBranch(name: string): boolean {
  return PROTECTED_BRANCHES.includes(name.toLowerCase());
}
