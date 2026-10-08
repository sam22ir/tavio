import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@/core/db/client';
import { drainOutbox } from '@/core/events';


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
  const processed = await drainOutbox(getDb(), async (row) => {
    // Real handlers arrive in P2/P3.
    console.log('outbox event', row.eventName);
  });
  return Response.json({ processed });
}
