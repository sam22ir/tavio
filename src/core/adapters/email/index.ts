import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface EmailMessage { to: string; subject: string; html: string; text: string; replyTo?: string }

const RESEND_URL = 'https://api.resend.com/emails';

// Workers bindings first (when running on Cloudflare), then process.env (Node, tests, local dev).
function readEnv(name: string): string | undefined {
  try {
    const fromWorker = (getCloudflareContext({ async: false }).env as Record<string, string | undefined>)[name];
    if (fromWorker) return fromWorker;
  } catch {
    // Not running on Workers.
  }
  return process.env[name] || undefined;
}

/** True when RESEND_API_KEY and EMAIL_FROM are set. */
export function emailConfigured(): boolean {
  return Boolean(readEnv('RESEND_API_KEY') && readEnv('EMAIL_FROM'));
}

/** Hides most of an address for logs: a***@example.com */
function redacted(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}

/** Sends through Resend; when not configured, logs a redacted line and returns { sent: false }. Never throws. */
export async function sendEmail(m: EmailMessage): Promise<{ sent: boolean; id?: string; error?: string }> {
  const apiKey = readEnv('RESEND_API_KEY');
  const from = readEnv('EMAIL_FROM');
  if (!apiKey || !from) {
    console.info('[email] not configured; would send', m.subject, '→', redacted(m.to));
    return { sent: false };
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: m.to, subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { sent: false, error: `Resend ${res.status}: ${data.message ?? 'request failed'}` };
    }
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'network error' };
  }
}
