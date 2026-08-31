import { detect } from '../stalls/detect.ts';
import { openDatabase } from '../store/database.ts';
import { readSnapshot } from '../store/repositories/snapshot.ts';
import { loadConfig, systemClock } from './config.ts';
import type { Stall } from '../core/model/stall.ts';

/** Read the mirror and report what has stopped moving. */
export function runStalls(): Stall[] {
  const config = loadConfig();
  const db = openDatabase({ path: config.databasePath });
  try {
    const snapshot = readSnapshot(db, {
      jira: config.jira.me,
      github: config.github.me,
    });
    return detect(snapshot, systemClock());
  } finally {
    db.close();
  }
}
