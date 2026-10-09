import type { EmailMessage } from '@/core/adapters/email';
import { contactSchema, HONEYPOT_FIELD, type ContactType } from './schema';

/** French labels for each request type, used in the team email and its subject. */
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  audit: 'Audit gratuit',
  demo: 'Démo de la plateforme',
  services: 'Services',
  other: 'Autre',
};
import type { RateLimiter } from './rate-limit';

export type ContactOutcome =
  | { status: 'sent' }
  | { status: 'invalid'; fieldErrors: Record<string, true> }
  | { status: 'rate_limited' }
  | { status: 'error' };

export interface ContactDeps {
  send: (m: EmailMessage) => Promise<{ sent: boolean; error?: string }>;
  limiter: RateLimiter;
  /** Destination inbox: CONTACT_EMAIL, falling back to EMAIL_FROM. */
  recipient: string | undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Handles one contact submission. Order matters:
 * 1. honeypot: a filled hidden field gets a silent success and nothing is sent,
 * 2. rate limit: every real attempt counts, valid or not,
 * 3. zod validation,
 * 4. email to the team.
 */
export async function processContact(input: Record<string, unknown>, ip: string, deps: ContactDeps): Promise<ContactOutcome> {
  if (typeof input[HONEYPOT_FIELD] === 'string' && input[HONEYPOT_FIELD].trim() !== '') {
    return { status: 'sent' };
  }

  if (!deps.limiter.take(ip)) {
    return { status: 'rate_limited' };
  }

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, true> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? 'message');
      fieldErrors[field] = true;
    }
    return { status: 'invalid', fieldErrors };
  }

  if (!deps.recipient) {
    return { status: 'error' };
  }

  const data = parsed.data;
  const typeLabel = CONTACT_TYPE_LABELS[data.type];
  const rows: [string, string][] = [
    ['Motif', typeLabel],
    ['Nom', data.name],
    ['Entreprise', data.company || '-'],
    ['Téléphone', data.phone],
    ['E-mail', data.email],
    ['Wilaya', data.wilaya],
  ];
  const text = [...rows.map(([k, v]) => `${k} : ${v}`), '', data.message].join('\n');
  const html = `<table>${rows
    .map(([k, v]) => `<tr><th align="left">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('')}</table><p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`;

  const result = await deps.send({
    to: deps.recipient,
    subject: `Nouveau contact Revora [${typeLabel}] : ${data.company || data.name}`,
    html,
    text,
    replyTo: data.email,
  });

  return result.sent ? { status: 'sent' } : { status: 'error' };
}
