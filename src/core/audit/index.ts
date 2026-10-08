// STUB owned by P00-W2-C.
import type { Ctx } from '@/core/ctx';
export interface AuditEntry { entity: string; recordId: string; action: string; before?: unknown; after?: unknown }
export async function audit(_ctx: Ctx, _entry: AuditEntry): Promise<void> { throw new Error('not implemented'); }
