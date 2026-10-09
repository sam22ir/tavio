import { describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/core/ctx';
import type { Tx } from '@/core/db/types';
import { emit, on } from './index';
import { EVENT_NAMES, type EventCatalog } from './catalog';

function fakeCtx() {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const ctx = {
    userId: 'u1',
    companyId: 'c1',
    perms: new Set<string>(),
    locale: 'en',
    tx: { insert } as unknown as Tx,
  } satisfies Ctx;
  return { ctx, insert, values };
}

describe('events bus', () => {
  it('runs handlers in registration order and then writes an outbox row', async () => {
    const calls: string[] = [];
    on('test.order.happened', async () => { calls.push('first'); });
    on('test.order.happened', async () => { calls.push('second'); });
    const { ctx, insert, values } = fakeCtx();

    await emit(ctx, { name: 'test.order.happened', payload: { id: 1 } });

    expect(calls).toEqual(['first', 'second']);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', createdBy: 'u1', eventType: 'test.order.happened', status: 'pending' }),
    );
  });

  it('propagates a handler error and writes no outbox row', async () => {
    on('test.fail.happened', async () => { throw new Error('handler boom'); });
    const { ctx, insert } = fakeCtx();

    await expect(emit(ctx, { name: 'test.fail.happened', payload: {} })).rejects.toThrow('handler boom');
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('event catalog (W13-EVENTS)', () => {
  it('lists the W13 CRM, chatter and credit-sales events', () => {
    const w13 = [
      'crm.lead.created',
      'crm.lead.stage_changed',
      'crm.lead.won',
      'crm.lead.lost',
      'chatter.activity.done',
      'credit_sales.contract.state_changed',
    ] as const;
    for (const name of w13) {
      expect(EVENT_NAMES).toContain(name);
    }
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
  });

  it('types the W13 payloads with the agreed fields', () => {
    const lost: EventCatalog['crm.lead.lost'] = { leadId: 'l1', lostReasonId: 'r1' };
    const done: EventCatalog['chatter.activity.done'] = {
      activityId: 'a1', entity: 'crm.lead', recordId: 'l1', activityTypeId: null, result: null,
    };
    const state: EventCatalog['credit_sales.contract.state_changed'] = {
      contractId: 'k1', partnerId: 'p1', fromState: 'submitted', toState: 'under_review',
    };
    expect(lost.lostReasonId).toBe('r1');
    expect(done.result).toBeNull();
    expect(state.toState).toBe('under_review');
  });
});
