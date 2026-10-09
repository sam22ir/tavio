import { describe, expect, it } from 'vitest';
import { invitationEmail, resetPasswordEmail, verifyEmailEmail } from './emails';

const url = 'https://app.example.com/ar/reset-password?token=abc';

describe('auth email templates', () => {
  it.each(['fr', 'ar', 'en'] as const)('renders the reset email in %s', (locale) => {
    const mail = resetPasswordEmail({ locale, url });
    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.html).toContain(`lang="${locale}"`);
    expect(mail.html).toContain(url.replace(/&/g, '&amp;'));
    expect(mail.text).toContain(url);
  });

  it('uses rtl direction for Arabic only', () => {
    expect(resetPasswordEmail({ locale: 'ar', url }).html).toContain('dir="rtl"');
    expect(resetPasswordEmail({ locale: 'en', url }).html).toContain('dir="ltr"');
  });

  it('falls back to French for an unknown locale', () => {
    expect(resetPasswordEmail({ locale: 'de', url }).html).toContain('lang="fr"');
  });

  it('renders the verification email with its link', () => {
    const mail = verifyEmailEmail({ locale: 'en', url });
    expect(mail.subject).toBe('Verify your email address');
    expect(mail.html).toContain(url);
  });

  it('escapes company and inviter names in the invitation', () => {
    const mail = invitationEmail({
      locale: 'en',
      companyName: '<b>Acme</b>',
      inviterName: 'Sam & Co',
      url,
    });
    expect(mail.html).not.toContain('<b>Acme</b>');
    expect(mail.html).toContain('&lt;b&gt;Acme&lt;/b&gt;');
    expect(mail.subject).toBe('Sam & Co invited you to join <b>Acme</b> on Revora');
  });

  it('renders the invitation in Arabic with rtl', () => {
    const mail = invitationEmail({ locale: 'ar', companyName: 'شركة', inviterName: 'سامي', url });
    expect(mail.subject).toContain('شركة');
    expect(mail.html).toContain('dir="rtl"');
  });
});
