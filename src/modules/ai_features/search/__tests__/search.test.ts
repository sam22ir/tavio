import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/adapters/ai', () => ({ getAi: vi.fn(), parseJsonReply: vi.fn() }));
vi.mock('@/core/ai/usage', () => ({
  recordAiUsage: vi.fn(async () => undefined),
  assertAiQuota: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock('@/modules/contacts/service/partners', () => ({ listPartners: vi.fn() }));
vi.mock('@/modules/products/service/products', () => ({ listProducts: vi.fn() }));
vi.mock('@/modules/credit_sales/service/contracts', () => ({ listContracts: vi.fn() }));

import { getAi, parseJsonReply } from '@/core/adapters/ai';
import { listPartners } from '@/modules/contacts/service/partners';
import { listProducts } from '@/modules/products/service/products';
import { listContracts } from '@/modules/credit_sales/service/contracts';
import { searchQuery } from '../search';

const ctx = { userId: 'u', companyId: 'c', perms: new Set<string>(), locale: 'fr', tx: {} } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listPartners).mockResolvedValue({ ok: true, value: { rows: [{ id: 'p1', displayName: 'Karim' }], total: 1, page: 1, pageSize: 5 } } as never);
  vi.mocked(listProducts).mockResolvedValue({ ok: true, value: { rows: [{ id: 'd1', name: 'Huile' }], total: 1, page: 1, pageSize: 5 } } as never);
  vi.mocked(listContracts).mockResolvedValue({ rows: [{ id: 'k1', reference: 'CR-0007' }], total: 1, page: 1, pageSize: 5 } as never);
});

describe('searchQuery', () => {
  it('runs text search only when AI is off', async () => {
    vi.mocked(getAi).mockReturnValue(null);
    const res = await searchQuery(ctx, 'Karim');
    expect(res.ok && res.value.source).toBe('text');
    expect(res.ok && res.value.hits.map((h) => h.kind)).toEqual(['contact', 'product', 'contract']);
  });

  it('falls back to text search when the AI reply is invalid', async () => {
    vi.mocked(getAi).mockReturnValue({
      name: 'mock', model: 'm', supportsVision: false,
      complete: vi.fn(async () => ({ text: '{"intent":"drop tables"}', inputTokens: 0, outputTokens: 0, model: 'm' })),
    } as never);
    vi.mocked(parseJsonReply).mockReturnValue({ intent: 'drop tables' });
    const res = await searchQuery(ctx, 'Karim');
    expect(res.ok && res.value.href).toBeNull();
    expect(res.ok && res.value.source).toBe('text');
    expect(listPartners).toHaveBeenCalled();
  });

  it('returns a whitelisted href from a valid AI reply', async () => {
    vi.mocked(getAi).mockReturnValue({
      name: 'mock', model: 'm', supportsVision: false,
      complete: vi.fn(async () => ({ text: '{}', inputTokens: 0, outputTokens: 0, model: 'm' })),
    } as never);
    vi.mocked(parseJsonReply).mockReturnValue({ intent: 'navigate', module: 'overdue' });
    const res = await searchQuery(ctx, 'retard');
    expect(res.ok && res.value.href).toBe('/credit/overdue?q=retard');
    expect(res.ok && res.value.source).toBe('ai');
  });
});
