import type { DatabaseSync } from 'node:sqlite';
import type { Board, Sprint } from '../../core/model/sprint.ts';

export function upsertBoard(db: DatabaseSync, board: Board, mirroredAt: string): void {
  db.prepare(
    `INSERT INTO boards (id, name, type, columns, mirrored_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type,
       columns = excluded.columns, mirrored_at = excluded.mirrored_at`,
  ).run(board.id, board.name, board.type, JSON.stringify(board.columns), mirroredAt);
}

export function upsertSprint(db: DatabaseSync, sprint: Sprint, mirroredAt: string): void {
  db.prepare(
    `INSERT INTO sprints (id, board_id, name, state, start_date, end_date, complete_date, mirrored_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       board_id = excluded.board_id, name = excluded.name, state = excluded.state,
       start_date = excluded.start_date, end_date = excluded.end_date,
       complete_date = excluded.complete_date, mirrored_at = excluded.mirrored_at`,
  ).run(
    sprint.id,
    sprint.boardId,
    sprint.name,
    sprint.state,
    sprint.startDate,
    sprint.endDate,
    sprint.completeDate,
    mirroredAt,
  );
}

/**
 * Record which issues a sprint contains.
 *
 * Replaced wholesale: an issue pulled out of the sprint leaves no trace upstream, so an
 * additive write would keep reporting it as committed work.
 */
export function replaceSprintIssues(
  db: DatabaseSync,
  sprintId: number,
  issueKeys: readonly string[],
): void {
  db.prepare('DELETE FROM sprint_issues WHERE sprint_id = ?').run(sprintId);
  const insert = db.prepare(
    'INSERT OR REPLACE INTO sprint_issues (sprint_id, issue_key) VALUES (?, ?)',
  );
  for (const key of issueKeys) {
    insert.run(sprintId, key);
  }
}

export function readActiveSprint(db: DatabaseSync): Sprint | null {
  const row = db
    .prepare(
      `SELECT id, board_id, name, state, start_date, end_date, complete_date
       FROM sprints WHERE state = 'active' ORDER BY end_date LIMIT 1`,
    )
    .get();
  return row === undefined ? null : toSprint(row as unknown as SprintRow);
}

interface SprintRow {
  readonly id: number;
  readonly board_id: number;
  readonly name: string;
  readonly state: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly complete_date: string | null;
}

function toSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    state: row.state as Sprint['state'],
    startDate: row.start_date,
    endDate: row.end_date,
    completeDate: row.complete_date,
  };
}
