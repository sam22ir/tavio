import { describe, expect, it } from 'vitest';
import { campaignInput, normalizeCampaign, type CampaignInput } from '../service/campaigns';

const base = (over: Partial<Record<string, unknown>> = {}) =>
  campaignInput.parse({
    name: '  Rappel octobre  ',
    channel: 'whatsapp',
    language: 'fr',
    messageFr: 'Bonjour {name}, de la part de {shop}.',
    messageAr: 'مرحباً {name} من {shop}',
    segmentCustomer: 'on',
    segmentProspect: undefined,
    segmentWilaya: '16',
    segmentHasOverdue: 'on',
    ...over,
  });

describe('campaignInput', () => {
  it('turns checkbox values into booleans and trims text', () => {
    const parsed = base();
    expect(parsed.name).toBe('Rappel octobre');
    expect(parsed.segmentCustomer).toBe(true);
    expect(parsed.segmentProspect).toBe(false);
    expect(parsed.segmentHasOverdue).toBe(true);
  });

  it('rejects an unknown channel and a wilaya outside 01-58', () => {
    expect(() => base({ channel: 'fax' })).toThrow();
    expect(() => base({ segmentWilaya: '59' })).toThrow();
  });
});

describe('normalizeCampaign', () => {
  it('maps the flat form fields to the segment object', () => {
    const result = normalizeCampaign(base());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.segment).toEqual({ customer: true, prospect: false, wilaya: '16', hasOverdue: true });
    expect(result.value.name).toBe('Rappel octobre');
  });

  it('leaves the wilaya unset when blank', () => {
    const result = normalizeCampaign(base({ segmentWilaya: '' }));
    expect(result.ok && result.value.segment.wilaya).toBeUndefined();
  });

  it('requires both messages to be non-empty', () => {
    const input: CampaignInput = { ...base(), messageAr: '' };
    const result = normalizeCampaign(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});
