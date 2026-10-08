// Custom worker entry for OpenNext on Cloudflare. OpenNext's generated worker only handles fetch,
// so this file adds the scheduled (cron) handler and re-exports the Durable Objects it needs.
import handler from './.open-next/worker.js';

export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js';
export { DOShardedTagCache } from './.open-next/.build/durable-objects/sharded-tag-cache.js';
export { BucketCachePurge } from './.open-next/.build/durable-objects/bucket-cache-purge.js';

type WorkerEnv = Parameters<typeof handler.fetch>[1] & { CRON_SECRET?: string };

const DAILY_CRON = '0 6 * * *';

/** Calls one cron route on this worker through OpenNext's fetch handler. The route checks the bearer secret. */
async function runCron(path: string, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
  const request = new Request(`https://cron.internal${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
  });
  const response = await handler.fetch(request, env, ctx);
  if (!response.ok) console.error(`cron ${path} failed with status ${response.status}`);
}

const worker = {
  fetch: handler.fetch,
  scheduled(event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): void {
    const paths = ['/api/cron/outbox'];
    if (event.cron === DAILY_CRON) paths.push('/api/cron/daily');
    ctx.waitUntil(Promise.allSettled(paths.map((path) => runCron(path, env, ctx))));
  },
};

export default worker;
