// Tenancy service. Runs as the owner connection (getDb(), no withTenant) and always filters by userId.
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import {
  companies,
  companyModules,
  memberships,
  rolePermissions,
  roles,
} from '@/core/db/schema';
import type { Db } from '@/core/db/types';
import type { TenantArgs } from '@/core/db/tenant';
import type { Locale } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { DEFAULT_MODULES, DEFAULT_ROLES } from './default-roles';
import { activityTypes } from '@/modules/chatter/schema';
import { ACTIVITY_TYPE_SEED } from '@/modules/chatter/entities';

export interface CompanySummary { id: string; name: string; roleKey: string; isDemo: boolean }
export interface NewCompanyInput {
  legalName: string;
  phone?: string;
  address?: string;
  wilayaCode?: string;
  businessType?: string;
  isDemo?: boolean;
}

/** Archived companies are hidden from every company list. */
export function visibleCompanyRows<T extends { archivedAt: Date | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.archivedAt === null);
}

/**
 * Why a company cannot be archived by this user, or null when it can. Only demo companies, only their owner,
 * and an archived company is already gone for the user.
 */
export function archiveRefusal(
  company: { isDemo: boolean | null; archivedAt: Date | null } | undefined,
  roleKey: string | null,
): 'NOT_FOUND' | 'FORBIDDEN' | null {
  if (!company || company.archivedAt !== null) return 'NOT_FOUND';
  if (!company.isDemo) return 'FORBIDDEN';
  if (roleKey !== 'owner') return 'FORBIDDEN';
  return null;
}

export const MODULE_VERSION = '0.1.0';

export async function listMyCompanies(userId: string, db: Db = getDb()): Promise<CompanySummary[]> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.displayName,
      roleKey: roles.key,
      isDemo: companies.isDemo,
      archivedAt: companies.archivedAt,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')));
  return visibleCompanyRows(rows).map((r) => ({ id: r.id, name: r.name, roleKey: r.roleKey, isDemo: r.isDemo ?? false }));
}

/** The user's first visible company that is not a demo: where their real data lives. */
export async function homeCompanyOf(userId: string, db: Db = getDb()): Promise<CompanySummary | null> {
  const mine = await listMyCompanies(userId, db);
  return mine.find((c) => !c.isDemo) ?? null;
}

/** Whether a company is a demo company. False when unknown. */
export async function companyIsDemo(companyId: string, db: Db = getDb()): Promise<boolean> {
  const [row] = await db.select({ isDemo: companies.isDemo }).from(companies).where(eq(companies.id, companyId));
  return row?.isDemo ?? false;
}

/** Archives a demo company. Owner only. No data is deleted; the company is hidden from the user's lists. */
export async function archiveDemoCompany(
  userId: string,
  companyId: string,
  db: Db = getDb(),
): Promise<Result<{ companyId: string }>> {
  const [company] = await db
    .select({ isDemo: companies.isDemo, archivedAt: companies.archivedAt })
    .from(companies)
    .where(eq(companies.id, companyId));
  const [membership] = await db
    .select({ roleKey: roles.key })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.userId, userId), eq(memberships.companyId, companyId), eq(memberships.status, 'active')));
  const refusal = archiveRefusal(company, membership?.roleKey ?? null);
  if (refusal === 'NOT_FOUND') return err('NOT_FOUND', 'demo company not found');
  if (refusal === 'FORBIDDEN') return err('FORBIDDEN', 'only the owner of a demo company can archive it');
  await db.update(companies).set({ archivedAt: new Date() }).where(and(eq(companies.id, companyId), isNull(companies.archivedAt)));
  return ok({ companyId });
}

