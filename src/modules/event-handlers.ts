// Side-effect module: registers every cross-module event handler exactly once.
// Imported at the top of the action runner, the page ctx builder and the cron routes so the handlers
// are in place before any event is emitted. core/events must NOT import this file (import cycle).
import { EVENT_NAMES, type EventName } from '@/core/events/catalog';
import { on, type DomainEvent } from '@/core/events';
import type { Ctx } from '@/core/ctx';
import { runAutomations } from '@/modules/automation/engine';
import '@/modules/accounting/events';
import '@/modules/credit_sales/events';
import '@/modules/inventory/events';

// Automation rules listen to every catalog event. Runs in the emitter's transaction, after the module handlers.
for (const name of EVENT_NAMES satisfies readonly EventName[]) {
  on(name, async (ctx: Ctx, event: DomainEvent) => {
    await runAutomations(ctx, event);
  });
}
