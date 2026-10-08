'use server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { ACTIVITY_TYPE_SEED } from './entities';
import { completeActivity, postMessage, scheduleActivity } from './service';

const uuid = z.uuid();
const typeKeys = ACTIVITY_TYPE_SEED.map((s) => s.key) as [string, ...string[]];

const postMessageSchema = z.object({
  entity: z.string().min(1).max(100),
  recordId: uuid,
  body: z.string().min(1).max(10000),
  kind: z.enum(['comment', 'note']),
});

const scheduleActivitySchema = z.object({
  entity: z.string().min(1).max(100),
  recordId: uuid,
  typeKey: z.enum(typeKeys),
  summary: z.string().min(1).max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assigneeId: uuid.optional(),
});

const completeActivitySchema = z.object({
  id: uuid,
  feedback: z.string().max(1000).optional(),
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
  (ctx, input) => completeActivity(ctx, input.id, input.feedback),
);
