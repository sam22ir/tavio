import type { Locale } from '@/core/ctx';

// Login link email (W16-E). Strings live here because the mail goes out outside any request UI.
const COPY: Record<Locale, { subject: (company: string) => string; body: (company: string, url: string) => string; text: (company: string, url: string) => string }> = {
  fr: {
    subject: (c) => `Connexion à votre espace client ${c}`,
    body: (c, url) => `<p>Bonjour,</p><p>Cliquez sur le lien ci-dessous pour accéder à votre espace client ${c}. Le lien est valable 30 minutes et ne fonctionne qu'une fois.</p><p><a href="${url}">Accéder à mon espace</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
    text: (c, url) => `Bonjour,\n\nAccédez à votre espace client ${c} (valable 30 minutes, usage unique) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  },
  ar: {
    subject: (c) => `تسجيل الدخول إلى فضاء الزبون ${c}`,
    body: (c, url) => `<p>مرحبا،</p><p>انقر على الرابط أدناه للدخول إلى فضاء الزبون ${c}. الرابط صالح لمدة 30 دقيقة ويعمل مرة واحدة فقط.</p><p><a href="${url}">الدخول إلى فضائي</a></p><p>إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>`,
    text: (c, url) => `مرحبا،\n\nادخل إلى فضاء الزبون ${c} (صالح لمدة 30 دقيقة، استعمال واحد):\n${url}\n\nإذا لم تطلب هذا، تجاهل هذه الرسالة.`,
  },
  en: {
    subject: (c) => `Sign in to your ${c} customer space`,
    body: (c, url) => `<p>Hello,</p><p>Use the link below to open your ${c} customer space. The link lasts 30 minutes and works once.</p><p><a href="${url}">Open my space</a></p><p>If you did not ask for this, ignore this message.</p>`,
    text: (c, url) => `Hello,\n\nOpen your ${c} customer space (valid 30 minutes, single use):\n${url}\n\nIf you did not ask for this, ignore this message.`,
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}

export function portalLoginEmail(locale: Locale, company: string, url: string): { subject: string; html: string; text: string } {
  const c = COPY[locale];
  return { subject: c.subject(company), html: c.body(escapeHtml(company), escapeHtml(url)), text: c.text(company, url) };
}
