import { describe, expect, it } from 'vitest';
import { buildContractHtml } from '../print/contract-html';
import { DEFAULT_CLAUSES_AR, DEFAULT_CLAUSES_FR } from '../service/clause-defaults';
import {
  BLANK_FIELD,
  CLAUSE_VARIABLES,
  clauseParagraphs,
  guarantorRequired,
  renderClauseTemplate,
  templateFor,
} from '../service/clauses';

describe('renderClauseTemplate', () => {
  it('replaces known variables with their values', () => {
    const out = renderClauseTemplate('Vendeur {societe_nom}, client {client_nom}.', {
      societe_nom: 'Maison Test',
      client_nom: 'Ali Ben',
    });
    expect(out).toBe('Vendeur Maison Test, client Ali Ben.');
  });

  it('leaves a visible blank line for a missing or empty variable, never the braces', () => {
    const out = renderClauseTemplate('Garant: {garant_nom} / NIN {client_nin} / {ville}', {
      garant_nom: null,
      client_nin: '   ',
    });
    expect(out).toBe(`Garant: ${BLANK_FIELD} / NIN ${BLANK_FIELD} / ${BLANK_FIELD}`);
    expect(out).not.toMatch(/\{[a-z_]+\}/);
  });

  it('blanks unknown tokens too, so no raw {x} reaches the print', () => {
    expect(renderClauseTemplate('Avant {inconnu} après', {})).toBe(`Avant ${BLANK_FIELD} après`);
  });

  it('trims values and does not re-expand braces inside a value', () => {
    expect(renderClauseTemplate('[{ville}]', { ville: '  {client_nom}  ' })).toBe('[{client_nom}]');
  });
});

describe('templateFor', () => {
  it('uses the company text when saved, the default when blank', () => {
    expect(templateFor('fr', { clausesFr: 'Mon texte', clausesAr: null })).toBe('Mon texte');
    expect(templateFor('fr', { clausesFr: '   ', clausesAr: null })).toBe(DEFAULT_CLAUSES_FR);
    expect(templateFor('ar', { clausesFr: null, clausesAr: null })).toBe(DEFAULT_CLAUSES_AR);
  });

  it('prints French clauses for English', () => {
    expect(templateFor('en', { clausesFr: null, clausesAr: null })).toBe(DEFAULT_CLAUSES_FR);
  });
});

describe('default clause text', () => {
  it('is marked for lawyer validation in French', () => {
    expect(DEFAULT_CLAUSES_FR.startsWith('Modèle à faire valider par un juriste')).toBe(true);
  });

  it('uses only documented variables', () => {
    const allowed = new Set<string>(CLAUSE_VARIABLES);
    for (const text of [DEFAULT_CLAUSES_FR, DEFAULT_CLAUSES_AR]) {
      const tokens = [...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1] ?? '');
      expect(tokens.length).toBeGreaterThan(0);
      for (const token of tokens) expect(allowed.has(token)).toBe(true);
    }
  });

  it('has the ten numbered articles in both languages', () => {
    expect(DEFAULT_CLAUSES_FR.match(/^Article \d+ - /gm)?.length).toBe(10);
    expect(DEFAULT_CLAUSES_AR.match(/^المادة \d+ - /gm)?.length).toBe(10);
  });
});

describe('clauseParagraphs', () => {
  it('keeps empty lines as spacing', () => {
    expect(clauseParagraphs('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('guarantorRequired', () => {
  it('is off without a threshold and applies only above it', () => {
    expect(guarantorRequired(BigInt(900000), null)).toBe(false);
    expect(guarantorRequired(BigInt(900000), BigInt(500000))).toBe(true);
    expect(guarantorRequired(BigInt(500000), BigInt(500000))).toBe(false);
  });
});

describe('contract print with the company template', () => {
  it('renders no placeholder text and no raw variable tokens', () => {
    const html = buildContractHtml({
      locale: 'fr',
      reference: 'CR-1',
      startDate: '2026-11-01',
      frequency: 'monthly',
      installmentsCount: 2,
      company: { legalName: 'Maison Test', nif: null, rc: null, address: null },
      partner: { name: 'Ali', phone: null },
      lines: [],
      cashPriceCents: BigInt(0),
      markupCents: BigInt(0),
      totalCents: BigInt(0),
      downPaymentCents: BigInt(0),
      financedCents: BigInt(0),
      schedule: [],
      clauses: clauseParagraphs(renderClauseTemplate(DEFAULT_CLAUSES_FR, {})),
      guarantors: [],
    });
    expect(html).not.toContain('Clauses du contrat à compléter');
    expect(html).not.toMatch(/\{[a-z_]+\}/);
    expect(html).toContain(BLANK_FIELD);
    expect(html).toContain('Le garant');
  });
});
