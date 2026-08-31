#!/usr/bin/env -S npx tsx
import { doctor, type CheckResult } from '../src/config/doctor.ts';
import { createDashboard, listen } from '../dashboard/server.ts';
import { loadConfig } from '../src/config/config.ts';
import { runResolve, type ResolveOutcome, type ResolveStatus } from '../src/config/run-resolve.ts';
import { runStalls } from '../src/config/run-stalls.ts';
import { runSync } from '../src/config/run-sync.ts';
import {
  stepAbandon,
  stepAdd,
  stepGate,
  stepSeal,
  stepStamp,
  stepStart,
  stepStatus,
} from '../src/config/run-step.ts';
import type { Stall } from '../src/core/model/stall.ts';
import type { SyncScope } from '../src/sync/sync.ts';
import { serveMcp } from '../src/mcp/serve.ts';

const COMMANDS = ['doctor', 'sync', 'stalls', 'resolve', 'serve', 'mcp', 'step'] as const;
const DEFAULT_PORT = 4747;
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
    case 'resolve':
      return resolveCommand(argv.slice(1));
    case 'serve':
      return serveCommand(argv.slice(1));
    case 'step':
      return stepCommand(argv.slice(1));
    case 'mcp':
      // Returns immediately. The readline handle on stdin keeps the process alive until the
      // client closes the stream, which is how the stdio transport signals shutdown. Awaiting
      // a promise that never settles here would work but makes node warn about it on stderr,
      // and stderr is what the client shows when something is wrong.
      serveMcp();
      return 0;
    default:
      process.stderr.write(`unknown command "${command}". Known: ${COMMANDS.join(', ')}\n`);
      return 2;
  }
}

const STEP_SUBCOMMANDS = ['add', 'start', 'status', 'stamp', 'gate', 'seal', 'abandon'] as const;

async function stepCommand(args: readonly string[]): Promise<number> {
  const sub = args[0] ?? 'status';
  const rest = args.slice(1);

  switch (sub) {
    case 'add':
      return stepAddCommand(rest);
    case 'start':
      return withId(rest, stepStart);
    case 'status':
      return stepStatus();
    case 'stamp':
      return stepStamp(rest[0] === undefined ? null : Number(rest[0]));
    case 'gate':
      return stepGate();
    case 'seal':
      return rest[0] === undefined ? missing('seal <commit-sha>') : stepSeal(rest[0]);
    case 'abandon':
      return withId(rest, stepAbandon);
    default:
      process.stderr.write(`unknown step subcommand "${sub}". Known: ${STEP_SUBCOMMANDS.join(', ')}\n`);
      return 2;
  }
}

function stepAddCommand(args: readonly string[]): number {
  const title = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (title === '') return missing('add "<title>" [--ticket=WS-1234]');
  return stepAdd(title, stringFlag(args, '--ticket'));
}

function withId(args: readonly string[], run: (id: number) => number): number {
  const id = Number(args[0]);
  return Number.isInteger(id) ? run(id) : missing('<step-id>');
}

function missing(usage: string): number {
  process.stderr.write(`usage: cc step ${usage}\n`);
  return 2;
}

function stringFlag(args: readonly string[], name: string): string | null {
  const found = args.find((a) => a.startsWith(`${name}=`));
  return found === undefined ? null : found.slice(name.length + 1);
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

async function serveCommand(args: readonly string[]): Promise<number> {
  const port = numberFlag(args, '--port') ?? DEFAULT_PORT;
  const server = createDashboard({ config: loadConfig(), port });
  const url = await listen(server, port);
  process.stdout.write(`dashboard on ${url}\n`);
  return 0;
}

const MARK: Record<ResolveStatus, string> = {
  ready: '·',
  applied: '✓',
  refused: '✗',
  failed: '!',
  unavailable: '–',
};

/**
 * Close the loop on tickets whose code already shipped.
 *
 * Lists by default and mutates only under `--apply`, because the difference between the two is
 * the difference between a report and a set of irreversible workflow transitions.
 */
async function resolveCommand(args: readonly string[]): Promise<number> {
  const apply = args.includes('--apply');
  const only = args.find((arg) => !arg.startsWith('--')) ?? null;
  const outcomes = await runResolve({ apply, only });

  if (outcomes.length === 0) {
    process.stdout.write('nothing shipped is waiting on a ticket.\n');
    return 0;
  }
  for (const outcome of outcomes) {
    process.stdout.write(`  ${MARK[outcome.status]} ${outcome.issueKey}  ${outcome.detail}\n`);
  }
  process.stdout.write(summarise(outcomes, apply));
  return outcomes.some((outcome) => outcome.status === 'failed') ? 1 : 0;
}

function summarise(outcomes: readonly ResolveOutcome[], apply: boolean): string {
  if (outcomes.length === 0) {
    return '\nNothing shipped is waiting on a ticket.\n';
  }
  if (!apply) {
    const ready = outcomes.filter((outcome) => outcome.status === 'ready').length;
    const next = ready === 0 ? 'Nothing to apply.' : 'Re-run with --apply to resolve them.';
    return `\n${ready} of ${outcomes.length} ready. ${next}\n`;
  }
  const applied = outcomes.filter((outcome) => outcome.status === 'applied').length;
  return `\n${applied} of ${outcomes.length} resolved.\n`;
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
