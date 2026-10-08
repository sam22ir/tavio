import type { Locale } from '@/i18n/routing';

export function dirFor(l: Locale): 'rtl' | 'ltr' {
  return l === 'ar' ? 'rtl' : 'ltr';
}
