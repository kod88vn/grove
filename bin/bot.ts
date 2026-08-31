#!/usr/bin/env -S npx tsx
import { doctor, type CheckResult } from '../src/config/doctor.ts';
import { runStalls } from '../src/config/run-stalls.ts';
import { runSync } from '../src/config/run-sync.ts';
import type { Stall } from '../src/core/model/stall.ts';
import type { SyncScope } from '../src/sync/sync.ts';

const COMMANDS = ['doctor', 'sync', 'stalls'] as const;
const SCOPES: readonly SyncScope[] = ['jira', 'github', 'branches', 'all'];

async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? 'doctor';

  switch (command) {
    case 'doctor':
      return report(await doctor());
    case 'sync':
      return runSyncCommand(argv.slice(1));
    case 'stalls':
      return stallsCommand(argv.slice(1));
    default:
      process.stderr.write(`unknown command "${command}". Known: ${COMMANDS.join(', ')}\n`);
      return 2;
  }
}

async function runSyncCommand(args: readonly string[]): Promise<number> {
  const scope = scopeFrom(args);
  if (scope === null) {
    process.stderr.write(`unknown scope. Known: ${SCOPES.join(', ')}\n`);
    return 2;
  }
  const maxAge = numberFlag(args, '--max-age-seconds');
  const started = Date.now();

  const outcome = await runSync({
    scope,
    ...(maxAge === null ? {} : { maxAgeMs: maxAge * 1000 }),
  });

  if (outcome.kind === 'skipped') {
    const age = outcome.ageMs === null ? 'never synced' : `${Math.round(outcome.ageMs / 1000)}s old`;
    process.stdout.write(`skipped (${outcome.reason}, ${age})\n`);
    return 0;
  }

  const counts = Object.entries(outcome.counts)
    .map(([name, value]) => `${name}=${value}`)
    .join(' ');
  process.stdout.write(
    `synced ${scope} in ${Math.round((Date.now() - started) / 1000)}s: ${counts} events=${outcome.events}\n`,
  );
  return 0;
}

/**
 * How many stalls to print per group before summarising the rest.
 *
 * A backlog of 200 is a list, not a next move. The point of the tool is to name the few things
 * worth doing now; `--all` is there when the full backlog is genuinely wanted.
 */
const TOP_N = 10;

function stallsCommand(args: readonly string[]): number {
  const stalls = runStalls();
  if (stalls.length === 0) {
    process.stdout.write('nothing is stalled.\n');
    return 0;
  }

  const limit = args.includes('--all') ? Number.MAX_SAFE_INTEGER : TOP_N;
  writeGroup('needs a move from me', stalls.filter((stall) => stall.owner === 'me'), limit);
  writeGroup('waiting on someone else', stalls.filter((stall) => stall.owner === 'them'), limit);
  return 0;
}

function writeGroup(heading: string, stalls: readonly Stall[], limit: number): void {
  if (stalls.length === 0) {
    return;
  }
  process.stdout.write(`\n${heading} (${stalls.length})\n`);
  for (const stall of stalls.slice(0, limit)) {
    process.stdout.write(`  [${stall.severity}] ${stall.summary}\n`);
    process.stdout.write(`      -> ${stall.nextMove.description}\n`);
  }
  const hidden = stalls.length - Math.min(stalls.length, limit);
  if (hidden > 0) {
    process.stdout.write(`  ... and ${hidden} more (--all to see them)\n`);
  }
}

function scopeFrom(args: readonly string[]): SyncScope | null {
  const positional = args.find((arg) => !arg.startsWith('--'));
  if (positional === undefined) {
    return 'all';
  }
  return SCOPES.includes(positional as SyncScope) ? (positional as SyncScope) : null;
}

function numberFlag(args: readonly string[], flag: string): number | null {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  if (match === undefined) {
    return null;
  }
  const parsed = Number.parseInt(match.slice(flag.length + 1), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function report(results: readonly CheckResult[]): number {
  for (const result of results) {
    process.stdout.write(`${result.ok ? '✓' : '✗'} ${result.name}: ${result.detail}\n`);
  }
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    process.stdout.write(`\n${failed} check(s) failed.\n`);
  }
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
