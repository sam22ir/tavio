// STUB owned by P00-W2-F. Signatures are frozen.
import type { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import type { Result } from '@/core/result';
import type { FormState } from '@/core/entities/types';

export interface ActionOptions<S extends z.ZodType> {
  perm: string;          // required permission, checked with requirePerm
  schema: S;             // validates input
  module?: string;       // if set, returns MODULE_DISABLED when the module is off for the company
}

/** Wraps a service call: session → active company → tenant args → module check → withTenant → perm → zod → fn. Never throws. */
export function defineAction<S extends z.ZodType, T>(
  _opts: ActionOptions<S>,
  _fn: (ctx: Ctx, input: z.infer<S>) => Promise<Result<T>>,
): (input: z.input<S>) => Promise<Result<T>> { throw new Error('not implemented'); }

/** Adapts a defined action for <form action> + useActionState. Maps zod issues to fieldErrors. */
export function toFormAction<S extends z.ZodType, T>(
  _action: (input: z.input<S>) => Promise<Result<T>>,
  _opts: { schema: S; redirectTo?: (value: T) => string },
): (prev: FormState, formData: FormData) => Promise<FormState> { throw new Error('not implemented'); }
