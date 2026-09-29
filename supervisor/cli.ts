#!/usr/bin/env -S npx tsx
import { openDatabase } from '../src/store/database.ts';
import { loadConfig } from '../src/config/config.ts';
import { SupervisorRepository } from '../src/store/repositories/supervisor.ts';
import { SupervisorResourceRepository } from '../src/store/repositories/supervisor-resources.ts';
import { Supervisor } from './tick.ts';
import type { SupervisorCloseOn, SupervisorSource } from '../src/core/model/supervisor.ts';

const USAGE = `Usage:
  npm run supervise -- add <key> --repo=<repo> [--source=<manual|plan-file|jira>] [--close-on=<merged|ready>] [--brief="..."]
  npm run supervise -- tick
  npm run supervise -- status
  npm run supervise -- pause <key>
  npm run supervise -- resume <key>
  npm run supervise -- cancel <key>
  npm run supervise -- teardown [key]
`;

export async function supervisorCli(argv: readonly string[]): Promise<number> {
  const config = loadConfig();
  const db = openDatabase({ path: config.databasePath });
  const repo = new SupervisorRepository(db);
  const resourceRepo = new SupervisorResourceRepository(db);
  const supervisor = new Supervisor(repo, resourceRepo);

  const command = argv[0];

  switch (command) {
    case 'add': {
      const key = argv[1];
      if (!key || key.startsWith('--')) {
        process.stderr.write(`Error: missing item key\n${USAGE}`);
        return 1;
      }
      const args = argv.slice(2);
      let repoName = '';
      let source: SupervisorSource = 'manual';
      let closeOn: SupervisorCloseOn = 'merged';
      let brief = '';

      for (const arg of args) {
        if (arg.startsWith('--repo=')) repoName = arg.slice(7);
        else if (arg.startsWith('--source=')) source = arg.slice(9) as SupervisorSource;
        else if (arg.startsWith('--close-on=')) closeOn = arg.slice(11) as SupervisorCloseOn;
        else if (arg.startsWith('--brief=')) brief = arg.slice(8);
      }

      if (!repoName) {
        process.stderr.write(`Error: --repo=<repo> is required\n${USAGE}`);
        return 1;
      }

      const item = repo.addItem({
        key,
        repo: repoName,
        source,
        closeOn,
        brief,
      });

      process.stdout.write(`Added supervisor item: ${item.key} (${item.repo}) [${item.state}]\n`);
      return 0;
    }

    case 'tick': {
      const summary = supervisor.tick();
      process.stdout.write(
        `Supervisor tick: ${summary.itemsChecked} items checked, ${summary.transitions.length} transitions, ${summary.cleanedResources} resources cleaned\n`
      );
      for (const t of summary.transitions) {
        process.stdout.write(`  ${t.key}: ${t.from} -> ${t.to}\n`);
      }
      return 0;
    }

    case 'status': {
      const items = repo.listItems();
      if (items.length === 0) {
        process.stdout.write('No supervisor items found.\n');
        return 0;
      }
      process.stdout.write(`Found ${items.length} supervisor items:\n`);
      for (const item of items) {
        process.stdout.write(
          `  ${item.key} | repo: ${item.repo} | state: ${item.state} | desired: ${item.desired} | close_on: ${item.closeOn}\n`
        );
      }
      return 0;
    }

    case 'pause': {
      const key = argv[1];
      if (!key) {
        process.stderr.write('Error: missing item key to pause\n');
        return 1;
      }
      repo.setDesired(key, 'paused');
      process.stdout.write(`Set desired=paused for ${key}\n`);
      return 0;
    }

    case 'resume': {
      const key = argv[1];
      if (!key) {
        process.stderr.write('Error: missing item key to resume\n');
        return 1;
      }
      repo.setDesired(key, 'run');
      process.stdout.write(`Set desired=run for ${key}\n`);
      return 0;
    }

    case 'cancel': {
      const key = argv[1];
      if (!key) {
        process.stderr.write('Error: missing item key to cancel\n');
        return 1;
      }
      repo.setDesired(key, 'cancelled');
      supervisor.tick();
      process.stdout.write(`Cancelled and tore down ${key}\n`);
      return 0;
    }

    case 'teardown': {
      const key = argv[1];
      const cleanupMgr = supervisor.getCleanupManager();
      const results = key ? cleanupMgr.teardownItem(key) : cleanupMgr.teardownAllPending();
      process.stdout.write(`Torn down ${results.length} resources (${results.filter((r) => r.success).length} succeeded)\n`);
      return 0;
    }

    default:
      process.stdout.write(USAGE);
      return 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  supervisorCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
