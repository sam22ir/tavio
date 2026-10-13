import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getAi: vi.fn(),
  quota: vi.fn(),
  record: vi.fn(),
  runTool: vi.fn(),
  propose: vi.fn(),
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
vi.mock('../../actions/service', () => ({ propose: h.propose }));

import { err, ok } from '@/core/result';
import type { AssistantTable } from '../tools';
import {
  BRIEFING_FEATURE,
  briefingMessages,
  briefingTools,
  collectionContractIds,
  modelTables,
  morningBriefing,
} from '../briefing';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ALL = ['ai_features.assistant.use', 'credit_sales.contract.read', 'invoicing.invoice.write'];

function ctx(perms: string[], locale: 'fr' | 'ar' | 'en' = 'en') {
  return { userId: uuid(1), companyId: uuid(2), perms: new Set(perms), locale, tx: {} } as never;
}

/** Fake tool results by name, each with real IDs so leaks would be visible. */
function fakeTable(name: string): AssistantTable {
  if (name === 'collections_queue') {
    return {
      title: 'Collections queue',
      columns: ['customer', 'overdue_installments', 'amount', 'days_late', 'risk'],
      rows: [['Karim', '2', '1 500 DA', '20', 'B']],
      ids: [{ partnerId: uuid(10), contractIds: [uuid(11), uuid(12)] }],
    };
  }
  return { title: name, columns: ['metric', 'value'], rows: [['x', '1']], ids: [{ partnerId: uuid(20) }] };
}

function aiReply(text: string) {
  return { text, inputTokens: 1, outputTokens: 1, model: 'm' };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.quota.mockResolvedValue(ok(undefined));
  h.record.mockResolvedValue(undefined);
  h.runTool.mockImplementation(async (_c: unknown, name: string) => ok(fakeTable(name)));
  h.propose.mockResolvedValue(ok({ id: uuid(99), kind: 'reminder_batch', summary: { kind: 'reminder_batch', items: [] } }));
});

describe('briefingTools', () => {
  it('runs all four briefing tools for a role with the credit read permission', () => {
    expect(briefingTools({ perms: new Set(ALL) })).toEqual(['kpis', 'collections_queue', 'unpaid_invoices', 'low_stock']);
  });

  it('drops the collections queue when the role lacks credit_sales.contract.read', () => {
    expect(briefingTools({ perms: new Set(['ai_features.assistant.use']) })).toEqual(['kpis', 'unpaid_invoices', 'low_stock']);
  });
});

describe('model input', () => {
  it('strips every ID from the tables sent to the model', () => {
    const json = JSON.stringify(modelTables([fakeTable('collections_queue'), fakeTable('kpis')]));
    expect(json).not.toMatch(UUID);
    expect(json).not.toContain('"ids"');
    const msg = briefingMessages('fr', [fakeTable('collections_queue')]);
    expect(msg.user).not.toMatch(UUID);
    expect(msg.system).toContain('French');
  });

  it('takes contract IDs from the queue in order, without duplicates, capped at 10', () => {
    const ids = Array.from({ length: 15 }, (_, i) => uuid(i + 1));
    const table: AssistantTable = {
      title: 'Collections queue',
      columns: [],
      rows: [],
      ids: [
        { partnerId: uuid(50), contractIds: ids.slice(0, 7) },
        { partnerId: uuid(51), contractIds: [ids[2]!, ids[7]!, ids[8]!, ids[9]!, ids[10]!, ids[11]!] },
      ],
    };
    const picked = collectionContractIds(table);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked.slice(0, 7)).toEqual(ids.slice(0, 7));
    expect(collectionContractIds(undefined)).toEqual([]);
  });
});

describe('morningBriefing', () => {
  it('returns the tables, an AI summary and a reminder proposal built from the queue IDs', async () => {
    h.getAi.mockReturnValue({ complete: vi.fn().mockResolvedValue(aiReply('  Trois clients à relancer.  ')) });

    const res = await morningBriefing(ctx(ALL, 'fr'));

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.answer).toBe('Trois clients à relancer.');
    expect(res.value.tables.map((t) => t.title)).toEqual(['kpis', 'Collections queue', 'unpaid_invoices', 'low_stock']);
    expect(h.propose).toHaveBeenCalledWith(expect.anything(), { kind: 'reminder_batch', contractIds: [uuid(11), uuid(12)] });
    expect(res.value.proposals).toHaveLength(1);
    expect(h.record).toHaveBeenCalledWith(expect.anything(), aiReply('  Trois clients à relancer.  '), BRIEFING_FEATURE);
  });

  it('keeps the tables and gives an empty answer when AI is off', async () => {
    h.getAi.mockReturnValue(null);
    const res = await morningBriefing(ctx(ALL));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.answer).toBe('');
      expect(res.value.tables.length).toBeGreaterThan(0);
    }
  });

  it('keeps the tables and gives an empty answer when the AI call throws', async () => {
    h.getAi.mockReturnValue({ complete: vi.fn().mockRejectedValue(new Error('timeout')) });
    const res = await morningBriefing(ctx(ALL));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.answer).toBe('');
    expect(h.record).not.toHaveBeenCalled();
  });

  it('skips the AI call entirely once the daily quota is reached', async () => {
    const complete = vi.fn();
    h.getAi.mockReturnValue({ complete });
    h.quota.mockResolvedValue(err('FORBIDDEN', 'AI_QUOTA'));
    const res = await morningBriefing(ctx(ALL));
    expect(res.ok).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not call the model when the options turn AI off, and still builds the proposal', async () => {
    const complete = vi.fn();
    h.getAi.mockReturnValue({ complete });
    const res = await morningBriefing(ctx(ALL), { ai: false });
    expect(res.ok).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    expect(h.propose).toHaveBeenCalledTimes(1);
  });

  it('narrows instead of failing for a role without credit read: no queue table, no proposal', async () => {
    h.getAi.mockReturnValue(null);
    const res = await morningBriefing(ctx(['ai_features.assistant.use']));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(h.runTool).not.toHaveBeenCalledWith(expect.anything(), 'collections_queue');
    expect(res.value.tables.map((t) => t.title)).not.toContain('Collections queue');
    expect(h.propose).not.toHaveBeenCalled();
    expect(res.value.proposals).toEqual([]);
  });

  it('skips a tool that answers FORBIDDEN and keeps the others', async () => {
    h.getAi.mockReturnValue(null);
    h.runTool.mockImplementation(async (_c: unknown, name: string) =>
      name === 'kpis' ? err('FORBIDDEN', 'nope') : ok(fakeTable(name)),
    );
    const res = await morningBriefing(ctx(ALL));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.tables.map((t) => t.title)).not.toContain('kpis');
  });

  it('refuses without the assistant permission', async () => {
    const res = await morningBriefing(ctx([]));
    expect(res.ok).toBe(false);
    expect(h.runTool).not.toHaveBeenCalled();
  });
});
