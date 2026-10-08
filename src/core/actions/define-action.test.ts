import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getActiveCompanyId: vi.fn(),
  getLocale: vi.fn(),
  loadTenantArgs: vi.fn(),
  enabledModules: vi.fn(),
  withTenant: vi.fn(),
}));

vi.mock('@/core/auth/session', () => ({ requireUser: m.requireUser }));
vi.mock('@/core/tenancy/active', () => ({ getActiveCompanyId: m.getActiveCompanyId }));
vi.mock('next-intl/server', () => ({ getLocale: m.getLocale }));
vi.mock('@/core/tenancy/service', () => ({
  loadTenantArgs: m.loadTenantArgs,
  enabledModules: m.enabledModules,
}));
vi.mock('@/core/db/tenant', () => ({ withTenant: m.withTenant }));

import { defineAction, toFormAction } from './define-action';

const USER = { userId: '11111111-1111-4111-8111-111111111111', email: 'a@b.co' };
const COMPANY = '22222222-2222-4222-8222-222222222222';
const TENANT = { userId: USER.userId, companyId: COMPANY, perms: new Set(['contacts.partner.write']), locale: 'fr' as const };

const schema = z.object({ name: z.string().min(2) });

function setHappyPath() {
  m.requireUser.mockResolvedValue({ ok: true, value: USER });
  m.getActiveCompanyId.mockResolvedValue(COMPANY);
  m.getLocale.mockResolvedValue('fr');
  m.loadTenantArgs.mockResolvedValue({ ok: true, value: TENANT });
  m.enabledModules.mockResolvedValue(['contacts']);
  m.withTenant.mockImplementation(async (_args: unknown, fn: (ctx: Ctx) => Promise<unknown>) =>
    fn({ ...TENANT, tx: {} as Ctx['tx'] }),
  );
}

describe('defineAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHappyPath();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns UNAUTHENTICATED when there is no session', async () => {
    m.requireUser.mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'x' } });
    const fn = vi.fn();
    const action = defineAction({ perm: 'contacts.partner.write', schema }, fn);
    const res = await action({ name: 'Ali' });
    expect(res).toEqual({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'x' } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN NO_COMPANY when no active company', async () => {
    m.getActiveCompanyId.mockResolvedValue(null);
    const action = defineAction({ perm: 'contacts.partner.write', schema }, vi.fn());
    const res = await action({ name: 'Ali' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatchObject({ code: 'FORBIDDEN', message: 'NO_COMPANY' });
  });

  it('passes the locale to loadTenantArgs', async () => {
    const action = defineAction({ perm: 'contacts.partner.write', schema }, async () => ({ ok: true, value: 1 }));
    await action({ name: 'Ali' });
    expect(m.loadTenantArgs).toHaveBeenCalledWith(USER.userId, COMPANY, 'fr');
  });

  it('propagates the loadTenantArgs FORBIDDEN error', async () => {
    m.loadTenantArgs.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', message: 'no membership' } });
    const action = defineAction({ perm: 'contacts.partner.write', schema }, vi.fn());
    const res = await action({ name: 'Ali' });
    expect(res).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: 'no membership' } });
  });

  it('returns MODULE_DISABLED when the module is off', async () => {
    m.enabledModules.mockResolvedValue(['core']);
    const fn = vi.fn();
    const action = defineAction({ perm: 'contacts.partner.write', schema, module: 'contacts' }, fn);
    const res = await action({ name: 'Ali' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MODULE_DISABLED');
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs when the module is enabled', async () => {
    const action = defineAction({ perm: 'contacts.partner.write', schema, module: 'contacts' }, async () => ({ ok: true, value: 'done' }));
    expect(await action({ name: 'Ali' })).toEqual({ ok: true, value: 'done' });
  });

  it('returns FORBIDDEN when the permission is missing, without calling fn', async () => {
    const fn = vi.fn();
    const action = defineAction({ perm: 'credit.contract.write', schema }, fn);
    const res = await action({ name: 'Ali' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FORBIDDEN');
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns VALIDATION with issues and does not call fn on bad input', async () => {
    const fn = vi.fn();
    const action = defineAction({ perm: 'contacts.partner.write', schema }, fn);
    const res = await action({ name: 'A' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION');
      const issues = res.error.details?.issues as { path: PropertyKey[] }[];
      expect(issues[0]?.path).toEqual(['name']);
      expect(JSON.stringify(res.error)).not.toContain('"A"');
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls fn with the parsed input and the tenant ctx', async () => {
    const fn = vi.fn(async (_ctx: Ctx, input: { name: string }) => ({ ok: true as const, value: input.name }));
    const action = defineAction({ perm: 'contacts.partner.write', schema }, fn);
    expect(await action({ name: 'Ali' })).toEqual({ ok: true, value: 'Ali' });
    expect(fn.mock.calls[0]?.[0]).toMatchObject({ companyId: COMPANY, userId: USER.userId });
  });

  it('rolls back the transaction when fn returns an error result', async () => {
    const action = defineAction({ perm: 'contacts.partner.write', schema }, async () => ({
      ok: false as const,
      error: { code: 'CONFLICT' as const, message: 'dup' },
    }));
    const res = await action({ name: 'Ali' });
    expect(res).toEqual({ ok: false, error: { code: 'CONFLICT', message: 'dup' } });
    expect(m.withTenant).toHaveBeenCalledTimes(1);
  });

  it('maps a POSTED_IMMUTABLE throw to that code', async () => {
    const action = defineAction({ perm: 'contacts.partner.write', schema }, async () => {
      throw new Error('POSTED_IMMUTABLE');
    });
    const res = await action({ name: 'Ali' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('POSTED_IMMUTABLE');
  });

  it('maps any other throw to INTERNAL without leaking input', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const action = defineAction({ perm: 'contacts.partner.write', schema }, async () => {
      throw new Error('boom with SECRET-VALUE');
    });
    const res = await action({ name: 'SECRET-INPUT' });
    expect(res).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Internal error', details: undefined } });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('SECRET-INPUT');
  });
});

describe('toFormAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps VALIDATION issues to fieldErrors', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'VALIDATION' as const,
        message: 'Invalid input',
        details: { issues: [{ path: ['name'], message: 'too short', code: 'too_small' }] },
      },
    }));
    const form = toFormAction(action, { schema });
    const fd = new FormData();
    fd.set('name', 'A');
    const state = await form({ ok: undefined }, fd);
    expect(action).toHaveBeenCalledWith({ name: 'A' });
    expect(state.ok).toBe(false);
    expect(state.fieldErrors).toEqual({ name: 'too short' });
  });

  it('returns redirectTo on success', async () => {
    const action = vi.fn(async () => ({ ok: true as const, value: { id: 'x' } }));
    const form = toFormAction(action, { schema, redirectTo: (v) => `/fr/c/${v.id}` });
    const state = await form({}, new FormData());
    expect(state).toEqual({ ok: true, redirectTo: '/fr/c/x' });
  });

  it('returns a message for non-validation errors', async () => {
    const action = vi.fn(async () => ({ ok: false as const, error: { code: 'FORBIDDEN' as const, message: 'no' } }));
    const form = toFormAction(action, { schema });
    const state = await form({}, new FormData());
    expect(state.ok).toBe(false);
    expect(state.fieldErrors).toBeUndefined();
  });
});
