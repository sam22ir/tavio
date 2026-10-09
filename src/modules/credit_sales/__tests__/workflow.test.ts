import { describe, expect, it } from 'vitest';
import { canTransition, nextStates } from '../service/transitions';
import { missingRequiredDocuments } from '../service/documents';

describe('contract transitions', () => {
  it('allows the full review path and the existing draft to active flow', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'under_review')).toBe(true);
    expect(canTransition('under_review', 'approved')).toBe(true);
    expect(canTransition('under_review', 'refused')).toBe(true);
    expect(canTransition('approved', 'reserved')).toBe(true);
    expect(canTransition('reserved', 'active')).toBe(true);
    expect(canTransition('draft', 'active')).toBe(true);
  });

  it('refuses skipped steps, reversals and moves out of terminal states', () => {
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('submitted', 'approved')).toBe(false);
    expect(canTransition('approved', 'active')).toBe(false);
    expect(canTransition('approved', 'under_review')).toBe(false);
    expect(canTransition('refused', 'approved')).toBe(false);
    expect(canTransition('refused', 'active')).toBe(false);
    expect(canTransition('cancelled', 'active')).toBe(false);
    expect(canTransition('active', 'draft')).toBe(false);
  });

  it('keeps cancel only for draft and active contracts', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('active', 'cancelled')).toBe(true);
    expect(canTransition('submitted', 'cancelled')).toBe(false);
    expect(canTransition('reserved', 'cancelled')).toBe(false);
  });

  it('treats unknown states as having no moves', () => {
    expect(canTransition('nonsense', 'active')).toBe(false);
    expect(nextStates('nonsense')).toEqual([]);
  });

  it('lists next states for the workflow bar', () => {
    expect(nextStates('under_review')).toEqual(['approved', 'refused']);
    expect(nextStates('refused')).toEqual([]);
  });
});

describe('missingRequiredDocuments', () => {
  it('returns required documents that are not received, and ignores optional ones', () => {
    const missing = missingRequiredDocuments([
      { documentId: '1', name: 'CIN', required: true, status: 'received' },
      { documentId: '2', name: 'Bank statement', required: true, status: 'missing' },
      { documentId: '3', name: 'Cheque', required: true, status: 'rejected' },
      { documentId: '4', name: 'Photo', required: false, status: 'missing' },
    ]);
    expect(missing).toEqual(['Bank statement', 'Cheque']);
  });

  it('is empty when every required document is received or there are none', () => {
    expect(missingRequiredDocuments([])).toEqual([]);
    expect(missingRequiredDocuments([{ documentId: '1', name: 'CIN', required: true, status: 'received' }])).toEqual([]);
  });
});
