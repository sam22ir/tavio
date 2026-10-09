export type EmailLocale = 'fr' | 'ar' | 'en';
export interface EmailContent { subject: string; html: string; text: string }

const LOCALES: readonly EmailLocale[] = ['fr', 'ar', 'en'];

interface Copy {
  greeting: string;
  resetSubject: string;
  resetBody: string;
  resetCta: string;
  resetIgnore: string;
  verifySubject: string;
  verifyBody: string;
  verifyCta: string;
  verifyIgnore: string;
  inviteSubject: (inviter: string, company: string) => string;
  inviteBody: (inviter: string, company: string) => string;
  inviteCta: string;
  inviteIgnore: string;
  footer: string;
}

const COPY: Record<EmailLocale, Copy> = {
  fr: {
    greeting: 'Bonjour,',
    resetSubject: 'Réinitialisez votre mot de passe Revora',
    resetBody: 'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
    resetCta: 'Réinitialiser le mot de passe',
    resetIgnore: 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet e-mail. Votre mot de passe reste inchangé.',
    verifySubject: 'Confirmez votre adresse e-mail',
    verifyBody: 'Merci de vous être inscrit sur Revora. Confirmez votre adresse e-mail pour activer votre compte.',
    verifyCta: 'Confirmer mon e-mail',
    verifyIgnore: 'Si vous n\'avez pas créé de compte, ignorez cet e-mail.',
    inviteSubject: (inviter, company) => `${inviter} vous invite à rejoindre ${company} sur Revora`,
    inviteBody: (inviter, company) => `${inviter} vous invite à rejoindre l'équipe de ${company} sur Revora.`,
    inviteCta: 'Accepter l\'invitation',
    inviteIgnore: 'Si vous ne connaissez pas cette entreprise, ignorez cet e-mail.',
    footer: 'Revora · Gérez votre entreprise, simplement.',
  },
  ar: {
    greeting: 'مرحباً،',
    resetSubject: 'إعادة تعيين كلمة المرور في Revora',
    resetBody: 'لقد طلبت إعادة تعيين كلمة المرور. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.',
    resetCta: 'إعادة تعيين كلمة المرور',
    resetIgnore: 'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة. لن تتغير كلمة المرور الحالية.',
    verifySubject: 'أكّد عنوان بريدك الإلكتروني',
    verifyBody: 'شكراً لتسجيلك في Revora. أكّد عنوان بريدك الإلكتروني لتفعيل حسابك.',
    verifyCta: 'تأكيد البريد الإلكتروني',
    verifyIgnore: 'إذا لم تُنشئ حساباً، يمكنك تجاهل هذه الرسالة.',
    inviteSubject: (inviter, company) => `${inviter} يدعوك للانضمام إلى ${company} على Revora`,
    inviteBody: (inviter, company) => `${inviter} يدعوك للانضمام إلى فريق ${company} على Revora.`,
    inviteCta: 'قبول الدعوة',
    inviteIgnore: 'إذا كنت لا تعرف هذه الشركة، يمكنك تجاهل هذه الرسالة.',
    footer: 'Revora · أدر أعمالك بكل بساطة.',
  },
  en: {
    greeting: 'Hello,',
    resetSubject: 'Reset your Revora password',
    resetBody: 'You asked to reset your password. Click the button below to choose a new one.',
    resetCta: 'Reset password',
    resetIgnore: 'If you did not ask for this, you can ignore this email. Your password will not change.',
    verifySubject: 'Verify your email address',
    verifyBody: 'Thanks for signing up for Revora. Verify your email address to activate your account.',
    verifyCta: 'Verify email',
    verifyIgnore: 'If you did not create an account, you can ignore this email.',
    inviteSubject: (inviter, company) => `${inviter} invited you to join ${company} on Revora`,
    inviteBody: (inviter, company) => `${inviter} invited you to join the ${company} team on Revora.`,
    inviteCta: 'Accept invitation',
    inviteIgnore: 'If you do not know this company, you can ignore this email.',
    footer: 'Revora · Run your business, simply.',
  },
};

function resolveLocale(locale: string | undefined): EmailLocale {
  return LOCALES.includes(locale as EmailLocale) ? (locale as EmailLocale) : 'fr';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Shared inline-styled layout: one button, a plain-link fallback, and the footer. */
function render(locale: EmailLocale, lead: string, body: string, cta: string, url: string, ignore: string): EmailContent {
  const c = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = locale === 'ar' ? 'right' : 'left';
  const safeUrl = escapeHtml(url);
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:24px;background:#f6f6f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;text-align:${align};">
<p style="margin:0 0 16px;font-size:16px;">${escapeHtml(c.greeting)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(body)}</p>
<p style="margin:24px 0;text-align:center;"><a href="${safeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;">${escapeHtml(cta)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all;">${safeUrl}</p>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${escapeHtml(ignore)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">${escapeHtml(c.footer)}</p>
</div>
</body>
</html>`;
  const text = [c.greeting, '', body, '', `${cta}: ${url}`, '', ignore, '', c.footer].join('\n');
  return { subject: lead, html, text };
}

export function resetPasswordEmail({ locale, url }: { locale: string; url: string }): EmailContent {
  const l = resolveLocale(locale);
  const c = COPY[l];
  return render(l, c.resetSubject, c.resetBody, c.resetCta, url, c.resetIgnore);
}

export function verifyEmailEmail({ locale, url }: { locale: string; url: string }): EmailContent {
  const l = resolveLocale(locale);
  const c = COPY[l];
  return render(l, c.verifySubject, c.verifyBody, c.verifyCta, url, c.verifyIgnore);
}

export function invitationEmail({
  locale,
  companyName,
  inviterName,
  url,
}: {
  locale: string;
  companyName: string;
  inviterName: string;
  url: string;
}): EmailContent {
  const l = resolveLocale(locale);
  const c = COPY[l];
  return render(
    l,
    c.inviteSubject(inviterName, companyName),
    c.inviteBody(inviterName, companyName),
    c.inviteCta,
    url,
    c.inviteIgnore,
  );
}
