import { describe, expect, it } from 'vitest';
import { leadScopeMode, saveTeamInput } from '../service/teams';

describe('leadScopeMode', () => {
  it('sees only own leads without a view permission', () => {
    expect(leadScopeMode(new Set(['crm.lead.read']))).toBe('own');
  });

  it('sees the team with view_team', () => {
    expect(leadScopeMode(new Set(['crm.lead.read', 'crm.leads.view_team']))).toBe('team');
  });

  it('sees every lead with view_all, even when view_team is also held', () => {
    expect(leadScopeMode(new Set(['crm.leads.view_team', 'crm.leads.view_all']))).toBe('all');
    expect(leadScopeMode(new Set(['crm.leads.view_all']))).toBe('all');
  });
});

describe('saveTeamInput', () => {
  it('requires a name and accepts a missing leader', () => {
    expect(saveTeamInput.safeParse({ name: '  ' }).success).toBe(false);
    const r = saveTeamInput.safeParse({ name: 'Oran', leaderId: null });
    expect(r.success).toBe(true);
  });

  it('rejects a leader or member id that is not a uuid', () => {
    expect(saveTeamInput.safeParse({ name: 'Oran', leaderId: 'abc' }).success).toBe(false);
    expect(saveTeamInput.safeParse({ name: 'Oran', userIds: ['abc'] }).success).toBe(false);
  });
});
