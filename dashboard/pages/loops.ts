import type { LoopIteration, LoopRun, LoopRunDetail } from '../../src/core/model/loop-run.ts';
import type { TableQuery, TableRow } from '../html.ts';
import { empty, escapeHtml, formatDateTime, layout, section, table } from '../html.ts';

/**
 * What the loops of LOOP.md left behind.
 *
 * Read-only, deliberately. There is no button here and there must never be one: DESIGN.md §19
 * says this system never invokes a language model, and a "run loop" control would be exactly
 * that. A loop is started by a human in a terminal; this page is where it becomes watchable
 * afterwards.
 */

const DEFAULT_QUERY: TableQuery = { path: '/loops', sort: null, direction: 'asc', group: null };

/** The state to show for a run: its outcome once closed, else its latest observation. */
function currentState(run: LoopRun): string {
  if (run.outcome !== null) {
    return run.outcome;
  }
  return run.latestState === null ? 'pending' : `${run.latestState} (running)`;
}

/**
 * Agent turns, excluding the iteration-0 negative control.
 *
 * The control is a recorded iteration but not an attempt, so counting it would report every
 * run as having used one turn more than it did.
 */
function turnsUsed(run: LoopRun): string {
  return `${Math.max(run.iterations - 1, 0)}/${run.budget}`;
}

function mono(text: string): string {
  return `<span class="mono">${escapeHtml(text)}</span>`;
}

function runRow(run: LoopRun): TableRow {
  return {
    cells: [
      `<a href="/loops/${run.id}">${run.id}</a>`,
      escapeHtml(run.ticket ?? '—'),
      mono(shortRepo(run.repo)),
      escapeHtml(currentState(run)),
      escapeHtml(turnsUsed(run)),
      `<span class="age">${escapeHtml(formatDateTime(run.startedAt))}</span>`,
      escapeHtml(run.stopReason ?? ''),
    ],
    values: [
      String(run.id),
      run.ticket ?? '',
      run.repo,
      currentState(run),
      turnsUsed(run),
      run.startedAt,
      run.stopReason ?? '',
    ],
  };
}

/** Repo paths are absolute and long; the last segment is the part anyone reads. */
function shortRepo(repo: string): string {
  const parts = repo.split('/').filter((part) => part !== '');
  return parts.at(-1) ?? repo;
}

export function loopsPage(runs: readonly LoopRun[], query: TableQuery = DEFAULT_QUERY): string {
  const body =
    runs.length === 0
      ? empty('No loop runs recorded. See LOOP.md to start one.')
      : table(runColumns, runs.map(runRow), query);

  return layout('Loops', '/loops', `<h1>Loops</h1>${section('Runs', runs.length, body)}`);
}

export function loopRunPage(detail: LoopRunDetail, query: TableQuery = DEFAULT_QUERY): string {
  const { run, iterations } = detail;
  const heading = `<h1>Loop ${run.id}${run.ticket === null ? '' : ` · ${escapeHtml(run.ticket)}`}</h1>`;
  const body =
    summary(run) +
    section(
      'Iterations',
      iterations.length,
      iterations.length === 0
        ? empty('No iterations recorded.')
        : table(iterationColumns, iterations.map(iterationRow), query),
    ) +
    tail(iterations);

  return layout(`Loop ${run.id}`, '/loops', heading + body);
}

function summary(run: LoopRun): string {
  const facts: readonly (readonly [string, string])[] = [
    ['state', currentState(run)],
    ['repo', run.repo],
    ['verifier', run.verifier],
    ['spec', run.specPath],
    ['baseline', `${run.baselineTests} tests`],
    ['turns', turnsUsed(run)],
    ['started', formatDateTime(run.startedAt)],
    ['finished', run.finishedAt === null ? '—' : formatDateTime(run.finishedAt)],
    ['stop reason', run.stopReason ?? '—'],
  ];
  const rows = facts
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${mono(value)}</td></tr>`)
    .join('');
  return `<table>${rows}</table>`;
}

function iterationRow(iteration: LoopIteration): TableRow {
  const label = iteration.ordinal === 0 ? '0 (control)' : String(iteration.ordinal);
  const tests = iteration.tests === null ? '—' : String(iteration.tests);
  return {
    cells: [
      escapeHtml(label),
      escapeHtml(iteration.state),
      mono(String(iteration.exitCode)),
      escapeHtml(tests),
      `<span class="age">${escapeHtml(formatDateTime(iteration.at))}</span>`,
    ],
    values: [label, iteration.state, String(iteration.exitCode), tests, iteration.at],
  };
}

/** The verifier output from the last iteration — the thing you actually want when it failed. */
function tail(iterations: readonly LoopIteration[]): string {
  const last = iterations.at(-1);
  if (last === undefined || last.outputTail === '') {
    return '';
  }
  return section(
    'Verifier output',
    1,
    `<pre class="mono">${escapeHtml(last.outputTail)}</pre>`,
  );
}

const runColumns = [
  { key: 'id', label: 'Run' },
  { key: 'ticket', label: 'Ticket' },
  { key: 'repo', label: 'Repo' },
  { key: 'state', label: 'State' },
  { key: 'turns', label: 'Turns' },
  { key: 'started', label: 'Started' },
  { key: 'reason', label: 'Stop reason' },
] as const;

const iterationColumns = [
  { key: 'ordinal', label: '#' },
  { key: 'state', label: 'State' },
  { key: 'exit', label: 'Exit' },
  { key: 'tests', label: 'Tests' },
  { key: 'at', label: 'When' },
] as const;
