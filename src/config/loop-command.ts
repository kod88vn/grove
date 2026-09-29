import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { childProfileSettings, mergeChildSettings } from '../core/policy/terminal-deny.ts';
import { loopFinish, loopRecord, loopStart, loopStatus } from './run-loop.ts';

/**
 * Argument parsing for `cc loop`.
 *
 * Separate from `run-loop.ts` only because the two together exceed the file-size limit, and
 * splitting parsing from behaviour is the honest cut — everything here is string handling and
 * everything there touches the ledger.
 */

const SUBCOMMANDS = ['start', 'record', 'finish', 'status', 'profile'] as const;
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
    case 'profile':
      return profileCommand(rest);
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

function profileCommand(args: readonly string[]): number {
  const userDataDir = text(args, '--user-data-dir') ?? resolve(process.cwd(), 'tmp/loop-vscode');
  const settingsPath = join(userDataDir, 'User', 'settings.json');

  if (args.includes('--check')) {
    return checkProfile(settingsPath);
  }
  if (args.includes('--write')) {
    return writeProfile(userDataDir, settingsPath);
  }
  process.stdout.write(`${JSON.stringify(childProfileSettings(), null, 2)}\n`);
  return 0;
}

function checkProfile(settingsPath: string): number {
  try {
    const raw = readFileSync(settingsPath, 'utf8');
    const existing: Record<string, unknown> = JSON.parse(raw);
    const managed = childProfileSettings();
    for (const [key, value] of Object.entries(managed)) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(value)) {
        return 1;
      }
    }
    return 0;
  } catch {
    return 1;
  }
}

function writeProfile(userDataDir: string, settingsPath: string): number {
  let existing: Record<string, unknown>;
  try {
    const raw = readFileSync(settingsPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isSettingsRecord(parsed)) {
      process.stderr.write(`invalid profile settings: ${settingsPath} must contain a JSON object\n`);
      return 1;
    }
    existing = parsed;
  } catch (error: unknown) {
    if (!isFileNotFound(error)) {
      process.stderr.write(`invalid profile settings: ${settingsPath} is not valid JSON\n`);
      return 1;
    }
    existing = {};
  }
  mkdirSync(join(userDataDir, 'User'), { recursive: true });
  const merged = mergeChildSettings(existing, childProfileSettings());
  writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);
  return 0;
}

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFileNotFound(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
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
