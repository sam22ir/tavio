// Total written in words for invoices (Algerian practice): "<dinars> dinars algériens et <centimes> centime(s)".
// Pure functions on bigint cents. Covers French (fr), Modern Standard Arabic (ar) and English (en).

export type WordsLocale = 'fr' | 'ar' | 'en';

const BILLION = BigInt(1_000_000_000);
const MILLION = BigInt(1_000_000);
const THOUSAND = BigInt(1000);
const HUNDRED_CENTS = BigInt(100);

/** Amount in words for a bigint cents value. Dinars are the integer part, centimes the rest. */
export function amountInWords(cents: bigint, locale: WordsLocale): string {
  if (cents < BigInt(0)) throw new RangeError('amountInWords: negative amount');
  const dinars = cents / HUNDRED_CENTS;
  const centimes = cents % HUNDRED_CENTS;
  if (locale === 'fr') return frAmount(dinars, centimes);
  if (locale === 'ar') return arAmount(dinars, centimes);
  return enAmount(dinars, centimes);
}

// ---------- French ----------

const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const FR_TENS: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

/**
 * 0..99. `final` is true when nothing number-like follows (so "quatre-vingts" keeps its s).
 * Before "mille" the s is dropped ("quatre-vingt mille"); before "million(s)" it is kept.
 */
