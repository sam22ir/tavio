import '@/modules/event-handlers';
import { getLocale } from 'next-intl/server';
import type { z } from 'zod';
import type { Ctx, Locale } from '@/core/ctx';
import { requireUser } from '@/core/auth/session';
import { getActiveCompanyId } from '@/core/tenancy/active';
import { enabledModules, listMyCompanies, loadTenantArgs } from '@/core/tenancy/service';
import { withTenant } from '@/core/db/tenant';
import { requirePerm } from '@/core/perms';
import { err, type AppError, type Result } from '@/core/result';
import type { FormState } from '@/core/entities/types';

export interface ActionOptions<S extends z.ZodType> {
  perm: string;          // required permission, checked with requirePerm
  schema: S;             // validates input
  module?: string;       // if set, returns MODULE_DISABLED when the module is off for the company
}

/** Thrown inside the transaction when fn returns an error result, so the tx rolls back. */
class ActionFailure extends Error {
  constructor(readonly appError: AppError) {
    super(appError.code);
  }
}

/** Wraps a service call: session → active company → tenant args → module check → withTenant → perm → zod → fn. Never throws. */
export function defineAction<S extends z.ZodType, T>(
  opts: ActionOptions<S>,
  fn: (ctx: Ctx, input: z.infer<S>) => Promise<Result<T>>,
): (input: z.input<S>) => Promise<Result<T>> {
  return async (input) => {
    try {
      const user = await requireUser();
      if (!user.ok) return user;

      // Active company from the cookie; falls back to the first membership when missing or invalid.
      const memberships = await listMyCompanies(user.value.userId);
      const stored = await getActiveCompanyId();
      const companyId = (memberships.find((c) => c.id === stored) ?? memberships[0])?.id;
      if (!companyId) return err('FORBIDDEN', 'NO_COMPANY');

      const locale = (await getLocale()) as Locale;

      const args = await loadTenantArgs(user.value.userId, companyId, locale);
      if (!args.ok) return args;

      if (opts.module) {
        const modules = await enabledModules(companyId);
        if (!modules.includes(opts.module)) {
          return err('MODULE_DISABLED', `Module ${opts.module} is disabled`, { module: opts.module });
        }
      }

      try {
        return await withTenant(args.value, async (ctx) => {
          const perm = requirePerm(ctx, opts.perm);
          if (!perm.ok) throw new ActionFailure(perm.error);

          const parsed = opts.schema.safeParse(input);
          if (!parsed.success) {
            throw new ActionFailure({
              code: 'VALIDATION',
              message: 'Invalid input',
              details: {
                issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message, code: i.code })),
              },
            });
          }

          const result = await fn(ctx, parsed.data);
          if (!result.ok) throw new ActionFailure(result.error);
          return result;
        });
      } catch (e) {
        if (e instanceof ActionFailure) return { ok: false, error: e.appError };
        throw e;
      }
    } catch (e) {
      // Log metadata only: never the input, and not the driver message (it can echo query params).
      console.error('defineAction failed', {
        name: e instanceof Error ? e.name : 'unknown',
        code: (e as { code?: unknown })?.code,
      });
      const cause = e instanceof Error ? (e.cause as Error | undefined) : undefined;
      const text = `${e instanceof Error ? e.message : ''} ${cause?.message ?? ''}`;
      if (text.includes('POSTED_IMMUTABLE')) return err('POSTED_IMMUTABLE', 'Posted documents are immutable');
      return err('INTERNAL', 'Internal error');
    }
  };
}

/** Adapts a defined action for <form action> + useActionState. Maps zod issues to fieldErrors. */
export function toFormAction<S extends z.ZodType, T>(
  action: (input: z.input<S>) => Promise<Result<T>>,
  opts: { schema: S; redirectTo?: (value: T) => string },
): (prev: FormState, formData: FormData) => Promise<FormState> {
  return async (_prev, formData) => {
    const result = await action(Object.fromEntries(formData) as z.input<S>);
    if (result.ok) {
      return { ok: true, redirectTo: opts.redirectTo?.(result.value) };
    }
    if (result.error.code === 'VALIDATION') {
      const issues = (result.error.details?.issues ?? []) as { path: PropertyKey[]; message: string }[];
      const fieldErrors: Record<string, string> = {};
      for (const issue of issues) {
        const key = issue.path.map(String).join('.') || '_form';
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, message: result.error.message, fieldErrors };
    }
    return { ok: false, message: result.error.code };
  };
}
