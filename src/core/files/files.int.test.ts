import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, files, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { fileUrl, uploadFile } from './service';

// Use in-memory storage so the test never touches a real bucket.
vi.mock('@/core/adapters/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/core/adapters/storage')>();
  const memory = new mod.MemoryStorage();
  return { ...mod, getStorage: () => memory };
});

const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();

function argsFor(companyId: string): TenantArgs {
  return { userId, companyId, perms: new Set(['*']), locale: 'fr' };
}

const bytes = new TextEncoder().encode('hello pdf');

beforeAll(async () => {
  const db = getDb();
  await db.insert(users).values({ id: userId, name: 'Files Test', email: `files-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyA, legalName: 'Files Test A', displayName: 'A' },
    { id: companyB, legalName: 'Files Test B', displayName: 'B' },
  ]);
});

afterAll(async () => {
  const db = getDb();
  for (const companyId of [companyA, companyB]) {
    await withTenant(argsFor(companyId), (ctx) =>
      ctx.tx.delete(files).where(eq(files.companyId, companyId)),
    );
  }
  await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
  await db.delete(users).where(eq(users.id, userId));
});

describe('files service', () => {
  it('uploads a file, stores metadata and returns a signed URL', async () => {
    const up = await withTenant(argsFor(companyA), (ctx) =>
      uploadFile(ctx, {
        entity: 'credit_sales.contract',
        recordId: randomUUID(),
        fileName: 'contrat signé.pdf',
        contentType: 'application/pdf',
        bytes,
        kind: 'contract_pdf',
      }),
    );
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.value.companyId).toBe(companyA);
    expect(up.value.sizeBytes).toBe(bytes.byteLength);
    expect(up.value.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(up.value.storageKey.startsWith(`${companyA}/credit_sales.contract/`)).toBe(true);
    expect(up.value.storageKey).not.toContain(' ');

    const url = await withTenant(argsFor(companyA), (ctx) => fileUrl(ctx, up.value.id));
    expect(url.ok).toBe(true);
    if (url.ok) expect(url.value.startsWith('memory://')).toBe(true);
  });

  it('rejects files over 10 MB and disallowed types with VALIDATION', async () => {
    const base = {
      entity: 'x.y',
      recordId: randomUUID(),
      fileName: 'a.pdf',
      kind: 'attachment',
    };
    const big = await withTenant(argsFor(companyA), (ctx) =>
      uploadFile(ctx, { ...base, contentType: 'application/pdf', bytes: new Uint8Array(10 * 1024 * 1024 + 1) }),
    );
    expect(big).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    const exe = await withTenant(argsFor(companyA), (ctx) =>
      uploadFile(ctx, { ...base, contentType: 'application/x-msdownload', bytes }),
    );
    expect(exe).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('does not expose another tenant file and returns NOT_FOUND for unknown ids', async () => {
    const up = await withTenant(argsFor(companyA), (ctx) =>
      uploadFile(ctx, {
        entity: 'x.y',
        recordId: randomUUID(),
        fileName: 'logo.png',
        contentType: 'image/png',
        bytes,
        kind: 'logo',
      }),
    );
    if (!up.ok) throw new Error('upload failed');

    const crossTenant = await withTenant(argsFor(companyB), (ctx) => fileUrl(ctx, up.value.id));
    expect(crossTenant).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const missing = await withTenant(argsFor(companyA), (ctx) => fileUrl(ctx, randomUUID()));
    expect(missing).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});
