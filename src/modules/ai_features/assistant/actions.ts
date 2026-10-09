'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { askAssistant } from './service';

export const askAssistantAction = defineAction(
  {
    perm: 'ai_features.assistant.use',
    schema: z.object({ question: z.string().trim().min(3).max(500) }),
  },
  (ctx, input) => askAssistant(ctx, input.question),
);
