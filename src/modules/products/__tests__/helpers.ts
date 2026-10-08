import type { ListQuery } from '@/core/entities/types';

export function defaultListQuery(): ListQuery {
  return { page: 1, pageSize: 25, filters: {} };
}
