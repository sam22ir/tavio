import '@/modules/event-handlers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/core/db/client';
import { drainOutbox } from '@/core/events';
import { handleAutomationWebhook, handleOutboxRow, AUTOMATION_WEBHOOK_EVENT } from '@/modules/platform/outbox-handler';
import { runTimedRulesForCompanies } from '@/modules/automation/timed';


// Reads CRON_SECRET from the Workers env when available, otherwise from process.env (Node).
function cronSecret(): string | undefined {
  try {
    const fromWorker = (getCloudflareContext({ async: false }).env as { CRON_SECRET?: string }).CRON_SECRET;
    if (fromWorker) return fromWorker;
  } catch {
    // Not running on Cloudflare.
  }
  return process.env.CRON_SECRET;
}

export async function POST(request: Request): Promise<Response> {
  const secret = cronSecret();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const processed = await drainOutbox(db, async (row) => {
    // Automation webhooks carry their own URL. Platform webhooks fan out to subscribed endpoints.
    if (row.eventName === AUTOMATION_WEBHOOK_EVENT) await handleAutomationWebhook(row);
    else await handleOutboxRow(row, db);
  });
  // Time-based automation rules fire once per record, per company.
  const timed = await runTimedRulesForCompanies(db);
  return Response.json({ processed, timed });
}
