'use server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { ok } from '@/core/result';
import { ACTIVITY_TYPE_SEED } from './entities';
import { cancelPlanRuns, launchPlan } from './service/plans';
import {
  ACTIVITY_CATEGORIES,
  completeActivity,
  postMessage,
  saveActivityType,
  savePlan,
  scheduleActivity,
} from './service';

const uuid = z.uuid();
const typeKeys = ACTIVITY_TYPE_SEED.map((s) => s.key) as [string, ...string[]];
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const postMessageSchema = z.object({
  entity: z.string().min(1).max(100),
  recordId: uuid,
  body: z.string().min(1).max(10000),
  kind: z.enum(['comment', 'note']),
});

const scheduleActivitySchema = z
  .object({
    entity: z.string().min(1).max(100),
    recordId: uuid,
    typeKey: z.enum(typeKeys).optional(),
    activityTypeId: uuid.optional(),
    summary: z.string().min(1).max(200),
    dueDate: dateString,
    assigneeId: uuid.optional(),
  })
  .refine((v) => Boolean(v.typeKey) !== Boolean(v.activityTypeId), {
    message: 'Give exactly one of typeKey or activityTypeId',
  });

const completeActivitySchema = z.object({
  id: uuid,
  result: z.string().max(100).optional(),
  feedback: z.string().max(1000).optional(),
});

const activityTypeSchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1).max(100),
  entity: z.string().max(100).nullable(),
  icon: z.string().max(40).nullable(),
  delayCount: z.number().int().min(0).max(3650),
  delayUnit: z.enum(['days', 'weeks']),
  category: z.enum(ACTIVITY_CATEGORIES),
  chainingType: z.enum(['suggest', 'trigger']),
  nextTypeId: uuid.nullable(),
  defaultUserId: uuid.nullable(),
  requireResult: z.boolean(),
  active: z.boolean(),
});

const planSchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1).max(100),
  entity: z.string().min(1).max(100),
  active: z.boolean(),
  steps: z
    .array(
      z.object({
        activityTypeId: uuid,
        summary: z.string().min(1).max(200),
        offsetDays: z.number().int().min(-3650).max(3650),
        responsible: z.enum(['record_owner', 'fixed']),
        userId: uuid.nullable(),
      }),
    )
    .min(1)
    .max(50),
});

const launchPlanSchema = z.object({
  planId: uuid,
  entity: z.string().min(1).max(100),
  recordId: uuid,
  startDate: dateString,
  ownerId: uuid,
  /** Cancel the open activities of earlier runs on the record. */
  replaceOpen: z.boolean(),
});

export const postMessageAction = defineAction(
  { perm: 'chatter.message.write', schema: postMessageSchema },
  (ctx, input) => postMessage(ctx, input),
);

export const scheduleActivityAction = defineAction(
  { perm: 'chatter.activity.write', schema: scheduleActivitySchema },
  (ctx, input) => scheduleActivity(ctx, input),
);

export const completeActivityAction = defineAction(
  { perm: 'chatter.activity.write', schema: completeActivitySchema },
  (ctx, input) => completeActivity(ctx, input.id, { result: input.result, feedback: input.feedback }),
);

export const saveActivityTypeAction = defineAction(
  { perm: 'chatter.activity.write', schema: activityTypeSchema },
  (ctx, input) => saveActivityType(ctx, input),
);

export const savePlanAction = defineAction(
  { perm: 'chatter.activity.write', schema: planSchema },
  (ctx, input) => savePlan(ctx, input),
);

export const launchPlanAction = defineAction(
  { perm: 'chatter.activity.write', schema: launchPlanSchema },
  async (ctx, input) => {
    const run = await launchPlan(ctx, input.planId, input.entity, input.recordId, input.startDate, input.ownerId);
    if (!run.ok || !input.replaceOpen) return run;
    const cancelled = await cancelPlanRuns(ctx, input.entity, input.recordId, { exceptRunId: run.value.runId });
    if (!cancelled.ok) return cancelled;
    return ok(run.value);
  },
);
