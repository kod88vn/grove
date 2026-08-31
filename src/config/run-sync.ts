import { GitHubClient } from '../connectors/github/client.ts';
import { JiraClient } from '../connectors/jira/client.ts';
import { openDatabase } from '../store/database.ts';
import { sync, type SyncOptions, type SyncOutcome } from '../sync/sync.ts';
import { loadConfig } from './config.ts';

/**
 * Build every dependency the sync engine needs and run it.
 *
 * This is the only place that knows how to construct the real clients, which keeps the sync
 * engine itself testable with fakes rather than requiring a network.
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncOutcome> {
  const config = loadConfig();
  const db = openDatabase({ path: config.databasePath });
  try {
    return await sync(
      {
        db,
        config,
        jira: new JiraClient(
          { baseUrl: config.jira.baseUrl, token: config.jira.token },
          config.jira.boardId,
        ),
        github: new GitHubClient({
          me: config.github.me,
          projectKeys: config.jira.projectKeys,
        }),
        now: () => new Date(),
      },
      options,
    );
  } finally {
    db.close();
  }
}
