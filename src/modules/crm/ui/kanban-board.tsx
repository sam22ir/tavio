'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('crm.ui');
  // Card subtitle: partner name and days spent in the current stage.
  const cards = rows.map((r) => {
    const days = typeof r.daysInStage === 'number' ? r.daysInStage : null;
    const parts = [
      typeof r.partnerName === 'string' && r.partnerName ? r.partnerName : null,
      days === null ? null : t('daysInStage', { count: days }),
    ].filter((p): p is string => p !== null);
    return { ...r, kanbanSubtitle: parts.join(' · ') || null };
  });
  return (
    <Kanban
      entity={leadEntity}
      columns={columns}
      rows={cards}
      onMove={(id, stageId) => move({ id, stageId })}
      rowHref={(r) => `${basePath}/${r.id}`}
    />
  );
}
