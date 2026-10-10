// Zod issue messages for the import preview, in fr, ar and en. Zod's own texts are English and developer-facing.

export type IoLocale = 'fr' | 'ar' | 'en';

export interface IssueLike {
  code: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  format?: string;
  expected?: string;
  message?: string;
  input?: unknown;
}

type Texts = Record<IoLocale, string>;

const REQUIRED: Texts = { fr: 'champ obligatoire', ar: 'حقل إلزامي', en: 'required field' };
const INVALID_TYPE: Texts = { fr: 'type de valeur incorrect', ar: 'نوع القيمة غير صحيح', en: 'invalid value type' };
const TOO_SMALL: Texts = { fr: 'valeur trop courte ou trop petite', ar: 'القيمة قصيرة أو صغيرة جدا', en: 'value too short or too small' };
const TOO_BIG: Texts = { fr: 'valeur trop longue ou trop grande', ar: 'القيمة طويلة أو كبيرة جدا', en: 'value too long or too large' };
const INVALID_FORMAT: Texts = { fr: 'format invalide', ar: 'تنسيق غير صالح', en: 'invalid format' };
const INVALID_VALUE: Texts = { fr: 'valeur non autorisée', ar: 'قيمة غير مسموح بها', en: 'value not allowed' };
const UNKNOWN: Texts = { fr: 'valeur invalide', ar: 'قيمة غير صالحة', en: 'invalid value' };

/** Messages raised by our own zod refinements. Keys are the message strings used in the schemas. */
export const CUSTOM_MESSAGES: Record<string, Texts> = {
  ACCOUNT_CODE: {
    fr: 'code de compte : 2 à 8 chiffres',
    ar: 'رمز الحساب: من 2 إلى 8 أرقام',
    en: 'account code: 2 to 8 digits',
  },
  MONEY: {
    fr: 'montant invalide (ex. 1500,50)',
    ar: 'مبلغ غير صالح (مثال 1500.50)',
    en: 'invalid amount (e.g. 1500.50)',
  },
  NEGATIVE: {
    fr: 'montant négatif interdit',
    ar: 'المبلغ السالب غير مسموح',
    en: 'negative amount not allowed',
  },
  BOTH_SIDES: {
    fr: 'renseignez le débit ou le crédit, pas les deux',
    ar: 'أدخل المدين أو الدائن وليس الاثنين',
    en: 'fill either debit or credit, not both',
  },
  DATE: {
    fr: 'date invalide (AAAA-MM-JJ)',
    ar: 'تاريخ غير صالح (السنة-الشهر-اليوم)',
    en: 'invalid date (YYYY-MM-DD)',
  },
  ACCOUNT_TYPE: {
    fr: 'type de compte inconnu (actif, passif, capitaux, produit, charge)',
    ar: 'نوع حساب غير معروف',
    en: 'unknown account type (asset, liability, equity, income, expense)',
  },
  PARENT_MISMATCH: {
    fr: 'le compte parent doit correspondre au code (préfixe)',
    ar: 'يجب أن يتطابق الحساب الأب مع الرمز',
    en: 'parent account must match the code prefix',
  },
  QUANTITY: {
    fr: 'quantité invalide (nombre positif)',
    ar: 'كمية غير صالحة (رقم موجب)',
    en: 'invalid quantity (positive number)',
  },
  WAREHOUSE_NOT_FOUND: {
    fr: 'dépôt introuvable (code)',
    ar: 'المخزن غير موجود (الرمز)',
    en: 'warehouse not found (code)',
  },
  PRODUCT_NOT_FOUND: {
    fr: 'produit introuvable (code SKU)',
    ar: 'المنتج غير موجود (رمز SKU)',
    en: 'product not found (SKU)',
  },
  PARTNER_NOT_FOUND: {
    fr: 'partenaire introuvable (nom, téléphone ou NIF)',
    ar: 'الشريك غير موجود (الاسم أو الهاتف أو NIF)',
    en: 'partner not found (name, phone or NIF)',
  },
  PARTNER_AMBIGUOUS: {
    fr: 'plusieurs partenaires correspondent : utilisez le NIF ou le téléphone',
    ar: 'أكثر من شريك مطابق: استخدم NIF أو الهاتف',
    en: 'several partners match: use the NIF or phone',
  },
  CUSTOMER_AMBIGUOUS: {
    fr: 'plusieurs clients correspondent : utilisez le NIF ou le téléphone',
    ar: 'أكثر من عميل مطابق: استخدم NIF أو الهاتف',
    en: 'several customers match: use the NIF or phone',
  },
  AMOUNT_REQUIRED: {
    fr: 'renseignez un montant au débit ou au crédit',
    ar: 'أدخل مبلغا في المدين أو الدائن',
    en: 'enter an amount in debit or credit',
  },
  PERCENT: {
    fr: 'remise invalide (pourcentage, ex. 5)',
    ar: 'خصم غير صالح (نسبة مئوية، مثال 5)',
    en: 'invalid discount (percentage, e.g. 5)',
  },
  QUOTE_MIXED_HEADER: {
    fr: 'les lignes d\'un même devis doivent avoir le même client et la même date',
    ar: 'يجب أن يكون لأسطر العرض نفسه العميل والتاريخ نفسه',
    en: 'lines of one quote must share the same customer and date',
  },
  ACCOUNT_CODE_TAKEN: {
    fr: 'code de compte déjà utilisé',
    ar: 'رمز الحساب مستخدم مسبقا',
    en: 'account code already used',
  },
  CUSTOMER_NOT_FOUND: {
    fr: 'client introuvable (nom, téléphone ou NIF)',
    ar: 'العميل غير موجود (الاسم أو الهاتف أو NIF)',
    en: 'customer not found (name, phone or NIF)',
  },
};

/** Localized text for one zod issue. Unknown codes fall back to a neutral message. */
export function issueText(issue: IssueLike, locale: IoLocale): string {
  if (issue.code === 'custom' && issue.message && CUSTOM_MESSAGES[issue.message]) {
    return CUSTOM_MESSAGES[issue.message]![locale];
  }
  switch (issue.code) {
    case 'invalid_type':
      // A missing cell arrives as undefined, which is a required field rather than a wrong type.
      return (issue.input === undefined ? REQUIRED : INVALID_TYPE)[locale];
    case 'too_small': return TOO_SMALL[locale];
    case 'too_big': return TOO_BIG[locale];
    case 'invalid_format': return INVALID_FORMAT[locale];
    case 'invalid_value': return INVALID_VALUE[locale];
    default: return UNKNOWN[locale];
  }
}

/** zod v4 error callback for parse calls: { error: issueErrorMap(locale) }. */
export function issueErrorMap(locale: IoLocale): (issue: IssueLike) => string {
  return (issue) => issueText(issue, locale);
}

/** Localized text for an error code returned by a commit step. Unknown codes are returned unchanged. */
export function commitMessageText(code: string, locale: IoLocale): string {
  return CUSTOM_MESSAGES[code]?.[locale] ?? code;
}
