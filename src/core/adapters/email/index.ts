// STUB owned by W6-A. Signatures are frozen.
export interface EmailMessage { to: string; subject: string; html: string; text: string; replyTo?: string }
/** True when RESEND_API_KEY and EMAIL_FROM are set. */
export function emailConfigured(): boolean { throw new Error('not implemented'); }
/** Sends through Resend; when not configured, logs a redacted line and returns { sent: false }. Never throws. */
export async function sendEmail(_m: EmailMessage): Promise<{ sent: boolean; id?: string; error?: string }> { throw new Error('not implemented'); }
