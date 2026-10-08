import { describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/core/ctx';
import type { Tx } from '@/core/db/types';
import { emit, on } from './index';

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
