import { describe, expect, it } from 'vitest';
import { commitMessageText, issueText, validateRow } from '@/core/io';
import { z } from 'zod';

describe('localized zod issue messages', () => {
  const schema = z.object({ name: z.string().min(2), qty: z.number().max(5) });

  it('translates missing and too-short values in fr and ar, never English', () => {
    const fr = validateRow(schema, { name: 'a', qty: 1 }, 'fr');
    expect(fr.ok).toBe(false);
    if (!fr.ok) {
      expect(fr.issues[0]?.message).toBe('valeur trop courte ou trop petite');
    }
    const ar = validateRow(z.object({ name: z.string() }), {}, 'ar');
    expect(ar.ok).toBe(false);
    if (!ar.ok) expect(ar.issues[0]?.message).toBe('حقل إلزامي');
  });

  it('translates our own custom rules in all three locales', () => {
    expect(issueText({ code: 'custom', message: 'MONEY' }, 'fr')).toBe('montant invalide (ex. 1500,50)');
    expect(issueText({ code: 'custom', message: 'MONEY' }, 'ar')).toContain('مبلغ');
    expect(issueText({ code: 'custom', message: 'MONEY' }, 'en')).toBe('invalid amount (e.g. 1500.50)');
  });

  it('falls back to a neutral text for unknown codes and keeps unknown commit codes as-is', () => {
    expect(issueText({ code: 'something_else' }, 'fr')).toBe('valeur invalide');
    expect(commitMessageText('UNKNOWN_CODE', 'ar')).toBe('UNKNOWN_CODE');
    expect(commitMessageText('PARTNER_NOT_FOUND', 'fr')).toContain('introuvable');
  });
});
