import { existsSync } from 'node:fs';
import { JiraClient } from '../connectors/jira/client.ts';
import { GitHubClient } from '../connectors/github/client.ts';
import { currentBranch } from '../connectors/git.ts';
import { openDatabase } from '../store/database.ts';
import { currentVersion } from '../store/database.ts';
import { latestVersion } from '../store/migrations/index.ts';
import { loadConfig, ConfigError, type BotConfig } from './config.ts';

export interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * Prove every external dependency works before anything relies on it.
 *
 * Each check reports what it actually found, not just a tick. A doctor that says "Jira: OK"
 * without naming the account it authenticated as cannot distinguish a working token from a
 * working token belonging to somebody else.
 */
export async function doctor(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  let config: BotConfig;
  try {
    config = loadConfig();
    results.push({ name: 'config', ok: true, detail: `board ${config.jira.boardId}, ${config.repos.length} repos` });
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : String(error);
    return [{ name: 'config', ok: false, detail: message }];
  }

  results.push(await checkJira(config));
  results.push(await checkGitHub(config));
  results.push(checkDatabase(config));
  results.push(...(await checkRepos(config)));
  return results;
}

async function checkJira(config: BotConfig): Promise<CheckResult> {
  const client = new JiraClient(
    { baseUrl: config.jira.baseUrl, token: config.jira.token },
    config.jira.boardId,
  );
  try {
    const me = await client.myself();
    const matches = me.name === config.jira.me;
    return {
      name: 'jira',
      ok: matches,
      detail: matches
        ? `authenticated as ${me.name} (${me.displayName})`
        : `token belongs to ${me.name}, but config expects ${config.jira.me}`,
    };
  } catch (error) {
    return { name: 'jira', ok: false, detail: String(error) };
  }
}

async function checkGitHub(config: BotConfig): Promise<CheckResult> {
  const client = new GitHubClient({ me: config.github.me, projectKeys: config.jira.projectKeys });
  try {
    await client.authStatus();
    // Team membership needs `read:org`. Without it every team-routed review request looks like
    // someone else's problem, so it is worth surfacing here rather than discovering it as a
    // mysteriously short review queue.
    const teams = await client.myTeams();
    return {
      name: 'github',
      ok: teams.length > 0,
      detail:
        teams.length > 0
          ? `gh authenticated for ${config.github.me}, teams: ${teams.join(', ')}`
          : `gh authenticated for ${config.github.me} but no teams visible — token likely lacks read:org, which hides team-routed review requests`,
    };
  } catch (error) {
    return { name: 'github', ok: false, detail: String(error) };
  }
}

function checkDatabase(config: BotConfig): CheckResult {
  try {
    const db = openDatabase({ path: config.databasePath });
    const version = currentVersion(db);
    db.close();
    const expected = latestVersion();
    return {
      name: 'database',
      ok: version === expected,
      detail: `${config.databasePath} at schema v${version} (latest v${expected})`,
    };
  } catch (error) {
    return { name: 'database', ok: false, detail: String(error) };
  }
}

async function checkRepos(config: BotConfig): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const repo of config.repos) {
    if (repo.path === null || !existsSync(repo.path)) {
      // Not a failure: a repo can be watched through the API alone.
      results.push({ name: `repo ${repo.fullName}`, ok: true, detail: 'no local clone (remote only)' });
      continue;
    }
    try {
      const branch = await currentBranch(repo.path);
      results.push({ name: `repo ${repo.fullName}`, ok: true, detail: `${repo.path} on ${branch}` });
    } catch (error) {
      results.push({ name: `repo ${repo.fullName}`, ok: false, detail: String(error) });
    }
  }
  return results;
}
