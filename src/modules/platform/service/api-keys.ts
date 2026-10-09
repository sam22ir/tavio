import { and, desc, eq, isNull } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { Db } from '@/core/db/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { apiKeys } from '../schema';
import { API_SCOPES, generateApiKey, hashApiKey, isApiScope, verifyApiKey, type ApiScope } from './api-keys-crypto';

const READ = 'platform.api_key.read';
const WRITE = 'platform.api_key.write';

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AuthenticatedKey {
  keyId: string;
  companyId: string;
  scopes: ApiScope[];
}

export async function listApiKeys(ctx: Ctx): Promise<Result<ApiKeySummary[]>> {
  const perm = requirePerm(ctx, READ);
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.companyId, ctx.companyId))
    .orderBy(desc(apiKeys.createdAt));
  return ok(rows);
}

/** Creates a key. The returned `token` is the only time the full value exists. */
export async function createApiKey(
  ctx: Ctx,
  input: { name: string; scopes: string[] },
): Promise<Result<{ id: string; token: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;

  const name = input.name.trim();
  if (name.length === 0 || name.length > 100) return err('VALIDATION', 'name must be 1 to 100 characters');
  const scopes = [...new Set(input.scopes)];
  if (scopes.length === 0 || !scopes.every(isApiScope)) {
    return err('VALIDATION', `scopes must be a non-empty subset of ${API_SCOPES.join(', ')}`);
  }

  const key = generateApiKey();
  const [row] = await ctx.tx
    .insert(apiKeys)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      name,
      prefix: key.prefix,
      hash: key.hash,
      scopes,
    })
    .returning({ id: apiKeys.id });
  if (!row) return err('INTERNAL', 'insert returned no row');

  // The audit row records the key's metadata only, never the token or its hash.
  await audit(ctx, { entity: 'platform.api_key', recordId: row.id, action: 'create', after: { name, scopes } });
  return ok({ id: row.id, token: key.token });
}

export async function revokeApiKey(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .update(apiKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.companyId, ctx.companyId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  if (!row) return err('NOT_FOUND', 'api key not found or already revoked');
  await audit(ctx, { entity: 'platform.api_key', recordId: row.id, action: 'revoke' });
  return ok({ id: row.id });
}

/**
 * Resolves a presented token to its company and scopes. Used by the REST route before any tenant
 * context exists, so it runs on the owner connection. The integrator must run it under a role that can read api_keys across tenants.
 * Returns null for unknown, revoked or mismatched tokens. Touches last_used_at on success.
 */
export async function authenticateApiKey(db: Db, token: string): Promise<AuthenticatedKey | null> {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.hash, hashApiKey(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row || !verifyApiKey(token, row.hash)) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { keyId: row.id, companyId: row.companyId, scopes: row.scopes.filter(isApiScope) };
}
