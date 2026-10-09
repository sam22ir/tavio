'use client';

import { Kanban, type KanbanColumn } from './kanban';
import type { Result } from '@/core/result';
import type { EntityDef, Row } from '@/core/entities/types';

/**
 * Kanban usable from server pages: row links are built from a base path string and
 * moves go through a server action, so no plain functions cross the server/client boundary.
 */
export function LinkedKanban({
  entity,
  columns,
  rows,
  basePath,
  onMove,
}: {
  entity: EntityDef;
  columns: KanbanColumn[];
  rows: Row[];
  basePath: string;
  onMove: (rowId: string, toColumn: string) => Promise<Result<unknown>>;
}) {
  return (
    <Kanban
      entity={entity}
      columns={columns}
      rows={rows}
      onMove={onMove}
      rowHref={(r) => `${basePath}/${r.id}`}
    />
  );
}
