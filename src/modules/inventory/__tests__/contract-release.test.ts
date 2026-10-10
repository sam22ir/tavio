import { describe, expect, it } from 'vitest';
import { CONTRACT_RELEASING_STATES, releasesContractReservations } from '../service/reservations';

describe('releasesContractReservations', () => {
  it('releases on refused', () => {
    expect(releasesContractReservations('refused')).toBe(true);
  });

  it('releases on cancelled', () => {
    expect(releasesContractReservations('cancelled')).toBe(true);
  });

  it('keeps reservations for the other contract states', () => {
    for (const state of ['draft', 'submitted', 'under_review', 'approved', 'reserved', 'active', 'completed', 'defaulted']) {
      expect(releasesContractReservations(state)).toBe(false);
    }
  });

  it('lists exactly refused and cancelled', () => {
    expect([...CONTRACT_RELEASING_STATES].sort()).toEqual(['cancelled', 'refused']);
  });
});
