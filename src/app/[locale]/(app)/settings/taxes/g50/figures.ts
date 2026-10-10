import type { G50Figures } from '@/modules/l10n_dz';

/** Figures as stored in g50_declarations.figures (bigints as decimal strings). */
export function figureCents(figures: G50Figures): {
  collected: bigint;
  deductible: bigint;
  net: bigint;
  stamp: bigint;
  withholding: bigint;
} {
  return {
    collected: BigInt(figures.collectedCents),
    deductible: BigInt(figures.deductibleCents),
    net: BigInt(figures.netDueCents),
    stamp: BigInt(figures.stampCents),
    withholding: BigInt(figures.withholdingCents ?? '0'),
  };
}
