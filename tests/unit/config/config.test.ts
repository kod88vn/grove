import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../../src/config/config.ts';

const MINIMAL = { JIRA_DC_TOKEN: 'test-token' } satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('refuses to run without a Jira token rather than failing later at request time', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ JIRA_DC_TOKEN: '' })).toThrow(/JIRA_DC_TOKEN/);
  });

  it('loads without a token for read-only callers, which never reach Jira', () => {
    const config = loadConfig({}, false);
    expect(config.jira.token).toBe('');
    expect(config.jira.boardId).toBe(1386);
  });

  it('defaults to the verified board and host for this machine', () => {
    const config = loadConfig(MINIMAL);
    expect(config.jira.baseUrl).toBe('https://jira.corp.clover.com');
    expect(config.jira.boardId).toBe(1386);
    expect(config.jira.projectKeys).toEqual(['WS']);
    expect(config.jira.me).toBe('jay.quach');
    expect(config.github.me).toBe('jay-quach');
  });

  it('derives a local clone path per repo from the checkout root', () => {
    const config = loadConfig({
      ...MINIMAL,
      CC_CHECKOUT_ROOT: '/tmp/src',
      CC_REPOS: 'clover/web-storefront-engine,clover/web-lib-RRS',
    });
    expect(config.repos).toEqual([
      { fullName: 'clover/web-storefront-engine', path: '/tmp/src/web-storefront-engine' },
      { fullName: 'clover/web-lib-RRS', path: '/tmp/src/web-lib-RRS' },
    ]);
  });

  it('tolerates whitespace and trailing separators in list settings', () => {
    const config = loadConfig({ ...MINIMAL, CC_REPOS: ' a/b , c/d ,', CC_JIRA_PROJECTS: 'WS, SV' });
    expect(config.repos.map((r) => r.fullName)).toEqual(['a/b', 'c/d']);
    expect(config.jira.projectKeys).toEqual(['WS', 'SV']);
  });

  it('rejects a non-numeric board rather than silently watching board NaN', () => {
    expect(() => loadConfig({ ...MINIMAL, CC_JIRA_BOARD: 'storefront' })).toThrow(/integer/);
  });

  it('carries the default stall thresholds', () => {
    expect(loadConfig(MINIMAL).thresholds.prAwaitingReviewDays).toBe(2);
  });
});
