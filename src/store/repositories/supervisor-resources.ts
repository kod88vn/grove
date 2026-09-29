import type { DatabaseSync } from 'node:sqlite';
import type { ResourceType, CleanupStatus, SupervisorResource } from '../../core/model/supervisor.ts';

interface ResourceRow {
  readonly id: number;
  readonly item_key: string;
  readonly resource_type: string;
  readonly identifier: string;
  readonly created_at: string;
  readonly cleaned_at: string | null;
  readonly cleanup_status: string;
}

function toResource(row: ResourceRow): SupervisorResource {
  return {
    id: row.id,
    itemKey: row.item_key,
    resourceType: row.resource_type as ResourceType,
    identifier: row.identifier,
    createdAt: row.created_at,
    cleanedAt: row.cleaned_at,
    cleanupStatus: row.cleanup_status as CleanupStatus,
  };
}

export class SupervisorResourceRepository {
  constructor(private readonly db: DatabaseSync) {}

  registerResource(resource: {
    itemKey: string;
    resourceType: ResourceType;
    identifier: string;
  }): SupervisorResource {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `INSERT INTO supervisor_resources (item_key, resource_type, identifier, created_at, cleanup_status)
         VALUES (?, ?, ?, ?, 'pending')`
      )
      .run(resource.itemKey, resource.resourceType, resource.identifier, now);

    const id = Number(res.lastInsertRowid);
    const row = this.db.prepare('SELECT * FROM supervisor_resources WHERE id = ?').get(id) as
      | ResourceRow
      | undefined;
    return toResource(row!);
  }

  listPendingResources(itemKey?: string): readonly SupervisorResource[] {
    let sql = "SELECT * FROM supervisor_resources WHERE cleanup_status = 'pending'";
    const params: (string | number)[] = [];
    if (itemKey) {
      sql += ' AND item_key = ?';
      params.push(itemKey);
    }
    const rows = this.db.prepare(sql).all(...params) as unknown as ResourceRow[];
    return rows.map(toResource);
  }

  markResourceCleaned(id: number, status: 'cleaned' | 'failed' = 'cleaned'): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE supervisor_resources SET cleaned_at = ?, cleanup_status = ? WHERE id = ?')
      .run(now, status, id);
  }
}
