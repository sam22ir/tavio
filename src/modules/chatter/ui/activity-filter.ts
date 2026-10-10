export const ACTIVITY_FILTERS = ['all', 'today', 'overdue', 'planned'] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

/** Anything else falls back to 'all'. */
export function parseActivityFilter(raw: string | undefined): ActivityFilter {
  return (ACTIVITY_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as ActivityFilter) : 'all';
}

/** Whether an activity due on `dueDate` is shown under `filter`, given today's ISO date. */
export function matchesActivityFilter(filter: ActivityFilter, dueDate: string, today: string): boolean {
  switch (filter) {
    case 'today':
      return dueDate === today;
    case 'overdue':
      return dueDate < today;
    case 'planned':
      return dueDate > today;
    default:
      return true;
  }
}

export type DeadlineTone = 'overdue' | 'today' | 'planned';

export function deadlineTone(dueDate: string, today: string): DeadlineTone {
  return dueDate < today ? 'overdue' : dueDate === today ? 'today' : 'planned';
}

export const DEADLINE_CLASS: Record<DeadlineTone, string> = {
  overdue: 'font-medium text-red-600 dark:text-red-400',
  today: 'font-medium text-amber-600 dark:text-amber-400',
  planned: 'text-emerald-600 dark:text-emerald-400',
};
