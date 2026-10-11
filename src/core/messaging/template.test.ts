import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATES,
  findUnknownVariables,
  messageLocaleFor,
  renderMessage,
  renderText,
  TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  textToHtml,
  withUnsubscribe,
} from './template';

describe('template rendering', () => {
  it('replaces known variables and leaves unknown placeholders as written', () => {
    expect(renderText('Bonjour {partner}, {unknown}', { partner: 'Ahmed' })).toBe('Bonjour Ahmed, {unknown}');
  });

  it('escapes HTML in the body and turns blank lines into paragraphs', () => {
    const html = textToHtml('<b>x</b> & y\n\nLigne 2');
    expect(html).toBe('<p>&lt;b&gt;x&lt;/b&gt; &amp; y</p><p>Ligne 2</p>');
  });

  it('auto-links URLs in the HTML version only', () => {
    const { text, html } = renderMessage({ subject: 'S', body: 'Voir https://example.com/p?x=1' }, {});
    expect(text).toBe('Voir https://example.com/p?x=1');
    expect(html).toContain('<a href="https://example.com/p?x=1">https://example.com/p?x=1</a>');
  });

  it('keeps the subject as plain text', () => {
    expect(renderMessage({ subject: 'Facture {number}', body: 'x' }, { number: 'FAC-1' }).subject).toBe('Facture FAC-1');
  });

  it('adds an unsubscribe line in the message locale', () => {
    const base = renderMessage({ subject: 'S', body: 'Corps' }, {});
    const fr = withUnsubscribe(base, 'https://x.test/u?t=1', 'fr');
    expect(fr.text).toContain('Vous ne souhaitez plus recevoir ces e-mails ? https://x.test/u?t=1');
    expect(fr.html).toContain('href="https://x.test/u?t=1"');
    expect(withUnsubscribe(base, 'https://x.test/u', 'ar').text).toContain('لا تريد تلقي هذه الرسائل');
  });
});

describe('default templates', () => {
  it('has fr and ar copy for every key', () => {
    for (const key of TEMPLATE_KEYS) {
      expect(DEFAULT_TEMPLATES[key].fr.subject).not.toBe('');
      expect(DEFAULT_TEMPLATES[key].ar.body).not.toBe('');
    }
  });

  it('uses only the variables its key allows', () => {
    for (const key of TEMPLATE_KEYS) {
      for (const locale of ['fr', 'ar'] as const) {
        const copy = DEFAULT_TEMPLATES[key][locale];
        expect(findUnknownVariables(key, copy.subject)).toEqual([]);
        expect(findUnknownVariables(key, copy.body)).toEqual([]);
      }
    }
  });

  it('gives every document template a portal link placeholder', () => {
    for (const key of TEMPLATE_KEYS) {
      if (key === 'portal_invite' || key.startsWith('installment') || key.endsWith('_sent') || key === 'payment_receipt') {
        expect(TEMPLATE_VARIABLES[key]).toContain('link');
        expect(DEFAULT_TEMPLATES[key].fr.body).toContain('{link}');
      }
    }
  });

  it('reports unknown variables for a key', () => {
    expect(findUnknownVariables('quote_sent', 'Bonjour {partner} {iban}')).toEqual(['iban']);
  });

  it('uses Arabic only for an Arabic company locale', () => {
    expect(messageLocaleFor('ar')).toBe('ar');
    expect(messageLocaleFor('en')).toBe('fr');
    expect(messageLocaleFor('fr')).toBe('fr');
  });
});
