import { describe, expect, it } from 'vitest';
import {
  canBuildRecipients,
  isEditable,
  nextCampaignState,
  personalize,
} from '../service/message';

describe('personalize', () => {
  it('replaces name and shop placeholders', () => {
    expect(personalize('Bonjour {name}, de la part de {shop}.', { name: 'Amina', shop: 'Boutique X' })).toBe(
      'Bonjour Amina, de la part de Boutique X.',
    );
  });

  it('replaces every occurrence and leaves unknown placeholders', () => {
    expect(personalize('{name} {name} {unknown}', { name: 'K', shop: 'S' })).toBe('K K {unknown}');
  });

  it('keeps Arabic text intact', () => {
    expect(personalize('مرحباً {name} من {shop}', { name: 'كريم', shop: 'متجر' })).toBe('مرحباً كريم من متجر');
  });
});

describe('campaign state rules', () => {
  it('allows edits only in draft and ready', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('ready')).toBe(true);
    expect(isEditable('sent')).toBe(false);
  });

  it('allows building recipients only while all are pending', () => {
    expect(canBuildRecipients('draft', [])).toBe(true);
    expect(canBuildRecipients('ready', ['pending', 'pending'])).toBe(true);
    expect(canBuildRecipients('ready', ['pending', 'sent'])).toBe(false);
    expect(canBuildRecipients('sent', ['sent'])).toBe(false);
  });

  it('derives the campaign state from recipient statuses', () => {
    expect(nextCampaignState([])).toBe('draft');
    expect(nextCampaignState(['pending', 'sent'])).toBe('ready');
    expect(nextCampaignState(['sent', 'failed'])).toBe('sent');
    expect(nextCampaignState(['sent'])).toBe('sent');
  });
});
