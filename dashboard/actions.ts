import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { BotConfig } from '../src/config/config.ts';
import { systemClock } from '../src/config/config.ts';
import { GitHubClient } from '../src/connectors/github/client.ts';
import { JiraClient } from '../src/connectors/jira/client.ts';
import type { ActionPayload } from '../src/core/model/action.ts';
import { execute } from '../src/executor/executor.ts';
import { prepareResolve } from '../src/executor/prepare.ts';
import type { Database } from '../src/store/database.ts';
import { readIssue } from '../src/store/repositories/issues.ts';

/**
 * Turning a button press into a mutation.
 *
 * Two defences, because the Host pin alone is not enough. Pinning Host stops a page that
 * resolves its own hostname to loopback, but nothing stops a public page from POSTing a form
 * straight at `http://127.0.0.1:4747` — that request carries an allowed Host. So every form
 * also carries a token minted at startup and never sent anywhere else, and the Origin header
 * must match if the browser supplies one.
 */

/** Minted per process. A form from a previous run is worthless, which is the intent. */
export const CSRF_TOKEN = randomUUID();

/** Named on every audit row written from here. There is no machine-authorized path. */
const AUTHORIZED_BY = 'human:dashboard';

export interface ActionResult {
  readonly ok: boolean;
  readonly message: string;
}

export async function performAction(
  form: URLSearchParams,
  db: Database,
  config: BotConfig,
): Promise<ActionResult> {
  if (form.get('token') !== CSRF_TOKEN) {
    return { ok: false, message: 'Stale or forged form: token does not match this process.' };
  }
  const jira = new JiraClient(
    { baseUrl: config.jira.baseUrl, token: config.jira.token },
    config.jira.boardId,
  );
  const github = new GitHubClient({ me: config.github.me, projectKeys: config.jira.projectKeys });
  const built = await build(form, jira, db);
  if (built === null) {
    return { ok: false, message: 'That action is no longer available.' };
  }
  const result = await execute(
    {
      db,
      github,
      jira,
      identity: { jira: config.jira.me, github: config.github.me },
      clock: systemClock(),
    },
    {
      action: built,
      stallId: form.get('stall'),
      authorizedBy: AUTHORIZED_BY,
      reason: form.get('reason') ?? 'requested from the dashboard',
    },
  );
  return result.ok
    ? { ok: true, message: result.outcome }
    : { ok: false, message: `Refused: ${result.refused.because}` };
}

async function build(
  form: URLSearchParams,
  jira: JiraClient,
  db: Database,
): Promise<ActionPayload | null> {
  const kind = form.get('do');
  if (kind === 'merge') {
    const repo = form.get('repo');
    const number = Number(form.get('number'));
    return repo === null || !Number.isInteger(number)
      ? null
      : { capability: 'github:pr-merge', payload: { repo, number, method: 'squash' } };
  }
  if (kind === 'resolve') {
    const key = form.get('issue');
    // Confirm the mirror knows the ticket before calling Jira. A stale or hand-crafted form
    // should not be able to make this process issue requests about arbitrary issue keys.
    if (key === null || readIssue(db, key) === null) {
      return null;
    }
    // Read the workflow live rather than assuming a transition id. Screens change.
    const prepared = await prepareResolve(jira, key);
    return prepared === null || prepared.unfilled.length > 0 ? null : prepared.action;
  }
  return null;
}

/** Read a form body, refusing anything large enough to be an attack rather than a click. */
export function readBody(request: IncomingMessage, limit = 8192): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
      if (body.length > limit) {
        reject(new Error('body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      resolve(new URLSearchParams(body));
    });
    request.on('error', reject);
  });
}

/**
 * Whether a cross-site page sent this.
 *
 * Compared against the Host header rather than a configured port, because the port is only
 * known once the socket is bound — with `--port=0` a configured value is simply wrong, and a
 * comparison that never matches is a comparison nobody will trust for long. Host has already
 * been pinned to loopback by the time this runs, so trusting it here adds nothing new.
 *
 * A missing Origin is permitted: curl sends none, and the token still has to be right.
 */
export function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (origin === undefined) {
    return true;
  }
  return host !== undefined && origin === `http://${host}`;
}
