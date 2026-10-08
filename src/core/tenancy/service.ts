// STUB owned by P00-W2-E. Signatures are frozen; the implementation replaces the bodies.
import type { Db } from '@/core/db/types';
import type { Locale } from '@/core/ctx';
import type { TenantArgs } from '@/core/db/tenant';
import type { Result } from '@/core/result';

export interface CompanySummary { id: string; name: string; roleKey: string }
export interface NewCompanyInput { legalName: string; phone?: string; address?: string; wilayaCode?: string }

export async function listMyCompanies(_userId: string, _db?: Db): Promise<CompanySummary[]> { throw new Error('not implemented'); }
export async function createCompany(_userId: string, _input: NewCompanyInput, _db?: Db): Promise<Result<{ companyId: string }>> { throw new Error('not implemented'); }
export async function loadTenantArgs(_userId: string, _companyId: string, _locale: Locale, _db?: Db): Promise<Result<TenantArgs>> { throw new Error('not implemented'); }
export async function enabledModules(_companyId: string, _db?: Db): Promise<string[]> { throw new Error('not implemented'); }
