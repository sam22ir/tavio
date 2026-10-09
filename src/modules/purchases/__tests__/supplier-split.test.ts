import { describe, expect, it } from 'vitest';
import { splitBySupplier } from '../service/supplier-split';

describe('splitBySupplier', () => {
  const lines = [
    { lineNo: 1, productId: 'p1' },
    { lineNo: 2, productId: 'p2' },
    { lineNo: 3, productId: null },
    { lineNo: 4, productId: 'p3' },
    { lineNo: 5, productId: 'p1' },
  ];

  it('groups lines by supplier and skips lines without a product or supplier', () => {
    const split = splitBySupplier(lines, [
      { productId: 'p1', partnerId: 's-a', sequence: 10 },
      { productId: 'p2', partnerId: 's-b', sequence: 10 },
      { productId: 'p1', partnerId: 's-b', sequence: 10 },
    ]);
    expect(split.groups).toEqual([
      { partnerId: 's-a', lineNos: [1, 5] },
      { partnerId: 's-b', lineNos: [2] },
    ]);
    expect(split.skippedLineNos).toEqual([3, 4]);
  });

  it('prefers the lowest sequence, then the lowest partner id', () => {
    const split = splitBySupplier([{ lineNo: 1, productId: 'p1' }], [
      { productId: 'p1', partnerId: 's-z', sequence: 5 },
      { productId: 'p1', partnerId: 's-a', sequence: 20 },
    ]);
    expect(split.groups).toEqual([{ partnerId: 's-z', lineNos: [1] }]);

    const tie = splitBySupplier([{ lineNo: 1, productId: 'p1' }], [
      { productId: 'p1', partnerId: 's-z', sequence: 10 },
      { productId: 'p1', partnerId: 's-a', sequence: 10 },
    ]);
    expect(tie.groups).toEqual([{ partnerId: 's-a', lineNos: [1] }]);
  });

  it('returns no groups when no line has a supplier', () => {
    expect(splitBySupplier(lines, [])).toEqual({ groups: [], skippedLineNos: [1, 2, 3, 4, 5] });
  });
});
