import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { DEFAULT_THRESHOLDS } from '../../../src/core/model/stall.ts';
import { createDashboard } from '../../../dashboard/server.ts';
import { CSRF_TOKEN, originAllowed } from '../../../dashboard/actions.ts';
import { openDatabase } from '../../../src/store/database.ts';
import { readRecentActions } from '../../../src/store/repositories/actions.ts';
import type { Config } from '../../../src/config/config.ts';

/**
 * The write path.
 *
 * These tests exist to prove the refusals happen, because a refusal that silently stops
 * working looks exactly like an action nobody happened to click. Nothing here reaches the
 * network: every case is rejected before the executor would call a client.
 */

const directory = mkdtempSync(join(tmpdir(), 'cc-actions-'));
const databasePath = join(directory, 'test.db');

const config: Config = {
  jira: {
    baseUrl: 'https://jira.example.invalid',
    token: 'unused',
    boardId: 1,
    projectKeys: ['WS'],
    me: 'jay.quach',
  },
  github: { me: 'jay-quach' },
  repos: [],
  databasePath,
  thresholds: DEFAULT_THRESHOLDS,
};

let server: Server;
let port: number;

interface Response {
  readonly status: number;
  readonly body: string;
}

function post(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/act',
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (response) => {
        let text = '';
        response.on('data', (chunk: Buffer) => {
          text += chunk.toString('utf8');
        });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: text });
        });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

beforeAll(async () => {
  openDatabase({ path: databasePath }).close();
  server = createDashboard({ config, port: 0 });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  rmSync(directory, { recursive: true, force: true });
});

describe('originAllowed', () => {
  it('accepts a form submitted from our own page', () => {
    expect(originAllowed('http://127.0.0.1:4747', '127.0.0.1:4747')).toBe(true);
  });

  it('refuses a form submitted from anywhere else', () => {
    expect(originAllowed('https://evil.example.com', '127.0.0.1:4747')).toBe(false);
  });

  it('permits a request with no Origin at all, since curl sends none', () => {
    expect(originAllowed(undefined, '127.0.0.1:4747')).toBe(true);
  });
});

describe('POST /act', () => {
  it('refuses a request carrying a foreign Origin', async () => {
    const response = await post(`do=merge&token=${CSRF_TOKEN}&repo=clover/x&number=1`, {
      origin: 'https://evil.example.com',
    });
    expect(response.status).toBe(403);
  });

  it('refuses a form with no token, which is what a cross-site POST would look like', async () => {
    const response = await post('do=merge&repo=clover/x&number=1');
    expect(response.status).toBe(409);
    expect(response.body).toContain('token does not match');
  });

  it('refuses a token from a previous process', async () => {
    const stale = '00000000-0000-4000-8000-000000000000';
    const response = await post(`do=merge&token=${stale}&repo=clover/x&number=1`);
    expect(response.body).toContain('token does not match');
  });

  it('refuses an unknown verb even with a valid token', async () => {
    const response = await post(`do=delete-everything&token=${CSRF_TOKEN}`);
    expect(response.status).toBe(409);
    expect(response.body).toContain('no longer available');
  });

  it('refuses to resolve a ticket the mirror has never heard of', async () => {
    const response = await post(`do=resolve&token=${CSRF_TOKEN}&issue=WS-99999`);
    expect(response.status).toBe(409);
  });

  it('writes no audit row for anything it refused before proposing', async () => {
    // A refusal at the token or shape stage never became an action, so it must leave no trace.
    // Only refusals from the executor's own guards are audited.
    const db = openDatabase({ path: databasePath });
    const merges = readRecentActions(db).filter((a) => a.capability === 'github:pr-merge');
    db.close();
    expect(merges).toHaveLength(0);
  });

  it('404s a POST to any path other than /act', async () => {
    const response = await new Promise<number>((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port, path: '/tickets', method: 'POST' },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      req.end();
    });
    expect(response).toBe(404);
  });
});
