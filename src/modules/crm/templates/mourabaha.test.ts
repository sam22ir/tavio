import { describe, expect, it } from 'vitest';
import {
  MOURABAHA_ACTIVITY_TYPES,
  MOURABAHA_DOCUMENT_REQUIREMENTS,
  MOURABAHA_LOST_REASONS,
  MOURABAHA_PLANS,
  MOURABAHA_STAGES,
} from './mourabaha';

describe('Mourabaha stages', () => {
  it('has the 13 statuses from item 8 in order', () => {
    expect(MOURABAHA_STAGES.map((s) => s.name)).toEqual([
      'Nouveau Lead',
      'Déjà contacté',
      'Ne répond pas',
      'Injoignable',
      'Demande d\'information',
      'Qualifié',
      'Intéressé',
      'Orienté showroom',
      'En attente de l\'envoi du dossier',
      'Dossier reçu',
      'Transmis BO',
      'Pas intéressé',
      'Non qualifié',
    ]);
  });

  it('marks only Transmis BO as won and only the two exit statuses as folded', () => {
    expect(MOURABAHA_STAGES.filter((s) => s.isWon).map((s) => s.name)).toEqual(['Transmis BO']);
    expect(MOURABAHA_STAGES.filter((s) => s.fold).map((s) => s.name)).toEqual(['Pas intéressé', 'Non qualifié']);
  });

  it('gives every stage a requirements hint and a 0-100 probability', () => {
    for (const s of MOURABAHA_STAGES) {
      expect(s.requirements.length).toBeGreaterThan(0);
      expect(s.probability).toBeGreaterThanOrEqual(0);
      expect(s.probability).toBeLessThanOrEqual(100);
    }
  });
});

describe('Mourabaha plans (item 23)', () => {
  const offsets = (code: string): number[] =>
    MOURABAHA_PLANS.find((p) => p.code === code)?.steps.map((s) => s.offsetDays) ?? [];

  it('has the seven plan codes', () => {
    expect(MOURABAHA_PLANS.map((p) => p.code)).toEqual(['NR', 'INJ', 'INFO', 'QUAL', 'INT', 'SHOW', 'DOS']);
  });

  it('uses the item 23 day offsets', () => {
    expect(offsets('NR')).toEqual([0, 1, 3, 7, 15]);
    expect(offsets('INJ')).toEqual([0, 1, 3, 7]);
    expect(offsets('INFO')).toEqual([2, 5, 10]);
    expect(offsets('QUAL')).toEqual([1]);
    expect(offsets('INT')).toEqual([0, 1, 3]);
    expect(offsets('SHOW')).toEqual([1]);
    expect(offsets('DOS')).toEqual([0, 1, 2, 4, 7]);
  });

  it('only references activity types that exist', () => {
    const keys = new Set(MOURABAHA_ACTIVITY_TYPES.map((t) => t.key));
    for (const plan of MOURABAHA_PLANS) {
      for (const step of plan.steps) expect(keys.has(step.activityTypeKey)).toBe(true);
    }
  });
});

describe('Mourabaha seed lists', () => {
  it('has the two lost reasons and the call type requiring a result', () => {
    expect(MOURABAHA_LOST_REASONS).toEqual(['Pas intéressé', 'Non qualifié']);
    expect(MOURABAHA_ACTIVITY_TYPES.find((t) => t.key === 'call')).toMatchObject({ category: 'phonecall', requireResult: true });
  });

  it('lists the five default document requirements', () => {
    expect(MOURABAHA_DOCUMENT_REQUIREMENTS).toHaveLength(5);
  });
});
