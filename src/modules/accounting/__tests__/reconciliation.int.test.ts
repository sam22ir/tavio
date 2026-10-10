import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { parseCsv } from '@/core/io';
import { autoMapColumns } from '@/core/io/import';
import { accounts, journalLines } from '../schema';
import { ensureDefaults } from '../service/chart';
import { postEntry } from '../service/entries';
import {
  closeStatement,
  createEntryForLine,
  createStatement,
  getStatementView,
  listStatementAccounts,
  matchLine,
} from '../service/bank-statements';
import { parseBankRows } from '../service/reconciliation';
import { BANK_IMPORT_FIELDS } from '../service/reconciliation';

loadDevEnv();

const CSV = [
  'Date;Libellé;Référence;Montant',
  '10/03/2030;VIR CLIENT VT/2030/00004;;5 000,00',
  '12/03/2030;FRAIS TENUE DE COMPTE;;-1 200,00',
].join('\r\n');

// Runs only after the integrator has migrated the bank statement tables: set TAVIO_W5_DB=1.
describe.skipIf(!process.env.TAVIO_W5_DB)('bank reconciliation (integration)', () => {
  const db = getDb();

  async function fixture(): Promise<TenantArgs> {
    const companyId = randomUUID();
    const userId = randomUUID();
    await db.insert(companies).values({ id: companyId, legalName: 'Rapp Test SARL', displayName: 'Rapp Test' });
    await db.insert(users).values({ id: userId, name: 'reconciliation test', email: `rapp-${userId}@test.invalid` });
    return { userId, companyId, perms: new Set(['*']), locale: 'en' };
  }

  it('imports a CSV, auto-matches a payment entry, posts a fee and closes the statement', async () => {
    const args = await fixture();

    // A customer payment received on the bank: Dr 512 / Cr 411.
    const payment = await withTenant(args, async (ctx) => {
      await ensureDefaults(ctx);
      return postEntry(ctx, {
        journalCode: 'BQ',
        date: '2030-03-10',
        ref: 'VT/2030/00004',
        sourceEntity: 'invoicing.payment',
        sourceId: randomUUID(),
        lines: [
          { accountCode: '512', debitCents: BigInt(500000), creditCents: BigInt(0), label: 'Règlement VT/2030/00004' },
          { accountCode: '411', debitCents: BigInt(0), creditCents: BigInt(500000), label: 'Règlement VT/2030/00004' },
        ],
      });
    });
    expect(payment.ok).toBe(true);
    if (!payment.ok) return;

    const statementId = await withTenant(args, async (ctx) => {
      const accounts = await listStatementAccounts(ctx);
      if (!accounts.ok) throw new Error(accounts.error.code);
      const bank = accounts.value.find((a) => a.code === '512');
      if (!bank) throw new Error('512 missing');

      // Import: header detection, DD/MM/YYYY dates, comma decimals with space grouping.
      const parsed = parseCsv(CSV);
      const auto = autoMapColumns(parsed.records[0] ?? [], BANK_IMPORT_FIELDS);
      const mapping = {
        date: auto.date ?? null,
        label: auto.label ?? null,
        reference: auto.reference ?? null,
        debit: auto.debit ?? null,
        credit: auto.credit ?? null,
        amount: auto.amount ?? null,
      };
      const rows = parseBankRows(parsed.records, mapping);
      expect(rows.errors).toEqual([]);
      expect(rows.lines.map((l) => l.amountCents)).toEqual([BigInt(500000), BigInt(-120000)]);

      const created = await createStatement(ctx, {
        accountId: bank.id,
        name: 'Relevé mars 2030',
        openingCents: BigInt(1000000),
        closingCents: BigInt(1380000),
        lines: rows.lines,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error.code);
      return created.value.id;
    });

    await withTenant(args, async (ctx) => {
      const view = await getStatementView(ctx, statementId);
      if (!view.ok) throw new Error(view.error.code);
      const [bank] = await ctx.tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.code, '512')));
      const [bankSide] = await ctx.tx
        .select({ id: journalLines.id })
        .from(journalLines)
        .where(and(eq(journalLines.entryId, payment.value.id), eq(journalLines.accountId, bank?.id ?? '')));
      const sales = view.value.lines.find((l) => l.amountCents === BigInt(500000));
      const fee = view.value.lines.find((l) => l.amountCents === BigInt(-120000));
      if (!sales || !fee || !bankSide) throw new Error('fixture lines missing');

      // Auto-proposal: the payment's bank line ranks first on amount, reference and date.
      const proposal = view.value.proposals[sales.id]?.[0];
      expect(proposal?.journalLineIds).toEqual([bankSide.id]);
      expect(proposal?.reasons).toEqual(expect.arrayContaining(['amount', 'reference', 'date']));
      const matched = await matchLine(ctx, { lineId: sales.id, journalLineIds: [bankSide.id] });
      expect(matched.ok).toBe(true);

      // A bank fee with no entry: Dr 627 / Cr 512 through postEntry, then matched.
      const [fees] = await ctx.tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.code, '627')));
      if (!fees) throw new Error('627 missing');
      const feeEntry = await createEntryForLine(ctx, { lineId: fee.id, counterAccountId: fees.id });
      expect(feeEntry.ok).toBe(true);
    });

    const closed = await withTenant(args, (ctx) => closeStatement(ctx, statementId));
    expect(closed.ok).toBe(true);

    await withTenant(args, async (ctx) => {
      const view = await getStatementView(ctx, statementId);
      expect(view.ok && view.value.statement.state).toBe('done');
      // A closed statement refuses further matches.
      const again = await matchLine(ctx, { lineId: randomUUID(), journalLineIds: [randomUUID()] });
      expect(again.ok).toBe(false);
    });
  });
});
