'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { searchQuery } from './search';

const schema = z.object({ q: z.string().max(200) });

/** Natural-language search for the command palette. Never writes. */
export const interpretQuery = defineAction(
  { perm: 'credit_sales.contract.read', schema },
  async (ctx, input) => searchQuery(ctx, input.q),
);
