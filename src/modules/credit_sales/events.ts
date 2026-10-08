import { on } from '@/core/events';
import { refreshScore } from './service/scoring';

// Side-effect module: imported from src/modules/credit_sales/index.ts so the handler is registered.
on('credit_sales.payment.recorded', async (ctx, event) => {
  const payload = event.payload as { partnerId: string };
  await refreshScore(ctx, payload.partnerId);
});