function frBelowHundred(n: number, final: boolean): string {
  if (n < 20) return FR_UNITS[n] as string;
  if (n < 70) {
    const base = FR_TENS[Math.floor(n / 10)] as string;
    const u = n % 10;
    if (u === 0) return base;
    if (u === 1) return `${base} et un`;
    return `${base}-${FR_UNITS[u]}`;
  }
  if (n < 80) {
    const k = n - 60; // 10..19
    if (k === 10) return 'soixante-dix';
    if (k === 11) return 'soixante et onze';
    return `soixante-${FR_UNITS[k]}`;
  }
  const k = n - 80;
  if (k === 0) return final ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${FR_UNITS[k]}`;
}

/** 0..999. "cent" takes an s only when it is a plain multiple of a hundred and nothing number-like follows. */
function frBelowThousand(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return frBelowHundred(r, final);
  const head = h === 1 ? 'cent' : `${FR_UNITS[h]} cent${r === 0 && final ? 's' : ''}`;
  return r === 0 ? head : `${head} ${frBelowHundred(r, final)}`;
}

/** Any non-negative integer in French. Milliards and millions are nouns, so their count keeps the plural s. */
function frInteger(n: bigint): string {
  if (n === BigInt(0)) return 'zéro';
  const parts: string[] = [];
  let rest = n;
  const bil = rest / BILLION;
  rest %= BILLION;
  if (bil > BigInt(0)) parts.push(bil === BigInt(1) ? 'un milliard' : `${frInteger(bil)} milliards`);
  const mil = rest / MILLION;
  rest %= MILLION;
  if (mil > BigInt(0)) parts.push(mil === BigInt(1) ? 'un million' : `${frInteger(mil)} millions`);
  const th = Number(rest / THOUSAND);
  rest %= THOUSAND;
  if (th > 0) parts.push(th === 1 ? 'mille' : `${frBelowThousand(th, false)} mille`);
  const low = Number(rest);
  if (low > 0) parts.push(frBelowThousand(low, true));
  return parts.join(' ');
}

function frAmount(dinars: bigint, centimes: bigint): string {
  let dinarPhrase: string;
  if (dinars === BigInt(0)) dinarPhrase = 'zéro dinar algérien';
  else if (dinars === BigInt(1)) dinarPhrase = 'un dinar algérien';
  else {
    // "un million de dinars": a de follows an exact million or milliard.
    const de = dinars >= MILLION && dinars % MILLION === BigInt(0) ? ' de' : '';
    dinarPhrase = `${frInteger(dinars)}${de} dinars algériens`;
  }
  let centPhrase: string;
  if (centimes === BigInt(0)) centPhrase = 'zéro centime';
  else if (centimes === BigInt(1)) centPhrase = 'un centime';
  else centPhrase = `${frBelowHundred(Number(centimes), true)} centimes`;
  return `${dinarPhrase} et ${centPhrase}`;
}

// ---------- Arabic (MSA) ----------

const AR_ONES = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
const AR_TEENS = [
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
  'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
// Units placed before a ten (21 to 99) take the feminine forms, e.g. 77 is سبعة وسبعون.
const AR_COMPOUND_ONES = ['', 'أحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

/** 0..99 in Arabic. */
function arBelowHundred(n: number): string {
  if (n <= 10) return AR_ONES[n] as string;
  if (n < 20) return AR_TEENS[n - 11] as string;
  const tens = AR_TENS[Math.floor(n / 10)] as string;
  const u = n % 10;
  if (u === 0) return tens;
  return `${AR_COMPOUND_ONES[u]} و${tens}`;
}

/** 0..999 in Arabic. Hundreds are joined to the rest with "و". */
function arBelowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return arBelowHundred(r);
  if (r === 0) return AR_HUNDREDS[h] as string;
  return `${AR_HUNDREDS[h]} و${arBelowHundred(r)}`;
}

/** A count of thousands, millions or milliards, with the Arabic singular/dual/plural/accusative forms. */
function arScaled(k: bigint, forms: [string, string, string, string]): string {
  const [one, two, few, many] = forms;
  if (k === BigInt(1)) return one;
  if (k === BigInt(2)) return two;
  if (k >= BigInt(3) && k <= BigInt(10)) return `${AR_ONES[Number(k)]} ${few}`;
  return `${arInteger(k)} ${many}`;
}

/** Any non-negative integer in Arabic. */
function arInteger(n: bigint): string {
  if (n === BigInt(0)) return 'صفر';
  const parts: string[] = [];
  let rest = n;
  const bil = rest / BILLION;
  rest %= BILLION;
  if (bil > BigInt(0)) parts.push(arScaled(bil, ['ملياراً', 'ملياران', 'مليارات', 'ملياراً']));
  const mil = rest / MILLION;
  rest %= MILLION;
  if (mil > BigInt(0)) parts.push(arScaled(mil, ['مليون', 'مليونان', 'ملايين', 'مليوناً']));
  const th = rest / THOUSAND;
  rest %= THOUSAND;
  if (th > BigInt(0)) parts.push(arScaled(th, ['ألف', 'ألفان', 'آلاف', 'ألفاً']));
  const low = Number(rest);
  if (low > 0) parts.push(arBelowThousand(low));
  return parts.join(' و');
}

function arAmount(dinars: bigint, centimes: bigint): string {
  const dinarPhrase = `${arInteger(dinars)} دينار جزائري`;
  const centPhrase = `${arBelowHundred(Number(centimes))} سنتيم`;
  return `${dinarPhrase} و${centPhrase}`;
}

// ---------- English ----------

const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enBelowHundred(n: number): string {
  if (n < 20) return EN_ONES[n] as string;
  const u = n % 10;
  return u === 0 ? (EN_TENS[Math.floor(n / 10)] as string) : `${EN_TENS[Math.floor(n / 10)]}-${EN_ONES[u]}`;
}

function enBelowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return enBelowHundred(r);
  return r === 0 ? `${EN_ONES[h]} hundred` : `${EN_ONES[h]} hundred and ${enBelowHundred(r)}`;
}

function enInteger(n: bigint): string {
  if (n === BigInt(0)) return 'zero';
  const scales: [bigint, string][] = [[BILLION, 'billion'], [MILLION, 'million'], [THOUSAND, 'thousand']];
  const parts: string[] = [];
  let rest = n;
  for (const [value, name] of scales) {
    const k = rest / value;
    rest %= value;
    if (k > BigInt(0)) parts.push(`${enBelowThousand(Number(k))} ${name}`);
  }
  if (rest > BigInt(0)) parts.push(enBelowThousand(Number(rest)));
  return parts.join(' ');
}

function enAmount(dinars: bigint, centimes: bigint): string {
  const dinarPhrase = `${enInteger(dinars)} Algerian ${dinars === BigInt(1) ? 'dinar' : 'dinars'}`;
  const centPhrase = `${enBelowHundred(Number(centimes))} ${centimes === BigInt(1) ? 'cent' : 'cents'}`;
  return `${dinarPhrase} and ${centPhrase}`;
}
