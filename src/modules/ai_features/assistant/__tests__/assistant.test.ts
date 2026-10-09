import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  complete: vi.fn(),
  getAi: vi.fn(),
  runTool: vi.fn(),
  quota: vi.fn(),
  record: vi.fn(),
}));

vi.mock('@/core/adapters/ai', () => ({
  getAi: h.getAi,
  parseJsonReply: (text: string) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  },
}));
vi.mock('@/core/ai/usage', () => ({ assertAiQuota: h.quota, recordAiUsage: h.record }));
vi.mock('../tools', () => ({ runAssistantTool: h.runTool }));

import { ok } from '@/core/result';
import { askAssistant } from '../service';
import { planToolCalls } from '../plan';

const ctx = {
  userId: '00000000-0000-4000-8000-000000000001',
  companyId: '00000000-0000-4000-8000-000000000002',
  perms: new Set(['ai_features.assistant.use']),
  locale: 'fr' as const,
  tx: {} as never,
};

describe('planToolCalls', () => {
  it('keeps only whitelisted, de-duplicated tool names', () => {
    expect(planToolCalls('{"tools":["kpis","drop_all_invoices","kpis","overdue"]}')).toEqual(['kpis', 'overdue']);
  });

  it('returns an empty plan for malformed or wrong-shape replies', () => {
    expect(planToolCalls('not json')).toEqual([]);
    expect(planToolCalls('{"tools":"kpis"}')).toEqual([]);
  });
});

describe('askAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.quota.mockResolvedValue(ok(undefined));
    h.record.mockResolvedValue(undefined);
    h.runTool.mockResolvedValue(ok({ title: 'KPIs', columns: ['metric', 'value'], rows: [['overdue', '0']] }));
  });

  it('runs only the tools the AI picked from the whitelist and answers from their results', async () => {
    h.getAi.mockReturnValue({
      name: 'mock',
      model: 'm',
      supportsVision: false,
      complete: h.complete
        .mockResolvedValueOnce({ text: '{"tools":["kpis","write_customer"]}', inputTokens: 1, outputTokens: 1, model: 'm' })
        .mockResolvedValueOnce({ text: ' Rien en retard. ', inputTokens: 1, outputTokens: 1, model: 'm' }),
    });

    const res = await askAssistant(ctx, 'Combien de retards ?');

    expect(res.ok).toBe(true);
    expect(h.runTool).toHaveBeenCalledTimes(1);
    expect(h.runTool).toHaveBeenCalledWith(ctx, 'kpis');
    if (res.ok) expect(res.value.answer).toBe('Rien en retard.');
  });

  it('refuses without the assistant permission and never calls a tool', async () => {
    const res = await askAssistant({ ...ctx, perms: new Set() }, 'test question');
    expect(res.ok).toBe(false);
    expect(h.runTool).not.toHaveBeenCalled();
  });

  it('returns a no-tool error when the AI picks nothing valid', async () => {
    h.getAi.mockReturnValue({
      name: 'mock', model: 'm', supportsVision: false,
      complete: vi.fn().mockResolvedValue({ text: '{"tools":["delete_all"]}', inputTokens: 1, outputTokens: 1, model: 'm' }),
    });
    const res = await askAssistant(ctx, 'supprime tout');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.details?.messageKey).toBe('errors.no_tool');
    expect(h.runTool).not.toHaveBeenCalled();
  });
});
