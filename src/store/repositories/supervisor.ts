import type { DatabaseSync } from 'node:sqlite';
import type {
  SupervisorItem,
  SupervisorEvent,
  SupervisorDispatch,
  SupervisorState,
  SupervisorDesired,
  SupervisorSource,
  SupervisorCloseOn,
} from '../../core/model/supervisor.ts';

interface ItemRow {
  readonly id: number;
  readonly key: string;
  readonly source: string;
  readonly repo: string;
  readonly state: string;
  readonly desired: string;
  readonly bounce_count: number;
  readonly close_on: string;
  readonly loop_run_id: number | null;
  readonly brief: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface EventRow {
  readonly id: number;
  readonly item_key: string;
  readonly at: string;
  readonly event_type: string;
  readonly from_state: string | null;
  readonly to_state: string | null;
  readonly evidence: string;
  readonly details_json: string | null;
}

interface DispatchRow {
  readonly id: number;
  readonly item_key: string;
  readonly dispatched_at: string;
  readonly session_path: string | null;
  readonly tier: string;
  readonly model: string;
  readonly agent_variant: string;
  readonly attempt: number;
  readonly nonce: string;
}

function toItem(row: ItemRow): SupervisorItem {
  return {
    id: row.id,
    key: row.key,
    source: row.source as SupervisorSource,
    repo: row.repo,
    state: row.state as SupervisorState,
    desired: row.desired as SupervisorDesired,
    bounceCount: row.bounce_count,
    closeOn: row.close_on as SupervisorCloseOn,
    loopRunId: row.loop_run_id,
    brief: row.brief,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: EventRow): SupervisorEvent {
  return {
    id: row.id,
    itemKey: row.item_key,
    at: row.at,
    eventType: row.event_type,
    fromState: row.from_state as SupervisorState | null,
    toState: row.to_state as SupervisorState | null,
    evidence: row.evidence,
    detailsJson: row.details_json,
  };
}

function toDispatch(row: DispatchRow): SupervisorDispatch {
  return {
    id: row.id,
    itemKey: row.item_key,
    dispatchedAt: row.dispatched_at,
    sessionPath: row.session_path,
    tier: row.tier,
    model: row.model,
    agentVariant: row.agent_variant,
    attempt: row.attempt,
    nonce: row.nonce,
  };
}

export class SupervisorRepository {
  constructor(private readonly db: DatabaseSync) {}

  addItem(item: {
    key: string;
    source: SupervisorSource;
    repo: string;
    closeOn: SupervisorCloseOn;
    brief?: string;
  }): SupervisorItem {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO supervisor_items (key, source, repo, state, desired, bounce_count, close_on, brief, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', 'run', 0, ?, ?, ?, ?)`
      )
      .run(item.key, item.source, item.repo, item.closeOn, item.brief ?? '', now, now);

    return this.getItem(item.key)!;
  }

  getItem(key: string): SupervisorItem | null {
    const row = this.db.prepare('SELECT * FROM supervisor_items WHERE key = ?').get(key) as
      | ItemRow
      | undefined;
    return row ? toItem(row) : null;
  }

  listItems(filter?: { state?: SupervisorState; repo?: string }): readonly SupervisorItem[] {
    let sql = 'SELECT * FROM supervisor_items WHERE 1=1';
    const params: (string | number)[] = [];
    if (filter?.state) {
      sql += ' AND state = ?';
      params.push(filter.state);
    }
    if (filter?.repo) {
      sql += ' AND repo = ?';
      params.push(filter.repo);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = this.db.prepare(sql).all(...params) as unknown as ItemRow[];
    return rows.map(toItem);
  }

  updateState(key: string, toState: SupervisorState, evidence = '', eventType = 'transition'): void {
    const now = new Date().toISOString();
    const item = this.getItem(key);
    if (!item) return;

    this.db.prepare('UPDATE supervisor_items SET state = ?, updated_at = ? WHERE key = ?').run(
      toState,
      now,
      key
    );

    this.addEvent({
      itemKey: key,
      eventType,
      fromState: item.state,
      toState,
      evidence,
    });
  }

  setDesired(key: string, desired: SupervisorDesired): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE supervisor_items SET desired = ?, updated_at = ? WHERE key = ?')
      .run(desired, now, key);
  }

  addEvent(event: {
    itemKey: string;
    eventType: string;
    fromState?: SupervisorState | null;
    toState?: SupervisorState | null;
    evidence?: string;
    detailsJson?: string | null;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO supervisor_events (item_key, at, event_type, from_state, to_state, evidence, details_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.itemKey,
        now,
        event.eventType,
        event.fromState ?? null,
        event.toState ?? null,
        event.evidence ?? '',
        event.detailsJson ?? null
      );
  }

  listEvents(itemKey: string): readonly SupervisorEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM supervisor_events WHERE item_key = ? ORDER BY at ASC')
      .all(itemKey) as unknown as EventRow[];
    return rows.map(toEvent);
  }

  addDispatch(dispatch: {
    itemKey: string;
    sessionPath?: string | null;
    tier: string;
    model: string;
    agentVariant: string;
    attempt?: number;
    nonce: string;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO supervisor_dispatches (item_key, dispatched_at, session_path, tier, model, agent_variant, attempt, nonce)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        dispatch.itemKey,
        now,
        dispatch.sessionPath ?? null,
        dispatch.tier,
        dispatch.model,
        dispatch.agentVariant,
        dispatch.attempt ?? 1,
        dispatch.nonce
      );
  }

  listDispatches(itemKey: string): readonly SupervisorDispatch[] {
    const rows = this.db
      .prepare('SELECT * FROM supervisor_dispatches WHERE item_key = ? ORDER BY dispatched_at ASC')
      .all(itemKey) as unknown as DispatchRow[];
    return rows.map(toDispatch);
  }

  updateHeartbeat(pid: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO supervisor_heartbeat (id, last_tick_at, pid)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET last_tick_at = excluded.last_tick_at, pid = excluded.pid`
      )
      .run(now, pid);
  }

  getHeartbeat(): { lastTickAt: string; pid: number } | null {
    const row = this.db.prepare('SELECT last_tick_at, pid FROM supervisor_heartbeat WHERE id = 1').get() as
      | { last_tick_at: string; pid: number }
      | undefined;
    return row ? { lastTickAt: row.last_tick_at, pid: row.pid } : null;
  }
}
