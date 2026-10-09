import { describe, expect, it } from 'vitest';
import { WEBHOOK_EVENTS } from '../constants';
import { deliverEvent, isWebhookEvent, validateWebhookUrl } from '../service/webhooks';
import { verifySignature } from '../service/signature';

describe('validateWebhookUrl', () => {
  it('accepts https and localhost http', () => {
    expect(validateWebhookUrl('https://hooks.example.dz/tavio').ok).toBe(true);
    expect(validateWebhookUrl('http://localhost:3000/hook').ok).toBe(true);
  });

  it.each(['http://example.dz/hook', 'ftp://example.dz', 'not a url', 'javascript:alert(1)'])('rejects %s', (url) => {
    expect(validateWebhookUrl(url).ok).toBe(false);
  });
});

describe('event names', () => {
  it('accepts only catalog events', () => {
    expect(isWebhookEvent('pos.order.paid')).toBe(true);
    expect(WEBHOOK_EVENTS.length).toBeGreaterThan(0);
    expect(isWebhookEvent('pos.order.deleted')).toBe(false);
  });
});

describe('deliverEvent', () => {
  const webhook = { url: 'https://hooks.example.dz/x', secret: 's3cret' };
  const req = {
    deliveryId: 'd1',
    outboxId: 'o1',
    webhook,
    eventName: 'pos.order.paid',
    payload: { orderId: 'a', totalCents: '150000' },
  };

  it('posts a signed JSON body and reports success on 2xx', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    const result = await deliverEvent(req, fakeFetch);
    expect(result).toEqual({ ok: true, status: 204, error: null });
    expect(captured).not.toBeNull();
    const c = captured as unknown as { url: string; init: RequestInit };
    expect(c.url).toBe(webhook.url);
    const headers = c.init.headers as Record<string, string>;
    expect(headers['X-Tavio-Event']).toBe('pos.order.paid');
    expect(headers['X-Tavio-Delivery']).toBe('d1');
    const body = c.init.body as string;
    expect(JSON.parse(body)).toEqual({ id: 'o1', event: 'pos.order.paid', data: req.payload });
    expect(verifySignature('s3cret', body, headers['X-Tavio-Signature'] ?? '')).toBe(true);
    expect(verifySignature('s3cret', body, headers['X-Revora-Signature'] ?? '')).toBe(true);
  });

  it('reports failure on a non-2xx status', async () => {
    const fakeFetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
    expect(await deliverEvent(req, fakeFetch)).toEqual({ ok: false, status: 500, error: 'HTTP 500' });
  });

  it('never throws on network errors', async () => {
    const fakeFetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await deliverEvent(req, fakeFetch)).toEqual({ ok: false, status: null, error: 'TypeError' });
  });
});