export async function createCompany(
  userId: string,
  input: NewCompanyInput,
  db: Db = getDb(),
): Promise<Result<{ companyId: string }>> {
  const legalName = input.legalName.trim();
  if (legalName.length < 2) return err('VALIDATION', 'legalName must be at least 2 characters');
  try {
    const companyId = await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({
          legalName,
          displayName: legalName,
          phone: input.phone,
          address: input.address,
          wilayaCode: input.wilayaCode,
          businessType: input.businessType,
          isDemo: input.isDemo ?? false,
          createdBy: userId,
        })
        .returning({ id: companies.id });
      if (!company) throw new Error('company insert returned no row');

      const insertedRoles = await tx
        .insert(roles)
        .values(
          DEFAULT_ROLES.map((r) => ({
            companyId: company.id,
            key: r.key,
            name: r.name,
            isSystem: true,
            createdBy: userId,
          })),
        )
        .returning({ id: roles.id, key: roles.key });

      const permissionRows = DEFAULT_ROLES.flatMap((def) => {
        const role = insertedRoles.find((r) => r.key === def.key);
        if (!role) throw new Error(`missing seeded role ${def.key}`);
        return def.permissions.map((permission) => ({
          companyId: company.id,
          roleId: role.id,
          permission,
          createdBy: userId,
        }));
      });
      await tx.insert(rolePermissions).values(permissionRows);

      const ownerRole = insertedRoles.find((r) => r.key === 'owner');
      if (!ownerRole) throw new Error('missing owner role');
      await tx.insert(memberships).values({
        companyId: company.id,
        userId,
        roleId: ownerRole.id,
        status: 'active',
        joinedAt: new Date(),
        createdBy: userId,
      });

      const now = new Date();
      await tx.insert(companyModules).values(
        DEFAULT_MODULES.map((moduleId) => ({
          companyId: company.id,
          moduleId,
          version: MODULE_VERSION,
          enabled: true,
          enabledAt: now,
          createdBy: userId,
        })),
      );

      // Default activity types (name holds the stable key; the UI translates chatter.types.<name>).
      await tx.insert(activityTypes).values(
        ACTIVITY_TYPE_SEED.map((t) => ({
          companyId: company.id,
          name: t.key,
          defaultDays: t.defaultDays,
          delayCount: t.defaultDays,
          delayUnit: 'days',
          icon: t.icon,
          createdBy: userId,
        })),
      );
      return company.id;
    });
    return ok({ companyId });
  } catch {
    return err('INTERNAL', 'could not create company');
  }
}

/**
 * A company this user created in the last `windowMs` with the same legal name. Used to make a repeated
 * create (double submit, reload) return the first company instead of making a duplicate.
 */
export async function findRecentOwnedCompany(
  userId: string,
  legalName: string,
  windowMs = 2 * 60 * 1000,
  db: Db = getDb(),
): Promise<{ id: string } | null> {
  const since = new Date(Date.now() - windowMs);
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.createdBy, userId),
        eq(companies.legalName, legalName.trim()),
        gte(companies.createdAt, since),
      ),
    )
    .orderBy(desc(companies.createdAt))
    .limit(1);
  return row ?? null;
}

export async function loadTenantArgs(
  userId: string,
  companyId: string,
  locale: Locale,
  db: Db = getDb(),
): Promise<Result<TenantArgs>> {
  const [membership] = await db
    .select({ roleId: memberships.roleId })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.status, 'active'),
        isNull(companies.archivedAt),
      ),
    );
  if (!membership) return err('FORBIDDEN', 'no active membership in this company');

  const perms = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, membership.roleId), eq(rolePermissions.companyId, companyId)));

  return ok({
    userId,
    companyId,
    perms: new Set(perms.map((p) => p.permission)),
    locale,
  });
}

export async function enabledModules(companyId: string, db: Db = getDb()): Promise<string[]> {
  const rows = await db
    .select({ moduleId: companyModules.moduleId })
    .from(companyModules)
    .where(and(eq(companyModules.companyId, companyId), eq(companyModules.enabled, true)));
  return rows.map((r) => r.moduleId);
}
