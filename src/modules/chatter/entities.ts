import type { EntityDef } from '@/core/entities/types';

// chatter is a panel, not a page: it has no main entities of its own.
export const entities: readonly EntityDef[] = [];

// Default activity types, inserted per company by the integrator's seed SQL.
export const ACTIVITY_TYPE_SEED = [
  { key: 'call', name: 'Call', defaultDays: 0, icon: 'phone' },
  { key: 'meeting', name: 'Meeting', defaultDays: 0, icon: 'calendar' },
  { key: 'todo', name: 'To do', defaultDays: 1, icon: 'check-square' },
  { key: 'payment_reminder', name: 'Payment reminder', defaultDays: 3, icon: 'bell' },
  { key: 'visit', name: 'Visit', defaultDays: 1, icon: 'map-pin' },
] as const;
