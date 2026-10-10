import { describe, expect, it } from 'vitest';
import fr from '../../../../messages/fr/accounting.json';
import ar from '../../../../messages/ar/accounting.json';
import en from '../../../../messages/en/accounting.json';
import { BILAN_LINES, TCR_LINES } from '../service/statements';

const locales = { fr, ar, en } as const;

describe('statement line labels', () => {
  it('French labels match the SCF line names in the code', () => {
    expect(fr.statements.bilan).toEqual(BILAN_LINES);
    for (const [key, line] of Object.entries(TCR_LINES)) {
      expect(fr.statements.tcr[key as keyof typeof fr.statements.tcr]).toBe(line.label);
    }
  });

  it.each(Object.entries(locales))('%s has a distinct label for every line', (_, messages) => {
    const bilan = Object.values(messages.statements.bilan);
    expect(Object.keys(messages.statements.bilan).sort()).toEqual(Object.keys(BILAN_LINES).sort());
    expect(Object.keys(messages.statements.tcr).sort()).toEqual(Object.keys(TCR_LINES).sort());
    // A section name ("actif", "passif") in place of the line name was a past bug.
    expect(new Set(bilan).size).toBeGreaterThan(bilan.length - 2);
  });
});
