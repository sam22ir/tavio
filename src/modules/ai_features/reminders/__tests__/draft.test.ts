import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/adapters/ai', () => ({ getAi: vi.fn(), parseJsonReply: vi.fn() }));
vi.mock('@/core/ai/usage', () => ({
  recordAiUsage: vi.fn(async () => undefined),
  assertAiQuota: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock('@/modules/credit_sales/service/contracts', () => ({ getContract: vi.fn() }));

import { getAi, parseJsonReply } from '@/core/adapters/ai';
import { recordAiUsage } from '@/core/ai/usage';
import { getContract } from '@/modules/credit_sales/service/contracts';
import { draftReminder } from '../draft';

const ctx = { userId: 'u', companyId: 'c', perms: new Set<string>(), locale: 'fr', tx: {} } as never;

const detail = {
  ok: true,
  value: {
    contract: { reference: 'CR-0007', id: 'k1' },
    partner: { id: 'p', name: 'Karim', phone: '0555123456' },
    installments: [
      { status: 'late', dueDate: '2026-09-01', amountCents: 100000n, paidCents: 0n },
      { status: 'late', dueDate: '2026-09-15', amountCents: 50000n, paidCents: 10000n },
      { status: 'upcoming', dueDate: '2026-12-01', amountCents: 50000n, paidCents: 0n },
    ],
  },
};

const provider = (text: string) => ({
  name: 'mock',
  model: 'm',
  supportsVision: false,
  complete: vi.fn(async () => ({ text, inputTokens: 1, outputTokens: 1, model: 'm' })),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getContract).mockResolvedValue(detail as never);
});

describe('draftReminder', () => {
  it('falls back to the template when AI is off', async () => {
    vi.mocked(getAi).mockReturnValue(null);
    const res = await draftReminder(ctx, { contractId: 'k1', tone: 'polite', language: 'fr' }, 'Boutique Test', new Date('2026-10-09T10:00:00Z'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.source).toBe('template');
    expect(res.value.amountCents).toBe(140000n);
    expect(res.value.whatsappUrl).toContain('https://wa.me/213555123456?text=');
  });

  it('uses the AI message and records usage, with the amount in the prompt', async () => {
    const p = provider('{"message": "Bonjour Karim, 1 400 DA sont en retard. Boutique Test"}');
    vi.mocked(getAi).mockReturnValue(p as never);
    vi.mocked(parseJsonReply).mockReturnValue({ message: 'Bonjour Karim, 1 400 DA sont en retard. Boutique Test' });
    const res = await draftReminder(ctx, { contractId: 'k1', tone: 'firm', language: 'fr' }, 'Boutique Test', new Date('2026-10-09T10:00:00Z'));
    expect(res.ok && res.value.source).toBe('ai');
    const sent = JSON.stringify(p.complete.mock.calls[0]);
    expect(sent).toMatch(/1\s?400/);
    expect(recordAiUsage).toHaveBeenCalledOnce();
  });

  it('falls back to the template when the AI JSON is invalid', async () => {
    vi.mocked(getAi).mockReturnValue(provider('not json') as never);
    vi.mocked(parseJsonReply).mockReturnValue(null);
    const res = await draftReminder(ctx, { contractId: 'k1', tone: 'polite', language: 'darija' }, 'Boutique Test', new Date('2026-10-09T10:00:00Z'));
    expect(res.ok && res.value.source).toBe('template');
  });

  it('refuses a contract with no overdue installment', async () => {
    vi.mocked(getContract).mockResolvedValue({
      ok: true,
      value: { ...detail.value, installments: [{ status: 'upcoming', dueDate: '2026-12-01', amountCents: 1n, paidCents: 0n }] },
    } as never);
    vi.mocked(getAi).mockReturnValue(null);
    const res = await draftReminder(ctx, { contractId: 'k1', tone: 'polite', language: 'fr' }, 'Boutique Test');
    expect(res.ok).toBe(false);
  });
});
