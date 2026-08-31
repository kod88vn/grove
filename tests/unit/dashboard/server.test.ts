import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { DEFAULT_THRESHOLDS } from '../../../src/core/model/stall.ts';
import { createDashboard } from '../../../dashboard/server.ts';
import { openDatabase } from '../../../src/store/database.ts';
import { upsertIssue } from '../../../src/store/repositories/issues.ts';
import type { BotConfig } from '../../../src/config/config.ts';
import type { Issue } from '../../../src/core/model/issue.ts';

/** A ticket summary containing markup, which is what a real Jira summary is free to contain. */
const HOSTILE_SUMMARY = '<script>alert(1)</script> & "quoted"';

const directory = mkdtempSync(join(tmpdir(), 'bot-dashboard-'));
const databasePath = join(directory, 'test.db');

const config: BotConfig = {
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

function hostileIssue(): Issue {
  return {
    key: 'WS-1',
    summary: HOSTILE_SUMMARY,
    status: 'Open',
    resolution: null,
    issueType: 'Task',
    priority: null,
    assignee: { name: 'jay.quach', displayName: 'Jay Quach' },
    reporter: null,
    created: '2026-08-01T00:00:00.000Z',
    updated: '2026-08-01T00:00:00.000Z',
    resolvedAt: null,
    epicKey: null,
    sprint: null,
    labels: [],
    fixVersions: [],
  };
}

let server: Server;
let origin: string;
let port: number;

/**
 * Issue a request with an explicit Host header.
 *
 * `fetch` silently drops `host` because it is a forbidden header name, so a test written with
 * fetch would pass without ever exercising the check.
 */
function getWithHost(path: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, method: 'GET', headers: { host } },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  const db = openDatabase({ path: databasePath });
  upsertIssue(db, { value: hostileIssue(), raw: '{}' }, true);
  db.close();

  server = createDashboard({ config, port: 0 });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  port = address.port;
  origin = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  rmSync(directory, { recursive: true, force: true });
});

describe('dashboard routing', () => {
  it('serves the landing page', async () => {
    const response = await fetch(`${origin}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Needs a push');
  });

  it('serves every page in the nav', async () => {
    for (const path of ['/tickets', '/prs', '/sprint', '/activity']) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status, path).toBe(200);
    }
  });

  it('returns 404 for an unknown path', async () => {
    const response = await fetch(`${origin}/nope`);
    expect(response.status).toBe(404);
  });
});

describe('dashboard hardening', () => {
  it('refuses a request whose Host is not loopback', async () => {
    // A page on the internet can resolve its own hostname to 127.0.0.1 and read the response;
    // binding to loopback alone does not stop that, so the Host header is pinned.
    expect(await getWithHost('/', 'evil.example.com')).toBe(403);
  });

  it('still answers on localhost and on an explicit port', async () => {
    expect(await getWithHost('/', `localhost:${port}`)).toBe(200);
    expect(await getWithHost('/', `127.0.0.1:${port}`)).toBe(200);
  });

  it('refuses methods other than reading and the one write route', async () => {
    // POST is legal on /act alone; every other verb is rejected outright.
    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      const response = await fetch(`${origin}/`, { method });
      expect(response.status, method).toBe(405);
    }
  });

  it('escapes markup coming from ticket data', async () => {
    const body = await (await fetch(`${origin}/tickets`)).text();
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('<script>alert(1)</script>');
  });

  it('sends a content security policy that forbids script', async () => {
    const response = await fetch(`${origin}/`);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
