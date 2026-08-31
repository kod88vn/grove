import type { Capability } from '../../core/model/action.ts';
import type { Database } from '../database.ts';

/**
 * The audit trail.
 *
 * A row is written *before* the mutation is attempted, not after. If this process dies
 * mid-merge the row survives as `applied_pending`, which is recoverable; the alternative is a
 * merge that happened with no record that anything asked for it.
 */

export type ActionStatus = 'proposed' | 'refused' | 'applied' | 'failed';

export interface ActionRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly capability: Capability;
  readonly payload: unknown;
  readonly reason: string;
  readonly stallId: string | null;
  readonly status: ActionStatus;
  /** Names the human decision that permitted this. Never null on an applied row. */
  readonly authorizedBy: string | null;
  readonly executedAt: string | null;
  readonly outcome: string | null;
}

export interface NewAction {
  readonly id: string;
  readonly createdAt: string;
  readonly capability: Capability;
  readonly payload: unknown;
  readonly reason: string;
  readonly stallId: string | null;
  readonly authorizedBy: string;
}

const COLUMNS = `id, created_at, capability, payload, reason, stall_id, status,
  authorized_by, executed_at, outcome`;

/** Record the intent to act. Always call this before touching a remote system. */
export function recordProposal(db: Database, action: NewAction): void {
  db.prepare(
    `INSERT INTO actions (id, created_at, capability, payload, reason, stall_id, status,
       authorized_by)
     VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?)`,
  ).run(
    action.id,
    action.createdAt,
    action.capability,
    JSON.stringify(action.payload),
    action.reason,
    action.stallId,
    action.authorizedBy,
  );
}

export interface Outcome {
  readonly id: string;
  readonly status: Exclude<ActionStatus, 'proposed'>;
  readonly executedAt: string;
  readonly outcome: string;
}

/** Close out an action with what actually happened. */
export function recordOutcome(db: Database, result: Outcome): void {
  db.prepare(`UPDATE actions SET status = ?, executed_at = ?, outcome = ? WHERE id = ?`).run(
    result.status,
    result.executedAt,
    result.outcome,
    result.id,
  );
}

export function readRecentActions(db: Database, limit = 50): ActionRecord[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM actions ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Record<string, string | null>[];
  return rows.map(toAction);
}

function toAction(row: Record<string, string | null>): ActionRecord {
  return {
    id: String(row['id']),
    createdAt: String(row['created_at']),
    capability: String(row['capability']) as Capability,
    payload: JSON.parse(String(row['payload'])) as unknown,
    reason: String(row['reason']),
    stallId: row['stall_id'] ?? null,
    status: String(row['status']) as ActionStatus,
    authorizedBy: row['authorized_by'] ?? null,
    executedAt: row['executed_at'] ?? null,
    outcome: row['outcome'] ?? null,
  };
}
