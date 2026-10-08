import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/core/db/client';
import { runDailyReminders } from '@/modules/credit_sales/jobs/daily-reminders';

export const dynamic = 'force-dynamic';

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
  const result = await runDailyReminders(getDb());
  return Response.json(result);
}
