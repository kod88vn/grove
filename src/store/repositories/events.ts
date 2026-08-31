import type { DatabaseSync } from 'node:sqlite';

export type SubjectKind = 'issue' | 'pull_request' | 'branch' | 'sprint';

export interface BotEvent {
  readonly at: string;
  /** e.g. `pr.merged`, `issue.status_changed`, `pr.review_requested_of_me`. */
  readonly kind: string;
  readonly subjectKind: SubjectKind;
  /** `WS-6316`, or `clover/web-storefront-engine#2390`. */
  readonly subjectId: string;
  readonly detail: Record<string, unknown>;
}

export function appendEvents(
  db: DatabaseSync,
  events: readonly BotEvent[],
  syncRunId: number | null,
): void {
  const insert = db.prepare(
    `INSERT INTO events (at, kind, subject_kind, subject_id, detail, sync_run_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const event of events) {
    insert.run(
      event.at,
      event.kind,
      event.subjectKind,
      event.subjectId,
      JSON.stringify(event.detail),
      syncRunId,
    );
  }
}

export function readRecentEvents(db: DatabaseSync, limit = 100): BotEvent[] {
  const rows = db
    .prepare(
      `SELECT at, kind, subject_kind, subject_id, detail
       FROM events ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as unknown as {
    at: string;
    kind: string;
    subject_kind: string;
    subject_id: string;
    detail: string;
  }[];
  return rows.map((r) => ({
    at: r.at,
    kind: r.kind,
    subjectKind: r.subject_kind as SubjectKind,
    subjectId: r.subject_id,
    detail: JSON.parse(r.detail) as Record<string, unknown>,
  }));
}

/**
 * Mark a subject as read.
 *
 * Absence of a row means unseen, so anything new is unseen without needing a write. This is
 * the only per-subject state owned locally that a re-sync must not touch.
 */
export function markSeen(
  db: DatabaseSync,
  subjectKind: SubjectKind,
  subjectId: string,
  seenAt: string,
): void {
  db.prepare(
    `INSERT INTO seen (subject_kind, subject_id, seen_at) VALUES (?, ?, ?)
     ON CONFLICT(subject_kind, subject_id) DO UPDATE SET seen_at = excluded.seen_at`,
  ).run(subjectKind, subjectId, seenAt);
}

export function readSeenAt(
  db: DatabaseSync,
  subjectKind: SubjectKind,
  subjectId: string,
): string | null {
  const row = db
    .prepare('SELECT seen_at FROM seen WHERE subject_kind = ? AND subject_id = ?')
    .get(subjectKind, subjectId) as unknown as { seen_at: string } | undefined;
  return row === undefined ? null : row.seen_at;
}
