import { describe, expect, it } from 'vitest';
import { buildInterpretPrompt, parseAiQuery, resolveAiQuery } from '../interpret';

describe('buildInterpretPrompt', () => {
  it('lists only whitelisted modules', () => {
    const p = buildInterpretPrompt('contrats en retard');
    expect(p.system).toContain('- overdue');
    expect(p.system).toContain('- contracts (filters: state)');
    expect(p.system).not.toContain('- users');
  });
});

describe('resolveAiQuery', () => {
  it('builds a whitelisted URL with query params', () => {
    const r = resolveAiQuery({ intent: 'navigate', module: 'contracts', filters: { state: 'active' }, text: 'Karim' }, 'x');
    expect(r.href).toBe('/credit/contracts?state=active&q=Karim');
  });
  it('drops unknown modules and unknown filters', () => {
    expect(resolveAiQuery({ intent: 'navigate', module: 'users' }, 'x').href).toBeNull();
    const r = resolveAiQuery({ intent: 'navigate', module: 'contracts', filters: { role: 'admin', state: 'deleted' } }, 'x');
    expect(r.href).toBe('/credit/contracts?q=x');
  });
});

describe('parseAiQuery', () => {
  it('rejects malformed replies', () => {
    expect(parseAiQuery(null)).toBeNull();
    expect(parseAiQuery({ intent: 'delete' })).toBeNull();
  });
  it('accepts a valid reply', () => {
    expect(parseAiQuery({ intent: 'search', text: 'x' })).toEqual({ intent: 'search', text: 'x' });
  });
});
