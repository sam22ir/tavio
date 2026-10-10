import { describe, expect, it } from 'vitest';
import { EVENT_NAMES } from '@/core/events/catalog';
import { actionConfigSchemas } from '../config';
import { canRunRule, MAX_CHAIN_DEPTH, runInRuleChain, TRIGGER_EVENTS } from '../engine';
import { checkUpdateValue, readableColumns, timeConfigSchema, UPDATABLE_FIELDS } from '../fields';
import { parseSteps, parseUpdateLines, toRuleInput } from '../form';
import { ruleInput } from '../service/rules';

const planId = '3f2b1c4e-5d6a-4b7c-8d9e-0f1a2b3c4d5e';

describe('trigger events', () => {
  it('accepts every catalog event', () => {
    expect(TRIGGER_EVENTS).toEqual(EVENT_NAMES);
  });
});

describe('checkUpdateValue', () => {
  it('never allows lead status changes, which go through the CRM services', () => {
    expect(checkUpdateValue('lead', 'status', 'lost')).toMatch(/cannot be updated/);
    expect(checkUpdateValue('lead', 'status', 'won')).toMatch(/cannot be updated/);
    expect(checkUpdateValue('lead', 'status', 'open')).toMatch(/cannot be updated/);
  });

  it('marks bo_owner_id as a user-id field', () => {
    expect(UPDATABLE_FIELDS.credit_contract.bo_owner_id?.userId).toBe(true);
  });

  it('readable columns for time rules exclude anything not listed', () => {
    expect(readableColumns('activity')).toContain('due_date');
    expect(readableColumns('activity')).not.toContain('summary');
  });

  it('never allows state columns on credit contracts', () => {
    expect(checkUpdateValue('credit_contract', 'state', 'refused')).toMatch(/cannot be updated/);
    expect(checkUpdateValue('credit_contract', 'state', 'active')).toMatch(/cannot be updated/);
    expect(checkUpdateValue('credit_contract', 'central_risk_result', 'flagged')).toBeNull();
    expect(checkUpdateValue('credit_contract', 'central_risk_result', 'maybe')).not.toBeNull();
  });

  it('checks probability range and the lead channel list', () => {
    expect(checkUpdateValue('lead', 'probability', '101')).not.toBeNull();
    expect(checkUpdateValue('lead', 'probability', '40')).toBeNull();
    expect(checkUpdateValue('lead', 'channel', 'fax')).not.toBeNull();
  });
});

describe('action configs', () => {
  it('update_record rejects a state field at save time', () => {
    const r = actionConfigSchemas.update_record.safeParse({ entity: 'lead', recordIdField: 'id', updates: { status: 'lost' } });
    expect(r.success).toBe(false);
  });

  it('launch_activity_plan needs a plan uuid', () => {
    expect(actionConfigSchemas.launch_activity_plan.safeParse({ entity: 'crm.lead', recordIdField: 'id', planId: 'nope' }).success).toBe(false);
    const ok = actionConfigSchemas.launch_activity_plan.safeParse({ entity: 'crm.lead', recordIdField: 'id', planId });
    expect(ok.success && ok.data.cancelPrevious).toBe(true);
  });

  it('multi runs valid steps only and refuses nested multi', () => {
    const steps = [{ action: 'post_note', config: { entity: 'crm.lead', recordIdField: 'id', body: 'Hi' } }];
    expect(actionConfigSchemas.multi.safeParse({ actions: steps }).success).toBe(true);
    expect(actionConfigSchemas.multi.safeParse({ actions: [{ action: 'multi', config: { actions: steps } }] }).success).toBe(false);
    expect(actionConfigSchemas.multi.safeParse({ actions: [] }).success).toBe(false);
  });
});

describe('time rules', () => {
  it('accepts a known date field and rejects one from another record type', () => {
    expect(timeConfigSchema.safeParse({ entity: 'lead', dateField: 'stage_entered_at', delayDays: 14 }).success).toBe(true);
    expect(timeConfigSchema.safeParse({ entity: 'activity', dateField: 'stage_entered_at', delayDays: 1 }).success).toBe(false);
    expect(timeConfigSchema.safeParse({ entity: 'lead', dateField: 'created_at', delayDays: -1 }).success).toBe(false);
  });

  it('requires a time config for time rules and a trigger for event rules', () => {
    const base = { name: 'x', conditions: [], action: 'cancel_activity_plans', actionConfig: { entity: 'crm.lead', recordIdField: 'id' }, active: true };
    expect(ruleInput.safeParse({ ...base, kind: 'time' }).success).toBe(false);
    expect(ruleInput.safeParse({ ...base, kind: 'time', timeConfig: { entity: 'lead', dateField: 'created_at', delayDays: 3 } }).success).toBe(true);
    expect(ruleInput.safeParse({ ...base, kind: 'event' }).success).toBe(false);
  });

  it('maps a time rule form onto kind time with no trigger event', () => {
    const input = toRuleInput({
      name: 'Stuck leads', kind: 'time', triggerEvent: 'crm.lead.won', timeEntity: 'lead', dateField: 'stage_entered_at',
      delayDays: '14', condField: '', condOp: 'eq', condValue: '', action: 'cancel_activity_plans',
      entity: 'crm.lead', recordIdField: 'id', active: 'on',
    });
    expect(input.kind).toBe('time');
    expect(input.triggerEvent).toBeNull();
    expect(input.timeConfig).toEqual({ entity: 'lead', dateField: 'stage_entered_at', delayDays: 14 });
  });
});

describe('form helpers', () => {
  it('parses field=value lines and skips blanks', () => {
    expect(parseUpdateLines('channel=web\n\n  probability = 40 \n')).toEqual({ channel: 'web', probability: '40' });
  });

  it('turns unreadable steps into an empty list', () => {
    expect(parseSteps('not json')).toEqual([]);
    expect(parseSteps('[{"action":"post_note"}]')).toHaveLength(1);
  });
});

describe('rule chain guard', () => {
  it('blocks a rule from re-entering itself and caps nested depth', async () => {
    expect(canRunRule('r1')).toBe(true);
    await runInRuleChain('r1', async () => {
      expect(canRunRule('r1')).toBe(false);
      expect(canRunRule('r2')).toBe(true);
    });
    const nest = async (n: number): Promise<void> => {
      if (n === 0) return;
      await runInRuleChain(`r${n}`, async () => {
        await nest(n - 1);
      });
    };
    await nest(MAX_CHAIN_DEPTH);
    await runInRuleChain('x1', async () => runInRuleChain('x2', async () => runInRuleChain('x3', async () => {
      expect(canRunRule('x4')).toBe(false);
    })));
  });
});
