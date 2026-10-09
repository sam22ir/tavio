'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import type { Result } from '@/core/result';
import { closeSessionInput, openSessionInput, payOrderInput } from './entities';
import { createPaidOrder } from './service/orders';
import { closeSession, openSession, type SessionReport } from './service/sessions';

const MODULE = 'pos';

const openSessionAction = defineAction(
  { perm: 'pos.session.write', schema: openSessionInput, module: MODULE },
  (ctx, input) => openSession(ctx, input),
);
const closeSessionAction = defineAction(
  { perm: 'pos.session.write', schema: closeSessionInput, module: MODULE },
  (ctx, input) => closeSession(ctx, input),
);
const payOrderAction = defineAction(
  { perm: 'pos.order.post', schema: payOrderInput, module: MODULE },
  (ctx, input) => createPaidOrder(ctx, input),
);

/** Money crosses the action boundary as decimal strings in cents, never as bigint. */
export interface WireSessionReport {
  sessionId: string;
  state: 'open' | 'closed';
  openingCashCents: string;
  cashSalesCents: string;
  cardSalesCents: string;
  orderCount: number;
  expectedCashCents: string;
  closingCashCents: string | null;
  differenceCents: string | null;
}

export interface WirePaidOrder {
  orderId: string;
  number: string;
  totalCents: string;
  changeCents: string | null;
}

function toWireReport(r: SessionReport): WireSessionReport {
  return {
    sessionId: r.sessionId,
    state: r.state,
    openingCashCents: r.openingCashCents.toString(),
    cashSalesCents: r.cashSalesCents.toString(),
    cardSalesCents: r.cardSalesCents.toString(),
    orderCount: r.orderCount,
    expectedCashCents: r.expectedCashCents.toString(),
    closingCashCents: r.closingCashCents?.toString() ?? null,
    differenceCents: r.differenceCents?.toString() ?? null,
  };
}

export async function closeSessionAct(input: unknown): Promise<Result<WireSessionReport>> {
  const r = await closeSessionAction(input as z.input<typeof closeSessionInput>);
  return r.ok ? { ok: true, value: toWireReport(r.value) } : r;
}

export async function payOrderAct(input: unknown): Promise<Result<WirePaidOrder>> {
  const r = await payOrderAction(input as z.input<typeof payOrderInput>);
  if (!r.ok) return r;
  return {
    ok: true,
    value: {
      orderId: r.value.orderId,
      number: r.value.number,
      totalCents: r.value.totalCents.toString(),
      changeCents: r.value.changeCents?.toString() ?? null,
    },
  };
}

/** Form action for the open-session form on /pos. Redirects to the new session, or back with an error code. */
export async function openSessionForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const result = await openSessionAction({ openingCash: String(formData.get('openingCash') ?? '') });
  if (result.ok) redirect(`/${locale}/pos/session/${result.value.sessionId}`);
  redirect(`/${locale}/pos?error=${encodeURIComponent(result.error.message)}`);
}
