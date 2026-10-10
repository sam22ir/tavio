import type { Locale } from '@/core/ctx';
import { formatDzd, type Cents } from '@/core/money';

// Shared types and helpers for the printable receipt and contract.
// Print labels live here, not in messages/*/credit.json (W4-E owns that file in Wave 4).

export interface CompanyPrint {
  legalName: string;
  nif: string | null;
  rc: string | null;
  address: string | null;
}

export interface PartnerPrint {
  name: string;
  phone: string | null;
}

const FR_LABELS = {
  receipt: 'Reçu de paiement',
  voided: 'ANNULÉ',
  number: 'N°',
  issuedAt: 'Date d’émission',
  client: 'Client',
  phone: 'Téléphone',
  method: 'Mode de paiement',
  reference: 'Référence',
  contract: 'Contrat',
  total: 'Montant reçu',
  nif: 'NIF',
  rc: 'RC',
  address: 'Adresse',
  signature: 'Signature',
  contractTitle: 'Contrat de vente à crédit',
  startDate: 'Date de début',
  frequency: 'Fréquence',
  monthly: 'Mensuelle',
  weekly: 'Hebdomadaire',
  lines: 'Articles',
  description: 'Désignation',
  quantity: 'Quantité',
  unitPrice: 'Prix unitaire',
  lineTotal: 'Total',
  cashPrice: 'Prix comptant',
  markup: 'Majoration',
  total2: 'Total à payer',
  downPayment: 'Acompte',
  financed: 'Montant financé',
  schedule: 'Échéancier',
  seq: 'N°',
  dueDate: 'Échéance',
  amount: 'Montant',
  terms: 'Conditions',
  guarantorSignature: 'Le garant',
  sellerSignature: 'Le vendeur',
  buyerSignature: 'L’acheteur',
  printButton: 'Imprimer',
  pdfButton: 'Télécharger le PDF',
};

const AR_LABELS = {
  receipt: 'وصل دفع',
  voided: 'ملغى',
  number: 'رقم',
  issuedAt: 'تاريخ الإصدار',
  client: 'الزبون',
  phone: 'الهاتف',
  method: 'طريقة الدفع',
  reference: 'المرجع',
  contract: 'العقد',
  total: 'المبلغ المستلم',
  nif: 'رقم التعريف الجبائي',
  rc: 'السجل التجاري',
  address: 'العنوان',
  signature: 'التوقيع',
  contractTitle: 'عقد بيع بالتقسيط',
  startDate: 'تاريخ البداية',
  frequency: 'الدورية',
  monthly: 'شهرية',
  weekly: 'أسبوعية',
  lines: 'المواد',
  description: 'البيان',
  quantity: 'الكمية',
  unitPrice: 'سعر الوحدة',
  lineTotal: 'المجموع',
  cashPrice: 'السعر نقدا',
  markup: 'الزيادة',
  total2: 'المبلغ الإجمالي',
  downPayment: 'الدفعة الأولى',
  financed: 'المبلغ الممول',
  schedule: 'جدول الأقساط',
  seq: 'رقم',
  dueDate: 'تاريخ الاستحقاق',
  amount: 'المبلغ',
  terms: 'الشروط',
  guarantorSignature: 'الكفيل',
  sellerSignature: 'البائع',
  buyerSignature: 'المشتري',
  printButton: 'طباعة',
  pdfButton: 'تحميل PDF',
};

const EN_LABELS = {
  receipt: 'Payment receipt',
  voided: 'VOID',
  number: 'No.',
  issuedAt: 'Issued on',
  client: 'Client',
  phone: 'Phone',
  method: 'Payment method',
  reference: 'Reference',
  contract: 'Contract',
  total: 'Amount received',
  nif: 'NIF',
  rc: 'RC',
  address: 'Address',
  signature: 'Signature',
  contractTitle: 'Credit sale contract',
  startDate: 'Start date',
  frequency: 'Frequency',
  monthly: 'Monthly',
  weekly: 'Weekly',
  lines: 'Items',
  description: 'Description',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  lineTotal: 'Total',
  cashPrice: 'Cash price',
  markup: 'Markup',
  total2: 'Total payable',
  downPayment: 'Down payment',
  financed: 'Financed amount',
  schedule: 'Payment schedule',
  seq: 'No.',
  dueDate: 'Due date',
  amount: 'Amount',
  terms: 'Terms',
  guarantorSignature: 'Guarantor',
  sellerSignature: 'Seller',
  buyerSignature: 'Buyer',
  printButton: 'Print',
  pdfButton: 'Download PDF',
};

type Labels = typeof FR_LABELS;

const LABELS: Record<Locale, Labels> = { fr: FR_LABELS, ar: AR_LABELS, en: EN_LABELS };

export function labels(locale: Locale): Labels {
  return LABELS[locale] ?? LABELS.fr;
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function money(c: Cents, locale: Locale): string {
  return formatDzd(c, locale);
}

export function formatDate(value: Date | string, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat(`${locale}-DZ`, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Africa/Algiers',
  }).format(date);
}

/** Pure: true for article headings such as "Article 3 - ..." or "المادة 3 - ...", which print in bold. */
export function isClauseTitle(line: string): boolean {
  return /^(Article \d+|المادة \d+)/.test(line);
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const METHOD_LABELS: Record<string, Record<Locale, string>> = {
  cash: { fr: 'Espèces', ar: 'نقدًا', en: 'Cash' },
  ccp: { fr: 'CCP', ar: 'CCP', en: 'CCP' },
  transfer: { fr: 'Virement', ar: 'تحويل بنكي', en: 'Bank transfer' },
  cib: { fr: 'CIB', ar: 'CIB', en: 'CIB' },
  edahabia: { fr: 'Edahabia', ar: 'Edahabia', en: 'Edahabia' },
  cheque: { fr: 'Chèque', ar: 'شيك', en: 'Cheque' },
};

/** Human label for a stored payment method. Unknown values are shown escaped as-is. */
export function methodLabel(method: string, locale: Locale): string {
  return METHOD_LABELS[method]?.[locale] ?? method;
}
