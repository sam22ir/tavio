import { sql } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { messageOptOuts } from '@/core/db/schema/messaging';
import { readPortalSecret } from '@/core/portal/env';
import { verifyUnsubscribe } from '@/core/messaging/unsubscribe';

// Public opt-out link from reminder and marketing emails. The signed token carries company, partner and channel.
// Records the opt-out under the company's RLS scope. No user session is involved.

const PAGE = (title: string, text: string) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
  `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;line-height:1.5"><h1 style="font-size:20px">${title}</h1><p>${text}</p></body></html>`;

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const secret = readPortalSecret();
  const payload = secret && token ? await verifyUnsubscribe(token, secret) : null;
  if (!payload) return html(PAGE('Lien invalide', 'Ce lien de désabonnement n\'est pas valide.'), 400);

  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${payload.c}, true)`);
    await tx.execute(sql`set local role tavio_app`);
    await tx
      .insert(messageOptOuts)
      .values({ companyId: payload.c, partnerId: payload.p, channel: payload.ch })
      .onConflictDoNothing();
  });
  return html(PAGE('Désabonnement confirmé', 'Vous ne recevrez plus ces e-mails de la part de cette entreprise.'));
}
