// Pure message templates: defaults (fr, ar), {variable} rendering, HTML conversion and footers. No DB, no IO.

export const TEMPLATE_KEYS = [
  'quote_sent',
  'invoice_sent',
  'contract_sent',
  'payment_receipt',
  'installment_reminder_before',
  'installment_overdue',
  'portal_invite',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export type MessageLocale = 'fr' | 'ar';
export interface TemplateCopy { subject: string; body: string }

/** Variables each template may use. {link} is the portal link created at send time. */
export const TEMPLATE_VARIABLES: Record<TemplateKey, readonly string[]> = {
  quote_sent: ['partner', 'company', 'number', 'amount', 'link'],
  invoice_sent: ['partner', 'company', 'number', 'amount', 'due_date', 'link'],
  contract_sent: ['partner', 'company', 'number', 'amount', 'link'],
  payment_receipt: ['partner', 'company', 'number', 'amount', 'link'],
  installment_reminder_before: ['partner', 'company', 'number', 'amount', 'due_date', 'days', 'link'],
  installment_overdue: ['partner', 'company', 'number', 'amount', 'due_date', 'days', 'link'],
  portal_invite: ['partner', 'company', 'link'],
};

export const DEFAULT_TEMPLATES: Record<TemplateKey, Record<MessageLocale, TemplateCopy>> = {
  quote_sent: {
    fr: {
      subject: 'Votre devis {number} de {company}',
      body: 'Bonjour {partner},\n\nVeuillez trouver votre devis {number} d\'un montant de {amount}.\nConsultez-le et suivez vos documents dans votre espace client :\n{link}\n\nCordialement,\n{company}',
    },
    ar: {
      subject: 'عرض الأسعار {number} من {company}',
      body: 'مرحبا {partner}،\n\nعرض الأسعار {number} بمبلغ {amount}.\nيمكنك الاطلاع عليه في فضاء الزبون:\n{link}\n\nمع التحية،\n{company}',
    },
  },
  invoice_sent: {
    fr: {
      subject: 'Facture {number} de {company}',
      body: 'Bonjour {partner},\n\nVotre facture {number} d\'un montant de {amount} est disponible (échéance : {due_date}).\nConsultez-la dans votre espace client :\n{link}\n\nCordialement,\n{company}',
    },
    ar: {
      subject: 'الفاتورة {number} من {company}',
      body: 'مرحبا {partner}،\n\nفاتورتكم {number} بمبلغ {amount} متوفرة (تاريخ الاستحقاق: {due_date}).\nيمكنكم الاطلاع عليها في فضاء الزبون:\n{link}\n\nمع التحية،\n{company}',
    },
  },
  contract_sent: {
    fr: {
      subject: 'Votre contrat de vente à crédit {number}',
      body: 'Bonjour {partner},\n\nVotre contrat {number} d\'un montant total de {amount} est prêt.\nConsultez-le dans votre espace client :\n{link}\n\nCordialement,\n{company}',
    },
    ar: {
      subject: 'عقد البيع بالتقسيط {number}',
      body: 'مرحبا {partner}،\n\nعقدكم {number} بمبلغ إجمالي {amount} جاهز.\nيمكنكم الاطلاع عليه في فضاء الزبون:\n{link}\n\nمع التحية،\n{company}',
    },
  },
  payment_receipt: {
    fr: {
      subject: 'Reçu de paiement {number}',
      body: 'Bonjour {partner},\n\nNous confirmons la réception de votre paiement de {amount}. Reçu n° {number}.\nRetrouvez vos reçus dans votre espace client :\n{link}\n\nMerci,\n{company}',
    },
    ar: {
      subject: 'إيصال الدفع {number}',
      body: 'مرحبا {partner}،\n\nنؤكد استلام دفعتكم بمبلغ {amount}. الإيصال رقم {number}.\nيمكنكم الاطلاع على إيصالاتكم في فضاء الزبون:\n{link}\n\nشكرا لكم،\n{company}',
    },
  },
  installment_reminder_before: {
    fr: {
      subject: 'Rappel : échéance dans {days} jours ({number})',
      body: 'Bonjour {partner},\n\nUne échéance de {amount} sur votre contrat {number} arrive à terme le {due_date}, dans {days} jours.\nVotre espace client :\n{link}\n\nCordialement,\n{company}',
    },
    ar: {
      subject: 'تذكير: استحقاق بعد {days} أيام ({number})',
      body: 'مرحبا {partner}،\n\nيستحق مبلغ {amount} من عقدكم {number} بتاريخ {due_date}، أي بعد {days} أيام.\nفضاء الزبون:\n{link}\n\nمع التحية،\n{company}',
    },
  },
  installment_overdue: {
    fr: {
      subject: 'Échéance en retard de {days} jour(s) ({number})',
      body: 'Bonjour {partner},\n\nUne échéance de {amount} sur votre contrat {number} (échue le {due_date}) n\'est pas encore réglée.\nVotre espace client :\n{link}\n\nCordialement,\n{company}',
    },
    ar: {
      subject: 'استحقاق متأخر بمدة {days} يوم ({number})',
      body: 'مرحبا {partner}،\n\nلم يتم تسديد مبلغ {amount} من عقدكم {number} (المستحق بتاريخ {due_date}).\nفضاء الزبون:\n{link}\n\nمع التحية،\n{company}',
    },
  },
  portal_invite: {
    fr: {
      subject: 'Accédez à votre espace client {company}',
      body: 'Bonjour {partner},\n\n{company} vous invite à consulter vos documents dans votre espace client :\n{link}\n\nCordialement,\n{company}',
    },
    ar: {
      subject: 'ادخلوا إلى فضاء الزبون {company}',
      body: 'مرحبا {partner}،\n\nتدعوكم {company} للاطلاع على وثائقكم في فضاء الزبون:\n{link}\n\nمع التحية،\n{company}',
    },
  },
};

export function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

/** Partner emails use the company default locale: ar when the company is Arabic, otherwise fr. */
export function messageLocaleFor(companyLocale: string): MessageLocale {
  return companyLocale === 'ar' ? 'ar' : 'fr';
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}

/** Replaces {name} with vars[name]. Unknown placeholders are left as written. Pure. */
export function renderText(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{([a-z_]+)\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

/** Plain text to HTML: escaped, blank lines become paragraphs, single newlines become <br>. Links are auto-anchored. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`)
    .join('');
}

export interface RenderedMessage { subject: string; text: string; html: string }

/** Renders a template copy with variables. The subject is plain text; the body is converted to HTML. */
export function renderMessage(copy: TemplateCopy, vars: Record<string, string | number | undefined>): RenderedMessage {
  const text = renderText(copy.body, vars);
  return { subject: renderText(copy.subject, vars), text, html: textToHtml(text) };
}

const FOOTER: Record<MessageLocale, { line: (url: string) => string; label: string }> = {
  fr: { label: 'Se désabonner des e-mails', line: (url) => `Vous ne souhaitez plus recevoir ces e-mails ? ${url}` },
  ar: { label: 'إلغاء الاشتراك', line: (url) => `لا تريد تلقي هذه الرسائل؟ ${url}` },
};

/** Adds an unsubscribe line to a marketing or reminder message. */
export function withUnsubscribe(message: RenderedMessage, url: string, locale: MessageLocale): RenderedMessage {
  const f = FOOTER[locale];
  return {
    ...message,
    text: `${message.text}\n\n${f.line(url)}`,
    html: `${message.html}<p style="font-size:12px;color:#666"><a href="${url}">${f.label}</a></p>`,
  };
}

/** Sample values for the live preview on the settings page. */
export const SAMPLE_VARS: Record<string, string> = {
  partner: 'Ahmed Benali',
  company: 'Ma Société',
  number: 'DEV-00042',
  amount: '125 000,00 DA',
  due_date: '2026-11-01',
  days: '3',
  link: 'https://example.com/portal/...',
};

/** Variables used in text that the template key does not allow. Pure. */
export function findUnknownVariables(key: TemplateKey, text: string): string[] {
  const allowed = new Set<string>(TEMPLATE_VARIABLES[key]);
  const found = new Set<string>();
  for (const m of text.matchAll(/\{([a-z_]+)\}/g)) {
    if (!allowed.has(m[1] ?? '')) found.add(m[1] ?? '');
  }
  return [...found];
}
