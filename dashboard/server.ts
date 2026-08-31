import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { BotConfig } from '../src/config/config.ts';
import { systemClock } from '../src/config/config.ts';
import { detect } from '../src/stalls/detect.ts';
import { openDatabase, type Database } from '../src/store/database.ts';
import { readRecentEvents } from '../src/store/repositories/events.ts';
import { readLastRun } from '../src/store/repositories/sync-runs.ts';
import { readSnapshot } from '../src/store/repositories/snapshot.ts';
import { activityPage, sprintPage } from './pages/sprint.ts';
import { escapeHtml, layout } from './html.ts';
import { pullRequestsPage, ticketsPage } from './pages/work.ts';
import { pushPage } from './pages/push.ts';
import { originAllowed, performAction, readBody } from './actions.ts';
import { resultPage } from './pages/result.ts';

/** Loopback only. This server exposes an authenticated view of private work and has no auth. */
const HOST = '127.0.0.1';

/**
 * Host header values the server will answer on.
 *
 * Binding to loopback stops remote connections, but a page on the public internet can still
 * point a hostname at 127.0.0.1 and have the browser read the response. Pinning the Host
 * header closes that.
 */
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface DashboardOptions {
  readonly config: BotConfig;
  readonly port: number;
}

export function createDashboard(options: DashboardOptions): Server {
  const db = openDatabase({ path: options.config.databasePath });
  const server = createServer((request, response) => {
    void route(request, response, db, options);
  });
  server.on('close', () => {
    db.close();
  });
  return server;
}

export function listen(server: Server, port: number): Promise<string> {
  return new Promise((resolve) => {
    server.listen(port, HOST, () => {
      resolve(`http://${HOST}:${port}`);
    });
  });
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  db: Database,
  options: DashboardOptions,
): Promise<void> {
  if (!hostAllowed(request.headers.host)) {
    send(response, 403, layout('Forbidden', '', '<h1>Forbidden</h1>'));
    return;
  }
  if (request.method === 'POST') {
    await act(request, response, db, options);
    return;
  }
  handle(request, response, db, options.config);
}

/**
 * The one route that changes anything.
 *
 * Kept separate from the read paths so that the difference between looking and acting is
 * visible in the code, not buried in a branch.
 */
async function act(
  request: IncomingMessage,
  response: ServerResponse,
  db: Database,
  options: DashboardOptions,
): Promise<void> {
  const path = new URL(request.url ?? '/', `http://${HOST}`).pathname;
  if (path !== '/act') {
    send(response, 404, layout('Not found', '', '<h1>Not found</h1>'));
    return;
  }
  if (!originAllowed(request.headers.origin, request.headers.host)) {
    send(response, 403, layout('Forbidden', '', '<h1>Cross-site request refused</h1>'));
    return;
  }
  try {
    const form = await readBody(request);
    const result = await performAction(form, db, options.config);
    send(response, result.ok ? 200 : 409, resultPage(result));
  } catch (error) {
    const because = error instanceof Error ? error.message : String(error);
    send(response, 400, resultPage({ ok: false, message: because }));
  }
}

function handle(
  request: IncomingMessage,
  response: ServerResponse,
  db: Database,
  config: BotConfig,
): void {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, layout('Not allowed', '', '<h1>Method not allowed</h1>'));
    return;
  }

  const path = new URL(request.url ?? '/', `http://${HOST}`).pathname;
  const page = render(path, db, config);
  if (page === null) {
    send(response, 404, layout('Not found', '', `<h1>Not found</h1><p class="mono">${escapeHtml(path)}</p>`));
    return;
  }
  send(response, 200, page);
}

function hostAllowed(header: string | undefined): boolean {
  if (header === undefined) {
    return false;
  }
  // Strip the port; `[::1]:4747` keeps its brackets so the bracketed form is what is compared.
  const name = header.replace(/:\d+$/, '');
  return ALLOWED_HOSTS.has(name);
}

function render(path: string, db: Database, config: BotConfig): string | null {
  const issueUrl = (key: string): string => `${config.jira.baseUrl}/browse/${key}`;
  const snapshot = readSnapshot(db, { jira: config.jira.me, github: config.github.me });

  switch (path) {
    case '/':
      return pushPage(detect(snapshot, systemClock(), config.thresholds), {
        issueUrl,
        pullRequestUrl: (repo, number) =>
          snapshot.pullRequests.find((pr) => pr.repo === repo && pr.number === number)?.url ?? null,
      });
    case '/tickets':
      return ticketsPage(snapshot.issues, issueUrl);
    case '/prs':
      return pullRequestsPage(snapshot.pullRequests, config.github.me);
    case '/sprint':
      return sprintPage(
        snapshot.activeSprint,
        snapshot.issues.filter((issue) => snapshot.sprintIssueKeys.includes(issue.key)),
        issueUrl,
      );
    case '/activity':
      return activityPage(readRecentEvents(db, 100), readLastRun(db));
    default:
      return null;
  }
}

function send(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    // The dashboard renders no untrusted script and loads nothing remote; say so explicitly.
    // `form-action` is needed because `default-src 'none'` would otherwise block our own
    // action forms from submitting.
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}
