'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { ruleFormInput, toRuleInput } from './form';
import { createRule, updateRule } from './service/rules';

const MODULE = 'automation';
const WRITE = 'automation.rule.write';

const createRuleAction = defineAction(
  { perm: WRITE, schema: ruleFormInput, module: MODULE },
  (ctx, f) => createRule(ctx, toRuleInput(f)),
);

const updateRuleAction = defineAction(
  { perm: WRITE, schema: ruleFormInput.extend({ id: z.uuid() }), module: MODULE },
  (ctx, f) => updateRule(ctx, f.id, toRuleInput(f)),
);

/** Form action for the new-rule form on /settings/automation. */
export async function createRuleForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createRuleAction, {
    schema: ruleFormInput,
    redirectTo: () => `/${locale}/settings/automation`,
  })(prev, formData);
}

/** Form action for editing an existing rule. The form carries a hidden `id`. */
export async function updateRuleForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(updateRuleAction, {
    schema: ruleFormInput.extend({ id: z.uuid() }),
    redirectTo: () => `/${locale}/settings/automation`,
  })(prev, formData);
}
