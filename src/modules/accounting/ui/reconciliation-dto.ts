// Plain, serializable view of a statement for the client. Money is sent as decimal cent strings and parsed in the UI.
import type { StatementView } from '../service/bank-statements';

export interface LineDto {
  id: string;
  date: string;
  label: string;
  reference: string | null;
  amount: string;
  state: 'unmatched' | 'matched' | 'ignored';
  matches: { journalLineId: string; entryNumber: string; date: string; value: string }[];
}

export interface CandidateDto {
  journalLineId: string;
  date: string;
  value: string;
  entryNumber: string;
  entryRef: string | null;
  lineLabel: string | null;
}

export interface ProposalDto {
  kind: 'single' | 'group';
  journalLineIds: string[];
  score: number;
  reasons: string[];
}

export interface StatementDto {
  id: string;
  name: string;
  accountCode: string;
  dateFrom: string;
  dateTo: string;
  opening: string;
  closing: string;
  gap: string;
  state: 'open' | 'done';
  lines: LineDto[];
  candidates: CandidateDto[];
  proposals: Record<string, ProposalDto[]>;
  counterAccounts: { id: string; code: string; name: string }[];
}

export function toStatementDto(view: StatementView): StatementDto {
  const s = view.statement;
  return {
    id: s.id,
    name: s.name,
    accountCode: s.accountCode,
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
    opening: s.openingBalanceCents.toString(),
    closing: s.closingBalanceCents.toString(),
    gap: view.gapCents.toString(),
    state: s.state,
    lines: view.lines.map((l) => ({
      id: l.id,
      date: l.date,
      label: l.label,
      reference: l.reference,
      amount: l.amountCents.toString(),
      state: l.state,
      matches: l.matches.map((m) => ({ journalLineId: m.journalLineId, entryNumber: m.entryNumber, date: m.date, value: m.valueCents.toString() })),
    })),
    candidates: view.candidates.map((c) => ({
      journalLineId: c.journalLineId,
      date: c.entryDate,
      value: c.valueCents.toString(),
      entryNumber: c.entryNumber,
      entryRef: c.entryRef,
      lineLabel: c.lineLabel,
    })),
    proposals: Object.fromEntries(
      Object.entries(view.proposals).map(([id, ps]) => [id, ps.map((p) => ({ kind: p.kind, journalLineIds: p.journalLineIds, score: p.score, reasons: p.reasons }))]),
    ),
    counterAccounts: view.counterAccounts.map((a) => ({ id: a.id, code: a.code, name: a.name })),
  };
}

/** Translation key carried in an error's details (see core/result err). */
export function messageKeyOf(error: { details?: Record<string, unknown> }): string | undefined {
  const key = error.details?.messageKey;
  return typeof key === 'string' ? key : undefined;
}
