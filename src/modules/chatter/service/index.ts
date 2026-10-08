// STUB owned by W4-D. Signatures are frozen.
import type { Ctx } from '@/core/ctx';
import type { Result } from '@/core/result';
export interface NewActivity { entity: string; recordId: string; typeKey: string; summary: string; dueDate: string; assigneeId?: string }
export async function postMessage(_ctx: Ctx, _i: { entity: string; recordId: string; body: string; kind?: 'comment' | 'note' | 'system' }): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
export async function scheduleActivity(_ctx: Ctx, _i: NewActivity): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
export async function completeActivity(_ctx: Ctx, _id: string, _feedback?: string): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
/** Idempotent: does nothing if an open activity with the same entity, recordId, typeKey and dueDate exists. */
export async function ensureActivity(_ctx: Ctx, _i: NewActivity): Promise<Result<{ id: string; created: boolean }>> { throw new Error('not implemented'); }
