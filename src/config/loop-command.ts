import { loopFinish, loopRecord, loopStart, loopStatus } from './run-loop.ts';

/**
 * Argument parsing for `cc loop`.
 *
 * Separate from `run-loop.ts` only because the two together exceed the file-size limit, and
 * splitting parsing from behaviour is the honest cut — everything here is string handling and
 * everything there touches the ledger.
 */

const SUBCOMMANDS = ['start', 'record', 'finish', 'status'] as const;
const DEFAULT_BUDGET = 4;

export function loopCommand(args: readonly string[]): number {
  const sub = args[0] ?? 'status';
  const rest = args.slice(1);

  switch (sub) {
    case 'start':
      return startCommand(rest);
    case 'record':
      return recordCommand(rest);
    case 'finish':
      return finishCommand(rest);
    case 'status':
      return loopStatus();
    default:
      process.stderr.write(
        `unknown loop subcommand "${sub}". Known: ${SUBCOMMANDS.join(', ')}\n`,
      );
      return 2;
  }
}

function startCommand(args: readonly string[]): number {
  const spec = text(args, '--spec');
  const verifier = text(args, '--verifier');
  if (spec === null || verifier === null) {
    return usage('start --spec=<path> --verifier="<cmd>" --exit=<code> [--repo=<path>]');
  }
  const exitCode = number(args, '--exit');
  if (exitCode === null) {
    return usage('start … --exit=<verifier exit code from iteration 0>');
  }
  return loopStart({
    ticket: text(args, '--ticket'),
    repo: text(args, '--repo') ?? process.cwd(),
    spec,
    config: text(args, '--config'),
    verifier,
    baselineTests: number(args, '--tests') ?? 0,
    baselineSuppressions: number(args, '--suppressions') ?? 0,
    budget: number(args, '--budget') ?? DEFAULT_BUDGET,
    exitCode,
  });
}

function recordCommand(args: readonly string[]): number {
  const runId = number(args, '--run');
  const ordinal = number(args, '--iteration');
  const exitCode = number(args, '--exit');
  if (runId === null || ordinal === null || exitCode === null) {
    return usage('record --run=<id> --iteration=<n> --exit=<code> [--tests=<n>] [--tail=<path>]');
  }
  return loopRecord({
    runId,
    ordinal,
    exitCode,
    tests: number(args, '--tests'),
    suppressions: number(args, '--suppressions'),
    tailFile: text(args, '--tail'),
  });
}

function finishCommand(args: readonly string[]): number {
  const runId = number(args, '--run');
  return runId === null ? usage('finish --run=<id>') : loopFinish(runId);
}

function usage(line: string): number {
  process.stderr.write(`usage: cc loop ${line}\n`);
  return 2;
}

function text(args: readonly string[], flag: string): string | null {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match === undefined ? null : match.slice(flag.length + 1);
}

function number(args: readonly string[], flag: string): number | null {
  const raw = text(args, flag);
  if (raw === null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
