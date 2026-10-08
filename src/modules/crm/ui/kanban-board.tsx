'use client';

import { Kanban, type KanbanColumn } from '@/ui/views/kanban';
import type { Result } from '@/core/result';
import type { Row } from '@/core/entities/types';
import { leadEntity } from '@/modules/crm/entities';

interface KanbanBoardProps {
  columns: KanbanColumn[];
  rows: Row[];
  basePath: string;
  move: (input: { id: string; stageId: string }) => Promise<Result<unknown>>;
}

export function KanbanBoard({ columns, rows, basePath, move }: KanbanBoardProps) {
  return (
    <Kanban
      entity={leadEntity}
      columns={columns}
      rows={rows}
      onMove={(id, stageId) => move({ id, stageId })}
      rowHref={(r) => `${basePath}/${r.id}`}
    />
  );
}
