import type { Tx } from './db/types';
export type Locale = 'fr' | 'ar' | 'en';
export interface Ctx {
  readonly userId: string;
  readonly companyId: string;
  readonly perms: ReadonlySet<string>;
  readonly locale: Locale;
  readonly tx: Tx;
}
