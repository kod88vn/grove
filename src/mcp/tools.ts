import type { Config } from '../config/config.ts';
import { systemClock } from '../config/config.ts';
import type { Stall } from '../core/model/stall.ts';
import { detect } from '../stalls/detect.ts';
import type { Database } from '../store/database.ts';
import { readSnapshot } from '../store/repositories/snapshot.ts';
import { readLastRun } from '../store/repositories/sync-runs.ts';
import type { Tool } from './protocol.ts';

/**
 * The tools, and deliberately only these two.
 *
 * Both are read-only. Nothing here imports the executor, which is what makes "an agent cannot
 * merge or resolve anything through this server" a property of the code rather than a promise.
 * Actions stay behind a button I press.
 */

const MAX_RESULTS = 40;

/** Hoisted so the tool builders stay flat; these are data, not logic. */
const STATUS_SCHEMA = {
  type: 'object',
  properties: {
    owner: {
      type: 'string',
      enum: ['me', 'them', 'all'],
      description: 'Whose move it is. Defaults to me.',
    },
  },
};

const FIND_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Text, issue key, or repository name.' },
  },
  required: ['query'],
};

export function tools(db: Database, config: Config): Tool[] {
  return [statusTool(db, config), findTool(db, config)];
}

function statusTool(db: Database, config: Config): Tool {
  return {
    definition: {
      name: 'cc_status',
      title: 'What needs a push',
      description:
        'What has stopped moving across my Jira tickets, pull requests and branches, with ' +
        'the next move for each. Use this to answer "what should I do next" or "what is ' +
        'stuck". Data comes from a local mirror; the age of that mirror is included.',
      inputSchema: STATUS_SCHEMA,
    },
    run: (args) => status(db, config, String(args['owner'] ?? 'me')),
  };
}

function status(db: Database, config: Config, owner: string): string {
  const stalls = detect(snapshotFor(db, config), systemClock(), config.thresholds);
  const wanted = owner === 'all' ? stalls : stalls.filter((stall) => stall.owner === owner);
  if (wanted.length === 0) {
    return `Nothing stalled${freshness(db)}`;
  }
  const shown = wanted.slice(0, MAX_RESULTS);
  const more = wanted.length - shown.length;
  const lines = shown.map(describe);
  if (more > 0) {
    lines.push(`... and ${more} more`);
  }
  return `${wanted.length} stalled${freshness(db)}\n\n${lines.join('\n')}`;
}

function describe(stall: Stall): string {
  return `[${stall.severity}] ${subject(stall)} — ${stall.summary}\n    -> ${stall.nextMove.description}`;
}

function subject(stall: Stall): string {
  const value = stall.subject;
  switch (value.kind) {
    case 'issue':
      return value.key;
    case 'pull_request':
      return `${value.repo}#${value.number}`;
    case 'branch':
      return `${value.repo} ${value.branch}`;
    case 'sprint':
      return `sprint ${value.id}`;
  }
}

function findTool(db: Database, config: Config): Tool {
  return {
    definition: {
      name: 'cc_find',
      title: 'Find a ticket or pull request',
      description:
        'Search my mirrored Jira tickets and pull requests by text, issue key or repo. Use ' +
        'this to answer "what was WS-1234 about" or "which PR touched checkout".',
      inputSchema: FIND_SCHEMA,
    },
    run: (args) => find(db, config, String(args['query'] ?? '')),
  };
}

function find(db: Database, config: Config, query: string): string {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return 'Give me something to search for.';
  }
  const snapshot = snapshotFor(db, config);
  const issues = snapshot.issues
    .filter((issue) => matches(needle, issue.key, issue.summary, issue.status))
    .slice(0, MAX_RESULTS)
    .map((issue) => `${issue.key} [${issue.status}] ${issue.summary}`);
  const prs = snapshot.pullRequests
    .filter((pr) => matches(needle, `${pr.repo}#${pr.number}`, pr.title, pr.issueKeys.join(' ')))
    .slice(0, MAX_RESULTS)
    .map((pr) => `${pr.repo}#${pr.number} [${pr.state}] ${pr.title}`);

  if (issues.length === 0 && prs.length === 0) {
    return `Nothing matching "${query}"${freshness(db)}`;
  }
  return [
    issues.length > 0 ? `Tickets:\n${issues.join('\n')}` : '',
    prs.length > 0 ? `Pull requests:\n${prs.join('\n')}` : '',
  ]
    .filter((part) => part !== '')
    .join('\n\n');
}

function matches(needle: string, ...fields: readonly string[]): boolean {
  return fields.some((field) => field.toLowerCase().includes(needle));
}

function snapshotFor(db: Database, config: Config): ReturnType<typeof readSnapshot> {
  return readSnapshot(db, { jira: config.jira.me, github: config.github.me });
}

/**
 * How stale the answer is.
 *
 * Always appended, because an agent reading this cannot tell a quiet day from a sync that
 * stopped running three days ago, and the two look identical without it.
 */
function freshness(db: Database): string {
  const last = readLastRun(db);
  return last?.finishedAt === undefined || last.finishedAt === null
    ? ' (never synced)'
    : ` (mirror last synced ${last.finishedAt})`;
}
