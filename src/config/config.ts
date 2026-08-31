import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Clock } from '../core/clock.ts';
import { DEFAULT_THRESHOLDS, type StallThresholds } from '../core/model/stall.ts';

/**
 * The real clock.
 *
 * It lives here rather than in `src/core/` because reading the time is exactly the kind of
 * ambient dependency that makes the stall rules untestable. Core takes a `Clock`; only an
 * entrypoint is allowed to supply the one that moves.
 */
export function systemClock(): Clock {
  return { now: () => Date.now() };
}

export interface WatchedRepo {
  /** `owner/name` as GitHub knows it. */
  readonly fullName: string;
  /** Absolute path to a local clone, or null when only the remote is tracked. */
  readonly path: string | null;
}

export interface Config {
  readonly jira: {
    readonly baseUrl: string;
    readonly token: string;
    readonly boardId: number;
    readonly projectKeys: readonly string[];
    /** Jira username, e.g. `jay.quach`. */
    readonly me: string;
  };
  readonly github: {
    /** GitHub login, e.g. `jay-quach`. */
    readonly me: string;
  };
  readonly repos: readonly WatchedRepo[];
  readonly databasePath: string;
  readonly thresholds: StallThresholds;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const DEFAULT_REPOS = [
  'clover/web-storefront-engine',
  'clover/web-storefront-retail',
  'clover/web-storefront-services',
  'clover/web-storefront-ui',
  'clover/web-lib-RRS',
] as const;

/**
 * Build configuration from the environment.
 *
 * The token is the only value with no default. Everything else falls back to the verified
 * values for this machine so that `cc` runs with no setup, while an override stays possible
 * for a second board or a different checkout root.
 *
 * `requireToken: false` is for the read-only paths. The MCP server and the dashboard's read
 * pages answer entirely from the local mirror and never call Jira, so demanding a secret they
 * do not use would make them fail to start in exactly the environments most likely to lack
 * it — a task or MCP client spawned in a non-interactive shell that never sourced a profile.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  requireToken = true,
): Config {
  const token = env['JIRA_DC_TOKEN'] ?? '';
  if (requireToken && token === '') {
    throw new ConfigError(
      'JIRA_DC_TOKEN is not set. Export it in your shell profile; it is never stored.',
    );
  }

  const checkoutRoot = env['CC_CHECKOUT_ROOT'] ?? join(homedir(), 'dev');

  return {
    jira: {
      baseUrl: env['CC_JIRA_URL'] ?? 'https://jira.corp.clover.com',
      token,
      boardId: intFromEnv(env['CC_JIRA_BOARD'], 1386),
      projectKeys: (env['CC_JIRA_PROJECTS'] ?? 'WS').split(',').map((key) => key.trim()),
      me: env['CC_JIRA_USER'] ?? 'jay.quach',
    },
    github: {
      me: env['CC_GITHUB_USER'] ?? 'jay-quach',
    },
    repos: watchedRepos(env['CC_REPOS'], checkoutRoot),
    databasePath: env['CC_DB'] ?? resolve(process.cwd(), 'data/central-command.db'),
    thresholds: DEFAULT_THRESHOLDS,
  };
}

function watchedRepos(raw: string | undefined, checkoutRoot: string): WatchedRepo[] {
  const names = raw === undefined ? [...DEFAULT_REPOS] : raw.split(',').map((n) => n.trim());
  return names
    .filter((fullName) => fullName !== '')
    .map((fullName) => ({
      fullName,
      // A local clone is optional: a repo can be watched through the API alone. The branch
      // stalls simply stay quiet for repos with no checkout.
      path: join(checkoutRoot, fullName.split('/').at(-1) ?? fullName),
    }));
}

function intFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new ConfigError(`Expected an integer but got "${raw}"`);
  }
  return parsed;
}
