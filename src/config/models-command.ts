import { findNewestCatalogFile } from '../connectors/model-catalog-file.ts';
import { defaultCatalogSearchRoot } from './model-paths.ts';
import { modelsApply, modelsPick, modelsReport } from './run-models.ts';

/**
 * Argument parsing for `cc models`. Split from `run-models.ts` for the same reason as
 * `loop-command.ts`/`run-loop.ts`: parsing is string handling, the actions are file IO.
 */

export interface ModelsCommandOptions {
  readonly repoRoot: string;
  readonly write: (line: string) => void;
}

export function modelsCommand(args: readonly string[], options: ModelsCommandOptions): number {
  const sub = args[0];
  if (sub === undefined) {
    return modelsReport({ repoRoot: options.repoRoot, catalogPath: resolveCatalogPath([]) }, options.write);
  }
  if (sub === 'pick') {
    return pickCommand(args.slice(1), options);
  }
  if (sub === 'apply') {
    return applyCommand(args.slice(1), options);
  }
  process.stderr.write(`unknown models subcommand "${sub}". Known: pick, apply\n`);
  return 2;
}

function pickCommand(args: readonly string[], options: ModelsCommandOptions): number {
  const role = args[0];
  if (role === undefined) {
    return usage('pick <role> [--escalate=N] [--catalog=<path>]');
  }
  const escalate = number(args, '--escalate') ?? 0;
  return modelsPick(
    { repoRoot: options.repoRoot, catalogPath: resolveCatalogPath(args) },
    role,
    escalate,
    options.write,
  );
}

function applyCommand(args: readonly string[], options: ModelsCommandOptions): number {
  return modelsApply(options.repoRoot, args.includes('--check'));
}

/** `--catalog=<path>`, then `CC_MODEL_CATALOG`, then the newest `models.json` on disk. */
function resolveCatalogPath(args: readonly string[]): string {
  const flagged = text(args, '--catalog');
  if (flagged !== null) {
    return flagged;
  }
  const fromEnv = process.env.CC_MODEL_CATALOG;
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }
  const found = findNewestCatalogFile(defaultCatalogSearchRoot());
  if (found === null) {
    throw new Error('no models.json catalogue found; pass --catalog=<path> or set CC_MODEL_CATALOG');
  }
  return found;
}

function usage(line: string): number {
  process.stderr.write(`usage: cc models ${line}\n`);
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
